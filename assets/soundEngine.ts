/**
 * Web Audio API sound synthesizer for HAKI SCHOOL Jiu-Jitsu Timer.
 * Synthesizes an authentic steel boxing ring bell, UFC-style hardwood 10-second clapper,
 * sharp bomb-style per-second rest ticks, and final countdown cues with zero external audio files.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterBus: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
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
    if (!this.masterBus || !this.masterGain || this.masterBus.context !== ctx) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-6, ctx.currentTime);
      comp.knee.setValueAtTime(8, ctx.currentTime);
      comp.ratio.setValueAtTime(6, ctx.currentTime);
      comp.attack.setValueAtTime(0.001, ctx.currentTime);
      comp.release.setValueAtTime(0.14, ctx.currentTime);

      const boost = ctx.createGain();
      boost.gain.setValueAtTime(1.65, ctx.currentTime);

      comp.connect(boost);
      boost.connect(ctx.destination);

      this.masterBus = comp;
      this.masterGain = boost;
    }
    return this.masterBus;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.6);
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
   * Synthesizes a loud, resonant steel-dome boxing ring bell strike.
   * Uses dense beating metallic partials, FM clang transient, and heavy iron hammer hit.
   */
  private triggerBoxingBellStrike(
    ctx: AudioContext,
    startTime: number,
    sustain = 2.2,
    level = 0.88
  ): void {
    const out = this.getOutputNode(ctx);
    const strikeBus = ctx.createGain();
    strikeBus.gain.setValueAtTime(level, startTime);
    strikeBus.connect(out);

    // Chrome-steel boxing bell dome partials (~820 Hz body + bright metallic ring partials)
    const baseFreq = 820;
    const partials = [
      { ratio: 0.72, gain: 0.28, decay: sustain * 0.9 },
      { ratio: 1.0, gain: 0.45, decay: sustain },
      { ratio: 1.009, gain: 0.38, decay: sustain * 0.95 },
      { ratio: 1.49, gain: 0.32, decay: sustain * 0.86 },
      { ratio: 1.507, gain: 0.26, decay: sustain * 0.82 },
      { ratio: 2.08, gain: 0.34, decay: sustain * 0.74 },
      { ratio: 2.106, gain: 0.26, decay: sustain * 0.7 },
      { ratio: 2.84, gain: 0.22, decay: sustain * 0.56 },
      { ratio: 3.66, gain: 0.17, decay: sustain * 0.42 },
      { ratio: 4.52, gain: 0.12, decay: sustain * 0.28 },
      { ratio: 5.75, gain: 0.08, decay: sustain * 0.18 },
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
      osc.stop(startTime + decay + 0.04);
    });

    // Metallic FM "clang" burst on hammer impact
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const fmEnv = ctx.createGain();

    carrier.type = 'sine';
    modulator.type = 'sine';
    carrier.frequency.setValueAtTime(1320, startTime);
    modulator.frequency.setValueAtTime(2040, startTime);
    modGain.gain.setValueAtTime(2200, startTime);
    modGain.gain.exponentialRampToValueAtTime(50, startTime + 0.12);

    fmEnv.gain.setValueAtTime(0.6, startTime);
    fmEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(fmEnv);
    fmEnv.connect(strikeBus);

    modulator.start(startTime);
    carrier.start(startTime);
    modulator.stop(startTime + 0.18);
    carrier.stop(startTime + 0.18);

    // Crisp metal-on-metal impact transient
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, startTime);
    bp.Q.setValueAtTime(1.5, startTime);

    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(0.8, startTime);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);

    noiseSrc.connect(bp);
    bp.connect(impactGain);
    impactGain.connect(strikeBus);

    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + 0.045);
  }

  /**
   * Boxing ring bell for Fight Start ("ROLA!") — loud single heavy strike
   */
  public playFightStartGong(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerBoxingBellStrike(ctx, now, 2.35, 0.95);
  }

  /**
   * Synthesizes one longer, louder hardwood clapper snap (UFC 10-second warning block)
   */
  private triggerWoodClapperSnap(
    ctx: AudioContext,
    startTime: number,
    pitchShift = 1.0,
    level = 0.95
  ): void {
    const out = this.getOutputNode(ctx);

    const playCrack = (t: number, gainScale: number) => {
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(level * gainScale, t);
      bus.connect(out);

      // Longer hardwood resonant formants driven by broadband noise
      const formants = [
        { freq: 1120 * pitchShift, q: 8.5, gain: 1.0, dur: 0.095 },
        { freq: 2240 * pitchShift, q: 9.5, gain: 0.95, dur: 0.075 },
        { freq: 3950 * pitchShift, q: 4.0, gain: 0.72, dur: 0.045 },
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
        noise.stop(t + dur + 0.015);
      });

      // Deeper, longer wood block knock thud
      const knock = ctx.createOscillator();
      const knockEnv = ctx.createGain();
      knock.type = 'triangle';
      knock.frequency.setValueAtTime(340 * pitchShift, t);
      knock.frequency.exponentialRampToValueAtTime(210 * pitchShift, t + 0.065);

      knockEnv.gain.setValueAtTime(0.55, t);
      knockEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);

      knock.connect(knockEnv);
      knockEnv.connect(bus);
      knock.start(t);
      knock.stop(t + 0.085);
    };

    // Direct snap + longer gym tail reflection
    playCrack(startTime, 1.0);
    playCrack(startTime + 0.055, 0.34);
  }

  /**
   * UFC-style 10-second warning: 3 loud, extended hardwood clapper slams ("CLACK-CLACK-CLACK!")
   */
  public playTenSecondsAlert(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerWoodClapperSnap(ctx, now, 1.0, 1.0);
    this.triggerWoodClapperSnap(ctx, now + 0.21, 0.96, 0.96);
    this.triggerWoodClapperSnap(ctx, now + 0.42, 1.03, 1.0);
  }

  /**
   * Louder, high-pitched bomb-style tick played every second during Rest ("Descanso")
   */
  public playRestTick(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const out = this.getOutputNode(ctx);
    const now = ctx.currentTime;

    // Sharp high-pitched metallic/electronic bomb-tick tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2250, now);
    osc.frequency.exponentialRampToValueAtTime(1450, now + 0.045);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.06);

    // Crisp high-frequency transient snap ("tic")
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2600, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.28, now);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    noise.connect(hp);
    hp.connect(nGain);
    nGain.connect(out);
    noise.start(now);
    noise.stop(now + 0.025);
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
    osc.frequency.setValueAtTime(1240, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(gain);
    gain.connect(out);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Boxing end-of-round bell: rapid triple-strike ("DING-DING-DING!")
   */
  public playRestBell(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerBoxingBellStrike(ctx, now, 0.65, 0.85);
    this.triggerBoxingBellStrike(ctx, now + 0.18, 0.65, 0.88);
    this.triggerBoxingBellStrike(ctx, now + 0.36, 1.9, 0.96);
  }

  /**
   * Final championship boxing bell flurry when the entire workout completes
   */
  public playWorkoutComplete(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerBoxingBellStrike(ctx, now, 0.55, 0.85);
    this.triggerBoxingBellStrike(ctx, now + 0.16, 0.55, 0.88);
    this.triggerBoxingBellStrike(ctx, now + 0.32, 0.55, 0.92);
    this.triggerBoxingBellStrike(ctx, now + 0.48, 2.5, 1.0);
  }
}

export const soundEngine = new SoundEngine();
