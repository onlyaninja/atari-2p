(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;

  function drawInvaderSprite(ctx, x, y, type, frame, color) {
    ctx.fillStyle = color;
    const s = 3;
    ctx.save();
    ctx.translate(x - 16, y - 10);
    if (type === 0) {
      // Top squid
      ctx.fillRect(4 * s, 0, 3 * s, s);
      ctx.fillRect(3 * s, s, 5 * s, s);
      ctx.fillRect(2 * s, 2 * s, 7 * s, 2 * s);
      ctx.fillRect(frame ? s : 2 * s, 4 * s, 2 * s, 2 * s);
      ctx.fillRect(frame ? 8 * s : 7 * s, 4 * s, 2 * s, 2 * s);
    } else if (type === 1) {
      // Mid crab
      ctx.fillRect(2 * s, 0, s, s); ctx.fillRect(8 * s, 0, s, s);
      ctx.fillRect(2 * s, s, 7 * s, 3 * s);
      ctx.fillRect(0, frame ? s : 2 * s, 2 * s, 2 * s);
      ctx.fillRect(9 * s, frame ? s : 2 * s, 2 * s, 2 * s);
      ctx.fillRect(2 * s, 4 * s, 2 * s, s); ctx.fillRect(7 * s, 4 * s, 2 * s, s);
    } else {
      // Bottom octopus
      ctx.fillRect(2 * s, 0, 7 * s, s);
      ctx.fillRect(s, s, 9 * s, 3 * s);
      ctx.fillRect(frame ? 0 : s, 4 * s, 2 * s, 2 * s);
      ctx.fillRect(4 * s, 4 * s, 3 * s, s);
      ctx.fillRect(frame ? 9 * s : 8 * s, 4 * s, 2 * s, 2 * s);
    }
    // Eyes
    ctx.fillStyle = '#06070c';
    ctx.fillRect(3 * s, 2 * s, s, s);
    ctx.fillRect(7 * s, 2 * s, s, s);
    ctx.restore();
  }

  Atari.games.push({
    id: 'space-invaders',
    title: 'SPACE INVADERS',
    year: 1978,
    originalPlayers: '1P / Alternating',
    upgradeNote: 'Upgraded to Simultaneous Twin-Cannon Bunker Defense!',
    upgraded: true,
    mode: 'CO-OP',
    accent: '#22d3ee',
    controls: {
      p1: 'A / D Move • SPACE Fire',
      p2: '← / → Move • ENTER Fire'
    },

    drawThumbnail(ctx, w, h) {
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, w, h);
      const colors = ['#f43f5e', '#facc15', '#4ade80'];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) {
          ctx.fillStyle = colors[r];
          ctx.fillRect(28 + c * 28, 22 + r * 22, 16, 11);
          ctx.fillStyle = '#05070d';
          ctx.fillRect(32 + c * 28, 25 + r * 22, 3, 3);
          ctx.fillRect(38 + c * 28, 25 + r * 22, 3, 3);
        }
      }
      // Bunkers
      ctx.fillStyle = '#4ade80';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(24 + i * 48, h - 48, 28, 12);
      }
      // Two cannons
      ctx.fillStyle = '#38e8ff';
      ctx.fillRect(w * 0.3 - 12, h - 22, 24, 10);
      ctx.fillRect(w * 0.3 - 3, h - 28, 6, 6);
      ctx.fillStyle = '#ffb830';
      ctx.fillRect(w * 0.7 - 12, h - 22, 24, 10);
      ctx.fillRect(w * 0.7 - 3, h - 28, 6, 6);
    },

    create(engine) {
      const state = {
        wave: 1,
        time: 0,
        gameOver: false,
        invaders: [],
        dir: 1,
        stepTimer: 0.55,
        frame: 0,
        bunkers: [],
        bullets: [],
        enemyBullets: [],
        ufo: null,
        ufoTimer: 12,
        players: [
          { id: 1, x: W * 0.32, y: H - 40, color: '#38e8ff', score: 0, lives: 3, alive: true, invuln: 1.5, cooldown: 0, respawn: 0 },
          { id: 2, x: W * 0.68, y: H - 40, color: '#ffb830', score: 0, lives: 3, alive: true, invuln: 1.5, cooldown: 0, respawn: 0 }
        ]
      };

      function buildBunkers() {
        state.bunkers = [];
        const centers = [140, 315, 485, 660];
        centers.forEach((cx) => {
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 7; c++) {
              if (r === 3 && (c === 2 || c === 3 || c === 4)) continue;
              state.bunkers.push({ x: cx - 35 + c * 10, y: H - 124 + r * 10, w: 10, h: 10, hp: 2 });
            }
          }
        });
      }

      function spawnWave(wave) {
        state.invaders = [];
        const cols = 11;
        const rows = 5;
        const colors = ['#f43f5e', '#fb923c', '#facc15', '#4ade80', '#22d3ee'];
        const pts = [40, 30, 20, 20, 10];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            state.invaders.push({
              x: 110 + c * 56,
              y: 86 + r * 42 + Math.min(60, (wave - 1) * 14),
              type: r === 0 ? 0 : r <= 2 ? 1 : 2,
              color: colors[r],
              pts: pts[r]
            });
          }
        }
        state.dir = 1;
        state.stepTimer = 0.5;
      }

      function botControl(p) {
        const out = { left: false, right: false, fire: false };
        // Dodge incoming enemy shot
        const threat = state.enemyBullets.find((b) => b.y > H - 180 && Math.abs(b.x - p.x) < 32);
        if (threat) {
          if (threat.x >= p.x && p.x > 60) out.left = true;
          else out.right = true;
          return out;
        }
        let target = state.ufo;
        if (!target && state.invaders.length > 0) {
          target = state.invaders.reduce((best, cur) =>
            Math.abs(cur.x - p.x) < Math.abs(best.x - p.x) ? cur : best, state.invaders[0]);
        }
        if (target) {
          if (target.x < p.x - 8) out.left = true;
          else if (target.x > p.x + 8) out.right = true;
          if (Math.abs(target.x - p.x) < 28) out.fire = true;
        }
        return out;
      }

      buildBunkers();
      spawnWave(1);

      return {
        update(dt, input) {
          if (state.gameOver) return;
          state.time += dt;

          // Players
          state.players.forEach((p, idx) => {
            if (!p.alive) {
              if (p.lives > 0) {
                p.respawn -= dt;
                if (p.respawn <= 0) {
                  p.alive = true; p.invuln = 2;
                  p.x = idx === 0 ? W * 0.32 : W * 0.68;
                }
              }
              return;
            }
            if (p.invuln > 0) p.invuln -= dt;
            if (p.cooldown > 0) p.cooldown -= dt;
            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(p) : input.p2);
            if (ctrl.left) p.x -= 300 * dt;
            if (ctrl.right) p.x += 300 * dt;
            p.x = Math.max(26, Math.min(W - 26, p.x));
            const ownActive = state.bullets.filter((b) => b.owner === p.id).length;
            if (ctrl.fire && p.cooldown <= 0 && ownActive < 2) {
              p.cooldown = 0.24;
              state.bullets.push({ x: p.x, y: p.y - 16, vy: -520, owner: p.id, color: p.color });
              engine.audio.shoot(idx === 0 ? 840 : 690);
            }
          });

          // Invader rhythmic march (speeds up as count drops!)
          const ratio = Math.max(0.06, state.invaders.length / 55);
          state.stepTimer -= dt;
          if (state.stepTimer <= 0 && state.invaders.length > 0) {
            state.stepTimer = Math.max(0.06, 0.56 * ratio - (state.wave - 1) * 0.03);
            state.frame ^= 1;
            let hitEdge = false;
            const stepX = 14 * state.dir;
            for (const inv of state.invaders) {
              if (inv.x + stepX < 34 || inv.x + stepX > W - 34) { hitEdge = true; break; }
            }
            if (hitEdge) {
              state.dir *= -1;
              for (const inv of state.invaders) inv.y += 22;
            } else {
              for (const inv of state.invaders) inv.x += stepX;
            }
            engine.audio.tone(state.frame ? 110 : 92, 0.045, 'square', 0.05);

            // Random bottom-row invader shoots
            if (Math.random() < 0.42 + state.wave * 0.05) {
              const shooter = state.invaders[Math.floor(Math.random() * state.invaders.length)];
              if (shooter) {
                state.enemyBullets.push({ x: shooter.x, y: shooter.y + 12, vy: 250 + state.wave * 18 });
              }
            }
          }

          // Mystery UFO
          if (!state.ufo) {
            state.ufoTimer -= dt;
            if (state.ufoTimer <= 0) {
              const fromLeft = Math.random() < 0.5;
              state.ufo = { x: fromLeft ? -30 : W + 30, y: 42, vx: fromLeft ? 150 : -150 };
            }
          } else {
            state.ufo.x += state.ufo.vx * dt;
            if (state.ufo.x < -50 || state.ufo.x > W + 50) {
              state.ufo = null;
              state.ufoTimer = 14;
            }
          }

          // Player bullets
          for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.y += b.vy * dt;
            if (b.y < 0) { state.bullets.splice(i, 1); continue; }

            // Check bunkers
            let consumed = false;
            for (let k = state.bunkers.length - 1; k >= 0; k--) {
              const bk = state.bunkers[k];
              if (b.x > bk.x && b.x < bk.x + bk.w && b.y > bk.y && b.y < bk.y + bk.h) {
                bk.hp -= 1;
                if (bk.hp <= 0) state.bunkers.splice(k, 1);
                state.bullets.splice(i, 1);
                consumed = true;
                break;
              }
            }
            if (consumed) continue;

            // Check UFO
            if (state.ufo && Math.abs(b.x - state.ufo.x) < 26 && Math.abs(b.y - state.ufo.y) < 14) {
              const owner = state.players.find((pl) => pl.id === b.owner);
              if (owner) owner.score += 300;
              engine.audio.powerup();
              state.ufo = null;
              state.ufoTimer = 16;
              state.bullets.splice(i, 1);
              continue;
            }

            // Check invaders
            for (let j = state.invaders.length - 1; j >= 0; j--) {
              const inv = state.invaders[j];
              if (Math.abs(b.x - inv.x) < 19 && Math.abs(b.y - inv.y) < 14) {
                const owner = state.players.find((pl) => pl.id === b.owner);
                if (owner) owner.score += inv.pts;
                engine.audio.explode(false);
                state.invaders.splice(j, 1);
                state.bullets.splice(i, 1);
                break;
              }
            }
          }

          // Enemy bullets
          for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
            const eb = state.enemyBullets[i];
            eb.y += eb.vy * dt;
            if (eb.y > H) { state.enemyBullets.splice(i, 1); continue; }

            let consumed = false;
            for (let k = state.bunkers.length - 1; k >= 0; k--) {
              const bk = state.bunkers[k];
              if (eb.x > bk.x && eb.x < bk.x + bk.w && eb.y > bk.y && eb.y < bk.y + bk.h) {
                bk.hp -= 1;
                if (bk.hp <= 0) state.bunkers.splice(k, 1);
                state.enemyBullets.splice(i, 1);
                consumed = true;
                break;
              }
            }
            if (consumed) continue;

            for (const p of state.players) {
              if (p.alive && p.invuln <= 0 && Math.abs(eb.x - p.x) < 20 && Math.abs(eb.y - p.y) < 14) {
                p.lives -= 1; p.alive = false; p.respawn = 1.4;
                engine.audio.explode(true);
                state.enemyBullets.splice(i, 1);
                break;
              }
            }
          }

          // Invasion reached ground!
          if (state.invaders.some((inv) => inv.y >= H - 72)) {
            state.gameOver = true;
            engine.audio.gameOver();
          }

          if (state.invaders.length === 0) {
            state.wave += 1;
            state.players.forEach((p) => { if (!p.alive && p.lives === 0) { p.lives = 1; p.alive = true; p.invuln = 2; } });
            engine.audio.powerup();
            buildBunkers();
            spawnWave(state.wave);
          }

          if (state.players.every((p) => !p.alive && p.lives <= 0)) {
            state.gameOver = true;
            engine.audio.gameOver();
          }
        },

        render(ctx) {
          ctx.fillStyle = '#05070d';
          ctx.fillRect(0, 0, W, H);

          // Ground line
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(0, H - 16, W, 3);

          // UFO
          if (state.ufo) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.ellipse(state.ufo.x, state.ufo.y, 24, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fde047';
            ctx.fillRect(state.ufo.x - 14, state.ufo.y - 2, 6, 4);
            ctx.fillRect(state.ufo.x - 3, state.ufo.y - 2, 6, 4);
            ctx.fillRect(state.ufo.x + 8, state.ufo.y - 2, 6, 4);
          }

          // Invaders
          for (const inv of state.invaders) {
            drawInvaderSprite(ctx, inv.x, inv.y, inv.type, state.frame, inv.color);
          }

          // Bunkers
          for (const bk of state.bunkers) {
            ctx.fillStyle = bk.hp === 2 ? '#4ade80' : '#166534';
            ctx.fillRect(bk.x, bk.y, bk.w, bk.h);
          }

          // Bullets
          for (const b of state.bullets) {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x - 2, b.y - 10, 4, 14);
          }
          ctx.fillStyle = '#ff6b81';
          for (const eb of state.enemyBullets) {
            ctx.fillRect(eb.x - 2, eb.y - 6, 4, 12);
          }

          // Twin cannons
          for (const p of state.players) {
            if (!p.alive) continue;
            if (p.invuln > 0 && Math.floor(state.time * 16) % 2 === 0) continue;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 20, p.y - 4, 40, 14);
            ctx.fillRect(p.x - 12, p.y - 10, 24, 6);
            ctx.fillRect(p.x - 3, p.y - 17, 6, 7);
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
            levelText: `WAVE ${state.wave}`,
            highCandidate: total,
            gameOver: state.gameOver,
            overTitle: 'EARTH INVADED',
            overMessage: `WAVE ${state.wave}\nP1: ${p1.score}  •  P2: ${p2.score}\nTEAM TOTAL: ${total}`
          };
        }
      };
    }
  });
})();
