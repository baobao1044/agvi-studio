export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export type TrackType =
  | "video"
  | "image"
  | "text"
  | "caption"
  | "shape"
  | "audio";

export type EasingPreset =
  | "linear"
  | "ease-in-out"
  | "expo-out"
  | "expo-in"
  | "whip"
  | "back-out"
  | "elastic"
  | "bounce";

export type AnimationType =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "pop-spring"
  | "blur-in"
  | "whip-left"
  | "whip-right"
  | "whip-up"
  | "3d-flip-x"
  | "3d-flip-y"
  | "3d-fly-through"
  | "kinetic-slam"
  | "elastic-stomp";

export type KenBurnsEffect =
  | "none"
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right";

export type CameraMotionEffect =
  | "none"
  | "cinema-dolly"
  | "focus-zoom-left"
  | "focus-zoom-right"
  | "isometric-3d-frame"
  | "split-stage-left"
  | "letterbox-cinema"
  | "orbit-3d-left"
  | "orbit-3d-right"
  | "fly-through-z"
  | "whip-pan-3d"
  | "dutch-roll-impact"
  | "hyper-push-in";

export type SceneTransitionEffect =
  | "none"
  | "shutter-wipe"
  | "editorial-curtain"
  | "iris-frame"
  | "flash-cut"
  | "whip-blur-cut"
  | "3d-cube-spin"
  | "glitch-slice"
  | "zoom-punch";

export type MotionOverlayPreset =
  | "none"
  | "spotlight-pointer"
  | "hud-telemetry"
  | "lower-chyron"
  | "step-annotations"
  | "split-compare"
  | "3d-parallax-grid";

export interface ProcessStepItem {
  step: string;
  title: string;
  detail?: string;
  status?: "done" | "active" | "pending";
}

export interface VideoMotionOverlay {
  preset: MotionOverlayPreset;
  title?: string;
  subtitle?: string;
  /** Target X in percentage from center (-40 to +40) for spotlight-pointer */
  targetX?: number;
  /** Target Y in percentage from center (-40 to +40) for spotlight-pointer */
  targetY?: number;
  /** Sequential items for step-annotations or [beforeLabel, afterLabel] for split-compare */
  items?: string[];
  /** Optional structured step items */
  steps?: ProcessStepItem[];
  /** Optional accent color override */
  accentColor?: string;
}

export type CaptionPreset =
  | "tiktok-pop"
  | "minimal-box"
  | "neon-cyber"
  | "cinematic";

export type ShapeVariant =
  | "rect"
  | "circle"
  | "badge"
  | "progress-bar"
  | "lower-third"
  | "code-card"
  | "gradient-backdrop"
  | "kpi-counter"
  | "bar-chart"
  | "chat-simulation"
  | "terminal-window"
  | "bento-grid"
  | "audio-waveform"
  | "cyber-shader"
  | "spotlight-callout"
  | "process-stepper"
  | "split-comparison"
  | "hud-telemetry"
  | "3d-carousel-stack"
  | "kinetic-impact-wall"
  | "3d-wireframe-prism";

export interface ClipKeyframe {
  /** Normalized progress within clip (0.0 = start, 1.0 = end) */
  offset: number;
  x?: number;
  y?: number;
  /** 3D Z-depth in pixels (-1500 to +1200, 0 = focal plane) */
  z?: number;
  scale?: number;
  rotation?: number;
  rotateX?: number;
  rotateY?: number;
  opacity?: number;
  blur?: number;
  easing?: EasingPreset;
}

export interface ClipTransform {
  /** Horizontal center offset in percentage of canvas width (-50 to 50, 0 = center) */
  x: number;
  /** Vertical center offset in percentage of canvas height (-50 to 50, 0 = center) */
  y: number;
  /** 3D Z-space depth in pixels (-1200 to +800, 0 = stage plane) */
  z?: number;
  /** Scale multiplier (1 = 100%) */
  scale: number;
  /** Z-axis Rotation in degrees */
  rotation: number;
  /** 3D X-axis Pitch in degrees */
  rotateX?: number;
  /** 3D Y-axis Yaw in degrees */
  rotateY?: number;
  /** Width in percentage of canvas width (0-100) */
  width?: number;
  /** Height in percentage of canvas height (0-100) */
  height?: number;
}

export interface ClipAnimation {
  type: AnimationType;
  /** Duration in seconds */
  duration: number;
  /** Optional custom velocity graph easing */
  easing?: EasingPreset;
}

export interface ClipFilter {
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  grayscale?: number;
  /** Automatic velocity-driven directional motion blur (0 = off, 1 = standard AE shutter, 2 = hyper) */
  motionBlur?: number;
  /** RGB chromatic aberration split on fast velocity transitions (0 to 1) */
  chromaticAberration?: number;
  /** Camera impact shake intensity at clip entrance (0 to 2) */
  cameraShake?: number;
}

