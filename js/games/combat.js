(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;
  const WIN_SCORE = 10;

  const WALLS = [
    // Border walls
    { x: 0, y: 0, w: W, h: 18 },
    { x: 0, y: H - 18, w: W, h: 18 },
    { x: 0, y: 0, w: 18, h: H },
    { x: W - 18, y: 0, w: 18, h: H },
    // Classic Combat symmetrical brackets & center barriers
    { x: 165, y: 170, w: 22, h: 260 },
    { x: 165, y: 170, w: 72, h: 22 },
    { x: 165, y: 408, w: 72, h: 22 },

    { x: W - 187, y: 170, w: 22, h: 260 },
    { x: W - 237, y: 170, w: 72, h: 22 },
    { x: W - 237, y: 408, w: 72, h: 22 },

    { x: W / 2 - 14, y: 95, w: 28, h: 105 },
    { x: W / 2 - 14, y: H - 200, w: 28, h: 105 },
    { x: W / 2 - 58, y: H / 2 - 14, w: 116, h: 28 }
  ];

  function rectHit(x, y, r, wall) {
    return x + r > wall.x && x - r < wall.x + wall.w && y + r > wall.y && y - r < wall.y + wall.h;
  }

  function drawTank(ctx, t) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.ang);
    ctx.fillStyle = t.color;
    // Treads
    ctx.fillRect(-16, -15, 32, 7);
    ctx.fillRect(-16, 8, 32, 7);
    // Hull
    ctx.fillRect(-13, -9, 24, 18);
    // Turret & barrel
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = t.color;
    ctx.fillRect(4, -3, 18, 6);
    ctx.restore();
  }

  Atari.games.push({
    id: 'combat',
    title: 'COMBAT',
    year: 1977,
    originalPlayers: '2P Versus',
    upgradeNote: 'Classic Atari 2600 2P Ricochet Tank Arena — First to 10!',
    upgraded: false,
    mode: 'VERSUS',
    accent: '#fb923c',
    controls: {
      p1: 'A/D Turn • W/S Drive • SPACE Cannon',
      p2: '←/→ Turn • ↑/↓ Drive • ENTER Cannon'
    },

    drawThumbnail(ctx, w, h) {
      ctx.fillStyle = '#2d3b1e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(0, 0, w, 8);
      ctx.fillRect(0, h - 8, w, 8);
      ctx.fillRect(48, 42, 10, 74);
      ctx.fillRect(w - 58, 42, 10, 74);
      ctx.fillRect(w / 2 - 18, h / 2 - 6, 36, 12);
      // Two tanks
      ctx.save();
      ctx.scale(0.75, 0.75);
      drawTank(ctx, { x: 40, y: h / 1.5, ang: 0, color: '#38e8ff' });
      drawTank(ctx, { x: w / 0.75 - 40, y: h / 1.5, ang: Math.PI, color: '#ffb830' });
      ctx.restore();
      // Ricochet shell
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w * 0.52, h * 0.3, 3.5, 0, Math.PI * 2); ctx.fill();
    },

    create(engine) {
      const state = {
        time: 0,
        gameOver: false,
        winner: null,
        shells: [],
        particles: [],
        tanks: [
          { id: 1, x: 84, y: H / 2, ang: 0, color: '#38e8ff', score: 0, cooldown: 0, spinTimer: 0 },
          { id: 2, x: W - 84, y: H / 2, ang: Math.PI, color: '#ffb830', score: 0, cooldown: 0, spinTimer: 0 }
        ]
      };

      function burst(x, y, color) {
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 50 + Math.random() * 170;
          state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, color });
        }
      }

      function botControl(t, enemy) {
        const out = { left: false, right: false, up: false, down: false, fire: false };
        const desired = Math.atan2(enemy.y - t.y, enemy.x - t.x);
        let diff = desired - t.ang;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (diff < -0.14) out.left = true;
        else if (diff > 0.14) out.right = true;
        if (Math.hypot(enemy.x - t.x, enemy.y - t.y) > 170) out.up = true;
        if (Math.abs(diff) < 0.35) out.fire = true;
        return out;
      }

      return {
        update(dt, input) {
          if (state.gameOver) return;
          state.time += dt;

          state.tanks.forEach((t, idx) => {
            if (t.cooldown > 0) t.cooldown -= dt;
            if (t.spinTimer > 0) {
              t.spinTimer -= dt;
              t.ang += 14 * dt;
              return;
            }
            const enemy = state.tanks[1 - idx];
            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(t, enemy) : input.p2);
            if (ctrl.left) t.ang -= 3.1 * dt;
            if (ctrl.right) t.ang += 3.1 * dt;

            let move = 0;
            if (ctrl.up) move += 155;
            if (ctrl.down) move -= 110;
            if (move !== 0) {
              const nx = t.x + Math.cos(t.ang) * move * dt;
              const ny = t.y + Math.sin(t.ang) * move * dt;
              if (!WALLS.some((w) => rectHit(nx, t.y, 16, w))) t.x = nx;
              if (!WALLS.some((w) => rectHit(t.x, ny, 16, w))) t.y = ny;
            }

            if (ctrl.fire && t.cooldown <= 0) {
              t.cooldown = 0.55;
              state.shells.push({
                x: t.x + Math.cos(t.ang) * 24,
                y: t.y + Math.sin(t.ang) * 24,
                vx: Math.cos(t.ang) * 390,
                vy: Math.sin(t.ang) * 390,
                bounces: 2,
                owner: t.id,
                color: t.color,
                life: 3.0
              });
              engine.audio.shoot(idx === 0 ? 320 : 260);
            }
          });

          // Shells with Tank-Pong ricochet!
          for (let i = state.shells.length - 1; i >= 0; i--) {
            const s = state.shells[i];
            s.life -= dt;
            if (s.life <= 0) { state.shells.splice(i, 1); continue; }

            const nx = s.x + s.vx * dt;
            const ny = s.y + s.vy * dt;
            let hitX = WALLS.some((w) => rectHit(nx, s.y, 4, w));
            let hitY = WALLS.some((w) => rectHit(s.x, ny, 4, w));

            if (hitX || hitY) {
              if (s.bounces > 0) {
                if (hitX) s.vx *= -1;
                if (hitY) s.vy *= -1;
                s.bounces -= 1;
                engine.audio.pong(true);
              } else {
                burst(s.x, s.y, '#fef08a');
                state.shells.splice(i, 1);
                continue;
              }
            } else {
              s.x = nx;
              s.y = ny;
            }

            // Hit opponent tank!
            for (const t of state.tanks) {
              if (t.id === s.owner && s.bounces === 2 && s.life > 2.8) continue;
              if (t.spinTimer <= 0 && Math.hypot(s.x - t.x, s.y - t.y) < 19) {
                const scorer = state.tanks.find((tk) => tk.id !== t.id);
                if (scorer) scorer.score += 1;
                t.spinTimer = 1.05;
                burst(t.x, t.y, t.color);
                engine.audio.explode(true);
                state.shells.splice(i, 1);
                if (scorer && scorer.score >= WIN_SCORE) {
                  state.gameOver = true;
                  state.winner = scorer.id;
                  engine.audio.powerup();
                }
                break;
              }
            }
          }

          for (let i = state.particles.length - 1; i >= 0; i--) {
            const pt = state.particles[i];
            pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
            if (pt.life <= 0) state.particles.splice(i, 1);
          }
        },

        render(ctx) {
          // Classic olive Atari 2600 Combat battlefield
          ctx.fillStyle = '#2b3a1d';
          ctx.fillRect(0, 0, W, H);

          // Walls
          for (const w of WALLS) {
            ctx.fillStyle = '#ca8a04';
            ctx.fillRect(w.x, w.y, w.w, w.h);
            ctx.fillStyle = '#eab308';
            ctx.fillRect(w.x, w.y, w.w, 4);
          }

          // Tanks
          for (const t of state.tanks) {
            drawTank(ctx, t);
          }

          // Shells
          for (const s of state.shells) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }

          for (const pt of state.particles) {
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
          }
        },

        getHud() {
          const p1 = state.tanks[0];
          const p2 = state.tanks[1];
          return {
            p1Score: p1.score,
            p2Score: p2.score,
            p1Lives: Math.max(0, WIN_SCORE - p2.score),
            p2Lives: Math.max(0, WIN_SCORE - p1.score),
            livesSymbol: '▪',
            levelText: `FIRST TO ${WIN_SCORE}`,
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
