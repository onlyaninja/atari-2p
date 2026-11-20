(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyF', 'KeyG', 'KeyQ', 'ShiftLeft',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Slash',
    'Period', 'ShiftRight', 'Numpad0', 'NumpadDecimal', 'NumpadEnter'
  ]);

  class InputManager {
    constructor() {
      this.down = new Set();
      this.prev = new Set();
      this.p2Bot = false;

      this._onKeyDown = (e) => {
        if (this.active && GAME_KEYS.has(e.code)) {
          e.preventDefault();
        }
        this.down.add(e.code);
      };

      this._onKeyUp = (e) => {
        this.down.delete(e.code);
      };

      this._onBlur = () => {
        this.down.clear();
        this.prev.clear();
      };

      this.active = false;
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('blur', this._onBlur);
    }

    setGameplayActive(active) {
      this.active = Boolean(active);
      if (!active) {
        this.down.clear();
        this.prev.clear();
      }
    }

    _gp(index) {
      if (!navigator.getGamepads) return null;
      const pads = navigator.getGamepads();
      if (!pads) return null;
      const connected = [];
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) connected.push(pads[i]);
      }
      return connected[index] || null;
    }

    _readPlayer(idx) {
      const gp = this._gp(idx);
      const isP1 = idx === 0;
      const d = this.down;

      let up = isP1 ? d.has('KeyW') : d.has('ArrowUp');
      let down = isP1 ? d.has('KeyS') : d.has('ArrowDown');
      let left = isP1 ? d.has('KeyA') : d.has('ArrowLeft');
      let right = isP1 ? d.has('KeyD') : d.has('ArrowRight');
      let fire = isP1
        ? (d.has('Space') || d.has('KeyF') || d.has('ShiftLeft'))
        : (d.has('Enter') || d.has('Slash') || d.has('ShiftRight') || d.has('Numpad0') || d.has('NumpadEnter'));
      let alt = isP1
        ? (d.has('KeyG') || d.has('KeyQ'))
        : (d.has('Period') || d.has('NumpadDecimal'));

      if (gp) {
        const ax = gp.axes[0] || 0;
        const ay = gp.axes[1] || 0;
        if (ay < -0.35 || gp.buttons[12]?.pressed) up = true;
        if (ay > 0.35 || gp.buttons[13]?.pressed) down = true;
        if (ax < -0.35 || gp.buttons[14]?.pressed) left = true;
        if (ax > 0.35 || gp.buttons[15]?.pressed) right = true;
        if (gp.buttons[0]?.pressed || gp.buttons[2]?.pressed || gp.buttons[7]?.pressed) fire = true;
        if (gp.buttons[1]?.pressed || gp.buttons[3]?.pressed) alt = true;
      }

      return { up, down, left, right, fire, alt };
    }

    poll() {
      const p1Now = this._readPlayer(0);
      const p2Now = this._readPlayer(1);

      const p1Prev = this._prevP1 || { up: false, down: false, left: false, right: false, fire: false, alt: false };
      const p2Prev = this._prevP2 || { up: false, down: false, left: false, right: false, fire: false, alt: false };

      const withEdges = (cur, prev) => ({
        ...cur,
        firePressed: cur.fire && !prev.fire,
        altPressed: cur.alt && !prev.alt,
        upPressed: cur.up && !prev.up,
        downPressed: cur.down && !prev.down,
        leftPressed: cur.left && !prev.left,
        rightPressed: cur.right && !prev.right
      });

      this._prevP1 = p1Now;
      this._prevP2 = p2Now;

      return {
        p1: withEdges(p1Now, p1Prev),
        p2: withEdges(p2Now, p2Prev),
        p2Bot: this.p2Bot
      };
    }

    resetEdges() {
      this._prevP1 = null;
      this._prevP2 = null;
    }
  }

  Atari.input = new InputManager();
})();
