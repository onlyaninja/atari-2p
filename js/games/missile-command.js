(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;
  const GROUND_Y = H - 44;

  Atari.games.push({
    id: 'missile-command',
    title: 'MISSILE COMMAND',
    year: 1980,
    originalPlayers: '1P / Alternating',
    upgradeNote: 'Upgraded to Simultaneous Dual-Crosshair Battery Defense!',
    upgraded: true,
    mode: 'CO-OP',
    accent: '#f43f5e',
    controls: {
      p1: 'WASD Aim Crosshair • SPACE Launch',
      p2: 'ARROWS Aim Crosshair • ENTER Launch'
    },

    drawThumbnail(ctx, w, h) {
      ctx.fillStyle = '#07060d';
      ctx.fillRect(0, 0, w, h);
      // Incoming red streaks
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 0); ctx.lineTo(82, 72);
      ctx.moveTo(150, 0); ctx.lineTo(126, 60);
      ctx.stroke();
      // Explosions
      ctx.fillStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.beginPath(); ctx.arc(82, 72, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(56, 232, 255, 0.65)';
      ctx.beginPath(); ctx.arc(128, 62, 14, 0, Math.PI * 2); ctx.fill();
      // Ground & cities
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(0, h - 18, w, 18);
      ctx.fillStyle = '#38bdf8';
      [34, 68, 128, 162].forEach((cx) => ctx.fillRect(cx, h - 28, 18, 10));
      // Crosshairs
      ctx.strokeStyle = '#38e8ff';
      ctx.strokeRect(56, 52, 14, 14);
      ctx.strokeStyle = '#ffb830';
      ctx.strokeRect(138, 46, 14, 14);
    },

    create(engine) {
      const cityXs = [130, 225, 320, 480, 575, 670];
      const state = {
        wave: 1,
        time: 0,
        gameOver: false,
        waveRemaining: 14,
        spawnTimer: 0.7,
        cities: cityXs.map((x) => ({ x, alive: true })),
        batteries: [
          { x: 52, y: GROUND_Y - 10, color: '#38e8ff' },
          { x: W - 52, y: GROUND_Y - 10, color: '#ffb830' }
        ],
        players: [
          { id: 1, x: W * 0.32, y: H * 0.45, color: '#38e8ff', score: 0, cooldown: 0 },
          { id: 2, x: W * 0.68, y: H * 0.45, color: '#ffb830', score: 0, cooldown: 0 }
        ],
        enemyMissiles: [],
        interceptors: [],
        explosions: []
      };

      function spawnEnemyMissile() {
        const livingCities = state.cities.filter((c) => c.alive);
        const target = livingCities.length > 0
          ? livingCities[Math.floor(Math.random() * livingCities.length)]
          : { x: 80 + Math.random() * (W - 160) };
        const sx = 40 + Math.random() * (W - 80);
        const dx = target.x - sx;
        const dy = GROUND_Y - 0;
        const dist = Math.hypot(dx, dy);
        const speed = 56 + state.wave * 11 + Math.random() * 24;
        state.enemyMissiles.push({
          sx, sy: 0,
          x: sx, y: 0,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed
        });
      }

      function botControl(p) {
        const out = { left: false, right: false, up: false, down: false, firePressed: false };
        if (state.enemyMissiles.length === 0) return out;
        // Pick lowest missile on right half, or overall lowest
        let target = state.enemyMissiles.filter((m) => m.x > W * 0.42)
          .sort((a, b) => b.y - a.y)[0] || state.enemyMissiles.slice().sort((a, b) => b.y - a.y)[0];
        if (!target) return out;
        // Lead target slightly
        const lx = target.x + target.vx * 0.55;
        const ly = Math.min(GROUND_Y - 50, target.y + target.vy * 0.55);
        if (lx < p.x - 10) out.left = true;
        else if (lx > p.x + 10) out.right = true;
        if (ly < p.y - 10) out.up = true;
        else if (ly > p.y + 10) out.down = true;
        if (Math.hypot(lx - p.x, ly - p.y) < 28 && p.cooldown <= 0) {
          out.firePressed = true;
        }
        return out;
      }

      return {
        update(dt, input) {
          if (state.gameOver) return;
          state.time += dt;

          // Move crosshairs & launch interceptors
          state.players.forEach((p, idx) => {
            if (p.cooldown > 0) p.cooldown -= dt;
            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(p) : input.p2);
            const spd = 380;
            if (ctrl.left) p.x -= spd * dt;
            if (ctrl.right) p.x += spd * dt;
            if (ctrl.up) p.y -= spd * dt;
            if (ctrl.down) p.y += spd * dt;
            p.x = Math.max(20, Math.min(W - 20, p.x));
            p.y = Math.max(30, Math.min(GROUND_Y - 40, p.y));

            if ((ctrl.firePressed || ctrl.fire) && p.cooldown <= 0) {
              p.cooldown = 0.32;
              const bat = state.batteries[idx];
              const dx = p.x - bat.x;
              const dy = p.y - bat.y;
              const dist = Math.max(1, Math.hypot(dx, dy));
              const speed = 560;
              state.interceptors.push({
                sx: bat.x, sy: bat.y,
                x: bat.x, y: bat.y,
                tx: p.x, ty: p.y,
                vx: (dx / dist) * speed,
                vy: (dy / dist) * speed,
                owner: p.id,
                color: p.color
              });
              engine.audio.laser();
            }
          });

          // Spawn enemy warheads
          if (state.waveRemaining > 0) {
            state.spawnTimer -= dt;
            if (state.spawnTimer <= 0) {
              const burstCount = state.wave >= 3 ? 2 : 1;
              for (let k = 0; k < burstCount && state.waveRemaining > 0; k++) {
                spawnEnemyMissile();
                state.waveRemaining -= 1;
              }
              state.spawnTimer = Math.max(0.45, 1.35 - state.wave * 0.1);
            }
          }

          // Update interceptors
          for (let i = state.interceptors.length - 1; i >= 0; i--) {
            const ic = state.interceptors[i];
            ic.x += ic.vx * dt;
            ic.y += ic.vy * dt;
            if (Math.hypot(ic.tx - ic.x, ic.ty - ic.y) < 14 || ic.y <= ic.ty) {
              state.explosions.push({
                x: ic.tx, y: ic.ty,
                r: 6, maxR: 54,
                growing: true,
                owner: ic.owner,
                color: ic.color
              });
              engine.audio.explode(false);
              state.interceptors.splice(i, 1);
            }
          }

          // Update explosions
          for (let i = state.explosions.length - 1; i >= 0; i--) {
            const ex = state.explosions[i];
            if (ex.growing) {
              ex.r += 110 * dt;
              if (ex.r >= ex.maxR) ex.growing = false;
            } else {
              ex.r -= 65 * dt;
              if (ex.r <= 0) state.explosions.splice(i, 1);
            }
          }

          // Update enemy missiles
          for (let i = state.enemyMissiles.length - 1; i >= 0; i--) {
            const m = state.enemyMissiles[i];
            m.x += m.vx * dt;
            m.y += m.vy * dt;

            // Caught in explosion? Chain reaction!
            let destroyedBy = null;
            for (const ex of state.explosions) {
              if (Math.hypot(m.x - ex.x, m.y - ex.y) < ex.r + 4) {
                destroyedBy = ex;
                break;
              }
            }
            if (destroyedBy) {
              const owner = state.players.find((pl) => pl.id === destroyedBy.owner);
              if (owner) owner.score += 50;
              state.explosions.push({
                x: m.x, y: m.y, r: 5, maxR: 42, growing: true,
                owner: destroyedBy.owner, color: '#facc15'
              });
              engine.audio.explode(false);
              state.enemyMissiles.splice(i, 1);
              continue;
            }

            // Impact ground / city
            if (m.y >= GROUND_Y) {
              state.explosions.push({ x: m.x, y: GROUND_Y, r: 8, maxR: 38, growing: true, owner: 0, color: '#ef4444' });
              engine.audio.explode(true);
              for (const c of state.cities) {
                if (c.alive && Math.abs(c.x - m.x) < 34) {
                  c.alive = false;
                }
              }
              state.enemyMissiles.splice(i, 1);
            }
          }

          // Wave completion
          if (state.waveRemaining <= 0 && state.enemyMissiles.length === 0 && state.explosions.length === 0) {
            const surviving = state.cities.filter((c) => c.alive).length;
            if (surviving === 0) {
              state.gameOver = true;
              engine.audio.gameOver();
            } else {
              state.players[0].score += surviving * 100;
              state.players[1].score += surviving * 100;
              state.wave += 1;
              state.waveRemaining = 12 + state.wave * 4;
              // Rebuild 1 city every 2 waves
              if (state.wave % 2 === 1) {
                const dead = state.cities.find((c) => !c.alive);
                if (dead) dead.alive = true;
              }
              engine.audio.powerup();
            }
          }

          if (state.cities.every((c) => !c.alive)) {
            state.gameOver = true;
            engine.audio.gameOver();
          }
        },

        render(ctx) {
          ctx.fillStyle = '#07060d';
          ctx.fillRect(0, 0, W, H);

          // Ground terrain
          ctx.fillStyle = '#a16207';
          ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

          // Batteries
          state.batteries.forEach((b, idx) => {
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.moveTo(b.x - 28, GROUND_Y);
            ctx.lineTo(b.x - 10, GROUND_Y - 22);
            ctx.lineTo(b.x + 10, GROUND_Y - 22);
            ctx.lineTo(b.x + 28, GROUND_Y);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#07060d';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`P${idx + 1}`, b.x, GROUND_Y - 5);
          });

          // Cities
          for (const c of state.cities) {
            if (!c.alive) {
              ctx.fillStyle = '#3f3f46';
              ctx.fillRect(c.x - 20, GROUND_Y - 4, 40, 4);
              continue;
            }
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(c.x - 22, GROUND_Y - 14, 10, 14);
            ctx.fillRect(c.x - 9, GROUND_Y - 24, 12, 24);
            ctx.fillRect(c.x + 6, GROUND_Y - 18, 14, 18);
            ctx.fillStyle = '#fde047';
            ctx.fillRect(c.x - 5, GROUND_Y - 18, 4, 4);
            ctx.fillRect(c.x + 10, GROUND_Y - 12, 4, 4);
          }

          // Enemy missiles
          ctx.lineWidth = 2;
          for (const m of state.enemyMissiles) {
            ctx.strokeStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(m.sx, m.sy);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(m.x - 2.5, m.y - 2.5, 5, 5);
          }

          // Interceptors
          for (const ic of state.interceptors) {
            ctx.strokeStyle = ic.color;
            ctx.beginPath();
            ctx.moveTo(ic.sx, ic.sy);
            ctx.lineTo(ic.x, ic.y);
            ctx.stroke();
            // Target X
            ctx.beginPath();
            ctx.moveTo(ic.tx - 5, ic.ty - 5); ctx.lineTo(ic.tx + 5, ic.ty + 5);
            ctx.moveTo(ic.tx + 5, ic.ty - 5); ctx.lineTo(ic.tx - 5, ic.ty + 5);
            ctx.stroke();
          }

          // Explosions
          for (const ex of state.explosions) {
            const pulse = Math.floor(state.time * 24) % 2 === 0;
            ctx.fillStyle = pulse ? '#ffffff' : ex.color;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, Math.max(1, ex.r), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          // Dual Crosshairs
          for (const p of state.players) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
            ctx.moveTo(p.x - 18, p.y); ctx.lineTo(p.x - 6, p.y);
            ctx.moveTo(p.x + 6, p.y); ctx.lineTo(p.x + 18, p.y);
            ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, p.y - 6);
            ctx.moveTo(p.x, p.y + 6); ctx.lineTo(p.x, p.y + 18);
            ctx.stroke();
            ctx.fillStyle = p.color;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`P${p.id}`, p.x + 15, p.y - 11);
          }
        },

        getHud() {
          const p1 = state.players[0];
          const p2 = state.players[1];
          const aliveCities = state.cities.filter((c) => c.alive).length;
          const total = p1.score + p2.score;
          return {
            p1Score: p1.score,
            p2Score: p2.score,
            p1Lives: aliveCities,
            p2Lives: aliveCities,
            livesSymbol: '⌂',
            levelText: `WAVE ${state.wave}`,
            highCandidate: total,
            gameOver: state.gameOver,
            overTitle: 'CITIES LOST',
            overMessage: `WAVE ${state.wave}\nP1: ${p1.score}  •  P2: ${p2.score}\nTEAM TOTAL: ${total}`
          };
        }
      };
    }
  });
})();
