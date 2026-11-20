(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  const W = 800;
  const H = 600;
  const TILE = 28;
  // 25 cols x 21 rows -> 700 x 588, centered nicely in 800x600!
  const MAP_TEMPLATE = [
    '#########################',
    '#o..........#..........o#',
    '#.###.#####.#.#####.###.#',
    '#.......................#',
    '#.###.#.#########.#.###.#',
    '#.....#.....#.....#.....#',
    '#####.##### # #####.#####',
    '    #.#           #.#    ',
    '#####.# ###===### #.#####',
    '     .  #  GGG  #  .     ',
    '#####.# ######### #.#####',
    '    #.#           #.#    ',
    '#####.# ######### #.#####',
    '#...........#...........#',
    '#.###.#####.#.#####.###.#',
    '#o..#....... .......#..o#',
    '###.#.#.#########.#.#.###',
    '#.....#.....#.....#.....#',
    '#.#########.#.#########.#',
    '#.......................#',
    '#########################'
  ];

  const ROWS = MAP_TEMPLATE.length;
  const COLS = MAP_TEMPLATE[0].length;
  const OX = Math.floor((W - COLS * TILE) / 2);
  const OY = Math.floor((H - ROWS * TILE) / 2);

  const DIRS = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 }
  };

  Atari.games.push({
    id: 'pacman',
    title: 'PAC-MAN',
    year: 1980,
    originalPlayers: '1P / Alternating',
    upgradeNote: 'Upgraded to Simultaneous 2P Dual-Chomper Maze Co-op!',
    upgraded: true,
    mode: 'CO-OP',
    accent: '#facc15',
    controls: {
      p1: 'WASD Navigate Maze',
      p2: 'ARROWS Navigate Maze'
    },

    drawThumbnail(ctx, w, h) {
      ctx.fillStyle = '#040510';
      ctx.fillRect(0, 0, w, h);
      // Maze walls
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.strokeRect(40, 36, 48, 22);
      ctx.strokeRect(w - 88, 36, 48, 22);
      ctx.strokeRect(w / 2 - 26, h / 2 - 12, 52, 24);
      // Pellets
      ctx.fillStyle = '#fde68a';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.arc(32 + i * 24, h - 30, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      // P1 Cyan Pac & P2 Gold Pac
      const drawPac = (x, y, color, dir) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, 12, dir + 0.45, dir + Math.PI * 2 - 0.45);
        ctx.closePath();
        ctx.fill();
      };
      drawPac(w * 0.28, h * 0.72, '#38e8ff', 0);
      drawPac(w * 0.72, h * 0.72, '#facc15', Math.PI);
      // Ghost
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.28, 10, Math.PI, 0);
      ctx.lineTo(w * 0.5 + 10, h * 0.28 + 10);
      ctx.lineTo(w * 0.5 - 10, h * 0.28 + 10);
      ctx.closePath();
      ctx.fill();
    },

    create(engine) {
      const state = {
        level: 1,
        time: 0,
        gameOver: false,
        frightTimer: 0,
        wakaToggle: false,
        grid: [],
        pelletsLeft: 0,
        players: [
          { id: 1, col: 9, row: 15, x: 0, y: 0, dir: 'left', want: 'left', color: '#38e8ff', score: 0, lives: 3, alive: true, invuln: 1.5, respawn: 0 },
          { id: 2, col: 15, row: 15, x: 0, y: 0, dir: 'right', want: 'right', color: '#facc15', score: 0, lives: 3, alive: true, invuln: 1.5, respawn: 0 }
        ],
        ghosts: []
      };

      function tileCenter(c, r) {
        return { x: OX + c * TILE + TILE / 2, y: OY + r * TILE + TILE / 2 };
      }

      function isWall(c, r, allowGate = false) {
        if (r < 0 || r >= ROWS) return true;
        if (c < 0 || c >= COLS) return false; // side tunnel wrap
        const ch = state.grid[r][c];
        if (ch === '#') return true;
        if (ch === '=' && !allowGate) return true;
        return false;
      }

      function loadMaze() {
        state.grid = MAP_TEMPLATE.map((row) => row.split(''));
        state.pelletsLeft = 0;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (state.grid[r][c] === '.' || state.grid[r][c] === 'o') state.pelletsLeft++;
          }
        }
      }

      function resetPositions() {
        const starts = [{ c: 9, r: 15, d: 'left' }, { c: 15, r: 15, d: 'right' }];
        state.players.forEach((p, i) => {
          const pos = tileCenter(starts[i].c, starts[i].r);
          p.x = pos.x; p.y = pos.y;
          p.dir = starts[i].d; p.want = starts[i].d;
          p.invuln = 1.5;
        });

        const ghostSpecs = [
          { name: 'Blinky', color: '#ef4444', c: 12, r: 7, d: 'left' },
          { name: 'Pinky', color: '#f472b6', c: 11, r: 9, d: 'up' },
          { name: 'Inky', color: '#22d3ee', c: 12, r: 9, d: 'up' },
          { name: 'Clyde', color: '#fb923c', c: 13, r: 9, d: 'up' }
        ];
        state.ghosts = ghostSpecs.map((g, idx) => {
          const pos = tileCenter(g.c, g.r);
          return { ...g, x: pos.x, y: pos.y, dir: g.d, homeC: g.c, homeR: g.r, exitDelay: idx * 1.4 };
        });
      }

      function moveEntity(ent, speed, dt, isGhost) {
        const centerCol = Math.floor((ent.x - OX) / TILE);
        const centerRow = Math.floor((ent.y - OY) / TILE);
        const tc = tileCenter(centerCol, centerRow);
        const distToCenter = Math.hypot(ent.x - tc.x, ent.y - tc.y);

        // Allow instant reverse anytime for responsive feel
        if (!isGhost && ent.want && ent.want !== ent.dir) {
          const dCur = DIRS[ent.dir];
          const dWant = DIRS[ent.want];
          if (dCur.x === -dWant.x && dCur.y === -dWant.y) {
            ent.dir = ent.want;
          }
        }

        if (distToCenter < speed * dt + 2.5) {
          if (!isGhost && ent.want) {
            const dw = DIRS[ent.want];
            if (!isWall(centerCol + dw.x, centerRow + dw.y, false)) {
              if (ent.want !== ent.dir) {
                ent.x = tc.x; ent.y = tc.y;
                ent.dir = ent.want;
              }
            }
          } else if (isGhost) {
            // Choose ghost direction at intersection
            const opp = { left: 'right', right: 'left', up: 'down', down: 'up' }[ent.dir];
            const options = ['up', 'left', 'down', 'right'].filter((d) => {
              if (d === opp) return false;
              const v = DIRS[d];
              return !isWall(centerCol + v.x, centerRow + v.y, centerRow >= 8 && centerRow <= 10);
            });
            if (options.length > 0) {
              const living = state.players.filter((p) => p.alive);
              let bestDir = options[0];
              if (state.frightTimer > 0) {
                bestDir = options[Math.floor(Math.random() * options.length)];
              } else if (living.length > 0) {
                // Chase nearest player (or leave ghost house)
                const tgt = (centerRow >= 8 && centerRow <= 10 && centerCol >= 10 && centerCol <= 14)
                  ? tileCenter(12, 7)
                  : living.reduce((best, cur) =>
                      Math.hypot(cur.x - ent.x, cur.y - ent.y) < Math.hypot(best.x - ent.x, best.y - ent.y) ? cur : best, living[0]);
                let bestScore = Infinity;
                for (const d of options) {
                  const v = DIRS[d];
                  const nextPos = tileCenter(centerCol + v.x, centerRow + v.y);
                  const dist = Math.hypot(nextPos.x - tgt.x, nextPos.y - tgt.y) + Math.random() * 18;
                  if (dist < bestScore) { bestScore = dist; bestDir = d; }
                }
              }
              if (bestDir !== ent.dir) {
                ent.x = tc.x; ent.y = tc.y;
                ent.dir = bestDir;
              }
            } else {
              ent.dir = opp;
            }
          }

          // Check forward wall
          const dv = DIRS[ent.dir];
          if (isWall(centerCol + dv.x, centerRow + dv.y, isGhost && centerRow >= 8 && centerRow <= 10)) {
            ent.x = tc.x;
            ent.y = tc.y;
            return;
          }
        }

        const dv = DIRS[ent.dir];
        ent.x += dv.x * speed * dt;
        ent.y += dv.y * speed * dt;

        // Horizontal tunnel wrap
        if (ent.x < OX - TILE / 2) ent.x = OX + COLS * TILE + TILE / 2;
        if (ent.x > OX + COLS * TILE + TILE / 2) ent.x = OX - TILE / 2;
      }

      function botControl(p) {
        const out = { left: false, right: false, up: false, down: false };
        const col = Math.max(0, Math.min(COLS - 1, Math.floor((p.x - OX) / TILE)));
        const row = Math.max(0, Math.min(ROWS - 1, Math.floor((p.y - OY) / TILE)));
        const options = ['up', 'down', 'left', 'right'].filter((d) => {
          const v = DIRS[d];
          return !isWall(col + v.x, row + v.y, false);
        });
        if (options.length === 0) return out;
        // Prefer direction with pellet and away from non-frightened ghosts
        let bestD = options[0];
        let bestVal = -Infinity;
        for (const d of options) {
          const v = DIRS[d];
          const nc = (col + v.x + COLS) % COLS;
          const nr = row + v.y;
          let score = 0;
          const cell = state.grid[nr]?.[nc];
          if (cell === 'o') score += 80;
          else if (cell === '.') score += 40;
          if (d === p.dir) score += 8;
          const np = tileCenter(nc, nr);
          for (const g of state.ghosts) {
            const gd = Math.hypot(g.x - np.x, g.y - np.y);
            if (state.frightTimer > 0) score += Math.max(0, 120 - gd) * 0.6;
            else if (gd < 90) score -= (100 - gd) * 2.5;
          }
          if (score > bestVal) { bestVal = score; bestD = d; }
        }
        out[bestD] = true;
        return out;
      }

      loadMaze();
      resetPositions();

      return {
        update(dt, input) {
          if (state.gameOver) return;
          state.time += dt;
          if (state.frightTimer > 0) state.frightTimer = Math.max(0, state.frightTimer - dt);

          const pacSpeed = 148 + Math.min(35, (state.level - 1) * 8);
          state.players.forEach((p, idx) => {
            if (!p.alive) {
              if (p.lives > 0) {
                p.respawn -= dt;
                if (p.respawn <= 0) {
                  p.alive = true; p.invuln = 2;
                  const pos = tileCenter(idx === 0 ? 9 : 15, 15);
                  p.x = pos.x; p.y = pos.y;
                }
              }
              return;
            }
            if (p.invuln > 0) p.invuln -= dt;
            const ctrl = idx === 0 ? input.p1 : (input.p2Bot ? botControl(p) : input.p2);
            if (ctrl.left) p.want = 'left';
            else if (ctrl.right) p.want = 'right';
            else if (ctrl.up) p.want = 'up';
            else if (ctrl.down) p.want = 'down';

            moveEntity(p, pacSpeed, dt, false);

            // Eat pellets
            const col = Math.floor((p.x - OX) / TILE);
            const row = Math.floor((p.y - OY) / TILE);
            if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
              const ch = state.grid[row][col];
              if (ch === '.' || ch === 'o') {
                state.grid[row][col] = ' ';
                state.pelletsLeft--;
                if (ch === 'o') {
                  p.score += 50;
                  state.frightTimer = Math.max(4.5, 8 - state.level * 0.5);
                  engine.audio.powerup();
                } else {
                  p.score += 10;
                  state.wakaToggle = !state.wakaToggle;
                  engine.audio.waka(state.wakaToggle);
                }
              }
            }
          });

          // Ghosts
          const ghostSpeed = state.frightTimer > 0 ? 86 : 122 + Math.min(45, (state.level - 1) * 10);
          for (const g of state.ghosts) {
            if (g.exitDelay > 0) { g.exitDelay -= dt; continue; }
            moveEntity(g, ghostSpeed, dt, true);

            for (const p of state.players) {
              if (!p.alive || p.invuln > 0) continue;
              if (Math.hypot(p.x - g.x, p.y - g.y) < 18) {
                if (state.frightTimer > 0) {
                  // Chomp ghost!
                  p.score += 200;
                  const home = tileCenter(12, 9);
                  g.x = home.x; g.y = home.y; g.dir = 'up'; g.exitDelay = 1.6;
                  engine.audio.score();
                } else {
                  p.lives -= 1; p.alive = false; p.respawn = 1.6;
                  engine.audio.explode(true);
                }
              }
            }
          }

          if (state.pelletsLeft <= 0) {
            state.level += 1;
            state.players.forEach((p) => { if (!p.alive && p.lives === 0) { p.lives = 1; p.alive = true; } });
            engine.audio.powerup();
            loadMaze();
            resetPositions();
          }

          if (state.players.every((p) => !p.alive && p.lives <= 0)) {
            state.gameOver = true;
            engine.audio.gameOver();
          }
        },

        render(ctx) {
          ctx.fillStyle = '#040510';
          ctx.fillRect(0, 0, W, H);

          // Maze walls & pellets
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              const ch = state.grid[r][c];
              const x = OX + c * TILE;
              const y = OY + r * TILE;
              if (ch === '#') {
                ctx.fillStyle = '#1d4ed8';
                ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
              } else if (ch === '=') {
                ctx.fillStyle = '#f472b6';
                ctx.fillRect(x, y + TILE / 2 - 2, TILE, 4);
              } else if (ch === '.') {
                ctx.fillStyle = '#fef08a';
                ctx.beginPath();
                ctx.arc(x + TILE / 2, y + TILE / 2, 3, 0, Math.PI * 2);
                ctx.fill();
              } else if (ch === 'o') {
                const pulse = 5.5 + Math.sin(state.time * 10) * 1.8;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(x + TILE / 2, y + TILE / 2, pulse, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          // Ghosts
          for (const g of state.ghosts) {
            const frightened = state.frightTimer > 0;
            const flash = frightened && state.frightTimer < 2 && Math.floor(state.time * 10) % 2 === 0;
            ctx.fillStyle = frightened ? (flash ? '#ffffff' : '#2563eb') : g.color;
            ctx.beginPath();
            ctx.arc(g.x, g.y - 2, 11, Math.PI, 0);
            ctx.lineTo(g.x + 11, g.y + 10);
            ctx.lineTo(g.x + 5, g.y + 7);
            ctx.lineTo(g.x, g.y + 10);
            ctx.lineTo(g.x - 5, g.y + 7);
            ctx.lineTo(g.x - 11, g.y + 10);
            ctx.closePath();
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(g.x - 4, g.y - 3, 3, 0, Math.PI * 2);
            ctx.arc(g.x + 4, g.y - 3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#09090b';
            ctx.beginPath();
            ctx.arc(g.x - 4 + DIRS[g.dir].x * 1.2, g.y - 3 + DIRS[g.dir].y * 1.2, 1.5, 0, Math.PI * 2);
            ctx.arc(g.x + 4 + DIRS[g.dir].x * 1.2, g.y - 3 + DIRS[g.dir].y * 1.2, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Pac-Men (P1 Cyan, P2 Yellow/Gold)
          const dirAngles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
          for (const p of state.players) {
            if (!p.alive) continue;
            if (p.invuln > 0 && Math.floor(state.time * 16) % 2 === 0) continue;
            const mouth = 0.2 + Math.abs(Math.sin(state.time * 14)) * 0.45;
            const base = dirAngles[p.dir];
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.arc(p.x, p.y, 12, base + mouth, base + Math.PI * 2 - mouth);
            ctx.closePath();
            ctx.fill();
            // Tiny P2 ribbon / bow so both chompers feel iconic!
            if (p.id === 2) {
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(p.x - 4, p.y - 13, 8, 4);
            }
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
            levelText: `MAZE ${state.level}`,
            highCandidate: total,
            gameOver: state.gameOver,
            overTitle: 'GHOSTS WIN',
            overMessage: `MAZE ${state.level}\nP1: ${p1.score}  •  P2: ${p2.score}\nTEAM TOTAL: ${total}`
          };
        }
      };
    }
  });
})();
