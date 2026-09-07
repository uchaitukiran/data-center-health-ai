/**
 * Web Audio API Sound Engine for Data Center Health AI
 * Synthesizes realistic datacenter acoustic environments (fan hum, UI chirps, alarm sirens)
 * Zero external MP3/WAV file dependencies. 100% reliable across all modern browsers.
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.alarmInterval = null;
    this.ambientSource = null;
    this.ambientGain = null;
    this.isAmbientPlaying = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {
      console.warn('Audio click error:', e);
    }
  }

  playSelect() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {
      console.warn('Audio select error:', e);
    }
  }

  startAlarm() {
    if (this.alarmInterval) return;
    this.ensureContext();
    if (!this.ctx) return;

    const beep = (freq, duration) => {
      if (this.isMuted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    };

    let high = true;
    beep(880, 0.25);
    this.alarmInterval = setInterval(() => {
      beep(high ? 660 : 880, 0.22);
      high = !high;
    }, 380);
  }

  stopAlarm() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  startAmbientHum() {
    if (this.isAmbientPlaying || this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      // White noise buffer for server cooling fans
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Bandpass filter to simulate air conditioning / chassis fan drone
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(180, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.03, this.ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      whiteNoise.start(0);
      this.ambientSource = whiteNoise;
      this.isAmbientPlaying = true;
    } catch (e) {
      console.warn('Ambient sound error:', e);
    }
  }

  stopAmbientHum() {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      } catch (e) {}
      this.ambientSource = null;
      this.isAmbientPlaying = false;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopAlarm();
      this.stopAmbientHum();
    } else {
      this.startAmbientHum();
    }
    return this.isMuted;
  }
}

export const soundEngine = new AudioManager();
