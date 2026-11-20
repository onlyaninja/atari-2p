(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;
  const GROUND_Y = 420;

  // 8 handcrafted classic Pitfall-style jungle screens (wraps smoothly!)
  const SCREENS = [
    { hazard: 'logs', pit: null, vine: false, treasure: { x: 640, type: 'gold', pts: 4000 } },
    { hazard: 'crocs', pit: { x: 280, w: 240, type: 'water' }, vine: true, treasure: { x: 680, type: 'silver', pts: 3000 } },
    { hazard: 'logs', pit: { x: 320, w: 170, type: 'tar' }, vine: true, treasure: { x: 590, type: 'ring', pts: 5000 } },
    { hazard: 'fire', pit: null, vine: false, treasure: { x: 660, type: 'money', pts: 2000 } },
    { hazard: 'crocs', pit: { x: 250, w: 280, type: 'water' }, vine: true, treasure: { x: 680, type: 'gold', pts: 4000 } },
    { hazard: 'logs', pit: { x: 310, w: 180, type: 'tar' }, vine: true, treasure: { x: 640, type: 'ring', pts: 5000 } },
    { hazard: 'fire', pit: { x: 330, w: 140, type: 'tar' }, vine: true, treasure: { x: 680, type: 'silver', pts: 3000 } },
    { hazard: 'logs', pit: null, vine: false, treasure: { x: 620, type: 'ring', pts: 5000 } }
  ];

  Atari.games.push({
    id: 'pitfall',
    title: 'PITFALL!',
    year: 1982,
    originalPlayers: '1P Only',
    upgradeNote: 'Upgraded to Simultaneous 2P Jungle Treasure Dash!',
    upgraded: true,
    mode: 'CO-OP',
    accent: '#22c55e',
    controls: {
      p1: 'A / D Run • W or SPACE Jump / Grab Vine',
      p2: '← / → Run • ↑ or ENTER Jump / Grab Vine'
    },

    drawThumbnail(ctx, w, h) {
      // Jungle canopy & ground
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, w, 34);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(0, 34, w, h - 84);
      ctx.fillStyle = '#a16207';
      ctx.fillRect(0, h - 50, w, 50);
      // Trees
      ctx.fillStyle = '#5c3317';
      [26, 94, 166].forEach((tx) => ctx.fillRect(tx, 30, 14, h - 80));
      // Croc pit
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(72, h - 50, 74, 18);
      // Vine
      ctx.strokeStyle = '#bef264';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w / 2, 26); ctx.lineTo(w / 2 + 24, h - 78); ctx.stroke();
      // Two explorers
      ctx.fillStyle = '#38e8ff';
      ctx.fillRect(42, h - 72, 10, 22);
      ctx.fillStyle = '#ffb830';
      ctx.fillRect(w / 2 + 19, h - 86, 10, 22);
      // Gold bar
      ctx.fillStyle = '#facc15';
      ctx.fillRect(w - 36, h - 62, 18, 10);
    },

    create(engine) {
      const state = {
        screenIdx: 0,
        lap: 1,
        time: 0,
        gameOver: false,
        logs: [],
        crocOpen: false,
        treasureTaken: false,
        vineAngle: 0,
        players: [
          { id: 1, x: 75, y: GROUND_Y, vy: 0, grounded: true, onVine: false, color: '#38e8ff', score: 0, lives: 3, alive: true, invuln: 1, respawn: 0, facing: 1 },
          { id: 2, x: 125, y: GROUND_Y, vy: 0, grounded: true, onVine: false, color: '#ffb830', score: 0, lives: 3, alive: true, invuln: 1, respawn: 0, facing: 1 }
        ]
      };

      function loadScreen(idx) {
        state.screenIdx = idx;
        state.treasureTaken = false;
        const sc = SCREENS[idx % SCREENS.length];
        state.logs = [];
        if (sc.hazard === 'logs') {
          state.logs = [
            { x: W - 40, speed: 170 + state.lap * 20 },
            { x: W + 280, speed: 170 + state.lap * 20 }
          ];
        } else if (sc.hazard === 'fire') {
          state.logs = [
            { x: 240, speed: 0, fire: true },
            { x: 470, speed: 0, fire: true }
          ];
        }
        state.players.forEach((p, i) => {
          if (p.alive) {
            p.x = 55 + i * 42;
            p.y = GROUND_Y;
            p.vy = 0;
            p.grounded = true;
            p.onVine = false;
          }
        });
      }

      function vineTip() {
        const len = 215;
        return {
          x: W / 2 + Math.sin(state.vineAngle) * len,
          y: 125 + Math.cos(state.vineAngle) * len
        };
      }

      function botControl(p) {
        const out = { left: false, right: true, upPressed: false, firePressed: false };
        const sc = SCREENS[state.screenIdx % SCREENS.length];
        if (p.onVine) {
          // Release near right side of pit
          if (p.x > (sc.pit ? sc.pit.x + sc.pit.w - 25 : W * 0.6)) {
            out.firePressed = true;
          }
          return out;
        }
        // Jump before pit or log
        if (sc.pit && p.x > sc.pit.x - 42 && p.x < sc.pit.x + 10 && p.grounded) {
          out.firePressed = true;
        }
        for (const lg of state.logs) {
          if (lg.x > p.x && lg.x - p.x < 52 && p.grounded) {
            out.firePressed = true;
          }
        }
        return out;
      }

      loadScreen(0);

      return {
        update(dt, input) {
          if (state.gameOver) return;
          state.time += dt;
          state.vineAngle = Math.sin(state.time * 2.1) * 0.92;
          state.crocOpen = Math.sin(state.time * 2.4) > 0.25;
          const sc = SCREENS[state.screenIdx % SCREENS.length];
          const tip = vineTip();

          // Move rolling logs
          for (const lg of state.logs) {
            if (!lg.fire) {
              lg.x -= lg.speed * dt;
              if (lg.x < -30) lg.x = W + 60;
            }
          }

          let advanceScreen = false;

          state.players.forEach((p, idx) => {
            if (!p.alive) {
              if (p.lives > 0) {
                p.respawn -= dt;
                if (p.respawn <= 0) {
                  p.alive = true; p.invuln = 2;
                  p.x = 65 + idx * 35; p.y = GROUND_Y; p.vy = 0; p.grounded = true; p.onVine = false;
                }
              }
              return;
            }
            if (p.invuln > 0) p.invuln -= dt;
            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(p) : input.p2);
            const jumpTrig = ctrl.firePressed || ctrl.upPressed;

            if (p.onVine) {
              p.x = tip.x;
              p.y = tip.y + 18;
              if (jumpTrig) {
                p.onVine = false;
                p.vy = -340;
                p.x += Math.cos(state.vineAngle) * 32;
                engine.audio.jump();
              }
            } else {
              const spd = 230;
              if (ctrl.left) { p.x -= spd * dt; p.facing = -1; }
              if (ctrl.right) { p.x += spd * dt; p.facing = 1; }
              p.x = Math.max(20, p.x);

              if (jumpTrig && p.grounded) {
                p.vy = -440;
                p.grounded = false;
                engine.audio.jump();
              }

              p.vy += 1080 * dt;
              p.y += p.vy * dt;

              // Grab vine in midair!
              if (sc.vine && !p.grounded && Math.hypot(p.x - tip.x, (p.y - 20) - tip.y) < 38) {
                p.onVine = true;
                p.vy = 0;
                engine.audio.pong(true);
              }

              // Check pit vs ground
              const overPit = sc.pit && p.x > sc.pit.x + 8 && p.x < sc.pit.x + sc.pit.w - 8;
              let stoodOnCroc = false;
              if (overPit && sc.hazard === 'crocs' && !state.crocOpen && p.vy >= 0 && p.y >= GROUND_Y - 6 && p.y <= GROUND_Y + 14) {
                // Can bounce on closed crocodile heads!
                const crocXs = [sc.pit.x + 52, sc.pit.x + sc.pit.w / 2, sc.pit.x + sc.pit.w - 52];
                if (crocXs.some((cx) => Math.abs(p.x - cx) < 26)) {
                  p.y = GROUND_Y; p.vy = 0; p.grounded = true; stoodOnCroc = true;
                }
              }

              if (!overPit && p.y >= GROUND_Y) {
                p.y = GROUND_Y;
                p.vy = 0;
                p.grounded = true;
              } else if (overPit && !stoodOnCroc && p.y > GROUND_Y + 26) {
                // Fell into pit!
                p.lives -= 1; p.alive = false; p.respawn = 1.2;
                engine.audio.explode(true);
                return;
              }
            }

            // Hazard collision (logs / fire)
            if (p.invuln <= 0 && !p.onVine) {
              for (const lg of state.logs) {
                if (Math.abs(p.x - lg.x) < 18 && p.y > GROUND_Y - 26) {
                  if (lg.fire) {
                    p.lives -= 1; p.alive = false; p.respawn = 1.2;
                    engine.audio.explode(true);
                  } else {
                    // Rolling log trips you & deducts points just like Atari 2600 Pitfall!
                    p.score = Math.max(0, p.score - 100);
                    p.invuln = 0.7;
                    p.vy = -210; p.grounded = false;
                    engine.audio.hit();
                  }
                }
              }
            }

            // Collect treasure!
            if (!state.treasureTaken && sc.treasure && Math.abs(p.x - sc.treasure.x) < 26 && Math.abs(p.y - GROUND_Y) < 34) {
              state.treasureTaken = true;
              p.score += sc.treasure.pts;
              engine.audio.powerup();
            }

            // Reached right edge -> advance jungle screen for both explorers!
            if (p.x >= W - 18) {
              p.score += 250;
              advanceScreen = true;
            }
          });

          if (advanceScreen) {
            const next = state.screenIdx + 1;
            if (next % SCREENS.length === 0) state.lap += 1;
            engine.audio.score();
            loadScreen(next);
          }

          if (state.players.every((p) => !p.alive && p.lives <= 0)) {
            state.gameOver = true;
            engine.audio.gameOver();
          }
        },

        render(ctx) {
          const sc = SCREENS[state.screenIdx % SCREENS.length];

          // Sky / deep jungle background
          ctx.fillStyle = '#0d3b1e';
          ctx.fillRect(0, 0, W, 115);
          ctx.fillStyle = '#15803d';
          ctx.fillRect(0, 115, W, GROUND_Y - 115);

          // Tree trunks
          ctx.fillStyle = '#5c3317';
          [95, 240, 560, 705].forEach((tx) => {
            ctx.fillRect(tx, 110, 34, GROUND_Y - 110);
            ctx.fillStyle = '#3f220e';
            ctx.fillRect(tx + 24, 110, 10, GROUND_Y - 110);
            ctx.fillStyle = '#5c3317';
          });
          // Leafy canopy trim
          ctx.fillStyle = '#166534';
          for (let x = 0; x < W; x += 64) {
            ctx.beginPath();
            ctx.arc(x + 32, 115, 42, 0, Math.PI);
            ctx.fill();
          }

          // Ground & underground brick tunnel aesthetic
          ctx.fillStyle = '#b45309';
          ctx.fillRect(0, GROUND_Y, W, 38);
          ctx.fillStyle = '#451a03';
          ctx.fillRect(0, GROUND_Y + 38, W, H - (GROUND_Y + 38));
          // Classic underground wall texture
          ctx.fillStyle = '#78350f';
          for (let y = GROUND_Y + 52; y < H; y += 26) {
            for (let x = (y % 52 === 0 ? 0 : 28); x < W; x += 56) {
              ctx.fillRect(x, y, 48, 18);
            }
          }

          // Pit (water with crocodiles or bubbling tar)
          if (sc.pit) {
            ctx.fillStyle = sc.pit.type === 'water' ? '#1d4ed8' : '#111827';
            ctx.fillRect(sc.pit.x, GROUND_Y, sc.pit.w, 46);
            if (sc.hazard === 'crocs') {
              const crocXs = [sc.pit.x + 52, sc.pit.x + sc.pit.w / 2, sc.pit.x + sc.pit.w - 52];
              crocXs.forEach((cx) => {
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(cx - 22, GROUND_Y + 4, 44, 14);
                if (state.crocOpen) {
                  // Open snapping jaws!
                  ctx.fillStyle = '#15803d';
                  ctx.beginPath();
                  ctx.moveTo(cx - 18, GROUND_Y + 4);
                  ctx.lineTo(cx + 16, GROUND_Y - 16);
                  ctx.lineTo(cx + 18, GROUND_Y + 4);
                  ctx.fill();
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(cx - 6, GROUND_Y - 4, 4, 5);
                  ctx.fillRect(cx + 4, GROUND_Y - 8, 4, 5);
                } else {
                  ctx.fillStyle = '#facc15';
                  ctx.fillRect(cx - 10, GROUND_Y + 1, 5, 4);
                }
              });
            }
          }

          // Swinging vine
          if (sc.vine) {
            const tip = vineTip();
            ctx.strokeStyle = '#bef264';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(W / 2, 125);
            ctx.lineTo(tip.x, tip.y);
            ctx.stroke();
            ctx.fillStyle = '#a3e635';
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
            ctx.fill();
          }

          // Rolling logs or campfires
          for (const lg of state.logs) {
            if (lg.fire) {
              const flick = Math.sin(state.time * 20) * 6;
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.moveTo(lg.x - 16, GROUND_Y);
              ctx.lineTo(lg.x, GROUND_Y - 32 - flick);
              ctx.lineTo(lg.x + 16, GROUND_Y);
              ctx.fill();
              ctx.fillStyle = '#facc15';
              ctx.beginPath();
              ctx.moveTo(lg.x - 8, GROUND_Y);
              ctx.lineTo(lg.x, GROUND_Y - 18 - flick * 0.5);
              ctx.lineTo(lg.x + 8, GROUND_Y);
              ctx.fill();
            } else {
              ctx.fillStyle = '#7c2d12';
              ctx.beginPath();
              ctx.arc(lg.x, GROUND_Y - 12, 13, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#d97706';
              ctx.beginPath();
              ctx.arc(lg.x, GROUND_Y - 12, 6, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Treasure
          if (!state.treasureTaken && sc.treasure) {
            const tx = sc.treasure.x;
            const ty = GROUND_Y - 16;
            if (sc.treasure.type === 'gold') {
              ctx.fillStyle = '#facc15';
              ctx.fillRect(tx - 15, ty, 30, 14);
              ctx.fillStyle = '#fef08a';
              ctx.fillRect(tx - 11, ty + 2, 22, 4);
            } else if (sc.treasure.type === 'silver') {
              ctx.fillStyle = '#e2e8f0';
              ctx.fillRect(tx - 15, ty, 30, 14);
            } else if (sc.treasure.type === 'ring') {
              ctx.strokeStyle = '#facc15';
              ctx.lineWidth = 4;
              ctx.beginPath(); ctx.arc(tx, ty + 6, 10, 0, Math.PI * 2); ctx.stroke();
              ctx.fillStyle = '#38e8ff';
              ctx.fillRect(tx - 4, ty - 8, 8, 8);
            } else {
              ctx.fillStyle = '#fde047';
              ctx.beginPath(); ctx.arc(tx, ty + 6, 12, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#15803d';
              ctx.font = 'bold 14px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('$', tx, ty + 11);
            }
          }

          // Explorers (P1 & P2)
          for (const p of state.players) {
            if (!p.alive) continue;
            if (p.invuln > 0 && Math.floor(state.time * 16) % 2 === 0) continue;
            const runStep = p.grounded ? Math.sin(state.time * 16) * 5 : 4;
            // Head
            ctx.fillStyle = '#fde68a';
            ctx.fillRect(p.x - 6, p.y - 44, 12, 11);
            // Hat
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 10, p.y - 48, 20, 5);
            // Torso
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 7, p.y - 33, 14, 18);
            // Legs
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(p.x - 6 - runStep * 0.5, p.y - 15, 5, 15);
            ctx.fillRect(p.x + 1 + runStep * 0.5, p.y - 15, 5, 15);
            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`P${p.id}`, p.x, p.y - 54);
          }

          // Right arrow exit cue
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'right';
          ctx.fillText('NEXT JUNGLE ▶', W - 16, 40);
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
            levelText: `ZONE ${state.screenIdx + 1}`,
            highCandidate: total,
            gameOver: state.gameOver,
            overTitle: 'LOST IN THE JUNGLE',
            overMessage: `REACHED ZONE ${state.screenIdx + 1}\nP1: ${p1.score}  •  P2: ${p2.score}\nTREASURE TOTAL: ${total}`
          };
        }
      };
    }
  });
})();
