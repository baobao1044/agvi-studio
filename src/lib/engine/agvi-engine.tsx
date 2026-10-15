"use client";

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Maximize2, Pause, Play, RotateCcw } from "lucide-react";

/**
 * AGVI Native Deterministic Video Engine (100% MIT / Enterprise-Free)
 * Zero Remotion dependency. Provides deterministic frame-driven rendering:
 * - useCurrentFrame()
 * - useVideoConfig()
 * - interpolate()
 * - spring()
 * - <AbsoluteFill />
 * - <Sequence />
 * - <AGVIPlayer /> (with requestAnimationFrame clock, auto-scaling stage, and playerRef API)
 */

export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

interface FrameContextValue {
  frame: number;
  config: VideoConfig;
}

const FrameContext = createContext<FrameContextValue>({
  frame: 0,
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
  },
});

export function useCurrentFrame(): number {
  return useContext(FrameContext).frame;
}

export function useVideoConfig(): VideoConfig {
  return useContext(FrameContext).config;
}

export interface InterpolateOptions {
  extrapolateLeft?: "clamp" | "extend" | "identity";
  extrapolateRight?: "clamp" | "extend" | "identity";
  easing?: (t: number) => number;
}

/**
 * Deterministic piecewise linear interpolation matching studio animation math.
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options?: InterpolateOptions
): number {
  if (inputRange.length < 2 || inputRange.length !== outputRange.length) {
    return outputRange[0] ?? 0;
  }

  const extrapolateLeft = options?.extrapolateLeft ?? "extend";
  const extrapolateRight = options?.extrapolateRight ?? "extend";

  if (input <= inputRange[0]) {
    if (extrapolateLeft === "clamp") return outputRange[0];
    if (extrapolateLeft === "identity") return input;
    const dx = inputRange[1] - inputRange[0];
    if (dx === 0) return outputRange[0];
    const t = (input - inputRange[0]) / dx;
    return outputRange[0] + t * (outputRange[1] - outputRange[0]);
  }

  const lastIdx = inputRange.length - 1;
  if (input >= inputRange[lastIdx]) {
    if (extrapolateRight === "clamp") return outputRange[lastIdx];
    if (extrapolateRight === "identity") return input;
    const dx = inputRange[lastIdx] - inputRange[lastIdx - 1];
    if (dx === 0) return outputRange[lastIdx];
    const t = (input - inputRange[lastIdx - 1]) / dx;
    return (
      outputRange[lastIdx - 1] +
      t * (outputRange[lastIdx] - outputRange[lastIdx - 1])
    );
  }

  // Find active segment
  let segIdx = 0;
  for (let i = 0; i < lastIdx; i++) {
    if (input >= inputRange[i] && input <= inputRange[i + 1]) {
      segIdx = i;
      break;
    }
  }

  const inMin = inputRange[segIdx];
  const inMax = inputRange[segIdx + 1];
  const outMin = outputRange[segIdx];
  const outMax = outputRange[segIdx + 1];

  const span = inMax - inMin;
  if (span === 0) return outMin;

  let t = (input - inMin) / span;
  if (options?.easing) {
    t = options.easing(Math.max(0, Math.min(1, t)));
  }

  return outMin + t * (outMax - outMin);
}

export type EasingPreset =
  | "linear"
  | "ease-in-out"
  | "expo-out"
  | "expo-in"
  | "whip"
  | "back-out"
  | "elastic"
  | "bounce";

/**
 * High-tempo After Effects-style Graph Editor easing functions.
 * "whip" models an aggressive cubic-bezier(0.87, 0, 0.13, 1) speed-peak curve.
 * "expo-out" models instant kinetic snap settling smoothly.
 */
