(function () {
  'use strict';
  class AudioSystem {
    constructor() { this.volume = .35; this.context = null; }
    start() {
      try { if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)(); if (this.context.state === 'suspended') this.context.resume().catch(() => {}); } catch (_) { /* Audio is optional. */ }
    }
    note(frequency, duration, delay = 0, type = 'sine', strength = .09) {
      if (!this.context || !this.volume || this.context.state !== 'running') return;
      const time = this.context.currentTime + delay, oscillator = this.context.createOscillator(), gain = this.context.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time); oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * .8), time + duration);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(strength * this.volume, time + .008); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
      oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(time); oscillator.stop(time + duration + .01); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
    play(event) {
      switch (event.type) {
        case 'mine': this.note(110, .1, 0, 'triangle', .2); this.note(65, .14, .04, 'sawtooth', .05); break;
        case 'place': this.note(160, .09, 0, 'triangle'); break;
        case 'collect': this.note(660, .1); this.note(880, .12, .06); break;
        case 'craft': case 'station': this.note(392, .17); this.note(523, .2, .09); this.note(659, .25, .18); break;
        case 'swing': this.note(180, .08, 0, 'sawtooth', .025); break;
        case 'hit': this.note(90, .12, 0, 'triangle', .18); break;
        case 'hurt': this.note(62, .2, 0, 'sawtooth', .08); break;
        case 'eat': this.note(260, .09); this.note(310, .12, .08); break;
        case 'night': this.note(130, .8); this.note(155, .9, .4); break;
        case 'victory': [392, 494, 587, 784].forEach((f, i) => this.note(f, .7, i * .2)); break;
        case 'defeat': [220, 165, 110].forEach((f, i) => this.note(f, .5, i * .2)); break;
      }
    }
  }
  CB.AudioSystem = AudioSystem;
})();