export interface BaseClip {
  id: string;
  name: string;
  type: TrackType;
  /** Start time on timeline in seconds */
  startTime: number;
  /** Duration on timeline in seconds */
  duration: number;
  /** Opacity from 0 to 1 */
  opacity: number;
  transform: ClipTransform;
  enterAnimation: ClipAnimation;
  exitAnimation: ClipAnimation;
  /** Optional After Effects-style multi-point keyframe track */
  keyframes?: ClipKeyframe[];
  filter?: ClipFilter;
  /** Declarative scene entrance transition (shutter-wipe, iris-frame, whip-blur-cut, 3d-cube-spin, etc.) */
  sceneTransition?: SceneTransitionEffect;
  /** Optional metadata for AI agents (e.g. prompt, sceneId, reasoning) */
  aiMetadata?: {
    sceneId?: string;
    prompt?: string;
    agentNote?: string;
    generatedBy?: string;
  };
}

export interface VideoClip extends BaseClip {
  type: "video";
  src: string;
  trimStart?: number;
  playbackRate?: number;
  volume?: number;
  loop?: boolean;
  objectFit?: "cover" | "contain";
  borderRadius?: number;
  /** Smart camera rig (e.g. focus-zoom-left, isometric-3d-frame, orbit-3d-left, fly-through-z) */
  cameraMotion?: CameraMotionEffect;
  /** Zero-effort motion graphics composited directly onto this video clip */
  motionOverlay?: VideoMotionOverlay;
}

export interface ImageClip extends BaseClip {
  type: "image";
  src: string;
  objectFit?: "cover" | "contain";
  kenBurns?: KenBurnsEffect;
  borderRadius?: number;
  overlayColor?: string;
  overlayOpacity?: number;
  /** Smart camera rig (e.g. focus-zoom-left, isometric-3d-frame, orbit-3d-left, fly-through-z) */
  cameraMotion?: CameraMotionEffect;
  /** Zero-effort motion graphics composited directly onto this image clip */
  motionOverlay?: VideoMotionOverlay;
}

export interface TextStyleConfig {
  fontFamily?: string;
  fontSize: number;
  fontWeight?: "400" | "500" | "600" | "700" | "800" | "900";
  color: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right";
  paddingX?: number;
  paddingY?: number;
  borderRadius?: number;
  letterSpacing?: number;
  lineHeight?: number;
  glowColor?: string;
  gradientColors?: [string, string];
}

export type KineticTextEffect =
  | "none"
  | "typewriter"
  | "gradient"
  | "neon-glow"
  | "kinetic-char-3d"
  | "kinetic-word-stomp"
  | "split-mask-reveal"
  | "glitch-decode";

export interface TextClip extends BaseClip {
  type: "text";
  text: string;
  subtext?: string;
  textEffect?: KineticTextEffect;
  style: TextStyleConfig;
}

export interface CaptionWord {
  word: string;
  /** Relative start time in seconds from clip startTime */
  start: number;
  /** Relative end time in seconds from clip startTime */
  end: number;
}

export interface CaptionClip extends BaseClip {
  type: "caption";
  text: string;
  preset: CaptionPreset;
  highlightColor: string;
  textColor?: string;
  backgroundColor?: string;
  fontSize?: number;
  words?: CaptionWord[];
}

export interface ChartBarItem {
  label: string;
  value: number;
  color?: string;
}

export interface ChatMessageItem {
  sender: "user" | "ai";
  text: string;
}

export interface BentoGridItem {
  title: string;
  subtitle: string;
  metric?: string;
  accent?: string;
}

export interface ShapeClip extends BaseClip {
  type: "shape";
  shapeVariant: ShapeVariant;
  fill: string;
  secondaryFill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  /** Used for lower-third, badge, kpi-counter, bar-chart, code-card, etc. */
  title?: string;
  subtitle?: string;
  codeSnippet?: string;
  codeLanguage?: string;
  accentColor?: string;
  /** For kpi-counter */
  metricValue?: string;
  metricTrend?: string;
  /** For bar-chart */
  chartData?: ChartBarItem[];
  /** For chat-simulation */
  chatMessages?: ChatMessageItem[];
  /** For bento-grid */
  bentoItems?: BentoGridItem[];
  /** For spotlight-callout (-40 to +40 % from center) */
  targetX?: number;
  targetY?: number;
  /** For process-stepper & split-comparison */
  stepperItems?: string[];
  steps?: ProcessStepItem[];
  compareBeforeLabel?: string;
  compareBeforeValue?: string;
  compareAfterLabel?: string;
  compareAfterValue?: string;
}

export interface AudioClip extends BaseClip {
  type: "audio";
  src: string;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  trimStart?: number;
  transcript?: string;
  synthWave?: boolean;
}

export type TimelineClip =
  | VideoClip
  | ImageClip
  | TextClip
  | CaptionClip
  | ShapeClip
  | AudioClip;

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  /** Higher zIndex renders on top */
  zIndex: number;
  muted?: boolean;
  hidden?: boolean;
  locked?: boolean;
  clips: TimelineClip[];
}

export interface CanvasConfig {
  width: number;
  height: number;
  fps: number;
  /** Total duration in seconds */
  duration: number;
  backgroundColor: string;
  aspectRatio: AspectRatio;
}

export interface AssetDefinition {
  id: string;
  name: string;
  type: "video" | "image" | "audio";
  url: string;
  duration?: number;
  tags?: string[];
}

