(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;

  function drawFighter(ctx, x, y, color, dual) {
    const drawOne = (ox) => {
      ctx.save();
      ctx.translate(ox, y);
      ctx.fillStyle = color;
      // Nose & main hull
      ctx.fillRect(-3, -16, 6, 12);
      ctx.fillRect(-7, -8, 14, 14);
      // Wings
      ctx.fillRect(-16, 0, 32, 8);
      ctx.fillRect(-16, -5, 4, 13);
      ctx.fillRect(12, -5, 4, 13);
      // Cockpit accent
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -10, 4, 8);
      // Red wing tips
      ctx.fillStyle = '#ff3b5c';
      ctx.fillRect(-15, -7, 3, 4);
      ctx.fillRect(12, -7, 3, 4);
      ctx.restore();
    };
    if (dual) {
      drawOne(x - 16);
      drawOne(x + 16);
    } else {
      drawOne(x);
    }
  }

  function drawAlien(ctx, e, t) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const wing = Math.sin(t * 9 + e.phase) > 0 ? 1 : -1;

    if (e.type === 'boss') {
      ctx.fillStyle = e.hp > 1 ? '#38d39f' : '#60a5fa';
      ctx.fillRect(-14, -8, 28, 16);
      ctx.fillRect(-18, -2 + wing * 2, 36, 8);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-10, -14, 6, 7);
      ctx.fillRect(4, -14, 6, 7);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-6, -3, 4, 4);
      ctx.fillRect(2, -3, 4, 4);
    } else if (e.type === 'butterfly') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-12, -6, 24, 12);
      ctx.fillRect(-16, -2 + wing * 3, 8, 10);
      ctx.fillRect(8, -2 + wing * 3, 8, 10);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-4, -8, 8, 14);
    } else {
      // Bee
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-10, -6, 20, 12);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-14, -4 + wing * 2, 6, 8);
      ctx.fillRect(8, -4 + wing * 2, 6, 8);
      ctx.fillStyle = '#111827';
      ctx.fillRect(-8, 0, 16, 3);
    }
    ctx.restore();
  }

  Atari.games.push({
    id: 'galaga',
    title: 'GALAGA',
    year: 1981,
    originalPlayers: '1P / Alternating',
    upgradeNote: 'Upgraded to Simultaneous 2P Wingman Co-op + Boss Rescue!',
    upgraded: true,
    mode: 'CO-OP',
    accent: '#38e8ff',
    controls: {
      p1: 'A / D Move • SPACE Fire',
      p2: '← / → Move • ENTER Fire'
    },

    drawThumbnail(ctx, w, h) {
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, w, h);
      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 24; i++) {
        ctx.fillRect((i * 53) % w, (i * 37) % h, 2, 2);
      }
      // Alien rows
      const cols = 6;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < cols; c++) {
          const ex = 38 + c * ((w - 76) / (cols - 1));
          const ey = 32 + r * 24;
          ctx.fillStyle = r === 0 ? '#38d39f' : r === 1 ? '#ef4444' : '#facc15';
          ctx.fillRect(ex - 8, ey - 5, 16, 10);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ex - 4, ey - 2, 3, 3);
          ctx.fillRect(ex + 1, ey - 2, 3, 3);
        }
      }
      // Lasers
      ctx.fillStyle = '#38e8ff';
      ctx.fillRect(w * 0.34 - 1, h * 0.48, 3, 18);
      ctx.fillStyle = '#ffb830';
      ctx.fillRect(w * 0.66 - 1, h * 0.54, 3, 18);
      // Two fighters side by side!
      ctx.save();
      ctx.scale(0.85, 0.85);
      drawFighter(ctx, (w * 0.34) / 0.85, (h - 24) / 0.85, '#38e8ff', false);
      drawFighter(ctx, (w * 0.66) / 0.85, (h - 24) / 0.85, '#ffb830', false);
      ctx.restore();
    },

    create(engine) {
      const stars = Array.from({ length: 75 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 35 + Math.random() * 95,
        color: ['#ffffff', '#38e8ff', '#ffb830', '#ff6b8b'][Math.floor(Math.random() * 4)]
      }));

      const state = {
        wave: 1,
        time: 0,
        waveBanner: 1.6,
        gameOver: false,
        players: [
          { id: 1, x: W * 0.35, y: H - 48, color: '#38e8ff', score: 0, lives: 3, cooldown: 0, invuln: 1.5, alive: true, dual: false, respawn: 0 },
          { id: 2, x: W * 0.65, y: H - 48, color: '#ffb830', score: 0, lives: 3, cooldown: 0, invuln: 1.5, alive: true, dual: false, respawn: 0 }
        ],
        enemies: [],
        bullets: [],
        enemyBullets: [],
        particles: [],
        diveTimer: 1.8,
        sway: 0
      };

      function spawnWave(wave) {
        state.enemies = [];
        const rows = [
          { type: 'boss', count: 4, y: 78, hp: 2, pts: 400 },
          { type: 'butterfly', count: 8, y: 126, hp: 1, pts: 160 },
          { type: 'butterfly', count: 8, y: 168, hp: 1, pts: 160 },
          { type: 'bee', count: 10, y: 210, hp: 1, pts: 100 },
          { type: 'bee', count: 10, y: 252, hp: 1, pts: 100 }
        ];
        rows.forEach((row, rIdx) => {
          const span = (row.count - 1) * 58;
          const startX = W / 2 - span / 2;
          for (let i = 0; i < row.count; i++) {
            const gx = startX + i * 58;
            state.enemies.push({
              type: row.type,
              hp: row.hp,
              pts: row.pts,
              homeX: gx,
              homeY: row.y,
              x: gx + (rIdx % 2 === 0 ? -340 : 340),
              y: -40 - i * 18 - rIdx * 28,
              mode: 'enter',
              diveT: 0,
              diveStartX: gx,
              diveStartY: row.y,
              diveTargetX: W / 2,
              beamTimer: 0,
              carryingDual: false,
              phase: i * 0.5 + rIdx
            });
          }
        });
        state.waveBanner = 1.7;
        state.diveTimer = Math.max(0.7, 2.0 - wave * 0.12);
      }

      function burst(x, y, color, count = 14) {
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 50 + Math.random() * 190;
          state.particles.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 0.35 + Math.random() * 0.35, maxLife: 0.7, color
          });
        }
      }

      function botControl(p) {
        const out = { left: false, right: false, fire: false };
        // Dodge closest enemy bullet
        let danger = null;
        let bestD = 120;
        for (const b of state.enemyBullets) {
          if (b.y > H - 200 && Math.abs(b.x - p.x) < 42) {
            const d = Math.hypot(b.x - p.x, b.y - p.y);
            if (d < bestD) { bestD = d; danger = b; }
          }
        }
        if (danger) {
          if (danger.x >= p.x && p.x > 60) out.left = true;
          else if (p.x < W - 60) out.right = true;
          else out.left = true;
        } else if (state.enemies.length > 0) {
          // Track nearest diving enemy or lowest enemy on right side
          let target = state.enemies.find((e) => e.mode === 'dive');
          if (!target) {
            target = state.enemies.reduce((best, cur) =>
              Math.abs(cur.x - p.x) < Math.abs(best.x - p.x) ? cur : best, state.enemies[0]);
          }
          if (target.x < p.x - 10) out.left = true;
          else if (target.x > p.x + 10) out.right = true;
          if (Math.abs(target.x - p.x) < 55) out.fire = true;
        }
        return out;
      }

      spawnWave(1);

      return {
        update(dt, input) {
          if (state.gameOver) return;
          state.time += dt;
          if (state.waveBanner > 0) state.waveBanner -= dt;
          state.sway = Math.sin(state.time * 1.9) * 34;

          for (const s of stars) {
            s.y += s.speed * dt;
            if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
          }

          // Players
          state.players.forEach((p, idx) => {
            if (!p.alive) {
              if (p.lives > 0) {
                p.respawn -= dt;
                if (p.respawn <= 0) {
                  p.alive = true;
                  p.invuln = 2.0;
                  p.x = idx === 0 ? W * 0.35 : W * 0.65;
                }
              }
              return;
            }

            if (p.invuln > 0) p.invuln -= dt;
            if (p.cooldown > 0) p.cooldown -= dt;

            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(p) : input.p2);
            const speed = 340;
            if (ctrl.left) p.x -= speed * dt;
            if (ctrl.right) p.x += speed * dt;
            const margin = p.dual ? 36 : 24;
            p.x = Math.max(margin, Math.min(W - margin, p.x));

            const maxShots = p.dual ? 6 : 3;
            const activeShots = state.bullets.filter((b) => b.owner === p.id).length;
            if (ctrl.fire && p.cooldown <= 0 && activeShots < maxShots) {
              p.cooldown = 0.16;
              if (p.dual) {
                state.bullets.push({ x: p.x - 16, y: p.y - 18, vy: -560, owner: p.id, color: p.color });
                state.bullets.push({ x: p.x + 16, y: p.y - 18, vy: -560, owner: p.id, color: p.color });
              } else {
                state.bullets.push({ x: p.x, y: p.y - 18, vy: -560, owner: p.id, color: p.color });
              }
              engine.audio.shoot(idx === 0 ? 860 : 720);
            }
          });

          // Trigger enemy dives
          state.diveTimer -= dt;
          if (state.diveTimer <= 0) {
            const formation = state.enemies.filter((e) => e.mode === 'formation');
            if (formation.length > 0) {
              const count = Math.min(formation.length, state.wave >= 3 ? 3 : 2);
              for (let k = 0; k < count; k++) {
                const pick = formation[Math.floor(Math.random() * formation.length)];
                if (pick && pick.mode === 'formation') {
                  pick.mode = 'dive';
                  pick.diveT = 0;
                  pick.diveStartX = pick.x;
                  pick.diveStartY = pick.y;
                  const living = state.players.filter((pl) => pl.alive);
                  const tgt = living[Math.floor(Math.random() * living.length)];
                  pick.diveTargetX = tgt ? tgt.x : W / 2;
                  pick.firedDive = false;
                  pick.beamTimer = pick.type === 'boss' && Math.random() < 0.3 ? 1.4 : 0;
                }
              }
            }
            state.diveTimer = Math.max(0.85, 2.3 - state.wave * 0.14);
          }

          // Update enemies
          for (const e of state.enemies) {
            const tx = e.homeX + state.sway;
            if (e.mode === 'enter') {
              const dx = tx - e.x;
              const dy = e.homeY - e.y;
              const dist = Math.hypot(dx, dy);
              const spd = 340;
              if (dist < spd * dt + 4) {
                e.x = tx;
                e.y = e.homeY;
                e.mode = 'formation';
              } else {
                e.x += (dx / dist) * spd * dt;
                e.y += (dy / dist) * spd * dt;
              }
            } else if (e.mode === 'formation') {
              e.x = tx;
              e.y = e.homeY + Math.sin(state.time * 3 + e.phase) * 4;
              if (Math.random() < (0.08 + state.wave * 0.015) * dt) {
                state.enemyBullets.push({ x: e.x, y: e.y + 12, vx: (Math.random() - 0.5) * 45, vy: 220 + state.wave * 15 });
              }
            } else if (e.mode === 'dive') {
              e.diveT += dt * (0.52 + state.wave * 0.03);
              if (e.beamTimer > 0 && e.y > 290 && e.y < 360) {
                // Boss tractor beam sweep!
                e.beamTimer -= dt;
                // If boss holds steady, players can shoot boss for dual-fighter bonus!
              } else {
                const p = e.diveT;
                const curve = Math.sin(p * Math.PI * 2.5) * 95;
                e.x = e.diveStartX + (e.diveTargetX - e.diveStartX) * Math.min(1, p * 1.2) + curve;
                e.y = e.diveStartY + p * (H + 90 - e.diveStartY);
                if (!e.firedDive && e.y > 220) {
                  e.firedDive = true;
                  const living = state.players.filter((pl) => pl.alive);
                  const tgt = living[Math.floor(Math.random() * living.length)];
                  if (tgt) {
                    const ang = Math.atan2(tgt.y - e.y, tgt.x - e.x);
                    const spd = 260 + state.wave * 15;
                    state.enemyBullets.push({ x: e.x, y: e.y + 10, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd });
                  }
                }
                if (e.y > H + 30) {
                  e.y = -30;
                  e.mode = 'enter';
                }
              }
            }
          }

          // Update player bullets
          for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.y += b.vy * dt;
            if (b.y < -12) {
              state.bullets.splice(i, 1);
              continue;
            }
            let hit = false;
            for (let j = state.enemies.length - 1; j >= 0; j--) {
              const e = state.enemies[j];
              if (Math.abs(b.x - e.x) < 18 && Math.abs(b.y - e.y) < 16) {
                e.hp -= 1;
                hit = true;
                const owner = state.players.find((pl) => pl.id === b.owner);
                if (e.hp <= 0) {
                  const pts = e.mode === 'dive' ? e.pts * 2 : e.pts;
                  if (owner) {
                    owner.score += pts;
                    if (e.type === 'boss' && e.beamTimer > 0 && !owner.dual) {
                      owner.dual = true;
                      engine.audio.powerup();
                    }
                  }
                  burst(e.x, e.y, e.type === 'boss' ? '#38d39f' : e.type === 'butterfly' ? '#ef4444' : '#facc15', 16);
                  engine.audio.explode(e.type === 'boss');
                  state.enemies.splice(j, 1);
                } else {
                  engine.audio.hit();
                  burst(e.x, e.y, '#60a5fa', 6);
                }
                break;
              }
            }
            if (hit) state.bullets.splice(i, 1);
          }

          // Enemy bullets & collisions
          const hitPlayer = (p) => {
            if (p.invuln > 0) return;
            if (p.dual) {
              p.dual = false;
              p.invuln = 1.6;
              burst(p.x, p.y, p.color, 18);
              engine.audio.explode(false);
              return;
            }
            p.lives -= 1;
            p.alive = false;
            p.respawn = 1.4;
            burst(p.x, p.y, p.color, 26);
            engine.audio.explode(true);
          };

          for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
            const eb = state.enemyBullets[i];
            eb.x += eb.vx * dt;
            eb.y += eb.vy * dt;
            if (eb.y > H + 20 || eb.x < -20 || eb.x > W + 20) {
              state.enemyBullets.splice(i, 1);
              continue;
            }
            for (const p of state.players) {
              if (!p.alive || p.invuln > 0) continue;
              const hitW = p.dual ? 30 : 15;
              if (Math.abs(eb.x - p.x) < hitW && Math.abs(eb.y - p.y) < 15) {
                hitPlayer(p);
                state.enemyBullets.splice(i, 1);
                break;
              }
            }
          }

          // Enemy body collisions with players
          for (let j = state.enemies.length - 1; j >= 0; j--) {
            const e = state.enemies[j];
            for (const p of state.players) {
              if (!p.alive || p.invuln > 0) continue;
              const hitW = p.dual ? 34 : 20;
              if (Math.abs(e.x - p.x) < hitW && Math.abs(e.y - p.y) < 20) {
                hitPlayer(p);
                burst(e.x, e.y, '#facc15', 14);
                state.enemies.splice(j, 1);
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

          // Next wave
          if (state.enemies.length === 0) {
            state.wave += 1;
            // Revive fallen wingman with 1 life on wave clear!
            state.players.forEach((p, idx) => {
              if (!p.alive && p.lives === 0) {
                p.lives = 1;
                p.alive = true;
                p.invuln = 2;
                p.x = idx === 0 ? W * 0.35 : W * 0.65;
              }
            });
            engine.audio.powerup();
            spawnWave(state.wave);
          }

          // Check game over (both players out)
          if (state.players.every((p) => !p.alive && p.lives <= 0)) {
            state.gameOver = true;
            engine.audio.gameOver();
          }
        },

        render(ctx) {
          ctx.fillStyle = '#05060f';
          ctx.fillRect(0, 0, W, H);

          // Scrolling starfield
          for (const s of stars) {
            ctx.fillStyle = s.color;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(s.x, s.y, 2, 2);
          }
          ctx.globalAlpha = 1;

          // Tractor beams from diving bosses
          for (const e of state.enemies) {
            if (e.mode === 'dive' && e.beamTimer > 0 && e.y > 280) {
              const grad = ctx.createLinearGradient(e.x, e.y + 12, e.x, H - 30);
              grad.addColorStop(0, 'rgba(56, 232, 255, 0.55)');
              grad.addColorStop(1, 'rgba(168, 85, 247, 0.12)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.moveTo(e.x - 10, e.y + 12);
              ctx.lineTo(e.x + 10, e.y + 12);
              ctx.lineTo(e.x + 48, H - 30);
              ctx.lineTo(e.x - 48, H - 30);
              ctx.closePath();
              ctx.fill();
            }
          }

          // Enemies
          for (const e of state.enemies) {
            drawAlien(ctx, e, state.time);
          }

          // Player bullets
          for (const b of state.bullets) {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x - 2, b.y - 8, 4, 14);
          }

          // Enemy bullets
          ctx.fillStyle = '#ff5c7c';
          for (const eb of state.enemyBullets) {
            ctx.beginPath();
            ctx.arc(eb.x, eb.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          // Players
          for (const p of state.players) {
            if (!p.alive) continue;
            if (p.invuln > 0 && Math.floor(state.time * 16) % 2 === 0) continue;
            drawFighter(ctx, p.x, p.y, p.color, p.dual);
            // Tiny P1/P2 tag beneath ship
            ctx.fillStyle = p.color;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(p.dual ? `P${p.id} x2` : `P${p.id}`, p.x, p.y + 22);
          }

          // Particles
          for (const pt of state.particles) {
            ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
          }
          ctx.globalAlpha = 1;

          // Wave banner
          if (state.waveBanner > 0) {
            ctx.fillStyle = '#fcbf49';
            ctx.font = 'bold 28px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`STAGE ${state.wave} — 2P WINGMAN CO-OP`, W / 2, H / 2 - 12);
            ctx.fillStyle = '#38e8ff';
            ctx.font = '14px monospace';
            ctx.fillText('TIP: BLAST A BEAMING BOSS FOR DUAL-FIGHTER MODE!', W / 2, H / 2 + 18);
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
            levelText: `STAGE ${state.wave}`,
            highCandidate: total,
            gameOver: state.gameOver,
            overTitle: 'FLEET LOST',
            overMessage: `STAGE ${state.wave} REACHED\nP1: ${p1.score}  •  P2: ${p2.score}\nTEAM TOTAL: ${total}`
          };
        }
      };
    }
  });
})();