export function evaluateEasing(preset: EasingPreset | undefined, rawT: number): number {
  const t = Math.max(0, Math.min(1, rawT));
  if (t === 0 || t === 1) return t;
  if (!preset || preset === "linear") return t;

  switch (preset) {
    case "ease-in-out":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case "expo-out":
      return 1 - Math.pow(2, -10 * t);
    case "expo-in":
      return Math.pow(2, 10 * t - 10);
    case "whip": {
      // Aggressive S-curve with high midpoint velocity (After Effects Speed Graph spike)
      return t < 0.5
        ? 8 * t * t * t * t
        : 1 - Math.pow(-2 * t + 2, 4) / 2;
    }
    case "back-out": {
      const c1 = 1.95;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case "elastic": {
      const c4 = (2 * Math.PI) / 3.2;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    case "bounce": {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = t;
      if (x < 1 / d1) {
        return n1 * x * x;
      } else if (x < 2 / d1) {
        return n1 * (x -= 1.5 / d1) * x + 0.75;
      } else if (x < 2.5 / d1) {
        return n1 * (x -= 2.25 / d1) * x + 0.9375;
      } else {
        return n1 * (x -= 2.625 / d1) * x + 0.984375;
      }
    }
    default:
      return t;
  }
}

export interface KeyframePoint {
  offset: number;
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  rotation?: number;
  rotateX?: number;
  rotateY?: number;
  opacity?: number;
  blur?: number;
  easing?: EasingPreset;
}

export interface EvaluatedKeyframeTransform {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  rotateX: number;
  rotateY: number;
  opacity: number;
  blur: number;
}

/**
 * Evaluates a multi-point keyframe track at normalized progress `p` (0..1)
 * using per-segment Graph Editor velocity presets (`whip`, `expo-out`, `back-out`, `elastic`, `bounce`).
 */
export function evaluateClipKeyframes(
  keyframes: readonly KeyframePoint[] | undefined,
  normalizedProgress: number,
  defaults: EvaluatedKeyframeTransform
): EvaluatedKeyframeTransform {
  if (!keyframes || keyframes.length === 0) {
    return { ...defaults };
  }

  const sorted = [...keyframes].sort((a, b) => a.offset - b.offset);
  const p = Math.max(0, Math.min(1, normalizedProgress));

  const resolveProp = (
    prop: keyof Omit<KeyframePoint, "offset" | "easing">,
    fallback: number
  ): number => {
    const pts = sorted.filter((k) => typeof k[prop] === "number");
    if (pts.length === 0) return fallback;
    if (pts.length === 1 || p <= pts[0].offset) return pts[0][prop] as number;
    const last = pts[pts.length - 1];
    if (p >= last.offset) return last[prop] as number;

    let segIdx = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      if (p >= pts[i].offset && p <= pts[i + 1].offset) {
        segIdx = i;
        break;
      }
    }
    const k0 = pts[segIdx];
    const k1 = pts[segIdx + 1];
    const span = k1.offset - k0.offset;
    if (span <= 0.0001) return k1[prop] as number;
    const rawT = (p - k0.offset) / span;
    const easedT = evaluateEasing(k1.easing || k0.easing || "whip", rawT);
    const v0 = k0[prop] as number;
    const v1 = k1[prop] as number;
    return v0 + easedT * (v1 - v0);
  };

  return {
    x: resolveProp("x", defaults.x),
    y: resolveProp("y", defaults.y),
    z: resolveProp("z", defaults.z),
    scale: resolveProp("scale", defaults.scale),
    rotation: resolveProp("rotation", defaults.rotation),
    rotateX: resolveProp("rotateX", defaults.rotateX),
    rotateY: resolveProp("rotateY", defaults.rotateY),
    opacity: resolveProp("opacity", defaults.opacity),
    blur: resolveProp("blur", defaults.blur),
  };
}

/**
 * Computes instantaneous motion velocity between `frame - 1` and `frame`
 * to drive automatic After Effects directional motion blur and RGB chromatic split.
 */
export function computeMotionVelocity(
  prev: { x: number; y: number; z: number; scale: number; rotation: number; rotateX?: number; rotateY?: number },
  curr: { x: number; y: number; z: number; scale: number; rotation: number; rotateX?: number; rotateY?: number }
): { vx: number; vy: number; speed: number } {
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  const dz = (curr.z - prev.z) * 0.04;
  const dScale = (curr.scale - prev.scale) * 60;
  const dRot =
    (curr.rotation - prev.rotation) * 0.4 +
    ((curr.rotateX ?? 0) - (prev.rotateX ?? 0)) * 0.35 +
    ((curr.rotateY ?? 0) - (prev.rotateY ?? 0)) * 0.35;

  const vx = dx + dz * 0.5 + dRot * 0.4;
  const vy = dy + dScale * 0.5;
  const speed = Math.sqrt(vx * vx + vy * vy + dz * dz + dScale * dScale);
  return { vx, vy, speed };
}

/**
 * Deterministic camera shake / impact impulse generator.
 * Pure function of frame — produces repeatable high-energy camera impact jitter.
 */
export function computeCameraShake(
  frame: number,
  fps: number,
  intensity = 1,
  decayFrames = 14
): { dx: number; dy: number; drot: number } {
  if (intensity <= 0 || frame < 0 || frame >= decayFrames) {
    return { dx: 0, dy: 0, drot: 0 };
  }
  const progress = frame / Math.max(1, decayFrames);
  const envelope = Math.pow(1 - progress, 2.2) * intensity;
  const freq = (frame / Math.max(1, fps)) * 55;
  const dx = Math.sin(freq * 2.1 + 0.7) * 18 * envelope;
  const dy = Math.cos(freq * 2.7 + 1.3) * 14 * envelope;
  const drot = Math.sin(freq * 1.8) * 1.6 * envelope;
  return { dx, dy, drot };
}

export interface SpringConfig {
  damping?: number;
  stiffness?: number;
  mass?: number;
}

export interface SpringParams {
  frame: number;
  fps: number;
  config?: SpringConfig;
  from?: number;
  to?: number;
  durationInFrames?: number;
}

/**
 * Deterministic analytical & step-integrated harmonic oscillator spring solver.
 * Pure function of `frame` and `fps` — 100% deterministic when scrubbing or rendering.
 */
export function spring(params: SpringParams): number {
  const { frame, fps, config, from = 0, to = 1 } = params;
  if (frame <= 0) return from;

  const damping = config?.damping ?? 14;
  const stiffness = config?.stiffness ?? 120;
  const mass = Math.max(0.1, config?.mass ?? 1);

  const t = frame / Math.max(1, fps);
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  let normalized = 1;
  if (zeta < 1) {
    // Underdamped harmonic oscillator
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * t);
    normalized =
      1 -
      envelope *
        (Math.cos(omegaD * t) +
          ((zeta * omega0) / omegaD) * Math.sin(omegaD * t));
  } else {
    // Critically damped or overdamped
    const envelope = Math.exp(-omega0 * t);
    normalized = 1 - envelope * (1 + omega0 * t);
  }

  // Settle very close to target
  if (Math.abs(1 - normalized) < 0.001 && t > 0.15) {
    normalized = 1;
  }

  return from + normalized * (to - from);
}

