(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;
  const CELL = 20;
  const COLS = W / CELL; // 40
  const ROWS = H / CELL; // 30
  const PLAYER_TOP = H - 150;

  Atari.games.push({
    id: 'centipede',
    title: 'CENTIPEDE',
    year: 1981,
    originalPlayers: '1P / Alternating',
    upgradeNote: 'Upgraded to Simultaneous 2P Dual-Blaster Garden Co-op!',
    upgraded: true,
    mode: 'CO-OP',
    accent: '#4ade80',
    controls: {
      p1: 'WASD Move • SPACE Fire',
      p2: 'ARROWS Move • ENTER Fire'
    },

    drawThumbnail(ctx, w, h) {
      ctx.fillStyle = '#060a08';
      ctx.fillRect(0, 0, w, h);
      // Mushrooms
      ctx.fillStyle = '#f97316';
      [[30, 45], [80, 62], [140, 42], [185, 76], [62, 102], [155, 108]].forEach(([mx, my]) => {
        ctx.beginPath();
        ctx.arc(mx, my, 7, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(mx - 3, my, 6, 6);
        ctx.fillStyle = '#f97316';
      });
      // Centipede body
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i === 0 ? '#ef4444' : '#4ade80';
        ctx.beginPath();
        ctx.arc(46 + i * 16, 28 + Math.sin(i * 0.8) * 6, 7.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Two blasters at bottom
      ctx.fillStyle = '#38e8ff';
      ctx.fillRect(w * 0.32 - 8, h - 22, 16, 12);
      ctx.fillRect(w * 0.32 - 2, h - 28, 4, 6);
      ctx.fillStyle = '#ffb830';
      ctx.fillRect(w * 0.68 - 8, h - 22, 16, 12);
      ctx.fillRect(w * 0.68 - 2, h - 28, 4, 6);
    },

    create(engine) {
      const state = {
        wave: 1,
        time: 0,
        gameOver: false,
        mushrooms: new Map(), // "c,r" -> hp (1..4)
        segments: [],
        bullets: [],
        spider: null,
        spiderTimer: 4,
        particles: [],
        players: [
          { id: 1, x: W * 0.35, y: H - 36, color: '#38e8ff', score: 0, lives: 3, alive: true, invuln: 1.5, cooldown: 0, respawn: 0 },
          { id: 2, x: W * 0.65, y: H - 36, color: '#ffb830', score: 0, lives: 3, alive: true, invuln: 1.5, cooldown: 0, respawn: 0 }
        ]
      };

      const key = (c, r) => `${c},${r}`;

      function seedMushrooms() {
        state.mushrooms.clear();
        for (let i = 0; i < 42; i++) {
          const c = 1 + Math.floor(Math.random() * (COLS - 2));
          const r = 2 + Math.floor(Math.random() * (ROWS - 8));
          state.mushrooms.set(key(c, r), 4);
        }
      }

      function spawnCentipede(wave) {
        state.segments = [];
        const len = Math.min(16, 10 + wave);
        const startC = Math.floor(COLS / 2);
        for (let i = 0; i < len; i++) {
          state.segments.push({
            x: (startC - i) * CELL + CELL / 2,
            y: CELL * 1.5,
            dir: 1,
            head: i === 0,
            speed: 135 + wave * 18
          });
        }
      }

      function burst(x, y, color) {
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 40 + Math.random() * 140;
          state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, color });
        }
      }

      function botControl(p) {
        const out = { left: false, right: false, up: false, down: false, fire: true };
        let target = state.spider;
        if (!target && state.segments.length > 0) {
          target = state.segments.reduce((best, cur) => (cur.y > best.y ? cur : best), state.segments[0]);
        }
        if (target) {
          if (target.x < p.x - 8) out.left = true;
          else if (target.x > p.x + 8) out.right = true;
        }
        if (p.y < H - 45) out.down = true;
        return out;
      }

      seedMushrooms();
      spawnCentipede(1);

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
                  p.x = idx === 0 ? W * 0.35 : W * 0.65;
                  p.y = H - 36;
                }
              }
              return;
            }
            if (p.invuln > 0) p.invuln -= dt;
            if (p.cooldown > 0) p.cooldown -= dt;
            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(p) : input.p2);
            const spd = 270;
            let nx = p.x;
            let ny = p.y;
            if (ctrl.left) nx -= spd * dt;
            if (ctrl.right) nx += spd * dt;
            if (ctrl.up) ny -= spd * dt;
            if (ctrl.down) ny += spd * dt;
            nx = Math.max(14, Math.min(W - 14, nx));
            ny = Math.max(PLAYER_TOP, Math.min(H - 16, ny));
            // Block by mushroom
            const curC = Math.floor(p.x / CELL);
            const curR = Math.floor(p.y / CELL);
            const mc = Math.floor(nx / CELL);
            const mr = Math.floor(ny / CELL);
            if ((mc === curC && mr === curR) || !state.mushrooms.has(key(mc, mr))) {
              p.x = nx; p.y = ny;
            }

            if (ctrl.fire && p.cooldown <= 0) {
              p.cooldown = 0.14;
              state.bullets.push({ x: p.x, y: p.y - 12, vy: -640, owner: p.id, color: p.color });
              engine.audio.shoot(idx === 0 ? 980 : 820);
            }
          });

          // Centipede segments
          for (const seg of state.segments) {
            const nextX = seg.x + seg.dir * seg.speed * dt;
            const c = Math.floor((nextX + seg.dir * 9) / CELL);
            const r = Math.floor(seg.y / CELL);
            const hitWall = nextX < 12 || nextX > W - 12;
            const hitShroom = state.mushrooms.has(key(c, r));
            if (hitWall || hitShroom) {
              seg.dir *= -1;
              seg.y += CELL;
              if (seg.y > H - 20) seg.y = PLAYER_TOP;
            } else {
              seg.x = nextX;
            }
          }

          // Spider
          if (!state.spider) {
            state.spiderTimer -= dt;
            if (state.spiderTimer <= 0) {
              const left = Math.random() < 0.5;
              state.spider = {
                x: left ? -16 : W + 16,
                y: PLAYER_TOP + 30,
                vx: left ? 130 : -130,
                vy: 120
              };
            }
          } else {
            const sp = state.spider;
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            if (sp.y < PLAYER_TOP - 40 || sp.y > H - 20) sp.vy *= -1;
            const sc = Math.floor(sp.x / CELL);
            const sr = Math.floor(sp.y / CELL);
            if (state.mushrooms.has(key(sc, sr))) state.mushrooms.delete(key(sc, sr));
            if (sp.x < -30 || sp.x > W + 30) {
              state.spider = null;
              state.spiderTimer = 5 + Math.random() * 4;
            }
          }

          // Bullets
          for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.y += b.vy * dt;
            if (b.y < 0) { state.bullets.splice(i, 1); continue; }
            const owner = state.players.find((pl) => pl.id === b.owner);

            // Hit mushroom
            const mc = Math.floor(b.x / CELL);
            const mr = Math.floor(b.y / CELL);
            const mk = key(mc, mr);
            if (state.mushrooms.has(mk)) {
              const hp = state.mushrooms.get(mk) - 1;
              if (hp <= 0) {
                state.mushrooms.delete(mk);
                if (owner) owner.score += 5;
              } else {
                state.mushrooms.set(mk, hp);
              }
              engine.audio.hit();
              state.bullets.splice(i, 1);
              continue;
            }

            // Hit spider
            if (state.spider && Math.hypot(b.x - state.spider.x, b.y - state.spider.y) < 16) {
              if (owner) owner.score += 600;
              burst(state.spider.x, state.spider.y, '#ec4899');
              engine.audio.explode(true);
              state.spider = null;
              state.spiderTimer = 6;
              state.bullets.splice(i, 1);
              continue;
            }

            // Hit centipede segment
            let hitSeg = false;
            for (let j = state.segments.length - 1; j >= 0; j--) {
              const seg = state.segments[j];
              if (Math.hypot(b.x - seg.x, b.y - seg.y) < 12) {
                if (owner) owner.score += seg.head ? 100 : 25;
                // Turns into a mushroom!
                const sc = Math.max(0, Math.min(COLS - 1, Math.floor(seg.x / CELL)));
                const sr = Math.max(1, Math.min(ROWS - 2, Math.floor(seg.y / CELL)));
                state.mushrooms.set(key(sc, sr), 4);
                // Promote trailing segment to a new head
                if (state.segments[j + 1]) state.segments[j + 1].head = true;
                burst(seg.x, seg.y, '#4ade80');
                engine.audio.explode(false);
                state.segments.splice(j, 1);
                hitSeg = true;
                break;
              }
            }
            if (hitSeg) state.bullets.splice(i, 1);
          }

          // Player collisions with centipede & spider
          for (const p of state.players) {
            if (!p.alive || p.invuln > 0) continue;
            let hit = false;
            for (const seg of state.segments) {
              if (Math.hypot(p.x - seg.x, p.y - seg.y) < 16) { hit = true; break; }
            }
            if (!hit && state.spider && Math.hypot(p.x - state.spider.x, p.y - state.spider.y) < 18) hit = true;
            if (hit) {
              p.lives -= 1; p.alive = false; p.respawn = 1.4;
              burst(p.x, p.y, p.color);
              engine.audio.explode(true);
            }
          }

          for (let i = state.particles.length - 1; i >= 0; i--) {
            const pt = state.particles[i];
            pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
            if (pt.life <= 0) state.particles.splice(i, 1);
          }

          if (state.segments.length === 0) {
            state.wave += 1;
            state.players.forEach((p, idx) => {
              if (!p.alive && p.lives === 0) {
                p.lives = 1; p.alive = true; p.invuln = 2;
                p.x = idx === 0 ? W * 0.35 : W * 0.65; p.y = H - 36;
              }
            });
            engine.audio.powerup();
            spawnCentipede(state.wave);
          }

          if (state.players.every((p) => !p.alive && p.lives <= 0)) {
            state.gameOver = true;
            engine.audio.gameOver();
          }
        },

        render(ctx) {
          ctx.fillStyle = '#060a08';
          ctx.fillRect(0, 0, W, H);

          // Player zone divider line
          ctx.strokeStyle = 'rgba(74, 222, 128, 0.18)';
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(0, PLAYER_TOP - 8);
          ctx.lineTo(W, PLAYER_TOP - 8);
          ctx.stroke();
          ctx.setLineDash([]);

          // Mushrooms
          state.mushrooms.forEach((hp, k) => {
            const [c, r] = k.split(',').map(Number);
            const mx = c * CELL + CELL / 2;
            const my = r * CELL + CELL / 2;
            const capR = 5 + hp * 1.1;
            ctx.fillStyle = hp >= 3 ? '#f97316' : hp === 2 ? '#fb923c' : '#fde047';
            ctx.beginPath();
            ctx.arc(mx, my - 1, capR, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(mx - 3, my - 1, 6, 7);
          });

          // Centipede
          for (const seg of state.segments) {
            ctx.fillStyle = seg.head ? '#ef4444' : '#4ade80';
            ctx.beginPath();
            ctx.arc(seg.x, seg.y, 9, 0, Math.PI * 2);
            ctx.fill();
            // Eyes on head
            if (seg.head) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(seg.x + seg.dir * 3 - 2, seg.y - 4, 3, 3);
              ctx.fillRect(seg.x + seg.dir * 3 - 2, seg.y + 1, 3, 3);
            }
          }

          // Spider
          if (state.spider) {
            const sp = state.spider;
            ctx.fillStyle = '#ec4899';
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#f472b6';
            ctx.lineWidth = 2;
            for (let l = -1; l <= 1; l++) {
              ctx.beginPath();
              ctx.moveTo(sp.x - 16, sp.y + l * 6);
              ctx.lineTo(sp.x + 16, sp.y + l * 6);
              ctx.stroke();
            }
          }

          // Bullets
          for (const b of state.bullets) {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
          }

          // Players
          for (const p of state.players) {
            if (!p.alive) continue;
            if (p.invuln > 0 && Math.floor(state.time * 16) % 2 === 0) continue;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 12);
            ctx.lineTo(p.x + 11, p.y + 10);
            ctx.lineTo(p.x - 11, p.y + 10);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(p.x - 2, p.y - 5, 4, 6);
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
            levelText: `WAVE ${state.wave}`,
            highCandidate: total,
            gameOver: state.gameOver,
            overTitle: 'GARDEN OVERRUN',
            overMessage: `WAVE ${state.wave}\nP1: ${p1.score}  •  P2: ${p2.score}\nTEAM TOTAL: ${total}`
          };
        }
      };
    }
  });
})();
