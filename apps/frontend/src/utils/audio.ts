// Web Audio API Synthesizer for Kitchen Sound Effects

class KitchenAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initCtx() {
    // if (!this.ctx && typeof window !== 'undefined') {
    //   const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    //   if (AudioCtx) {
    //     this.ctx = new AudioCtx();
    //   }
    // }
    // if (this.ctx && this.ctx.state === 'suspended') {
    //   this.ctx.resume();
    // }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public playNewTicketSound() {
    // if (this.isMuted) return;
    // this.initCtx();
    // if (!this.ctx) return;
    //
    // const now = this.ctx.currentTime;
    // 
    // // First bell chime
    // const osc1 = this.ctx.createOscillator();
    // const gain1 = this.ctx.createGain();
    // osc1.type = 'sine';
    // osc1.frequency.setValueAtTime(880, now); // A5
    // gain1.gain.setValueAtTime(0.15, now);
    // gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    // osc1.connect(gain1);
    // gain1.connect(this.ctx.destination);
    // osc1.start(now);
    // osc1.stop(now + 0.4);
    //
    // // Second bell chime
    // const osc2 = this.ctx.createOscillator();
    // const gain2 = this.ctx.createGain();
    // osc2.type = 'sine';
    // osc2.frequency.setValueAtTime(1174.66, now + 0.15); // D6
    // gain2.gain.setValueAtTime(0.2, now + 0.15);
    // gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    // osc2.connect(gain2);
    // gain2.connect(this.ctx.destination);
    // osc2.start(now + 0.15);
    // osc2.stop(now + 0.6);
  }

  public playVipTicketSound() {
    // if (this.isMuted) return;
    // this.initCtx();
    // if (!this.ctx) return;
    //
    // const now = this.ctx.currentTime;
    // const freqs = [1046.5, 1318.51, 1567.98]; // C6, E6, G6 (C Major triad)
    //
    // freqs.forEach((freq, idx) => {
    //   if (!this.ctx) return;
    //   const osc = this.ctx.createOscillator();
    //   const gain = this.ctx.createGain();
    //   const startTime = now + idx * 0.08;
    //
    //   osc.type = 'triangle';
    //   osc.frequency.setValueAtTime(freq, startTime);
    //   gain.gain.setValueAtTime(0.25, startTime);
    //   gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
    //
    //   osc.connect(gain);
    //   gain.connect(this.ctx.destination);
    //   osc.start(startTime);
    //   osc.stop(startTime + 0.5);
    // });
  }

  public playStatusTransitionSound() {
    // if (this.isMuted) return;
    // this.initCtx();
    // if (!this.ctx) return;
    //
    // const now = this.ctx.currentTime;
    // const osc = this.ctx.createOscillator();
    // const gain = this.ctx.createGain();
    //
    // osc.type = 'sine';
    // osc.frequency.setValueAtTime(523.25, now); // C5
    // osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
    //
    // gain.gain.setValueAtTime(0.12, now);
    // gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    //
    // osc.connect(gain);
    // gain.connect(this.ctx.destination);
    // osc.start(now);
    // osc.stop(now + 0.25);
  }

  public playServedSound() {
    // if (this.isMuted) return;
    // this.initCtx();
    // if (!this.ctx) return;
    //
    // const now = this.ctx.currentTime;
    // const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    //
    // freqs.forEach((freq, idx) => {
    //   if (!this.ctx) return;
    //   const osc = this.ctx.createOscillator();
    //   const gain = this.ctx.createGain();
    //   const startTime = now + idx * 0.07;
    //
    //   osc.type = 'sine';
    //   osc.frequency.setValueAtTime(freq, startTime);
    //   gain.gain.setValueAtTime(0.18, startTime);
    //   gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
    //
    //   osc.connect(gain);
    //   gain.connect(this.ctx.destination);
    //   osc.start(startTime);
    //   osc.stop(startTime + 0.6);
    // });
  }
}

export const kitchenAudio = new KitchenAudioEngine();