export interface AGVIProject {
  schemaVersion: "1.0.0";
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  canvas: CanvasConfig;
  assets: Record<string, AssetDefinition>;
  tracks: TimelineTrack[];
  agentMeta?: {
    designDirection?: string;
    antiSlopReport?: unknown;
    [key: string]: unknown;
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  normalizedProject?: AGVIProject;
}

export const ASPECT_RATIO_PRESETS: Record<
  AspectRatio,
  { width: number; height: number; label: string }
> = {
  "16:9": { width: 1920, height: 1080, label: "16:9 Landscape (1080p)" },
  "9:16": { width: 1080, height: 1920, label: "9:16 Vertical (Shorts/Reels)" },
  "1:1": { width: 1080, height: 1080, label: "1:1 Square" },
  "4:5": { width: 1080, height: 1350, label: "4:5 Social Feed" },
};

/**
 * Helper to generate word-level timestamps automatically from a sentence and duration
 */
export function buildAutoCaptionWords(
  text: string,
  duration: number
): CaptionWord[] {
  const rawWords = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (rawWords.length === 0) return [];
  const step = duration / rawWords.length;
  return rawWords.map((word, idx) => ({
    word,
    start: Number((idx * step).toFixed(2)),
    end: Number(((idx + 1) * step).toFixed(2)),
  }));
}

/**
 * Automatically separates full-duration HUD clips (like progress-bar or audio-waveform)
 * from scene-level shape tracks so they never collide on the same timeline lane.
 */
function sanitizeTrackOverlaps(
  tracks: TimelineTrack[],
  canvasDuration: number
): TimelineTrack[] {
  const extractedHudClips: TimelineClip[] = [];
  const cleanedTracks: TimelineTrack[] = [];

  for (const track of tracks) {
    if (track.type === "shape" && track.clips.length > 1 && track.id !== "track-hud") {
      const hudClips: TimelineClip[] = [];
      const sceneClips: TimelineClip[] = [];
      for (const clip of track.clips) {
        const isHud =
          clip.type === "shape" &&
          (clip.shapeVariant === "progress-bar" ||
            (clip.shapeVariant === "audio-waveform" &&
              clip.duration >= canvasDuration * 0.8));
        if (isHud) {
          hudClips.push(clip);
        } else {
          sceneClips.push(clip);
        }
      }
      if (hudClips.length > 0 && sceneClips.length > 0) {
        extractedHudClips.push(...hudClips);
        cleanedTracks.push({
          ...track,
          clips: sceneClips,
        });
        continue;
      }
    }
    cleanedTracks.push(track);
  }

  if (extractedHudClips.length > 0) {
    const existingHud = cleanedTracks.find((t) => t.id === "track-hud");
    if (existingHud) {
      const existingIds = new Set(existingHud.clips.map((c) => c.id));
      for (const hc of extractedHudClips) {
        if (!existingIds.has(hc.id)) {
          existingHud.clips.push(hc);
        }
      }
    } else {
      cleanedTracks.push({
        id: "track-hud",
        name: "HUD & Global Overlays",
        type: "shape",
        zIndex: 55,
        clips: extractedHudClips,
      });
    }
  }

  return cleanedTracks;
}

/**
 * Validates and normalizes an input JSON object into a valid AGVIProject.
 */
export function validateAndNormalizeProject(
  raw: unknown,
  autoFix = true
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      issues: [
        {
          path: "$",
          message: "Project root must be a valid JSON object.",
          severity: "error",
        },
      ],
    };
  }

  const input = raw as Record<string, unknown>;
  const id =
    typeof input.id === "string" && input.id.trim()
      ? input.id.trim()
      : "proj-default";
  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim()
      : "Untitled AI Video Project";
  const description =
    typeof input.description === "string"
      ? input.description
      : "Generated via AGVI Schema Engine";

  const rawCanvas =
    input.canvas && typeof input.canvas === "object"
      ? (input.canvas as Record<string, unknown>)
      : {};

  if (!input.canvas) {
    issues.push({
      path: "canvas",
      message: "Missing canvas object; using default 1920x1080 @ 30fps.",
      severity: autoFix ? "warning" : "error",
    });
  }

  const aspectRatio: AspectRatio =
    rawCanvas.aspectRatio === "9:16" ||
    rawCanvas.aspectRatio === "1:1" ||
    rawCanvas.aspectRatio === "4:5" ||
    rawCanvas.aspectRatio === "16:9"
      ? rawCanvas.aspectRatio
      : "16:9";

  const preset = ASPECT_RATIO_PRESETS[aspectRatio];
  const width =
    typeof rawCanvas.width === "number" && rawCanvas.width > 0
      ? rawCanvas.width
      : preset.width;
  const height =
    typeof rawCanvas.height === "number" && rawCanvas.height > 0
      ? rawCanvas.height
      : preset.height;
  const fps =
    typeof rawCanvas.fps === "number" &&
    rawCanvas.fps >= 12 &&
    rawCanvas.fps <= 120
      ? rawCanvas.fps
      : 30;
  let duration =
    typeof rawCanvas.duration === "number" && rawCanvas.duration > 0
      ? rawCanvas.duration
      : 12;
  const backgroundColor =
    typeof rawCanvas.backgroundColor === "string" && rawCanvas.backgroundColor
      ? rawCanvas.backgroundColor
      : "#06080F";

  const rawTracks = Array.isArray(input.tracks) ? input.tracks : [];
  if (!Array.isArray(input.tracks)) {
    issues.push({
      path: "tracks",
      message: "tracks must be an array of TimelineTrack objects.",
      severity: autoFix ? "warning" : "error",
    });
  }

  let maxClipEnd = 0;

  const normalizedTracks: TimelineTrack[] = rawTracks.map(
    (rawTrack, trackIndex) => {
      const t =
        rawTrack && typeof rawTrack === "object"
          ? (rawTrack as Record<string, unknown>)
          : {};
      const trackType: TrackType =
        t.type === "video" ||
        t.type === "image" ||
        t.type === "text" ||
        t.type === "caption" ||
        t.type === "shape" ||
        t.type === "audio"
          ? t.type
          : "shape";

      const trackId =
        typeof t.id === "string" && t.id
          ? t.id
          : `track-${trackType}-${trackIndex + 1}`;
      const trackName =
        typeof t.name === "string" && t.name
          ? t.name
          : `${trackType.toUpperCase()} Track ${trackIndex + 1}`;
      const zIndex =
        typeof t.zIndex === "number" ? t.zIndex : (trackIndex + 1) * 10;

      const rawClips = Array.isArray(t.clips) ? t.clips : [];

      const clips: TimelineClip[] = rawClips.map((rawClip, clipIndex) => {
        const c =
          rawClip && typeof rawClip === "object"
            ? (rawClip as Record<string, unknown>)
            : {};

        const clipType: TrackType =
          c.type === "video" ||
          c.type === "image" ||
          c.type === "text" ||
          c.type === "caption" ||
          c.type === "shape" ||
          c.type === "audio"
            ? c.type
            : trackType;

        const clipId =
          typeof c.id === "string" && c.id
            ? c.id
            : `clip-${clipType}-${trackIndex + 1}-${clipIndex + 1}`;
        const clipName =
          typeof c.name === "string" && c.name
            ? c.name
            : `${clipType} #${clipIndex + 1}`;

        const startTime =
          typeof c.startTime === "number" && c.startTime >= 0
            ? Number(c.startTime.toFixed(2))
            : 0;
        const clipDuration =
          typeof c.duration === "number" && c.duration > 0
            ? Number(c.duration.toFixed(2))
            : 3;

        if (c.duration !== undefined && Number(c.duration) <= 0) {
          issues.push({
            path: `tracks[${trackIndex}].clips[${clipIndex}].duration`,
            message: `Clip "${clipId}" has non-positive duration; defaulted to 3s.`,
            severity: autoFix ? "warning" : "error",
          });
        }

        if (startTime + clipDuration > maxClipEnd) {
          maxClipEnd = startTime + clipDuration;
        }

        const opacity =
          typeof c.opacity === "number"
            ? Math.min(1, Math.max(0, c.opacity))
            : 1;

        const rawTransform =
          c.transform && typeof c.transform === "object"
            ? (c.transform as Record<string, unknown>)
            : {};

        const transform: ClipTransform = {
          x: typeof rawTransform.x === "number" ? rawTransform.x : 0,
          y: typeof rawTransform.y === "number" ? rawTransform.y : 0,
          ...(typeof rawTransform.z === "number" ? { z: rawTransform.z } : {}),
          scale:
            typeof rawTransform.scale === "number" ? rawTransform.scale : 1,
          rotation:
            typeof rawTransform.rotation === "number"
              ? rawTransform.rotation
              : 0,
          ...(typeof rawTransform.rotateX === "number"
            ? { rotateX: rawTransform.rotateX }
            : {}),
          ...(typeof rawTransform.rotateY === "number"
            ? { rotateY: rawTransform.rotateY }
            : {}),
          ...(typeof rawTransform.width === "number"
            ? { width: rawTransform.width }
            : {}),
          ...(typeof rawTransform.height === "number"
            ? { height: rawTransform.height }
            : {}),
        };

        const rawEnter =
          c.enterAnimation && typeof c.enterAnimation === "object"
            ? (c.enterAnimation as Record<string, unknown>)
            : {};
        const rawExit =
          c.exitAnimation && typeof c.exitAnimation === "object"
            ? (c.exitAnimation as Record<string, unknown>)
            : {};

        const enterAnimation: ClipAnimation = {
          type: (rawEnter.type as AnimationType) || "fade",
          duration:
            typeof rawEnter.duration === "number" ? rawEnter.duration : 0.4,
          ...(typeof rawEnter.easing === "string"
            ? { easing: rawEnter.easing as EasingPreset }
            : {}),
        };

        const exitAnimation: ClipAnimation = {
          type: (rawExit.type as AnimationType) || "fade",
          duration:
            typeof rawExit.duration === "number" ? rawExit.duration : 0.3,
          ...(typeof rawExit.easing === "string"
            ? { easing: rawExit.easing as EasingPreset }
            : {}),
        };

        const keyframes: ClipKeyframe[] | undefined = Array.isArray(c.keyframes)
          ? (c.keyframes as ClipKeyframe[])
          : undefined;

        const base: BaseClip = {
          id: clipId,
          name: clipName,
          type: clipType,
          startTime,
          duration: clipDuration,
          opacity,
          transform,
          enterAnimation,
          exitAnimation,
          ...(keyframes && keyframes.length > 0 ? { keyframes } : {}),
          ...(typeof c.sceneTransition === "string"
            ? { sceneTransition: c.sceneTransition as SceneTransitionEffect }
            : {}),
          ...(c.filter && typeof c.filter === "object"
            ? { filter: c.filter as ClipFilter }
            : {}),
          ...(c.aiMetadata && typeof c.aiMetadata && typeof c.aiMetadata === "object"
            ? { aiMetadata: c.aiMetadata as BaseClip["aiMetadata"] }
            : {}),
        };

        switch (clipType) {
          case "video":
            return {
              ...base,
              type: "video",
              src:
                typeof c.src === "string" && c.src
                  ? c.src
                  : "procedural-video://product-ui-capture",
              trimStart: typeof c.trimStart === "number" ? c.trimStart : 0,
              playbackRate:
                typeof c.playbackRate === "number" ? c.playbackRate : 1,
              volume: typeof c.volume === "number" ? c.volume : 1,
              loop: typeof c.loop === "boolean" ? c.loop : true,
              objectFit: c.objectFit === "contain" ? "contain" : "cover",
              borderRadius:
                typeof c.borderRadius === "number" ? c.borderRadius : 0,
              cameraMotion:
                (c.cameraMotion as CameraMotionEffect) || "none",
              ...(c.motionOverlay && typeof c.motionOverlay === "object"
                ? { motionOverlay: c.motionOverlay as VideoMotionOverlay }
                : {}),
            } satisfies VideoClip;

          case "image":
            return {
              ...base,
              type: "image",
              src:
                typeof c.src === "string" && c.src
                  ? c.src
                  : "procedural://editorial-matte",
              objectFit: c.objectFit === "contain" ? "contain" : "cover",
              kenBurns: (c.kenBurns as KenBurnsEffect) || "none",
              borderRadius:
                typeof c.borderRadius === "number" ? c.borderRadius : 0,
              overlayColor:
                typeof c.overlayColor === "string" ? c.overlayColor : "#0D0D0C",
              overlayOpacity:
                typeof c.overlayOpacity === "number" ? c.overlayOpacity : 0.15,
              cameraMotion:
                (c.cameraMotion as CameraMotionEffect) || "none",
              ...(c.motionOverlay && typeof c.motionOverlay === "object"
                ? { motionOverlay: c.motionOverlay as VideoMotionOverlay }
                : {}),
            } satisfies ImageClip;

          case "text": {
            const rawStyle =
              c.style && typeof c.style === "object"
                ? (c.style as Record<string, unknown>)
                : {};
            return {
              ...base,
              type: "text",
              text: typeof c.text === "string" ? c.text : "Editorial Headline",
              subtext: typeof c.subtext === "string" ? c.subtext : undefined,
              textEffect:
                c.textEffect === "typewriter" ||
                c.textEffect === "gradient" ||
                c.textEffect === "neon-glow" ||
                c.textEffect === "kinetic-char-3d" ||
                c.textEffect === "kinetic-word-stomp" ||
                c.textEffect === "split-mask-reveal" ||
                c.textEffect === "glitch-decode"
                  ? c.textEffect
                  : "none",
              style: {
                fontFamily:
                  typeof rawStyle.fontFamily === "string"
                    ? rawStyle.fontFamily
                    : "'Inter', system-ui, sans-serif",
                fontSize:
                  typeof rawStyle.fontSize === "number"
                    ? rawStyle.fontSize
                    : 60,
                fontWeight:
                  (rawStyle.fontWeight as TextStyleConfig["fontWeight"]) ||
                  "700",
                color:
                  typeof rawStyle.color === "string"
                    ? rawStyle.color
                    : "#F2F0EA",
                backgroundColor:
                  typeof rawStyle.backgroundColor === "string"
                    ? rawStyle.backgroundColor
                    : undefined,
                textAlign:
                  rawStyle.textAlign === "left" ||
                  rawStyle.textAlign === "right"
                    ? rawStyle.textAlign
                    : "left",
                paddingX:
                  typeof rawStyle.paddingX === "number"
                    ? rawStyle.paddingX
                    : 20,
                paddingY:
                  typeof rawStyle.paddingY === "number"
                    ? rawStyle.paddingY
                    : 10,
                borderRadius:
                  typeof rawStyle.borderRadius === "number"
                    ? rawStyle.borderRadius
                    : 6,
                letterSpacing:
                  typeof rawStyle.letterSpacing === "number"
                    ? rawStyle.letterSpacing
                    : -1.5,
                glowColor:
                  typeof rawStyle.glowColor === "string"
                    ? rawStyle.glowColor
                    : "#FF4F00",
                gradientColors:
                  Array.isArray(rawStyle.gradientColors) &&
                  rawStyle.gradientColors.length === 2
                    ? (rawStyle.gradientColors as [string, string])
                    : ["#F2F0EA", "#FF4F00"],
              },
            } satisfies TextClip;
          }

          case "caption": {
            const text =
              typeof c.text === "string"
                ? c.text
                : "AI agents edit timeline JSON directly via REST endpoints.";
            const words =
              Array.isArray(c.words) && c.words.length > 0
                ? (c.words as CaptionWord[])
                : buildAutoCaptionWords(text, clipDuration);
            return {
              ...base,
              type: "caption",
              text,
              preset: (c.preset as CaptionPreset) || "minimal-box",
              highlightColor:
                typeof c.highlightColor === "string"
                  ? c.highlightColor
                  : "#FF4F00",
              textColor:
                typeof c.textColor === "string" ? c.textColor : "#F2F0EA",
              backgroundColor:
                typeof c.backgroundColor === "string"
                  ? c.backgroundColor
                  : "rgba(22, 22, 20, 0.94)",
              fontSize: typeof c.fontSize === "number" ? c.fontSize : 40,
              words,
            } satisfies CaptionClip;
          }

          case "audio":
            return {
              ...base,
              type: "audio",
              src: typeof c.src === "string" ? c.src : "",
              volume: typeof c.volume === "number" ? c.volume : 0.8,
              fadeIn: typeof c.fadeIn === "number" ? c.fadeIn : 0.5,
              fadeOut: typeof c.fadeOut === "number" ? c.fadeOut : 0.5,
              trimStart: typeof c.trimStart === "number" ? c.trimStart : 0,
              transcript:
                typeof c.transcript === "string" ? c.transcript : undefined,
              synthWave:
                typeof c.synthWave === "boolean" ? c.synthWave : true,
            } satisfies AudioClip;

          case "shape":
          default:
            return {
              ...base,
              type: "shape",
              shapeVariant:
                (c.shapeVariant as ShapeVariant) || "code-card",
              fill: typeof c.fill === "string" ? c.fill : "#161614",
              secondaryFill:
                typeof c.secondaryFill === "string"
                  ? c.secondaryFill
                  : "#1F1F1C",
              stroke: typeof c.stroke === "string" ? c.stroke : "#2A2A26",
              strokeWidth:
                typeof c.strokeWidth === "number" ? c.strokeWidth : 1,
              borderRadius:
                typeof c.borderRadius === "number" ? c.borderRadius : 6,
              title: typeof c.title === "string" ? c.title : undefined,
              subtitle: typeof c.subtitle === "string" ? c.subtitle : undefined,
              codeSnippet:
                typeof c.codeSnippet === "string" ? c.codeSnippet : undefined,
              codeLanguage:
                typeof c.codeLanguage === "string"
                  ? c.codeLanguage
                  : "typescript",
              accentColor:
                typeof c.accentColor === "string" ? c.accentColor : "#FF4F00",
              metricValue:
                typeof c.metricValue === "string" ? c.metricValue : undefined,
              metricTrend:
                typeof c.metricTrend === "string" ? c.metricTrend : undefined,
              chartData: Array.isArray(c.chartData)
                ? (c.chartData as ChartBarItem[])
                : undefined,
              chatMessages: Array.isArray(c.chatMessages)
                ? (c.chatMessages as ChatMessageItem[])
                : undefined,
              bentoItems: Array.isArray(c.bentoItems)
                ? (c.bentoItems as BentoGridItem[])
                : undefined,
              targetX: typeof c.targetX === "number" ? c.targetX : undefined,
              targetY: typeof c.targetY === "number" ? c.targetY : undefined,
              stepperItems: Array.isArray(c.stepperItems)
                ? (c.stepperItems as string[])
                : undefined,
              steps: Array.isArray(c.steps)
                ? (c.steps as ProcessStepItem[])
                : undefined,
              compareBeforeLabel:
                typeof c.compareBeforeLabel === "string"
                  ? c.compareBeforeLabel
                  : undefined,
              compareBeforeValue:
                typeof c.compareBeforeValue === "string"
                  ? c.compareBeforeValue
                  : undefined,
              compareAfterLabel:
                typeof c.compareAfterLabel === "string"
                  ? c.compareAfterLabel
                  : undefined,
              compareAfterValue:
                typeof c.compareAfterValue === "string"
                  ? c.compareAfterValue
                  : undefined,
            } satisfies ShapeClip;
        }
      });

      clips.sort((a, b) => a.startTime - b.startTime);

      return {
        id: trackId,
        name: trackName,
        type: trackType,
        zIndex,
        muted: Boolean(t.muted),
        hidden: Boolean(t.hidden),
        locked: Boolean(t.locked),
        clips,
      };
    }
  );

  if (maxClipEnd > duration && autoFix) {
    issues.push({
      path: "canvas.duration",
      message: `Clips extend to ${maxClipEnd.toFixed(1)}s which exceeds canvas.duration (${duration}s). Auto-extended canvas duration.`,
      severity: "warning",
    });
    duration = Number(maxClipEnd.toFixed(2));
  }

  const finalTracks = autoFix
    ? sanitizeTrackOverlaps(normalizedTracks, duration)
    : normalizedTracks;

  const normalizedProject: AGVIProject = {
    schemaVersion: "1.0.0",
    id,
    name,
    description,
    updatedAt:
      typeof input.updatedAt === "string" && input.updatedAt
        ? input.updatedAt
        : "2026-01-01T00:00:00.000Z",
    canvas: {
      width,
      height,
      fps,
      duration,
      backgroundColor,
      aspectRatio,
    },
    assets:
      input.assets && typeof input.assets === "object"
        ? (input.assets as Record<string, AssetDefinition>)
        : {},
    tracks: finalTracks,
    ...(input.agentMeta && typeof input.agentMeta === "object"
      ? { agentMeta: input.agentMeta as AGVIProject["agentMeta"] }
      : {}),
  };

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    valid: !hasErrors,
    issues,
    normalizedProject,
  };
}

