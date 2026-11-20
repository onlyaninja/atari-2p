(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;

  function makeRockShape(radius) {
    const pts = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = radius * (0.72 + Math.random() * 0.36);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }

  function wrap(obj) {
    if (obj.x < -20) obj.x = W + 20;
    if (obj.x > W + 20) obj.x = -20;
    if (obj.y < -20) obj.y = H + 20;
    if (obj.y > H + 20) obj.y = -20;
  }

  Atari.games.push({
    id: 'asteroids',
    title: 'ASTEROIDS',
    year: 1979,
    originalPlayers: '1P / Alternating',
    upgradeNote: 'Upgraded to Simultaneous 2-Ship Vector Space Co-op!',
    upgraded: true,
    mode: 'CO-OP',
    accent: '#a78bfa',
    controls: {
      p1: 'A/D Turn • W Thrust • SPACE Fire • G Warp',
      p2: '←/→ Turn • ↑ Thrust • ENTER Fire • . Warp'
    },

    drawThumbnail(ctx, w, h) {
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#d8d4f2';
      ctx.lineWidth = 1.6;
      const rocks = [[55, 45, 22], [175, 50, 26], [125, 115, 16], [42, 130, 14]];
      for (const [rx, ry, rr] of rocks) {
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rad = rr * (i % 2 === 0 ? 1 : 0.78);
          const px = rx + Math.cos(a) * rad;
          const py = ry + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // Two vector ships
      const drawMiniShip = (x, y, ang, color) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-9, -7);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-9, 7);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      };
      drawMiniShip(w * 0.38, h * 0.62, -0.7, '#38e8ff');
      drawMiniShip(w * 0.68, h * 0.66, -2.3, '#ffb830');
    },

    create(engine) {
      const state = {
        wave: 1,
        time: 0,
        gameOver: false,
        players: [
          { id: 1, x: W * 0.36, y: H * 0.5, vx: 0, vy: 0, ang: -Math.PI / 2, color: '#38e8ff', score: 0, lives: 3, alive: true, invuln: 2, cooldown: 0, warpCd: 0, respawn: 0, thrusting: false },
          { id: 2, x: W * 0.64, y: H * 0.5, vx: 0, vy: 0, ang: -Math.PI / 2, color: '#ffb830', score: 0, lives: 3, alive: true, invuln: 2, cooldown: 0, warpCd: 0, respawn: 0, thrusting: false }
        ],
        rocks: [],
        bullets: [],
        particles: [],
        saucer: null,
        saucerTimer: 11
      };

      function spawnRock(x, y, size) {
        const radii = { 3: 40, 2: 24, 1: 13 };
        const speeds = { 3: 65, 2: 105, 1: 155 };
        const ang = Math.random() * Math.PI * 2;
        const spd = speeds[size] * (0.8 + Math.random() * 0.5) * (1 + (state.wave - 1) * 0.08);
        state.rocks.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          rot: 0,
          vrot: (Math.random() - 0.5) * 2.2,
          size,
          radius: radii[size],
          shape: makeRockShape(radii[size])
        });
      }

      function spawnWave(wave) {
        const count = Math.min(11, 4 + wave);
        for (let i = 0; i < count; i++) {
          let rx, ry;
          do {
            rx = Math.random() * W;
            ry = Math.random() * H;
          } while (Math.hypot(rx - W / 2, ry - H / 2) < 180);
          spawnRock(rx, ry, 3);
        }
      }

      function burst(x, y, color, count = 14) {
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 40 + Math.random() * 160;
          state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45 + Math.random() * 0.35, color });
        }
      }

      function botControl(p) {
        const out = { left: false, right: false, up: false, fire: false, altPressed: false };
        if (state.rocks.length === 0 && !state.saucer) return out;
        let target = state.saucer;
        let bestDist = Infinity;
        if (!target) {
          for (const r of state.rocks) {
            const d = Math.hypot(r.x - p.x, r.y - p.y);
            if (d < bestDist) { bestDist = d; target = r; }
          }
        }
        if (target) {
          const desired = Math.atan2(target.y - p.y, target.x - p.x);
          let diff = desired - p.ang;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (diff < -0.1) out.left = true;
          else if (diff > 0.1) out.right = true;
          if (Math.abs(diff) < 0.28) out.fire = true;
          if (bestDist > 210 && Math.abs(diff) < 0.5) out.up = true;
        }
        return out;
      }

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
                  p.alive = true;
                  p.x = idx === 0 ? W * 0.36 : W * 0.64;
                  p.y = H * 0.5;
                  p.vx = 0; p.vy = 0;
                  p.invuln = 2.4;
                }
              }
              return;
            }
            if (p.invuln > 0) p.invuln -= dt;
            if (p.cooldown > 0) p.cooldown -= dt;
            if (p.warpCd > 0) p.warpCd -= dt;

            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(p) : input.p2);
            const turnSpeed = 4.2;
            if (ctrl.left) p.ang -= turnSpeed * dt;
            if (ctrl.right) p.ang += turnSpeed * dt;
            p.thrusting = Boolean(ctrl.up);
            if (ctrl.up) {
              p.vx += Math.cos(p.ang) * 320 * dt;
              p.vy += Math.sin(p.ang) * 320 * dt;
            }
            // Slight space drag so controls feel snappy
            p.vx *= Math.pow(0.68, dt);
            p.vy *= Math.pow(0.68, dt);
            const spd = Math.hypot(p.vx, p.vy);
            if (spd > 360) { p.vx = (p.vx / spd) * 360; p.vy = (p.vy / spd) * 360; }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            wrap(p);

            if (ctrl.altPressed && p.warpCd <= 0) {
              p.x = 70 + Math.random() * (W - 140);
              p.y = 70 + Math.random() * (H - 140);
              p.vx = 0; p.vy = 0;
              p.warpCd = 2.5;
              p.invuln = 0.6;
              engine.audio.powerup();
              burst(p.x, p.y, p.color, 10);
            }

            if (ctrl.fire && p.cooldown <= 0) {
              p.cooldown = 0.2;
              state.bullets.push({
                x: p.x + Math.cos(p.ang) * 16,
                y: p.y + Math.sin(p.ang) * 16,
                vx: Math.cos(p.ang) * 520 + p.vx * 0.25,
                vy: Math.sin(p.ang) * 520 + p.vy * 0.25,
                life: 1.05,
                owner: p.id,
                color: p.color
              });
              engine.audio.shoot(idx === 0 ? 940 : 780);
            }
          });

          // Saucer
          if (!state.saucer) {
            state.saucerTimer -= dt;
            if (state.saucerTimer <= 0) {
              const fromLeft = Math.random() < 0.5;
              state.saucer = {
                x: fromLeft ? -24 : W + 24,
                y: 80 + Math.random() * (H - 160),
                vx: fromLeft ? 135 : -135,
                vy: 0,
                shootCd: 1.4
              };
            }
          } else {
            const s = state.saucer;
            s.x += s.vx * dt;
            s.y += Math.sin(state.time * 3) * 55 * dt;
            s.shootCd -= dt;
            if (s.shootCd <= 0) {
              s.shootCd = 1.6;
              const living = state.players.filter((pl) => pl.alive);
              const tgt = living[Math.floor(Math.random() * living.length)];
              if (tgt) {
                const a = Math.atan2(tgt.y - s.y, tgt.x - s.x) + (Math.random() - 0.5) * 0.25;
                state.bullets.push({ x: s.x, y: s.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 1.6, owner: 0, color: '#ff4d6d' });
                engine.audio.laser();
              }
            }
            if (s.x < -50 || s.x > W + 50) {
              state.saucer = null;
              state.saucerTimer = 14;
            }
          }

          // Rocks
          for (const r of state.rocks) {
            r.x += r.vx * dt;
            r.y += r.vy * dt;
            r.rot += r.vrot * dt;
            wrap(r);
          }

          // Bullets
          for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            wrap(b);
            if (b.life <= 0) { state.bullets.splice(i, 1); continue; }

            if (b.owner > 0) {
              // Check rocks
              let removed = false;
              for (let j = state.rocks.length - 1; j >= 0; j--) {
                const r = state.rocks[j];
                if (Math.hypot(b.x - r.x, b.y - r.y) < r.radius) {
                  const pts = r.size === 3 ? 20 : r.size === 2 ? 50 : 100;
                  const owner = state.players.find((pl) => pl.id === b.owner);
                  if (owner) owner.score += pts;
                  burst(r.x, r.y, '#e2e8f0', 12);
                  engine.audio.explode(r.size === 3);
                  if (r.size > 1) {
                    spawnRock(r.x, r.y, r.size - 1);
                    spawnRock(r.x, r.y, r.size - 1);
                  }
                  state.rocks.splice(j, 1);
                  state.bullets.splice(i, 1);
                  removed = true;
                  break;
                }
              }
              if (removed) continue;

              // Check saucer
              if (state.saucer && Math.hypot(b.x - state.saucer.x, b.y - state.saucer.y) < 22) {
                const owner = state.players.find((pl) => pl.id === b.owner);
                if (owner) owner.score += 300;
                burst(state.saucer.x, state.saucer.y, '#ff4d6d', 24);
                engine.audio.explode(true);
                state.saucer = null;
                state.saucerTimer = 15;
                state.bullets.splice(i, 1);
              }
            } else {
              // Saucer bullet hits players
              for (const p of state.players) {
                if (p.alive && p.invuln <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < 16) {
                  p.lives -= 1;
                  p.alive = false;
                  p.respawn = 1.5;
                  burst(p.x, p.y, p.color, 24);
                  engine.audio.explode(true);
                  state.bullets.splice(i, 1);
                  break;
                }
              }
            }
          }

          // Ship vs rock collisions
          for (const p of state.players) {
            if (!p.alive || p.invuln > 0) continue;
            for (const r of state.rocks) {
              if (Math.hypot(p.x - r.x, p.y - r.y) < r.radius + 10) {
                p.lives -= 1;
                p.alive = false;
                p.respawn = 1.6;
                burst(p.x, p.y, p.color, 24);
                engine.audio.explode(true);
                break;
              }
            }
          }

          // Particles
          for (let i = state.particles.length - 1; i >= 0; i--) {
            const pt = state.particles[i];
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.life -= dt;
            if (pt.life <= 0) state.particles.splice(i, 1);
          }

          if (state.rocks.length === 0) {
            state.wave += 1;
            state.players.forEach((p, idx) => {
              if (!p.alive && p.lives === 0) {
                p.lives = 1; p.alive = true; p.invuln = 2;
                p.x = idx === 0 ? W * 0.36 : W * 0.64; p.y = H / 2;
              }
            });
            engine.audio.powerup();
            spawnWave(state.wave);
          }

          if (state.players.every((p) => !p.alive && p.lives <= 0)) {
            state.gameOver = true;
            engine.audio.gameOver();
          }
        },

        render(ctx) {
          ctx.fillStyle = '#05050a';
          ctx.fillRect(0, 0, W, H);

          // Vector rocks
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(200, 220, 255, 0.5)';
          for (const r of state.rocks) {
            ctx.save();
            ctx.translate(r.x, r.y);
            ctx.rotate(r.rot);
            ctx.beginPath();
            r.shape.forEach((pt, idx) => {
              if (idx === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
          }

          // Saucer
          if (state.saucer) {
            const s = state.saucer;
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.strokeStyle = '#ff4d6d';
            ctx.shadowColor = '#ff4d6d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-20, 2); ctx.lineTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(20, 2);
            ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.closePath();
            ctx.moveTo(-20, 2); ctx.lineTo(20, 2);
            ctx.stroke();
            ctx.restore();
          }

          // Players
          for (const p of state.players) {
            if (!p.alive) continue;
            if (p.invuln > 0 && Math.floor(state.time * 16) % 2 === 0) continue;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.ang);
            ctx.strokeStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(16, 0);
            ctx.lineTo(-12, -10);
            ctx.lineTo(-7, 0);
            ctx.lineTo(-12, 10);
            ctx.closePath();
            ctx.stroke();
            if (p.thrusting && Math.floor(state.time * 24) % 2 === 0) {
              ctx.strokeStyle = '#ffffff';
              ctx.beginPath();
              ctx.moveTo(-9, -4);
              ctx.lineTo(-19, 0);
              ctx.lineTo(-9, 4);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Bullets & particles
          ctx.shadowBlur = 6;
          for (const b of state.bullets) {
            ctx.fillStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          for (const pt of state.particles) {
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
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
            levelText: `SECTOR ${state.wave}`,
            highCandidate: total,
            gameOver: state.gameOver,
            overTitle: 'SHIPS DESTROYED',
            overMessage: `SECTOR ${state.wave}\nP1: ${p1.score}  •  P2: ${p2.score}\nTEAM TOTAL: ${total}`
          };
        }
      };
    }
  });
})();