export const AbsoluteFill: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    style?: React.CSSProperties;
  }
> = ({ children, style, ...rest }) => {
  return (
    <div
      {...rest}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface SequenceProps {
  from: number;
  durationInFrames?: number;
  name?: string;
  children: React.ReactNode;
}

/**
 * Mounts children only when the global frame is within [from, from + durationInFrames)
 * and shifts `useCurrentFrame()` to local clip frame `globalFrame - from`.
 */
export const Sequence: React.FC<SequenceProps> = ({
  from,
  durationInFrames = Infinity,
  name,
  children,
}) => {
  const parent = useContext(FrameContext);
  const localFrame = parent.frame - from;

  if (localFrame < 0 || localFrame >= durationInFrames) {
    return null;
  }

  const nextValue: FrameContextValue = {
    frame: localFrame,
    config: {
      ...parent.config,
      durationInFrames: Number.isFinite(durationInFrames)
        ? durationInFrames
        : parent.config.durationInFrames - from,
    },
  };

  return (
    <FrameContext.Provider value={nextValue}>
      <AbsoluteFill data-sequence-name={name}>{children}</AbsoluteFill>
    </FrameContext.Provider>
  );
};

export interface AGVIPlayerRef {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (frame: number) => void;
  getCurrentFrame: () => number;
  isPlaying: () => boolean;
  getContainerNode: () => HTMLDivElement | null;
}

export interface AGVIPlayerProps<P> {
  component: React.ComponentType<P>;
  inputProps: P;
  durationInFrames: number;
  compositionWidth: number;
  compositionHeight: number;
  fps: number;
  loop?: boolean;
  controls?: boolean;
  style?: React.CSSProperties;
  onFrameChange?: (frame: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
}

/**
 * Native AGVI Studio Player with automatic CSS transform scaling (`ResizeObserver`),
 * deterministic `requestAnimationFrame` clock, and zero third-party license restrictions.
 */
export const AGVIPlayer = forwardRef<
  AGVIPlayerRef,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AGVIPlayerProps<any>
>(function AGVIPlayerInner(
  {
    component: Comp,
    inputProps,
    durationInFrames,
    compositionWidth,
    compositionHeight,
    fps,
    loop = true,
    controls = true,
    style,
    onFrameChange,
    onPlayStateChange,
  },
  ref
) {
  const [frame, setFrame] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>({ width: 960, height: 540 });

  const outerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const playingRef = useRef<boolean>(false);

  const updateFrame = useCallback(
    (nextFrame: number) => {
      const clamped = Math.max(
        0,
        Math.min(Math.max(0, durationInFrames - 1), Math.round(nextFrame))
      );
      frameRef.current = clamped;
      setFrame(clamped);
      onFrameChange?.(clamped);
    },
    [durationInFrames, onFrameChange]
  );

  const setPlayState = useCallback(
    (nextPlaying: boolean) => {
      playingRef.current = nextPlaying;
      setPlaying(nextPlaying);
      onPlayStateChange?.(nextPlaying);
    },
    [onPlayStateChange]
  );

  useImperativeHandle(
    ref,
    () => ({
      play: () => setPlayState(true),
      pause: () => setPlayState(false),
      toggle: () => setPlayState(!playingRef.current),
      seekTo: (targetFrame: number) => updateFrame(targetFrame),
      getCurrentFrame: () => frameRef.current,
      isPlaying: () => playingRef.current,
      getContainerNode: () => stageRef.current,
    }),
    [setPlayState, updateFrame]
  );

  // Observe outer container size to compute exact responsive scale factor
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // High-precision requestAnimationFrame playback loop
  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    const startWall = performance.now();
    const startFrame = frameRef.current;

    const tick = (now: number) => {
      const elapsedSec = (now - startWall) / 1000;
      const rawNext = startFrame + Math.floor(elapsedSec * fps);

      if (rawNext >= durationInFrames) {
        if (loop) {
          const wrapped = rawNext % Math.max(1, durationInFrames);
          updateFrame(wrapped);
          rafId = requestAnimationFrame(tick);
        } else {
          updateFrame(durationInFrames - 1);
          setPlayState(false);
        }
      } else {
        if (rawNext !== frameRef.current) {
          updateFrame(rawNext);
        }
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, fps, durationInFrames, loop, updateFrame, setPlayState]);

  const scale = useMemo(() => {
    const scaleX = containerSize.width / Math.max(1, compositionWidth);
    const scaleY = containerSize.height / Math.max(1, compositionHeight);
    return Math.min(scaleX, scaleY);
  }, [
    containerSize.width,
    containerSize.height,
    compositionWidth,
    compositionHeight,
  ]);

  const contextValue = useMemo<FrameContextValue>(
    () => ({
      frame,
      config: {
        width: compositionWidth,
        height: compositionHeight,
        fps,
        durationInFrames,
      },
    }),
    [frame, compositionWidth, compositionHeight, fps, durationInFrames]
  );

  const currentSec = (frame / Math.max(1, fps)).toFixed(2);
  const totalSec = (durationInFrames / Math.max(1, fps)).toFixed(2);

  return (
    <div
      ref={outerRef}
      onClick={() => setPlayState(!playing)}
      className="group"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0D0D0C",
        userSelect: "none",
        cursor: "pointer",
        ...style,
      }}
    >
      {/* Scaled Virtual Resolution Stage (e.g. 1920x1080 or 1080x1920) */}
      <div
        ref={stageRef}
        style={{
          width: compositionWidth,
          height: compositionHeight,
          position: "relative",
          overflow: "hidden",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          flexShrink: 0,
        }}
      >
        <FrameContext.Provider value={contextValue}>
          <Comp {...inputProps} />
        </FrameContext.Provider>
      </div>

      {/* Minimalist Architectural Transport Overlay (Auto-hides unless hovered so it never blocks subtitles) */}
      {controls && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 left-3 right-3 px-3 py-1.5 rounded bg-[#161614]/95 border border-[#2A2A26] flex items-center justify-between gap-3 text-xs font-mono text-[#F2F0EA] opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlayState(!playing)}
              className="p-1 rounded bg-[#FF4F00] text-[#0D0D0C] hover:bg-[#e04600] cursor-pointer"
              title={playing ? "Pause (Space)" : "Play (Space)"}
            >
              {playing ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </button>
            <button
              onClick={() => updateFrame(0)}
              className="p-1 rounded bg-[#1F1F1C] hover:bg-[#2A2A26] text-[#9A9890] hover:text-[#F2F0EA] cursor-pointer"
              title="Restart Frame 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="tabular-nums text-[11px]">
              {currentSec}s / {totalSec}s
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, durationInFrames - 1)}
            value={frame}
            onChange={(e) => updateFrame(Number(e.target.value))}
            className="flex-1 accent-[#FF4F00] h-1 bg-[#2A2A26] rounded cursor-pointer"
          />

          <div className="flex items-center gap-2 text-[10px] text-[#9A9890] tabular-nums">
            <span>
              F:{String(frame).padStart(3, "0")}/{durationInFrames}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#1F1F1C] text-[#FF4F00] border border-[#2A2A26]">
              AGVI ENGINE (MIT)
            </span>
            <button
              onClick={() => outerRef.current?.requestFullscreen?.()}
              className="p-1 rounded hover:bg-[#1F1F1C] text-[#9A9890] hover:text-[#F2F0EA] cursor-pointer"
              title="Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
