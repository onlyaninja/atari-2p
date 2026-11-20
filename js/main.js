(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  const HIGH_SCORE_KEY = 'atari_top10_2p_highscores_v1';

  const els = {
    menuView: document.getElementById('menu-view'),
    gameView: document.getElementById('game-view'),
    gameGrid: document.getElementById('game-grid'),
    canvas: document.getElementById('game-canvas'),
    btnBack: document.getElementById('btn-back'),
    btnCrt: document.getElementById('btn-crt'),
    btnSound: document.getElementById('btn-sound'),
    btnControls: document.getElementById('btn-controls'),
    btnP2Bot: document.getElementById('btn-p2-bot'),
    btnPause: document.getElementById('btn-pause'),
    btnRestart: document.getElementById('btn-restart'),
    hudP1Score: document.getElementById('hud-p1-score'),
    hudP2Score: document.getElementById('hud-p2-score'),
    hudP1Lives: document.getElementById('hud-p1-lives'),
    hudP2Lives: document.getElementById('hud-p2-lives'),
    hudP2Name: document.getElementById('hud-p2-name'),
    hudTitle: document.getElementById('hud-game-title'),
    hudLevel: document.getElementById('hud-level'),
    hudMode: document.getElementById('hud-mode'),
    hudHi: document.getElementById('hud-hi'),
    stripP1: document.getElementById('strip-p1'),
    stripP2: document.getElementById('strip-p2'),
    overlay: document.getElementById('game-overlay'),
    overlayBadge: document.getElementById('overlay-badge'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayMessage: document.getElementById('overlay-message'),
    btnOverlayPrimary: document.getElementById('btn-overlay-primary'),
    btnOverlayRestart: document.getElementById('btn-overlay-restart'),
    btnOverlayMenu: document.getElementById('btn-overlay-menu'),
    controlsDialog: document.getElementById('controls-dialog')
  };

  const ctx = els.canvas.getContext('2d');
  let highScores = loadHighScores();
  let selectedIndex = 0;
  let activeGameDef = null;
  let activeInstance = null;
  let paused = false;
  let overShown = false;
  let rafId = null;
  let lastTime = 0;

  function loadHighScores() {
    try {
      return JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveHighScore(id, score) {
    if (!score || score <= (highScores[id] || 0)) return false;
    highScores[id] = score;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(highScores));
    } catch {
      // ignore storage quota errors
    }
    return true;
  }

  function padScore(val) {
    return String(Math.max(0, Math.floor(val || 0))).padStart(5, '0');
  }

  function formatLives(count, symbol = '♥') {
    if (count <= 0) return 'OUT';
    return symbol.repeat(Math.min(count, 6));
  }

  // Build Top 10 Cartridge Grid
  function renderMenu() {
    els.gameGrid.innerHTML = '';
    Atari.games.forEach((game, idx) => {
      const li = document.createElement('li');
      li.className = 'cart-item';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cart-card';
      btn.style.setProperty('--card-accent', game.accent);
      btn.dataset.index = String(idx);
      btn.setAttribute(
        'aria-label',
        `Play #${idx + 1} ${game.title} (${game.year}). ${game.upgradeNote}`
      );

      const rib = document.createElement('div');
      rib.className = 'cart-rib';
      rib.setAttribute('aria-hidden', 'true');

      const previewWrap = document.createElement('div');
      previewWrap.className = 'cart-preview-wrap';

      const previewCanvas = document.createElement('canvas');
      previewCanvas.className = 'cart-preview';
      previewCanvas.width = 220;
      previewCanvas.height = 165;
      previewCanvas.setAttribute('aria-hidden', 'true');
      const pctx = previewCanvas.getContext('2d');
      if (typeof game.drawThumbnail === 'function') {
        game.drawThumbnail(pctx, previewCanvas.width, previewCanvas.height);
      }

      const rank = document.createElement('span');
      rank.className = 'cart-rank';
      rank.textContent = `#${idx + 1}`;

      const badge = document.createElement('span');
      badge.className = `cart-badge ${game.upgraded ? 'cart-badge--upgraded' : 'cart-badge--classic'}`;
      badge.textContent = game.upgraded ? '2P UPGRADED' : '2P CLASSIC';

      previewWrap.append(previewCanvas, rank, badge);

      const body = document.createElement('div');
      body.className = 'cart-body';

      const titleRow = document.createElement('div');
      titleRow.className = 'cart-title-row';

      const title = document.createElement('h3');
      title.className = 'cart-title';
      title.textContent = game.title;

      const year = document.createElement('span');
      year.className = 'cart-year';
      year.textContent = String(game.year);

      titleRow.append(title, year);

      const desc = document.createElement('p');
      desc.className = 'cart-desc';
      desc.textContent = game.upgradeNote;

      const meta = document.createElement('div');
      meta.className = 'cart-meta';

      const mode = document.createElement('span');
      mode.className = 'cart-mode';
      mode.textContent = `2P ${game.mode}`;

      const hi = document.createElement('span');
      hi.className = 'cart-hi';
      hi.textContent = `HI ${padScore(highScores[game.id] || 0)}`;

      meta.append(mode, hi);
      body.append(titleRow, desc, meta);
      btn.append(rib, previewWrap, body);

      btn.addEventListener('click', () => {
        selectedIndex = idx;
        launchGame(game);
      });
      btn.addEventListener('mouseenter', () => {
        selectedIndex = idx;
        updateMenuSelection();
      });

      li.appendChild(btn);
      els.gameGrid.appendChild(li);
    });

    updateMenuSelection();
  }

  function updateMenuSelection() {
    const cards = els.gameGrid.querySelectorAll('.cart-card');
    cards.forEach((card, idx) => {
      card.classList.toggle('is-selected', idx === selectedIndex);
    });
  }

  const engineApi = {
    audio: Atari.audio
  };

  function launchGame(gameDef) {
    activeGameDef = gameDef;
    paused = false;
    overShown = false;
    els.overlay.hidden = true;

    els.menuView.hidden = true;
    els.gameView.hidden = false;
    els.btnBack.hidden = false;

    els.hudTitle.textContent = gameDef.title;
    els.hudMode.textContent = gameDef.upgraded ? `2P ${gameDef.mode} ★` : `2P ${gameDef.mode}`;
    els.stripP1.textContent = gameDef.controls.p1;
    els.stripP2.textContent = gameDef.controls.p2;
    els.hudHi.textContent = `HI ${padScore(highScores[gameDef.id] || 0)}`;

    Atari.input.resetEdges();
    Atari.input.setGameplayActive(true);
    Atari.audio.startFanfare();

    activeInstance = gameDef.create(engineApi);
    updateHud();

    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function restartGame() {
    if (!activeGameDef) return;
    launchGame(activeGameDef);
  }

  function returnToMenu() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    activeGameDef = null;
    activeInstance = null;
    paused = false;
    overShown = false;
    Atari.input.setGameplayActive(false);

    els.gameView.hidden = true;
    els.btnBack.hidden = true;
    els.overlay.hidden = true;
    els.menuView.hidden = false;

    renderMenu();
    Atari.audio.menuTick();
  }

  function setPaused(next) {
    if (!activeInstance || overShown) return;
    paused = next;
    if (paused) {
      els.overlayBadge.textContent = activeGameDef.upgraded ? '2P UPGRADED EDITION' : '2P CLASSIC EDITION';
      els.overlayTitle.textContent = 'PAUSED';
      els.overlayMessage.textContent = `${activeGameDef.title}\n${activeGameDef.upgradeNote}`;
      els.btnOverlayPrimary.hidden = false;
      els.btnOverlayPrimary.textContent = 'RESUME';
      els.overlay.hidden = false;
      els.btnPause.innerHTML = 'RESUME <kbd>P</kbd>';
    } else {
      els.overlay.hidden = true;
      els.btnPause.innerHTML = 'PAUSE <kbd>P</kbd>';
      lastTime = performance.now();
    }
  }

  function showGameOver(hud) {
    overShown = true;
    els.overlayBadge.textContent = activeGameDef.title;
    els.overlayTitle.textContent = hud.overTitle || 'GAME OVER';
    els.overlayMessage.textContent = hud.overMessage || '';
    els.btnOverlayPrimary.hidden = true;
    els.overlay.hidden = false;
  }

  function updateHud() {
    if (!activeInstance || !activeGameDef) return;
    const hud = activeInstance.getHud();
    els.hudP1Score.textContent = padScore(hud.p1Score);
    els.hudP2Score.textContent = padScore(hud.p2Score);
    els.hudP1Lives.textContent = hud.livesTextP1 || formatLives(hud.p1Lives, hud.livesSymbol || '♥');
    els.hudP2Lives.textContent = hud.livesTextP2 || formatLives(hud.p2Lives, hud.livesSymbol || '♥');
    els.hudLevel.textContent = hud.levelText || 'STAGE 1';

    if (saveHighScore(activeGameDef.id, hud.highCandidate)) {
      els.hudHi.textContent = `HI ${padScore(highScores[activeGameDef.id])}`;
    }

    if (hud.gameOver && !overShown) {
      showGameOver(hud);
    }
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    if (!activeInstance) return;
    if (!paused) {
      const inputState = Atari.input.poll();
      activeInstance.update(dt, inputState, engineApi);
      updateHud();
    }
    activeInstance.render(ctx, els.canvas.width, els.canvas.height, engineApi);
  }

  function toggleP2Bot() {
    Atari.input.p2Bot = !Atari.input.p2Bot;
    const isBot = Atari.input.p2Bot;
    els.btnP2Bot.setAttribute('aria-pressed', String(isBot));
    els.btnP2Bot.textContent = isBot ? 'P2: CPU BOT' : 'P2: HUMAN';
    els.hudP2Name.textContent = isBot ? 'PLAYER 2 (CPU)' : 'PLAYER 2';
    Atari.audio.menuTick();
  }

  // UI Event Listeners
  els.btnBack.addEventListener('click', returnToMenu);
  els.btnOverlayMenu.addEventListener('click', returnToMenu);
  els.btnRestart.addEventListener('click', restartGame);
  els.btnOverlayRestart.addEventListener('click', restartGame);
  els.btnPause.addEventListener('click', () => setPaused(!paused));
  els.btnOverlayPrimary.addEventListener('click', () => setPaused(false));
  els.btnP2Bot.addEventListener('click', toggleP2Bot);

  els.btnCrt.addEventListener('click', () => {
    const on = document.body.classList.toggle('crt-on');
    els.btnCrt.setAttribute('aria-pressed', String(on));
    els.btnCrt.textContent = on ? 'CRT: ON' : 'CRT: OFF';
    Atari.audio.menuTick();
  });

  els.btnSound.addEventListener('click', () => {
    const next = !Atari.audio.enabled;
    Atari.audio.setEnabled(next);
    els.btnSound.setAttribute('aria-pressed', String(next));
    els.btnSound.textContent = next ? 'SFX: ON' : 'SFX: OFF';
    if (next) Atari.audio.menuTick();
  });

  // Native <dialog closedby="any"> modal + Safari fallback
  els.btnControls.addEventListener('click', () => {
    if (activeInstance && !paused && !overShown) setPaused(true);
    els.controlsDialog.showModal();
  });

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    els.controlsDialog.addEventListener('click', (event) => {
      if (event.target !== els.controlsDialog) return;
      const rect = els.controlsDialog.getBoundingClientRect();
      const inside = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!inside) els.controlsDialog.close();
    });
  }

  // Global keyboard shortcuts (menu navigation & gameplay shortcuts)
  window.addEventListener('keydown', (e) => {
    if (els.controlsDialog.open) return;

    if (activeInstance) {
      if (e.code === 'Escape') {
        e.preventDefault();
        returnToMenu();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        setPaused(!paused);
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        restartGame();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        toggleP2Bot();
      }
      return;
    }

    // Menu keyboard navigation
    const total = Atari.games.length;
    if (total === 0) return;

    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % total;
      updateMenuSelection();
      Atari.audio.menuTick();
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + total) % total;
      updateMenuSelection();
      Atari.audio.menuTick();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 5) % total;
      updateMenuSelection();
      Atari.audio.menuTick();
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 5 + total) % total;
      updateMenuSelection();
      Atari.audio.menuTick();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON' && !document.activeElement.classList.contains('cart-card')) {
        return;
      }
      e.preventDefault();
      launchGame(Atari.games[selectedIndex]);
    }
  });

  // Boot the Multi-Cart Menu!
  renderMenu();
})();
