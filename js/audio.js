(function () {
  'use strict';

  const Atari = (window.AtariArcade = window.AtariArcade || {});
  Atari.games = Atari.games || [];

  class RetroAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    ensure() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    setEnabled(val) {
      this.enabled = Boolean(val);
    }

    tone(freq, duration = 0.08, type = 'square', volume = 0.09, slideTo = null) {
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    }

    noise(duration = 0.18, volume = 0.12, filterFreq = 800) {
      const ctx = this.ensure();
      if (!ctx) return;
      const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    }

    shoot(pitch = 780) {
      this.tone(pitch, 0.09, 'square', 0.07, 160);
    }

    laser() {
      this.tone(1100, 0.11, 'sawtooth', 0.06, 220);
    }

    explode(big = false) {
      this.noise(big ? 0.34 : 0.18, big ? 0.16 : 0.11, big ? 600 : 1100);
      this.tone(big ? 110 : 160, big ? 0.25 : 0.12, 'triangle', 0.09, 32);
    }

    hit() {
      this.tone(520, 0.05, 'square', 0.08, 320);
    }

    pong(high = true) {
      this.tone(high ? 580 : 420, 0.06, 'square', 0.08);
    }

    score() {
      this.tone(660, 0.07, 'square', 0.08);
      setTimeout(() => this.tone(990, 0.11, 'square', 0.08), 65);
    }

    waka(alt = false) {
      this.tone(alt ? 340 : 250, 0.055, 'triangle', 0.08, alt ? 210 : 390);
    }

    jump() {
      this.tone(240, 0.13, 'square', 0.07, 680);
    }

    powerup() {
      const notes = [440, 554, 659, 880];
      notes.forEach((n, idx) => {
        setTimeout(() => this.tone(n, 0.09, 'square', 0.07), idx * 55);
      });
    }

    menuTick() {
      this.tone(480, 0.035, 'square', 0.05);
    }

    startFanfare() {
      const notes = [330, 440, 554, 659];
      notes.forEach((n, idx) => {
        setTimeout(() => this.tone(n, 0.1, 'square', 0.075), idx * 70);
      });
    }

    gameOver() {
      const notes = [392, 349, 311, 261];
      notes.forEach((n, idx) => {
        setTimeout(() => this.tone(n, 0.16, 'sawtooth', 0.07), idx * 130);
      });
    }
  }

  Atari.audio = new RetroAudio();
})();
