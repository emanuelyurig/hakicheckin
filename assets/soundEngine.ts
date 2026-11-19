/**
 * Web Audio API sound synthesizer for HAKI SCHOOL Jiu-Jitsu Timer.
 * Synthesizes an authentic steel boxing ring bell, UFC-style hardwood 10-second clapper,
 * high-pitched rest ticks (same synth as countdown), and final countdown cues with zero external audio files.
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
      comp.threshold.setValueAtTime(-5, ctx.currentTime);
      comp.knee.setValueAtTime(6, ctx.currentTime);
      comp.ratio.setValueAtTime(8, ctx.currentTime);
      comp.attack.setValueAtTime(0.001, ctx.currentTime);
      comp.release.setValueAtTime(0.12, ctx.currentTime);

      const boost = ctx.createGain();
      boost.gain.setValueAtTime(1.85, ctx.currentTime);

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
   * Synthesizes a very loud, high-pitched steel-dome boxing ring bell strike.
   * Uses dense beating metallic partials, bright FM clang transient, and heavy iron hammer hit.
   */
  private triggerBoxingBellStrike(
    ctx: AudioContext,
    startTime: number,
    sustain = 2.2,
    level = 1.45
  ): void {
    const out = this.getOutputNode(ctx);
    const strikeBus = ctx.createGain();
    strikeBus.gain.setValueAtTime(level, startTime);
    strikeBus.connect(out);

    // Higher-pitched chrome-steel boxing bell dome partials (~1180 Hz body + bright metallic ring)
    const baseFreq = 1180;
    const partials = [
      { ratio: 0.72, gain: 0.34, decay: sustain * 0.9 },
      { ratio: 1.0, gain: 0.58, decay: sustain },
      { ratio: 1.008, gain: 0.5, decay: sustain * 0.95 },
      { ratio: 1.49, gain: 0.44, decay: sustain * 0.86 },
      { ratio: 1.506, gain: 0.36, decay: sustain * 0.82 },
      { ratio: 2.08, gain: 0.45, decay: sustain * 0.74 },
      { ratio: 2.104, gain: 0.36, decay: sustain * 0.7 },
      { ratio: 2.84, gain: 0.3, decay: sustain * 0.56 },
      { ratio: 3.66, gain: 0.24, decay: sustain * 0.42 },
      { ratio: 4.52, gain: 0.18, decay: sustain * 0.28 },
      { ratio: 5.75, gain: 0.12, decay: sustain * 0.18 },
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

    // Bright metallic FM "clang" burst on hammer impact
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const fmEnv = ctx.createGain();

    carrier.type = 'sine';
    modulator.type = 'sine';
    carrier.frequency.setValueAtTime(1850, startTime);
    modulator.frequency.setValueAtTime(2850, startTime);
    modGain.gain.setValueAtTime(2800, startTime);
    modGain.gain.exponentialRampToValueAtTime(80, startTime + 0.13);

    fmEnv.gain.setValueAtTime(0.85, startTime);
    fmEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.17);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(fmEnv);
    fmEnv.connect(strikeBus);

    modulator.start(startTime);
    carrier.start(startTime);
    modulator.stop(startTime + 0.19);
    carrier.stop(startTime + 0.19);

    // Sharp metal-on-metal impact transient
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(4400, startTime);
    bp.Q.setValueAtTime(1.8, startTime);

    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(1.0, startTime);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);

    noiseSrc.connect(bp);
    bp.connect(impactGain);
    impactGain.connect(strikeBus);

    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + 0.045);
  }

  /**
   * Boxing ring bell for Fight Start ("ROLA!") — very loud, high-pitched single heavy strike
   */
  public playFightStartGong(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerBoxingBellStrike(ctx, now, 2.45, 1.6);
  }

  /**
   * Synthesizes one sharp, high-pitched, very loud hardwood clapper snap (UFC 10-second warning block)
   */
  private triggerWoodClapperSnap(
    ctx: AudioContext,
    startTime: number,
    pitchShift = 1.0,
    level = 1.65
  ): void {
    const out = this.getOutputNode(ctx);

    const playCrack = (t: number, gainScale: number) => {
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(level * gainScale, t);
      bus.connect(out);

      // Higher-pitched, louder hardwood resonant formants driven by broadband noise
      const formants = [
        { freq: 1650 * pitchShift, q: 9.0, gain: 1.35, dur: 0.095 },
        { freq: 3100 * pitchShift, q: 10.0, gain: 1.3, dur: 0.075 },
        { freq: 5200 * pitchShift, q: 4.5, gain: 0.95, dur: 0.045 },
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

      // Higher-pitched, punchier wood block knock
      const knock = ctx.createOscillator();
      const knockEnv = ctx.createGain();
      knock.type = 'triangle';
      knock.frequency.setValueAtTime(540 * pitchShift, t);
      knock.frequency.exponentialRampToValueAtTime(340 * pitchShift, t + 0.06);

      knockEnv.gain.setValueAtTime(0.85, t);
      knockEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

      knock.connect(knockEnv);
      knockEnv.connect(bus);
      knock.start(t);
      knock.stop(t + 0.08);
    };

    // Direct snap + gym tail reflection
    playCrack(startTime, 1.0);
    playCrack(startTime + 0.055, 0.34);
  }

  /**
   * UFC-style 10-second warning: 3 loud, high-pitched, well-spaced hardwood clapper slams
   */
  public playTenSecondsAlert(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerWoodClapperSnap(ctx, now, 1.0, 1.65);
    this.triggerWoodClapperSnap(ctx, now + 0.36, 0.97, 1.6);
    this.triggerWoodClapperSnap(ctx, now + 0.72, 1.03, 1.7);
  }

  /**
   * Base sound pulse generator shared between Rest Tick and Countdown Tick
   */
  private triggerPipTone(ctx: AudioContext, frequency: number, volume = 0.45): void {
    const out = this.getOutputNode(ctx);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(out);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Louder per-second rest tick — uses the exact same synth voice as countdown tick, tuned to a high pitch (1680 Hz)
   */
  public playRestTick(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.triggerPipTone(ctx, 1680, 0.42);
  }

  /**
   * Crisp final 3-2-1 countdown pip before round transition — tuned to a medium-low pitch (980 Hz)
   */
  public playCountdownTick(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.triggerPipTone(ctx, 980, 0.55);
  }

  /**
   * Boxing end-of-round bell: rapid triple-strike ("DING-DING-DING!")
   */
  public playRestBell(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerBoxingBellStrike(ctx, now, 0.65, 1.35);
    this.triggerBoxingBellStrike(ctx, now + 0.18, 0.65, 1.45);
    this.triggerBoxingBellStrike(ctx, now + 0.36, 1.9, 1.6);
  }

  /**
   * Final championship boxing bell flurry when the entire workout completes
   */
  public playWorkoutComplete(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.triggerBoxingBellStrike(ctx, now, 0.55, 1.35);
    this.triggerBoxingBellStrike(ctx, now + 0.16, 0.55, 1.45);
    this.triggerBoxingBellStrike(ctx, now + 0.32, 0.55, 1.5);
    this.triggerBoxingBellStrike(ctx, now + 0.48, 2.5, 1.65);
  }
}

export const soundEngine = new SoundEngine();
