"use client";

import { AGVIProject } from "../schema/timeline-schema";

export type SoundStyle = "cyber-synth" | "ambient-tech" | "upbeat-pop";

export interface AudioTimelineEvent {
  timestampSec: number;
  type: "beat-step" | "sub-impact-drop" | "whoosh" | "tech-chime" | "word-blip";
  step?: number;
  frequencyHz?: number;
  clipId?: string;
}

/**
 * Deterministically enumerates all procedural audio & SFX events across the full timeline duration.
 * Can be called in both browser and Node.js verification suites to inspect audio track synthesis.
 */
export function buildProjectAudioSchedule(
  project: AGVIProject
): AudioTimelineEvent[] {
  const events: AudioTimelineEvent[] = [];
  const duration = Math.max(1, project.canvas.duration || 10);
  const audioTrack = project.tracks.find((t) => t.type === "audio");
  if (audioTrack?.muted || audioTrack?.hidden) {
    return events;
  }

  // 1. 120 BPM 8th-note beat steps (4 steps per second)
  const totalSteps = Math.floor(duration * 4);
  const bassProgression = [110, 87.31, 130.81, 98.0];
  for (let step = 0; step < totalSteps; step++) {
    const barIndex = Math.floor(step / 8) % bassProgression.length;
    events.push({
      timestampSec: Number((step * 0.25).toFixed(3)),
      type: "beat-step",
      step,
      frequencyHz: bassProgression[barIndex],
    });
  }

  // 2. Scene & Clip Enter Transition SFX
  for (const track of project.tracks) {
    if (track.hidden || track.muted) continue;
    for (const clip of track.clips) {
      if (clip.type === "audio") continue;
      const isHighTempo3DCut =
        clip.sceneTransition === "whip-blur-cut" ||
        clip.sceneTransition === "3d-cube-spin" ||
        clip.sceneTransition === "zoom-punch" ||
        clip.sceneTransition === "glitch-slice" ||
        clip.enterAnimation?.type === "kinetic-slam" ||
        clip.enterAnimation?.type === "3d-fly-through" ||
        clip.enterAnimation?.type === "whip-left" ||
        clip.enterAnimation?.type === "whip-right";

      if (isHighTempo3DCut) {
        events.push({
          timestampSec: clip.startTime,
          type: "sub-impact-drop",
          frequencyHz: 160,
          clipId: clip.id,
        });
      } else if (clip.type === "text") {
        events.push({
          timestampSec: clip.startTime,
          type: "whoosh",
          frequencyHz: 420,
          clipId: clip.id,
        });
      } else if (clip.type === "shape") {
        if (
          clip.shapeVariant === "code-card" ||
          clip.shapeVariant === "badge" ||
          clip.shapeVariant === "3d-wireframe-prism"
        ) {
          events.push({
            timestampSec: clip.startTime,
            type: "tech-chime",
            frequencyHz: 880,
            clipId: clip.id,
          });
        } else if (clip.shapeVariant !== "progress-bar") {
          events.push({
            timestampSec: clip.startTime,
            type: "whoosh",
            frequencyHz: 300,
            clipId: clip.id,
          });
        }
      }
    }
  }

  // 3. Karaoke Word Pop Blips
  const captionTrack = project.tracks.find(
    (t) => t.type === "caption" && !t.hidden && !t.muted
  );
  if (captionTrack) {
    for (const clip of captionTrack.clips) {
      if (clip.type === "caption" && clip.words) {
        clip.words.forEach((w, idx) => {
          events.push({
            timestampSec: Number((clip.startTime + w.start).toFixed(3)),
            type: "word-blip",
            frequencyHz: 520 + (idx % 5) * 45,
            clipId: clip.id,
          });
        });
      }
    }
  }

  return events.sort((a, b) => a.timestampSec - b.timestampSec);
}

/**
 * Zero-dependency Web Audio API Procedural Soundtrack & Transition SFX Engine.
 * Supports both live speaker output AND MediaStreamDestination multiplexing so browser-exported
 * `.webm` / `.mp4` videos contain a real, synchronized audio track!
 */
