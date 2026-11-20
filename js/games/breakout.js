(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;
  const ROW_COLORS = ['#ef4444', '#f97316', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'];
  const ROW_POINTS = [70, 60, 50, 40, 30, 20];

  Atari.games.push({
    id: 'breakout',
    title: 'BREAKOUT',
    year: 1976,
    originalPlayers: '1P / Alternating',
    upgradeNote: 'Upgraded to Simultaneous 2-Paddle & Dual-Ball Co-op!',
    upgraded: true,
    mode: 'CO-OP',
    accent: '#f97316',
    controls: {
      p1: 'A / D Move Paddle • SPACE Launch',
      p2: '← / → Move Paddle • ENTER Launch'
    },

    drawThumbnail(ctx, w, h) {
      ctx.fillStyle = '#08070d';
      ctx.fillRect(0, 0, w, h);
      const cols = 8;
      const bw = (w - 24) / cols;
      for (let r = 0; r < 5; r++) {
        ctx.fillStyle = ROW_COLORS[r];
        for (let c = 0; c < cols; c++) {
          if (r === 4 && (c === 3 || c === 4)) continue;
          ctx.fillRect(12 + c * bw + 1, 18 + r * 12, bw - 2, 9);
        }
      }
      // Two balls
      ctx.fillStyle = '#38e8ff';
      ctx.beginPath(); ctx.arc(w * 0.36, h * 0.62, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb830';
      ctx.beginPath(); ctx.arc(w * 0.64, h * 0.56, 4, 0, Math.PI * 2); ctx.fill();
      // Two paddles
      ctx.fillStyle = '#38e8ff';
      ctx.fillRect(w * 0.16, h - 22, 48, 7);
      ctx.fillStyle = '#ffb830';
      ctx.fillRect(w * 0.6, h - 32, 48, 7);
    },

    create(engine) {
      const state = {
        level: 1,
        gameOver: false,
        bricks: [],
        particles: [],
        players: [
          { id: 1, x: W * 0.3, y: H - 34, w: 108, h: 14, color: '#38e8ff', score: 0, lives: 3 },
          { id: 2, x: W * 0.7, y: H - 56, w: 108, h: 14, color: '#ffb830', score: 0, lives: 3 }
        ],
        balls: []
      };

      function buildBricks() {
        state.bricks = [];
        const cols = 12;
        const rows = 6;
        const marginX = 34;
        const gap = 5;
        const bw = (W - marginX * 2 - gap * (cols - 1)) / cols;
        const bh = 22;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            state.bricks.push({
              x: marginX + c * (bw + gap),
              y: 62 + r * (bh + gap),
              w: bw,
              h: bh,
              color: ROW_COLORS[r],
              pts: ROW_POINTS[r],
              alive: true
            });
          }
        }
      }

      function spawnBallFor(p) {
        const angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2;
        const speed = 340 + (state.level - 1) * 26;
        state.balls.push({
          owner: p.id,
          color: p.color,
          x: p.x,
          y: p.y - 14,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 7,
          stuck: true
        });
      }

      function resetBalls() {
        state.balls = [];
        state.players.forEach((p) => {
          if (p.lives > 0) spawnBallFor(p);
        });
      }

      function burst(x, y, color) {
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 50 + Math.random() * 140;
          state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, color });
        }
      }

      function botControl(p) {
        const out = { left: false, right: false, firePressed: false };
        const ownStuck = state.balls.find((b) => b.owner === p.id && b.stuck);
        if (ownStuck) {
          out.firePressed = true;
          return out;
        }
        // Track lowest descending ball
        let target = null;
        let bestY = -1;
        for (const b of state.balls) {
          if (b.vy > 0 && b.y > bestY) { bestY = b.y; target = b; }
        }
        if (!target && state.balls.length > 0) target = state.balls[0];
        if (target) {
          if (target.x < p.x - 10) out.left = true;
          else if (target.x > p.x + 10) out.right = true;
        }
        return out;
      }

      buildBricks();
      resetBalls();

      return {
        update(dt, input) {
          if (state.gameOver) return;

          // Move paddles
          state.players.forEach((p, idx) => {
            if (p.lives <= 0) return;
            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(p) : input.p2);
            const spd = 460;
            if (ctrl.left) p.x -= spd * dt;
            if (ctrl.right) p.x += spd * dt;
            p.x = Math.max(p.w / 2 + 8, Math.min(W - p.w / 2 - 8, p.x));

            if (ctrl.firePressed || ctrl.fire) {
              for (const b of state.balls) {
                if (b.owner === p.id && b.stuck) {
                  b.stuck = false;
                  engine.audio.pong(true);
                }
              }
            }
          });

          // Move balls
          for (let i = state.balls.length - 1; i >= 0; i--) {
            const b = state.balls[i];
            const ownerPlayer = state.players.find((pl) => pl.id === b.owner);
            if (b.stuck) {
              if (ownerPlayer) {
                b.x = ownerPlayer.x;
                b.y = ownerPlayer.y - 14;
              }
              continue;
            }

            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // Wall bounces
            if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); engine.audio.pong(false); }
            if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); engine.audio.pong(false); }
            if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); engine.audio.pong(false); }

            // Either player's paddle can bounce ANY ball (true co-op!)
            for (const p of state.players) {
              if (p.lives <= 0) continue;
              if (
                b.vy > 0 &&
                b.y + b.r >= p.y - p.h / 2 &&
                b.y - b.r <= p.y + p.h / 2 &&
                b.x >= p.x - p.w / 2 - 4 &&
                b.x <= p.x + p.w / 2 + 4
              ) {
                const offset = (b.x - p.x) / (p.w / 2);
                const spd = Math.min(590, Math.hypot(b.vx, b.vy) * 1.02);
                const bounceAng = offset * 1.15 - Math.PI / 2;
                b.vx = Math.cos(bounceAng) * spd;
                b.vy = -Math.abs(Math.sin(bounceAng) * spd);
                b.y = p.y - p.h / 2 - b.r - 1;
                b.owner = p.id;
                b.color = p.color;
                engine.audio.pong(true);
                break;
              }
            }

            // Brick collisions
            for (const br of state.bricks) {
              if (!br.alive) continue;
              if (
                b.x + b.r > br.x && b.x - b.r < br.x + br.w &&
                b.y + b.r > br.y && b.y - b.r < br.y + br.h
              ) {
                br.alive = false;
                const overlapX = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
                const overlapY = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
                if (overlapX < overlapY) b.vx *= -1;
                else b.vy *= -1;

                const scorer = state.players.find((pl) => pl.id === b.owner);
                if (scorer) scorer.score += br.pts;
                burst(br.x + br.w / 2, br.y + br.h / 2, br.color);
                engine.audio.hit();
                break;
              }
            }

            // Fell off bottom
            if (b.y - b.r > H) {
              if (ownerPlayer) {
                ownerPlayer.lives = Math.max(0, ownerPlayer.lives - 1);
                engine.audio.explode(false);
                state.balls.splice(i, 1);
                if (ownerPlayer.lives > 0) spawnBallFor(ownerPlayer);
              } else {
                state.balls.splice(i, 1);
              }
            }
          }

          // Particles
          for (let i = state.particles.length - 1; i >= 0; i--) {
            const pt = state.particles[i];
            pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
            if (pt.life <= 0) state.particles.splice(i, 1);
          }

          // Level cleared!
          if (state.bricks.every((br) => !br.alive)) {
            state.level += 1;
            state.players.forEach((p) => { if (p.lives === 0) p.lives = 1; });
            engine.audio.powerup();
            buildBricks();
            resetBalls();
          }

          if (state.players.every((p) => p.lives <= 0) || state.balls.length === 0) {
            state.gameOver = true;
            engine.audio.gameOver();
          }
        },

        render(ctx) {
          ctx.fillStyle = '#08070d';
          ctx.fillRect(0, 0, W, H);

          // Bricks
          for (const br of state.bricks) {
            if (!br.alive) continue;
            ctx.fillStyle = br.color;
            ctx.fillRect(br.x, br.y, br.w, br.h);
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(br.x, br.y, br.w, 4);
          }

          // Paddles (staggered Y slightly so players never collide/block each other!)
          for (const p of state.players) {
            if (p.lives <= 0) continue;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(p.x - p.w / 2 + 4, p.y - p.h / 2 + 2, p.w - 8, 3);
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#08070d';
            ctx.fillText(`P${p.id}`, p.x, p.y + 4);
          }

          // Balls
          for (const b of state.balls) {
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(b.x - 2, b.y - 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Launch prompt if any ball is stuck
          if (state.balls.some((b) => b.stuck)) {
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = 'bold 15px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PRESS SPACE (P1) / ENTER (P2) TO LAUNCH BALLS!', W / 2, H / 2 + 60);
          }

          for (const pt of state.particles) {
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
          }
        },

        getHud() {
          const p1 = state.players[0];
          const p2 = state.players[1];
          const total = p1.score + p2.score;
          return {
            p1Score: p1.score,
            p2Score: p2.score,
            p1Lives: p1.lives,
            p2Lives: p2.lives,
            levelText: `WALL ${state.level}`,
            highCandidate: total,
            gameOver: state.gameOver,
            overTitle: 'WALL HOLDS',
            overMessage: `WALL ${state.level}\nP1: ${p1.score}  •  P2: ${p2.score}\nTEAM TOTAL: ${total}`
          };
        }
      };
    }
  });
})();
