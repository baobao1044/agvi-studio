"use client";

import { AGVIProject } from "../schema/timeline-schema";

export type SoundStyle = "cyber-synth" | "ambient-tech" | "upbeat-pop";

/**
 * Zero-dependency Web Audio API Procedural Soundtrack & Transition SFX Engine.
 * Synthesizes real-time beat-synced background music, scene transition whooshes,
 * code-card chimes, and karaoke caption micro-pops synced to timeline currentTime.
 */
class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private volume = 0.65;
  private style: SoundStyle = "cyber-synth";
  private lastBeatStep = -1;
  private lastTriggeredClips = new Set<string>();
  private lastWordIndexKey = "";

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setStyle(style: SoundStyle) {
    this.style = style;
  }

  public getStyle(): SoundStyle {
    return this.style;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public resetTracking() {
    this.lastBeatStep = -1;
    this.lastTriggeredClips.clear();
    this.lastWordIndexKey = "";
  }

  /**
   * Called on every frame/time update while playing
   */
  public syncTime(currentTime: number, project: AGVIProject, isPlaying: boolean) {
    if (!isPlaying || this.isMuted) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Check if audio track is muted in project
    const audioTrack = project.tracks.find((t) => t.type === "audio");
    if (audioTrack?.muted || audioTrack?.hidden) {
      return;
    }

    // 1. Beat-synced procedural soundtrack (8th-note steps = 4 steps per second = 120 BPM)
    const step = Math.floor(currentTime * 4);
    if (step !== this.lastBeatStep) {
      if (step < this.lastBeatStep || step - this.lastBeatStep > 4) {
        // User seeked or looped
        this.lastTriggeredClips.clear();
      }
      this.lastBeatStep = step;
      this.triggerBeatStep(ctx, step);
    }

    // 2. Scene & Clip Enter Transition SFX
    for (const track of project.tracks) {
      if (track.hidden || track.muted) continue;
      for (const clip of track.clips) {
        const clipKey = `${clip.id}-${ Math.round(clip.startTime * 10)}`;
        const delta = currentTime - clip.startTime;
        if (delta >= 0 && delta <= 0.12 && !this.lastTriggeredClips.has(clipKey)) {
          this.lastTriggeredClips.add(clipKey);
          if (clip.type === "text") {
            this.playWhooshSfx(ctx, 420, 1200, 0.18);
          } else if (clip.type === "shape") {
            if (
              clip.shapeVariant === "code-card" ||
              clip.shapeVariant === "badge"
            ) {
              this.playTechChime(ctx);
            } else if (clip.shapeVariant !== "progress-bar") {
              this.playWhooshSfx(ctx, 300, 900, 0.14);
            }
          }
        }
      }
    }

    // 3. Subtle Karaoke Word Pop Blip
    const captionTrack = project.tracks.find(
      (t) => t.type === "caption" && !t.hidden && !t.muted
    );
    if (captionTrack) {
      for (const clip of captionTrack.clips) {
        if (
          clip.type === "caption" &&
          currentTime >= clip.startTime &&
          currentTime <= clip.startTime + clip.duration
        ) {
          const localSec = currentTime - clip.startTime;
          const words = clip.words || [];
          const activeIdx = words.findIndex(
            (w) => localSec >= w.start && localSec <= w.end
          );
          if (activeIdx !== -1) {
            const wordKey = `${clip.id}-w-${activeIdx}`;
            if (wordKey !== this.lastWordIndexKey) {
              this.lastWordIndexKey = wordKey;
              this.playWordBlip(ctx, activeIdx);
            }
          }
        }
      }
    }
  }

  private triggerBeatStep(ctx: AudioContext, step: number) {
    const now = ctx.currentTime;
    const masterGain = this.volume * 0.22;

    // Chord progression root notes (A minor -> F major -> C major -> G major)
    const bassProgression = [110, 87.31, 130.81, 98.0]; // A2, F2, C3, G2
    const arpScale =
      this.style === "ambient-tech"
        ? [220, 261.63, 329.63, 392.0, 440, 523.25]
        : [220, 261.63, 293.66, 329.63, 392.0, 440, 523.25, 587.33];

    const barIndex = Math.floor(step / 8) % bassProgression.length;
    const bassFreq = bassProgression[barIndex];

    // Kick drum on every quarter note (step % 2 === 0)
    if (step % 2 === 0 && this.style !== "ambient-tech") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(125, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.11);

      gain.gain.setValueAtTime(masterGain * 0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    }

    // Warm Sub-Bass Pad on every half bar (step % 4 === 0)
    if (step % 4 === 0) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(bassFreq, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.85);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(masterGain * 0.55, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.92);
    }

    // Melodic Synth Pluck Arpeggio on every step
    const noteFreq = arpScale[(step * 3 + barIndex) % arpScale.length];
    const pluckOsc = ctx.createOscillator();
    const pluckGain = ctx.createGain();

    pluckOsc.type = this.style === "cyber-synth" ? "triangle" : "sine";
    pluckOsc.frequency.setValueAtTime(noteFreq, now);

    pluckGain.gain.setValueAtTime(0.001, now);
    pluckGain.gain.linearRampToValueAtTime(masterGain * 0.35, now + 0.015);
    pluckGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    pluckOsc.connect(pluckGain);
    pluckGain.connect(ctx.destination);
    pluckOsc.start(now);
    pluckOsc.stop(now + 0.24);
  }

  public playWhooshSfx(
    ctxOrNull?: AudioContext | null,
    startFreq = 320,
    endFreq = 1100,
    dur = 0.18
  ) {
    if (this.isMuted) return;
    const ctx = ctxOrNull || this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(this.volume * 0.12, now + dur * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  public playTechChime(ctxOrNull?: AudioContext | null) {
    if (this.isMuted) return;
    const ctx = ctxOrNull || this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [880, 1318.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);

      gain.gain.setValueAtTime(0.001, now + idx * 0.055);
      gain.gain.linearRampToValueAtTime(
        this.volume * 0.1,
        now + idx * 0.055 + 0.01
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + idx * 0.055 + 0.18
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.2);
    });
  }

  private playWordBlip(ctx: AudioContext, wordIdx: number) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const pitch = 520 + (wordIdx % 5) * 45;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.25, now + 0.03);

    gain.gain.setValueAtTime(this.volume * 0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }
}

export const soundEngine = new ProceduralSoundEngine();