class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private volume = 0.65;
  private style: SoundStyle = "cyber-synth";
  private lastBeatStep = -1;
  private lastTriggeredClips = new Set<string>();
  private lastWordIndexKey = "";
  private activeExportDest: MediaStreamAudioDestinationNode | null = null;

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

  /**
   * Connects synthesized Web Audio nodes to both the speakers and a MediaStreamDestination
   * so `MediaRecorder` captures a synchronized audio track alongside the canvas video stream.
   */
  public createExportAudioStream(): {
    stream: MediaStream | null;
    cleanup: () => void;
  } {
    const ctx = this.ensureContext();
    if (!ctx || typeof ctx.createMediaStreamDestination !== "function") {
      return { stream: null, cleanup: () => {} };
    }
    const dest = ctx.createMediaStreamDestination();
    this.activeExportDest = dest;
    this.resetTracking();
    return {
      stream: dest.stream,
      cleanup: () => {
        if (this.activeExportDest === dest) {
          this.activeExportDest = null;
        }
      },
    };
  }

  private connectOutput(node: AudioNode, ctx: AudioContext) {
    if (!this.isMuted) {
      node.connect(ctx.destination);
    }
    if (this.activeExportDest) {
      node.connect(this.activeExportDest);
    }
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
   * Called on every frame/time update while playing or exporting
   */
  public syncTime(
    currentTime: number,
    project: AGVIProject,
    isPlaying: boolean,
    forceForExport = false
  ) {
    if ((!isPlaying && !forceForExport) || (this.isMuted && !this.activeExportDest)) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    const audioTrack = project.tracks.find((t) => t.type === "audio");
    if (audioTrack?.muted || audioTrack?.hidden) {
      return;
    }

    // 1. Beat-synced procedural soundtrack (8th-note steps = 4 steps per second = 120 BPM)
    const step = Math.floor(currentTime * 4);
    if (step !== this.lastBeatStep) {
      if (step < this.lastBeatStep || step - this.lastBeatStep > 4) {
        this.lastTriggeredClips.clear();
      }
      this.lastBeatStep = step;
      this.triggerBeatStep(ctx, step);
    }

    // 2. Scene & Clip Enter Transition SFX
    for (const track of project.tracks) {
      if (track.hidden || track.muted) continue;
      for (const clip of track.clips) {
        const clipKey = `${clip.id}-${Math.round(clip.startTime * 10)}`;
        const delta = currentTime - clip.startTime;
        if (
          delta >= 0 &&
          delta <= 0.12 &&
          !this.lastTriggeredClips.has(clipKey)
        ) {
          this.lastTriggeredClips.add(clipKey);
          const isHighTempo3DCut =
            clip.sceneTransition === "whip-blur-cut" ||
            clip.sceneTransition === "3d-cube-spin" ||
            clip.sceneTransition === "zoom-punch" ||
            clip.sceneTransition === "glitch-slice" ||
            clip.enterAnimation?.type === "kinetic-slam" ||
            clip.enterAnimation?.type === "3d-fly-through" ||
            clip.enterAnimation?.type === "whip-left" ||
            clip.enterAnimation?.type === "whip-right";

          if (isHighTempo3DCut) {
            this.playSubImpactDrop(ctx);
          } else if (clip.type === "text") {
            this.playWhooshSfx(ctx, 420, 1200, 0.18);
          } else if (clip.type === "shape") {
            if (
              clip.shapeVariant === "code-card" ||
              clip.shapeVariant === "badge" ||
              clip.shapeVariant === "3d-wireframe-prism"
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
      this.connectOutput(gain, ctx);
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
      this.connectOutput(gain, ctx);
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
    this.connectOutput(pluckGain, ctx);
    pluckOsc.start(now);
    pluckOsc.stop(now + 0.24);
  }

  public playWhooshSfx(
    ctxOrNull?: AudioContext | null,
    startFreq = 320,
    endFreq = 1100,
    dur = 0.18
  ) {
    if (this.isMuted && !this.activeExportDest) return;
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
    this.connectOutput(gain, ctx);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  public playTechChime(ctxOrNull?: AudioContext | null) {
    if (this.isMuted && !this.activeExportDest) return;
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
      this.connectOutput(gain, ctx);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.2);
    });
  }

  public playSubImpactDrop(ctxOrNull?: AudioContext | null) {
    if (this.isMuted && !this.activeExportDest) return;
    const ctx = ctxOrNull || this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.28);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(this.volume * 0.28, now + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    subOsc.connect(subGain);
    this.connectOutput(subGain, ctx);
    subOsc.start(now);
    subOsc.stop(now + 0.34);

    const whipOsc = ctx.createOscillator();
    const whipGain = ctx.createGain();
    whipOsc.type = "triangle";
    whipOsc.frequency.setValueAtTime(1800, now);
    whipOsc.frequency.exponentialRampToValueAtTime(240, now + 0.14);

    whipGain.gain.setValueAtTime(0.001, now);
    whipGain.gain.linearRampToValueAtTime(this.volume * 0.12, now + 0.01);
    whipGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    whipOsc.connect(whipGain);
    this.connectOutput(whipGain, ctx);
    whipOsc.start(now);
    whipOsc.stop(now + 0.18);
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
    this.connectOutput(gain, ctx);
    osc.start(now);
    osc.stop(now + 0.04);
  }
}

export const soundEngine = new ProceduralSoundEngine();
