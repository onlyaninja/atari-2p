(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;
  const WIN_SCORE = 11;

  Atari.games.push({
    id: 'pong',
    title: 'PONG',
    year: 1972,
    originalPlayers: '2P Versus',
    upgradeNote: 'The Original Atari 2P Legend — Angled Physics & First to 11!',
    upgraded: false,
    mode: 'VERSUS',
    accent: '#e2e8f0',
    controls: {
      p1: 'W / S Move Left Paddle',
      p2: '↑ / ↓ Move Right Paddle'
    },

    drawThumbnail(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let y = 10; y < h; y += 16) {
        ctx.fillRect(w / 2 - 2, y, 4, 9);
      }
      ctx.fillStyle = '#38e8ff';
      ctx.fillRect(20, h * 0.28, 8, 44);
      ctx.fillStyle = '#ffb830';
      ctx.fillRect(w - 28, h * 0.44, 8, 44);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w * 0.56, h * 0.42, 8, 8);
    },

    create(engine) {
      const state = {
        gameOver: false,
        winner: null,
        rally: 0,
        serveTimer: 0.7,
        trail: [],
        paddles: [
          { id: 1, x: 42, y: H / 2, w: 14, h: 98, color: '#38e8ff', score: 0 },
          { id: 2, x: W - 42, y: H / 2, w: 14, h: 98, color: '#ffb830', score: 0 }
        ],
        ball: { x: W / 2, y: H / 2, vx: 380, vy: 120, r: 8 }
      };

      function serve(dir) {
        const ang = (Math.random() * 0.7 - 0.35);
        const speed = 390;
        state.ball.x = W / 2;
        state.ball.y = H / 2;
        state.ball.vx = Math.cos(ang) * speed * dir;
        state.ball.vy = Math.sin(ang) * speed;
        state.rally = 0;
        state.trail = [];
        state.serveTimer = 0.65;
      }

      function botControl(p) {
        const out = { up: false, down: false };
        const targetY = state.ball.vx > 0 ? state.ball.y : H / 2;
        if (targetY < p.y - 12) out.up = true;
        else if (targetY > p.y + 12) out.down = true;
        return out;
      }

      serve(Math.random() < 0.5 ? 1 : -1);

      return {
        update(dt, input) {
          if (state.gameOver) return;

          state.paddles.forEach((p, idx) => {
            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(p) : input.p2);
            const spd = 470;
            if (ctrl.up) p.y -= spd * dt;
            if (ctrl.down) p.y += spd * dt;
            p.y = Math.max(p.h / 2 + 12, Math.min(H - p.h / 2 - 12, p.y));
          });

          if (state.serveTimer > 0) {
            state.serveTimer -= dt;
            return;
          }

          const b = state.ball;
          state.trail.push({ x: b.x, y: b.y });
          if (state.trail.length > 10) state.trail.shift();

          b.x += b.vx * dt;
          b.y += b.vy * dt;

          if (b.y - b.r < 10) { b.y = 10 + b.r; b.vy = Math.abs(b.vy); engine.audio.pong(false); }
          if (b.y + b.r > H - 10) { b.y = H - 10 - b.r; b.vy = -Math.abs(b.vy); engine.audio.pong(false); }

          // Paddle collisions
          state.paddles.forEach((p, idx) => {
            const hitX = idx === 0
              ? (b.vx < 0 && b.x - b.r <= p.x + p.w / 2 && b.x + b.r >= p.x - p.w / 2)
              : (b.vx > 0 && b.x + b.r >= p.x - p.w / 2 && b.x - b.r <= p.x + p.w / 2);
            if (hitX && Math.abs(b.y - p.y) <= p.h / 2 + b.r) {
              const rel = Math.max(-1, Math.min(1, (b.y - p.y) / (p.h / 2)));
              state.rally += 1;
              const speed = Math.min(760, Math.hypot(b.vx, b.vy) * 1.06);
              const maxAng = 1.05;
              const ang = rel * maxAng;
              b.vx = Math.cos(ang) * speed * (idx === 0 ? 1 : -1);
              b.vy = Math.sin(ang) * speed;
              b.x = idx === 0 ? p.x + p.w / 2 + b.r + 1 : p.x - p.w / 2 - b.r - 1;
              engine.audio.pong(idx === 0);
            }
          });

          // Scoring
          if (b.x < -16) {
            state.paddles[1].score += 1;
            engine.audio.score();
            if (state.paddles[1].score >= WIN_SCORE) {
              state.gameOver = true; state.winner = 2; engine.audio.powerup();
            } else {
              serve(-1);
            }
          } else if (b.x > W + 16) {
            state.paddles[0].score += 1;
            engine.audio.score();
            if (state.paddles[0].score >= WIN_SCORE) {
              state.gameOver = true; state.winner = 1; engine.audio.powerup();
            } else {
              serve(1);
            }
          }
        },

        render(ctx) {
          ctx.fillStyle = '#06070a';
          ctx.fillRect(0, 0, W, H);

          // Top & bottom court walls
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(0, 6, W, 4);
          ctx.fillRect(0, H - 10, W, 4);

          // Center net
          for (let y = 18; y < H - 18; y += 26) {
            ctx.fillRect(W / 2 - 3, y, 6, 14);
          }

          // Classic big retro score digits on court
          ctx.font = 'bold 72px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(56, 232, 255, 0.22)';
          ctx.fillText(String(state.paddles[0].score), W * 0.28, 105);
          ctx.fillStyle = 'rgba(255, 184, 48, 0.22)';
          ctx.fillText(String(state.paddles[1].score), W * 0.72, 105);

          // Ball trail
          state.trail.forEach((pt, idx) => {
            ctx.fillStyle = `rgba(255, 255, 255, ${(idx + 1) / (state.trail.length * 3)})`;
            ctx.fillRect(pt.x - 6, pt.y - 6, 12, 12);
          });

          // Paddles
          for (const p of state.paddles) {
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = p.color;
            ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
          }

          // Ball
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 12;
          ctx.fillRect(state.ball.x - state.ball.r, state.ball.y - state.ball.r, state.ball.r * 2, state.ball.r * 2);
          ctx.shadowBlur = 0;
        },

        getHud() {
          const p1 = state.paddles[0];
          const p2 = state.paddles[1];
          return {
            p1Score: p1.score,
            p2Score: p2.score,
            p1Lives: state.rally,
            p2Lives: state.rally,
            livesTextP1: `RALLY ${state.rally}`,
            livesTextP2: `FIRST TO ${WIN_SCORE}`,
            levelText: `MATCH TO ${WIN_SCORE}`,
            highCandidate: Math.max(p1.score, p2.score),
            gameOver: state.gameOver,
            overTitle: `PLAYER ${state.winner || 1} WINS!`,
            overMessage: `FINAL SCORE\nP1: ${p1.score}  —  P2: ${p2.score}`
          };
        }
      };
    }
  });
})();
