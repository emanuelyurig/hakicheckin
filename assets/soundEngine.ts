/**
 * Web Audio API sound synthesizer for HAKI SCHOOL Jiu-Jitsu Timer.
 * Synthesizes an authentic steel boxing ring bell, UFC-style hardwood 10-second clapper,
 * soft per-second rest ticks, and final countdown cues with zero external audio files.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterBus: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {
        // Ignore resume errors before user interaction
      });
    }

    return this.ctx;
  }

  private getOutputNode(ctx: AudioContext): AudioNode {
    if (!this.masterBus || this.masterBus.context !== ctx) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-10, ctx.currentTime);
      comp.knee.setValueAtTime(12, ctx.currentTime);
      comp.ratio.setValueAtTime(4, ctx.currentTime);
      comp.attack.setValueAtTime(0.002, ctx.currentTime);
      comp.release.setValueAtTime(0.15, ctx.currentTime);
      comp.connect(ctx.destination);
      this.masterBus = comp;
    }
    return this.masterBus;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public unlock(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    // Play a silent 1-sample buffer to unlock iOS/Safari Web Audio reliably
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // Safe fallback
    }
  }

  /**
   * Synthesizes a sharp steel-dome boxing ring bell strike.
   * Uses dense beating metallic partials, FM clang transient, and iron hammer hit.
   */
  private triggerBoxingBellStrike(
    ctx: AudioContext,
    startTime: number,
    sustain = 1.85,
    level = 0.55
  ): void {
    const out = this.getOutputNode(ctx);
    const strikeBus = ctx.createGain();
    strikeBus.gain.setValueAtTime(level, startTime);
    strikeBus.connect(out);

    // Chrome-steel boxing bell dome partials (~880 Hz fundamental cluster + bright ring partials)
    const baseFreq = 885;
    const partials = [
      { ratio: 1.0, gain: 0.34, decay: sustain },
      { ratio: 1.008, gain: 0.3, decay: sustain * 0.94 },
      { ratio: 1.49, gain: 0.24, decay: sustain * 0.85 },
      { ratio: 1.506, gain: 0.2, decay: sustain * 0.82 },
      { ratio: 2.08, gain: 0.26, decay: sustain * 0.72 },
      { ratio: 2.105, gain: 0.2, decay: sustain * 0.68 },
      { ratio: 2.84, gain: 0.18, decay: sustain * 0.54 },
      { ratio: 3.66, gain: 0.14, decay: sustain * 0.38 },
      { ratio: 4.52, gain: 0.1, decay: sustain * 0.25 },
      { ratio: 5.75, gain: 0.06, decay: sustain * 0.15 },
    ];

    partials.forEach(({ ratio, gain, decay }) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * ratio, startTime);

      amp.gain.setValueAtTime(0.0001, startTime);
      amp.gain.linearRampToValueAtTime(gain, startTime + 0.002);
      amp.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

      osc.connect(amp);
      amp.connect(strikeBus);

      osc.start(startTime);
      osc.stop(startTime + decay + 0.03);
    });

    // Brief FM metallic "clank" burst at the exact instant the iron hammer hits steel
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const fmEnv = ctx.createGain();

    carrier.type = 'sine';
    modulator.type = 'sine';
    carrier.frequency.setValueAtTime(1420, startTime);
    modulator.frequency.setValueAtTime(2170, startTime);
    modGain.gain.setValueAtTime(1800, startTime);
    modGain.gain.exponentialRampToValueAtTime(40, startTime + 0.09);

    fmEnv.gain.setValueAtTime(0.45, startTime);
    fmEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(fmEnv);
    fmEnv.connect(strikeBus);

    modulator.start(startTime);
    carrier.start(startTime);
    modulator.stop(startTime + 0.13);
    carrier.stop(startTime + 0.13);

    // Crisp metal-on-metal impact transient
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(3400, startTime);
    hp.Q.setValueAtTime(1.8, startTime);

    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(0.55, startTime);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.025);

    noiseSrc.connect(hp);
    hp.connect(impactGain);
    impactGain.connect(strikeBus);

    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + 0.03);
  }

  /**
   * Boxing ring bell for Fight Start ("ROLA!") — crisp single heavy strike + subtle rebound
   */
  public playFightStartGong(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerBoxingBellStrike(ctx, now, 2.0, 0.58);
  }

  /**
   * Synthesizes one realistic hardwood clapper snap (UFC 10-second warning block)
   */
  private triggerWoodClapperSnap(
    ctx: AudioContext,
    startTime: number,
    pitchShift = 1.0,
    level = 0.72
  ): void {
    const out = this.getOutputNode(ctx);

    const playCrack = (t: number, gainScale: number) => {
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(level * gainScale, t);
      bus.connect(out);

      // Hardwood resonant formants driven by dry broadband impulse noise (no pitch-bend sweeps)
      const formants = [
        { freq: 1180 * pitchShift, q: 7.5, gain: 0.95, dur: 0.038 },
        { freq: 2280 * pitchShift, q: 8.5, gain: 0.85, dur: 0.028 },
        { freq: 4100 * pitchShift, q: 3.2, gain: 0.55, dur: 0.015 },
      ];

      formants.forEach(({ freq, q, gain, dur }) => {
        const noise = ctx.createBufferSource();
        noise.buffer = this.getNoiseBuffer(ctx);

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(freq, t);
        bp.Q.setValueAtTime(q, t);

        const env = ctx.createGain();
        env.gain.setValueAtTime(gain, t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        noise.connect(bp);
        bp.connect(env);
        env.connect(bus);

        noise.start(t);
        noise.stop(t + dur + 0.01);
      });

      // Tight low-mid wood block knock thud
      const knock = ctx.createOscillator();
      const knockEnv = ctx.createGain();
      knock.type = 'sine';
      knock.frequency.setValueAtTime(360 * pitchShift, t);
      knockEnv.gain.setValueAtTime(0.32, t);
      knockEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);

      knock.connect(knockEnv);
      knockEnv.connect(bus);
      knock.start(t);
      knock.stop(t + 0.028);
    };

    // Direct snap + subtle arena/gym early reflection for realism
    playCrack(startTime, 1.0);
    playCrack(startTime + 0.048, 0.16);
  }

  /**
   * UFC-style 10-second warning: 3 crisp hardwood clapper slams ("CLACK-CLACK-CLACK!")
   */
  public playTenSecondsAlert(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerWoodClapperSnap(ctx, now, 1.0, 0.78);
    this.triggerWoodClapperSnap(ctx, now + 0.145, 0.97, 0.74);
    this.triggerWoodClapperSnap(ctx, now + 0.285, 1.02, 0.8);
  }

  /**
   * Soft, unobtrusive metronome tick played every second during Rest ("Descanso")
   */
  public playRestTick(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const out = this.getOutputNode(ctx);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(510, now);
    osc.frequency.exponentialRampToValueAtTime(390, now + 0.032);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);

    osc.connect(gain);
    gain.connect(out);

    osc.start(now);
    osc.stop(now + 0.055);
  }

  /**
   * Crisp final 3-2-1 countdown pip before round transition
   */
  public playCountdownTick(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const out = this.getOutputNode(ctx);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(out);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Boxing end-of-round bell: rapid triple-strike ("DING-DING-DING!")
   */
  public playRestBell(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerBoxingBellStrike(ctx, now, 0.55, 0.48);
    this.triggerBoxingBellStrike(ctx, now + 0.165, 0.55, 0.5);
    this.triggerBoxingBellStrike(ctx, now + 0.33, 1.65, 0.58);
  }

  /**
   * Final championship boxing bell flurry when the entire workout completes
   */
  public playWorkoutComplete(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerBoxingBellStrike(ctx, now, 0.48, 0.48);
    this.triggerBoxingBellStrike(ctx, now + 0.15, 0.48, 0.5);
    this.triggerBoxingBellStrike(ctx, now + 0.3, 0.48, 0.52);
    this.triggerBoxingBellStrike(ctx, now + 0.46, 2.2, 0.62);
  }
}

export const soundEngine = new SoundEngine();