/**
 * Returns the formal JSON Schema & AI Agent Tool definitions so external LLMs / MCP servers
 * can inspect and invoke the video editor programmatically.
 */
export function getAgentSchemaDocumentation() {
  return {
    schemaVersion: "1.0.0",
    engine: "AGVI 3.0 (High-Tempo 3D & Kinetic Motion Graphics Engine - MIT Native + WebGL + WebAudio)",
    description:
      "After Effects-grade schema-driven & API-driven 3D video engine designed for AI Agents. Supports true 3D spatial coordinates (x, y, z, rotateX, rotateY, rotation, scale), virtual 3D Camera rigs (orbit-3d-left, fly-through-z, whip-pan-3d, hyper-push-in), deterministic WebGL 3D rendering, multi-point keyframe velocity graphs (whip, expo-out, back-out, elastic, bounce), kinetic typography (kinetic-char-3d, kinetic-word-stomp, split-mask-reveal, glitch-decode), velocity-driven directional motion blur, chromatic aberration, and camera shake.",
    endpoints: {
      getSchema: "GET /api/schema",
      generateFromPrompt: "POST /api/agent/generate",
      executeAgentAction: "POST /api/agent/actions",
      listProjects: "GET /api/projects",
      createOrReplaceProject: "POST /api/projects",
      getProject: "GET /api/projects/:id",
      updateProjectJson: "PUT /api/projects/:id",
      triggerRender: "POST /api/render",
    },
    supportedActions: [
      {
        action: "generate_from_prompt",
        description:
          "Magic AI Director: Pass any natural language topic, product pitch, or script in Vietnamese or English and automatically synthesize a multi-track 3D & kinetic motion graphics video with 3D camera choreography, WebGL 3D scenes, velocity keyframes, kinetic typography, and broadcast subtitles.",
        parameters: {
          prompt: "string (required)",
          aspectRatio: "'16:9' | '9:16' | '1:1' | '4:5' (optional)",
          designDirection:
            "'kinetic-3d-keynote' | 'swiss-industrial' | 'warm-editorial' | 'documentary-slate' | 'cobalt-technical' (optional)",
        },
      },
      {
        action: "choreograph_3d_kinetic_scene",
        description:
          "1-Call After Effects 3D & Kinetic Choreographer: Automatically upgrades a clip or scene with 3D spatial depth (z, rotateX, rotateY), multi-point velocity keyframes (whip/expo-out/elastic), directional motion blur, chromatic aberration, camera impact shake, and 3D camera rig.",
        parameters: {
          projectId: "string (optional)",
          clipId: "string (optional)",
          cameraMotion:
            "'orbit-3d-left' | 'orbit-3d-right' | 'fly-through-z' | 'whip-pan-3d' | 'dutch-roll-impact' | 'hyper-push-in' (optional)",
          sceneTransition:
            "'whip-blur-cut' | '3d-cube-spin' | 'zoom-punch' | 'glitch-slice' (optional)",
          textEffect:
            "'kinetic-char-3d' | 'kinetic-word-stomp' | 'split-mask-reveal' | 'glitch-decode' (optional)",
          keyframes: "Array<ClipKeyframe> (optional)",
        },
      },
      {
        action: "enhance_video_with_motion",
        description:
          "1-Call Hybrid Video + Motion Rig: Attach a smart 3D/2D camera rig, scene transition, and SVG motion overlay directly onto a video or WebGL 3D clip.",
        parameters: {
          projectId: "string (optional)",
          clipId: "string (optional)",
          videoSrc: "string (optional, e.g. 'procedural-video://webgl-3d-prism')",
          cameraMotion: "CameraMotionEffect",
          sceneTransition: "SceneTransitionEffect",
          motionOverlay: "VideoMotionOverlay",
        },
      },
      {
        action: "build_from_storyboard",
        description:
          "High-level AI tool: Pass a list of storyboard scenes and automatically construct a 7-track 3D & kinetic video with zero clip overlaps.",
        parameters: {
          projectId: "string (optional)",
          aspectRatio: "'16:9' | '9:16' | '1:1'",
          title: "string",
          designDirection: "DesignDirectionId (optional)",
          scenes: "Array<StoryboardSceneInput>",
        },
      },
      {
        action: "add_clip",
        description:
          "Add a single clip (video, image, text, caption, shape, audio) with 3D transform and keyframes to a track with automatic collision avoidance.",
        parameters: {
          projectId: "string",
          trackId: "string (optional)",
          trackType: "'video' | 'image' | 'text' | 'caption' | 'shape' | 'audio'",
          clip: "Partial<TimelineClip>",
        },
      },
      {
        action: "update_clip",
        description: "Patch any properties (including 3D transform, keyframes, filter, textEffect, cameraMotion) of an existing clip by clipId.",
        parameters: {
          projectId: "string",
          clipId: "string",
          patch: "Partial<TimelineClip>",
        },
      },
      {
        action: "delete_clip",
        description: "Delete a clip from the timeline by clipId.",
        parameters: {
          projectId: "string",
          clipId: "string",
        },
      },
      {
        action: "split_clip",
        description:
          "Split a clip into two sequential clips at a given timeline timestamp (in seconds).",
        parameters: {
          projectId: "string",
          clipId: "string",
          splitTime: "number (seconds)",
        },
      },
      {
        action: "generate_captions_from_script",
        description:
          "Takes a full voiceover script and automatically generates timed karaoke caption clips across the specified time range.",
        parameters: {
          projectId: "string",
          script: "string",
          startTime: "number (default 0)",
          totalDuration: "number (optional)",
          preset: "'tiktok-pop' | 'minimal-box' | 'neon-cyber' | 'cinematic'",
          highlightColor: "string (hex)",
        },
      },
      {
        action: "set_canvas",
        description:
          "Change video aspect ratio ('16:9', '9:16', '1:1', '4:5'), resolution, FPS, or duration.",
        parameters: {
          projectId: "string",
          canvas: "Partial<CanvasConfig>",
        },
      },
      {
        action: "apply_template",
        description: "Reset project to one of the built-in showcase templates (including 'kinetic-3d-keynote').",
        parameters: {
          projectId: "string",
          templateId:
            "'kinetic-3d-keynote' | 'ai-tech-explainer' | 'tiktok-short-reel' | 'product-launch-ad'",
        },
      },
      {
        action: "batch",
        description:
          "Execute multiple agent actions atomically in sequence in a single HTTP request.",
        parameters: {
          projectId: "string",
          actions: "Array<AgentActionPayload>",
        },
      },
    ],
    openaiToolDefinitions: [
      {
        type: "function",
        function: {
          name: "agvi_generate_from_prompt",
          description:
            "Generate a complete 7-track 3D & high-tempo kinetic motion-graphics video from a natural language prompt or script.",
          parameters: {
            type: "object",
            required: ["prompt"],
            properties: {
              prompt: {
                type: "string",
                description:
                  "Natural language description, topic, or script for the video",
              },
              aspectRatio: {
                type: "string",
                enum: ["16:9", "9:16", "1:1", "4:5"],
              },
              designDirection: {
                type: "string",
                enum: [
                  "kinetic-3d-keynote",
                  "swiss-industrial",
                  "warm-editorial",
                  "documentary-slate",
                  "cobalt-technical",
                ],
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "agvi_choreograph_3d_kinetic_scene",
          description:
            "Apply After Effects-style 3D camera rig, velocity curve keyframes, directional motion blur, chromatic aberration, and 3D kinetic typography in a single tool call.",
          parameters: {
            type: "object",
            properties: {
              projectId: { type: "string" },
              clipId: { type: "string" },
              cameraMotion: {
                type: "string",
                enum: [
                  "orbit-3d-left",
                  "orbit-3d-right",
                  "fly-through-z",
                  "whip-pan-3d",
                  "dutch-roll-impact",
                  "hyper-push-in",
                ],
              },
              sceneTransition: {
                type: "string",
                enum: [
                  "whip-blur-cut",
                  "3d-cube-spin",
                  "zoom-punch",
                  "glitch-slice",
                ],
              },
              textEffect: {
                type: "string",
                enum: [
                  "kinetic-char-3d",
                  "kinetic-word-stomp",
                  "split-mask-reveal",
                  "glitch-decode",
                ],
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "agvi_build_from_storyboard",
          description:
            "Build a complete multi-track 3D & kinetic video timeline from a structured AI storyboard with 3D widgets (3d-wireframe-prism, 3d-carousel-stack, kinetic-impact-wall, kpi-counter, bar-chart, code-card), kinetic titles, and karaoke captions.",
          parameters: {
            type: "object",
            required: ["scenes"],
            properties: {
              projectId: { type: "string" },
              title: { type: "string" },
              aspectRatio: {
                type: "string",
                enum: ["16:9", "9:16", "1:1", "4:5"],
              },
              designDirection: {
                type: "string",
                enum: [
                  "kinetic-3d-keynote",
                  "swiss-industrial",
                  "warm-editorial",
                  "documentary-slate",
                  "cobalt-technical",
                ],
              },
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  required: ["duration", "narration"],
                  properties: {
                    duration: { type: "number" },
                    headline: { type: "string" },
                    subheadline: { type: "string" },
                    narration: { type: "string" },
                    cameraMotion: {
                      type: "string",
                      enum: [
                        "orbit-3d-left",
                        "orbit-3d-right",
                        "fly-through-z",
                        "whip-pan-3d",
                        "dutch-roll-impact",
                        "hyper-push-in",
                        "focus-zoom-left",
                        "isometric-3d-frame",
                      ],
                    },
                    sceneTransition: {
                      type: "string",
                      enum: [
                        "whip-blur-cut",
                        "3d-cube-spin",
                        "zoom-punch",
                        "glitch-slice",
                        "shutter-wipe",
                        "iris-frame",
                      ],
                    },
                    widgetType: {
                      type: "string",
                      enum: [
                        "3d-wireframe-prism",
                        "3d-carousel-stack",
                        "kinetic-impact-wall",
                        "kpi-counter",
                        "bar-chart",
                        "chat-simulation",
                        "code-card",
                        "terminal-window",
                        "bento-grid",
                      ],
                    },
                    metricValue: { type: "string" },
                    metricTrend: { type: "string" },
                    codeSnippet: { type: "string" },
                    lowerThirdTitle: { type: "string" },
                    lowerThirdSubtitle: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    ],
  };
}
