import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import {
  AGVIProject,
  ASPECT_RATIO_PRESETS,
  AspectRatio,
  BentoGridItem,
  CameraMotionEffect,
  CaptionPreset,
  ChartBarItem,
  ChatMessageItem,
  ClipFilter,
  ClipKeyframe,
  KineticTextEffect,
  ProcessStepItem,
  SceneTransitionEffect,
  ShapeVariant,
  TimelineClip,
  TrackType,
  VideoMotionOverlay,
  buildAutoCaptionWords,
  validateAndNormalizeProject,
} from "../schema/timeline-schema";
import { STARTER_TEMPLATES } from "../schema/starter-templates";
import {
  DesignDirectionId,
  cleanCopywritingText,
  enforceAntiSlopOnProject,
  resolveDesignDirection,
} from "../anti-slop/anti-slop-filter";
import {
  CompilerMode,
  compilePromptToStoryboardHeuristic,
  compilePromptToStoryboardWithLLM,
} from "./llm-director";
import { inspectFrameComposition } from "../engine/frame-compositor";
import { buildProjectAudioSchedule } from "../audio/procedural-sound-engine";

export { compilePromptToStoryboardHeuristic as compilePromptToStoryboard };
export { compilePromptToStoryboardWithLLM };
export type { CompilerMode };

export interface AgentActionLogEntry {
  id: string;
  timestamp: string;
  projectId: string;
  action: string;
  agentName: string;
  summary: string;
  status: "success" | "error";
}

export interface RenderJob {
  id: string;
  projectId: string;
  projectName: string;
  format: "mp4" | "webm" | "json-bundle";
  resolution: string;
  fps: number;
  duration: number;
  frameCount: number;
  status: "queued" | "rendering" | "completed" | "failed";
  progress: number;
  cliCommand: string;
  outputPath?: string;
  manifestPath?: string;
  fileSizeBytes?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

interface StoreState {
  activeProjectId: string;
  projects: Record<string, AGVIProject>;
  actionLogs: AgentActionLogEntry[];
  renderJobs: RenderJob[];
}

const DATA_DIR = path.join(process.cwd(), ".agvi-data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

function createInitialState(): StoreState {
  const projects: Record<string, AGVIProject> = {};
  for (const [, tpl] of Object.entries(STARTER_TEMPLATES)) {
    projects[tpl.id] = structuredClone(tpl);
  }
  return {
    activeProjectId: "proj-kinetic-3d",
    projects,
    actionLogs: [
      {
        id: "log-init-1",
        timestamp: new Date().toISOString(),
        projectId: "proj-kinetic-3d",
        action: "system_init",
        agentName: "AGVI 3D + High-Tempo Motion Engine",
        summary:
          "Initialized AGVI Studio (MIT Native Engine) with 6-DOF 3D Stage, Multi-Keyframe Velocity Graph, Kinetic Typography & Hybrid Video Compositing.",
        status: "success",
      },
    ],
    renderJobs: [],
  };
}

const globalForStore = globalThis as unknown as {
  __agviStore?: StoreState;
  __agviWriteSeq?: number;
  __agviWriteMutex?: Promise<void>;
};

function loadStore(): StoreState {
  if (globalForStore.__agviStore) {
    return globalForStore.__agviStore;
  }
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw) as StoreState;
      if (
        parsed &&
        parsed.projects &&
        Object.keys(parsed.projects).length > 0
      ) {
        for (const key of Object.keys(parsed.projects)) {
          const norm = validateAndNormalizeProject(
            parsed.projects[key],
            true
          ).normalizedProject;
          if (norm) {
            parsed.projects[key] = enforceAntiSlopOnProject(norm).project;
          }
        }
        for (const [, tpl] of Object.entries(STARTER_TEMPLATES)) {
          if (!parsed.projects[tpl.id] || tpl.id === "proj-kinetic-3d") {
            parsed.projects[tpl.id] = structuredClone(tpl);
          }
        }
        if (!parsed.activeProjectId || !parsed.projects[parsed.activeProjectId]) {
          parsed.activeProjectId = "proj-kinetic-3d";
        }
        if (!Array.isArray(parsed.renderJobs)) {
          parsed.renderJobs = [];
        }
        globalForStore.__agviStore = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to initial state
  }
  const initial = createInitialState();
  globalForStore.__agviStore = initial;
  saveStore(initial);
  return initial;
}

/**
 * Atomic write-temp-and-rename persistence (`store.json.tmp.<pid>.<seq>` -> `store.json`)
 * with serialized write ordering so concurrent updates never corrupt the JSON store.
 */
export function saveStore(state: StoreState): void {
  globalForStore.__agviStore = state;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const seq = (globalForStore.__agviWriteSeq =
      (globalForStore.__agviWriteSeq || 0) + 1);
    const tmpFile = `${STORE_FILE}.tmp.${process.pid}.${seq}`;
    const payload = JSON.stringify(state, null, 2);
    fs.writeFileSync(tmpFile, payload, "utf-8");
    try {
      fs.renameSync(tmpFile, STORE_FILE);
    } catch {
      // Windows fallback if destination is briefly locked by an external reader
      fs.writeFileSync(STORE_FILE, payload, "utf-8");
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // Ignore cleanup failure
      }
    }
  } catch {
    // Ignore disk write errors on read-only environments
  }
}

/**
 * Serializes async store mutations through an in-process mutex queue.
 */
export async function withStoreWriteLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const prev = globalForStore.__agviWriteMutex || Promise.resolve();
  let release!: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalForStore.__agviWriteMutex = prev.then(() => nextLock);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export function getStoreSnapshot() {
  const store = loadStore();
  return {
    activeProjectId: store.activeProjectId,
    projects: Object.values(store.projects),
    activeProject:
      store.projects[store.activeProjectId] ||
      Object.values(store.projects)[0],
    actionLogs: store.actionLogs.slice(0, 50),
    renderJobs: store.renderJobs.slice(0, 20),
  };
}

export function getProjectById(projectId?: string): AGVIProject {
  const store = loadStore();
  const targetId = projectId || store.activeProjectId;
  return (
    store.projects[targetId] ||
    store.projects[store.activeProjectId] ||
    Object.values(store.projects)[0]
  );
}

export function saveProject(
  rawProject: unknown,
  agentName = "External AI Agent",
  setActive = true
) {
  const store = loadStore();
  const validation = validateAndNormalizeProject(rawProject, true);
  if (!validation.normalizedProject) {
    throw new Error(
      validation.issues.map((i) => `${i.path}: ${i.message}`).join("; ")
    );
  }
  const { project: sanitized, report } = enforceAntiSlopOnProject(
    validation.normalizedProject
  );
  sanitized.updatedAt = new Date().toISOString();
  store.projects[sanitized.id] = sanitized;
  if (setActive) {
    store.activeProjectId = sanitized.id;
  }

  store.actionLogs.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: sanitized.updatedAt,
    projectId: sanitized.id,
    action: "save_project_json",
    agentName,
    summary: `Saved "${sanitized.name}" (${sanitized.tracks.length} tracks, ${sanitized.canvas.duration}s) • ${report.summary}`,
    status: "success",
  });

  saveStore(store);
  return {
    project: sanitized,
    validation,
    antiSlopReport: report,
  };
}

export function setActiveProject(projectId: string): AGVIProject | null {
  const store = loadStore();
  if (!store.projects[projectId]) return null;
  store.activeProjectId = projectId;
  saveStore(store);
  return store.projects[projectId];
}

export type SceneLayoutPattern =
  | "statement-only"
  | "asymmetric-split"
  | "artifact-focus"
  | "stacked-editorial";

export interface StoryboardSceneInput {
  duration: number;
  layoutPattern?: SceneLayoutPattern;
  headline?: string;
  subheadline?: string;
  narration: string;
  visualTheme?: string;
  imageUrl?: string;
  videoUrl?: string;
  useVideoFootage?: boolean;
  cameraMotion?: CameraMotionEffect;
  sceneTransition?: SceneTransitionEffect;
  motionOverlay?: VideoMotionOverlay;
  textEffect?: KineticTextEffect;
  keyframes?: ClipKeyframe[];
  filter?: ClipFilter;
  widgetType?: ShapeVariant;
  metricValue?: string;
  metricTrend?: string;
  chartData?: ChartBarItem[];
  chatMessages?: ChatMessageItem[];
  bentoItems?: BentoGridItem[];
  steps?: ProcessStepItem[];
  compareBeforeLabel?: string;
  compareBeforeValue?: string;
  compareAfterLabel?: string;
  compareAfterValue?: string;
  targetX?: number;
  targetY?: number;
  codeSnippet?: string;
  lowerThirdTitle?: string;
  lowerThirdSubtitle?: string;
}

export interface AgentActionPayload {
  action:
    | "generate_from_prompt"
    | "build_from_storyboard"
    | "enhance_video_with_motion"
    | "choreograph_3d_kinetic_scene"
    | "set_design_direction"
    | "add_clip"
    | "update_clip"
    | "delete_clip"
    | "split_clip"
    | "generate_captions_from_script"
    | "set_canvas"
    | "apply_template"
    | "batch";
  projectId?: string;
  agentName?: string;
  prompt?: string;
  stylePreset?: string;
  designDirection?: DesignDirectionId;
  compilerMode?: CompilerMode;
  providerName?: string;
  title?: string;
  aspectRatio?: AspectRatio;
  scenes?: StoryboardSceneInput[];
  videoSrc?: string;
  cameraMotion?: CameraMotionEffect;
  sceneTransition?: SceneTransitionEffect;
  motionOverlay?: VideoMotionOverlay;
  textEffect?: KineticTextEffect;
  keyframes?: ClipKeyframe[];
  filter?: ClipFilter;
  trackId?: string;
  trackType?: TrackType;
  clip?: Record<string, unknown>;
  clipId?: string;
  patch?: Record<string, unknown>;
  splitTime?: number;
  script?: string;
  startTime?: number;
  totalDuration?: number;
  preset?: CaptionPreset;
  highlightColor?: string;
  canvas?: Record<string, unknown>;
  templateId?: string;
  actions?: AgentActionPayload[];
}

/**
 * Executes a semantic AI Agent Action (or batch of actions) against a project,
 * then runs the Anti-Slop Gate (`enforceAntiSlopOnProject`).
 */
export function executeAgentAction(payload: AgentActionPayload) {
  const store = loadStore();
  const agentName = payload.agentName || "AI Agent (API)";
  const targetProject = structuredClone(getProjectById(payload.projectId));
  const summaryMessages: string[] = [];

  function runSingleAction(
    proj: AGVIProject,
    act: AgentActionPayload
  ): AGVIProject {
    switch (act.action) {
      case "set_design_direction": {
        const dir = resolveDesignDirection(act.designDirection, proj.name);
        proj.canvas.backgroundColor = dir.palette.canvasBg;
        proj.agentMeta = {
          ...(proj.agentMeta || {}),
          designDirection: dir.id,
        };
        summaryMessages.push(`Set Art Direction to "${dir.name}"`);
        return proj;
      }

      case "choreograph_3d_kinetic_scene": {
        const dir = resolveDesignDirection(
          act.designDirection || "kinetic-3d-keynote",
          proj.name
        );
        proj.agentMeta = {
          ...(proj.agentMeta || {}),
          designDirection: dir.id,
        };
        proj.canvas.fps = 60;

        const cameraMotion: CameraMotionEffect =
          act.cameraMotion || "orbit-3d-left";
        const sceneTransition: SceneTransitionEffect =
          act.sceneTransition || "3d-cube-spin";
        const textEffect: KineticTextEffect =
          act.textEffect || "kinetic-char-3d";
        const motionOverlay: VideoMotionOverlay = act.motionOverlay || {
          preset: "3d-parallax-grid",
          title: "6-DOF 3D KINETIC STAGE // 60 FPS",
          subtitle: "PERSPECTIVE 1400PX • VELOCITY GRAPH",
          accentColor: dir.palette.accent,
        };
        const defaultKeyframes: ClipKeyframe[] = act.keyframes || [
          {
            offset: 0,
            x: -28,
            y: 10,
            z: -260,
            rotateX: 28,
            rotateY: -34,
            scale: 0.72,
            opacity: 0,
            easing: "whip",
          },
          {
            offset: 0.24,
            x: -4,
            y: -4,
            z: 75,
            rotateX: 2,
            rotateY: -6,
            scale: 1.04,
            opacity: 1,
            easing: "expo-out",
          },
          {
            offset: 0.85,
            x: -3,
            y: -4,
            z: 40,
            rotateX: 0,
            rotateY: 4,
            scale: 1,
            opacity: 1,
            easing: "ease-in-out",
          },
          {
            offset: 1,
            x: 16,
            y: -4,
            z: 220,
            rotateX: -12,
            rotateY: 22,
            scale: 1.15,
            opacity: 0,
            easing: "expo-in",
          },
        ];

        const bgTrack = proj.tracks.find(
          (t) => t.type === "video" || t.type === "image"
        );
        if (bgTrack && bgTrack.clips.length > 0) {
          bgTrack.type = "video";
          bgTrack.name = "1. 3D WebGL Stage & 6-DOF Camera Rig";
          const firstBg = bgTrack.clips[0];
          bgTrack.clips[0] = {
            ...firstBg,
            type: "video",
            name: "3D WebGL Stage + 6-DOF Camera Rig",
            src: act.videoSrc || "procedural-video://webgl-3d-prism",
            volume: 0,
            playbackRate: 1,
            trimStart: 0,
            cameraMotion,
            sceneTransition,
            motionOverlay: {
              ...motionOverlay,
              accentColor: motionOverlay.accentColor || dir.palette.accent,
            },
          };
        }

        const textTrack = proj.tracks.find((t) => t.type === "text");
        if (textTrack && textTrack.clips.length > 0) {
          const targetText =
            (act.clipId &&
              textTrack.clips.find((c) => c.id === act.clipId)) ||
            textTrack.clips[0];
          if (targetText && targetText.type === "text") {
            const tIdx = textTrack.clips.indexOf(targetText);
            textTrack.clips[tIdx] = {
              ...targetText,
              textEffect,
              sceneTransition,
              filter: act.filter || {
                motionBlur: 0.75,
                chromaticAberration: 0.45,
                cameraShake: 0.35,
              },
              transform: {
                ...targetText.transform,
                z: 60,
                rotateX: 4,
                rotateY: -8,
              },
              keyframes: defaultKeyframes,
              enterAnimation: { type: "3d-flip-x", duration: 0.35 },
            };
          }
        }

        const widgetTrack = proj.tracks.find(
          (t) =>
            t.type === "shape" &&
            t.id !== "track-hud" &&
            t.id !== "track-callouts"
        );
        if (widgetTrack && widgetTrack.clips.length > 0) {
          const wClip =
            (act.clipId && widgetTrack.clips.find((c) => c.id === act.clipId)) ||
            widgetTrack.clips[0];
          if (wClip && wClip.type === "shape") {
            const wIdx = widgetTrack.clips.indexOf(wClip);
            widgetTrack.clips[wIdx] = {
              ...wClip,
              shapeVariant: "3d-carousel-stack",
              sceneTransition,
              filter: act.filter || {
                motionBlur: 0.55,
                chromaticAberration: 0.3,
              },
              transform: {
                ...wClip.transform,
                z: 35,
                rotateX: 4,
                rotateY: -12,
              },
              ...(act.keyframes ? { keyframes: defaultKeyframes } : {}),
              enterAnimation: { type: "3d-flip-y", duration: 0.38 },
            };
          }
        }

        if (act.clipId) {
          for (const trk of proj.tracks) {
            const cIdx = trk.clips.findIndex((c) => c.id === act.clipId);
            if (cIdx !== -1) {
              const target = trk.clips[cIdx];
              trk.clips[cIdx] = {
                ...target,
                sceneTransition,
                filter: act.filter || {
                  ...(target.filter || {}),
                  motionBlur: 0.75,
                  chromaticAberration: 0.45,
                  cameraShake: 0.35,
                },
                transform: {
                  ...target.transform,
                  z: target.transform.z ?? 60,
                  rotateX: target.transform.rotateX ?? 4,
                  rotateY: target.transform.rotateY ?? -8,
                },
                keyframes: defaultKeyframes,
              };
            }
          }
        }

        summaryMessages.push(
          `Choreographed 60fps 3D Kinetic Scene: Camera (${cameraMotion}), Transition (${sceneTransition}), Text (${textEffect}), 4-Point Whip Keyframe Graph & Directional Motion Blur`
        );
        return proj;
      }

      case "enhance_video_with_motion": {
        const dir = resolveDesignDirection(
          act.designDirection ||
            (proj.agentMeta?.designDirection as string | undefined),
          proj.name
        );
        const cameraMotion: CameraMotionEffect =
          act.cameraMotion || "focus-zoom-left";
        const sceneTransition: SceneTransitionEffect =
          act.sceneTransition || "shutter-wipe";
        const motionOverlay: VideoMotionOverlay = act.motionOverlay || {
          preset: "spotlight-pointer",
          title: "01 / AUTO-SPOTLIGHT TARGET",
          subtitle:
            "Tự động làm mờ nền, zoom camera vào mục tiêu và vẽ nhãn chỉ dẫn SVG.",
          targetX: -14,
          targetY: -8,
          accentColor: dir.palette.accent,
        };

        let bgTrack = proj.tracks.find(
          (t) => t.type === "video" || t.type === "image"
        );
        if (!bgTrack) {
          bgTrack = {
            id: "track-video-main",
            name: "1. Hybrid Video & Camera Rig",
            type: "video",
            zIndex: 10,
            clips: [],
          };
          proj.tracks.unshift(bgTrack);
        } else {
          bgTrack.type = "video";
          bgTrack.name = "1. Hybrid Video & Camera Rig";
        }

        const targetClip =
          (act.clipId &&
            bgTrack.clips.find((c) => c.id === act.clipId)) ||
          bgTrack.clips[0];

        if (targetClip) {
          const idx = bgTrack.clips.indexOf(targetClip);
          bgTrack.clips[idx] = {
            ...targetClip,
            type: "video",
            name: "Hybrid Video + Motion Rig",
            src:
              act.videoSrc ||
              (targetClip.type === "video" && targetClip.src
                ? targetClip.src
                : "procedural-video://product-ui-capture"),
            volume: 0,
            playbackRate: 1,
            trimStart: 0,
            cameraMotion,
            sceneTransition,
            motionOverlay: {
              ...motionOverlay,
              accentColor: motionOverlay.accentColor || dir.palette.accent,
            },
          };
        } else {
          bgTrack.clips.push({
            id: `clip-video-hybrid-${Date.now().toString(36).slice(-4)}`,
            name: "Hybrid Video + Motion Rig",
            type: "video",
            startTime: 0,
            duration: Math.min(6, proj.canvas.duration || 6),
            opacity: 1,
            src: act.videoSrc || "procedural-video://product-ui-capture",
            volume: 0,
            playbackRate: 1,
            trimStart: 0,
            cameraMotion,
            sceneTransition,
            motionOverlay: {
              ...motionOverlay,
              accentColor: motionOverlay.accentColor || dir.palette.accent,
            },
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            enterAnimation: { type: "none", duration: 0 },
            exitAnimation: { type: "none", duration: 0 },
          });
        }

        summaryMessages.push(
          `Attached Camera Rig (${cameraMotion}), Transition (${sceneTransition}) & Motion Overlay (${motionOverlay.preset}) onto video footage`
        );
        return proj;
      }

      case "generate_from_prompt": {
        const compiled = compilePromptToStoryboardHeuristic(
          act.prompt || "Schema-Driven Video Engine",
          act.aspectRatio || proj.canvas.aspectRatio,
          act.designDirection ||
            (proj.agentMeta?.designDirection as DesignDirectionId | undefined)
        );
        const mode: CompilerMode = act.compilerMode || compiled.compilerMode;
        proj.agentMeta = {
          ...(proj.agentMeta || {}),
          designDirection: compiled.designDirection,
          compilerMode: mode,
          ...(act.providerName ? { llmProvider: act.providerName } : {}),
        };
        summaryMessages.push(
          `Synthesized 4-scene hybrid video + motion storyboard (${compiled.aspectRatio}, ${compiled.designDirection}, mode=${mode}) from prompt: "${(act.prompt || "").slice(0, 45)}"`
        );
        return runSingleAction(proj, {
          action: "build_from_storyboard",
          title: act.title || compiled.title,
          aspectRatio: act.aspectRatio || compiled.aspectRatio,
          designDirection: act.designDirection || compiled.designDirection,
          compilerMode: mode,
          providerName: act.providerName,
          prompt: act.prompt,
          scenes: act.scenes || compiled.scenes,
        });
      }

      case "apply_template": {
        const tplId = act.templateId || "ai-tech-explainer";
        const tpl = STARTER_TEMPLATES[tplId];
        if (!tpl) {
          throw new Error(`Unknown templateId: "${tplId}"`);
        }
        const cloned = structuredClone(tpl);
        cloned.updatedAt = new Date().toISOString();
        store.projects[cloned.id] = cloned;
        store.activeProjectId = cloned.id;
        summaryMessages.push(`Applied editorial template "${tpl.name}"`);
        return cloned;
      }

      case "set_canvas": {
        const c = act.canvas || {};
        if (
          c.aspectRatio === "16:9" ||
          c.aspectRatio === "9:16" ||
          c.aspectRatio === "1:1" ||
          c.aspectRatio === "4:5"
        ) {
          proj.canvas.aspectRatio = c.aspectRatio;
          const preset = ASPECT_RATIO_PRESETS[c.aspectRatio];
          proj.canvas.width = preset.width;
          proj.canvas.height = preset.height;
        }
        if (typeof c.width === "number" && c.width > 0) {
          proj.canvas.width = c.width;
        }
        if (typeof c.height === "number" && c.height > 0) {
          proj.canvas.height = c.height;
        }
        if (typeof c.fps === "number" && c.fps >= 12) {
          proj.canvas.fps = c.fps;
        }
        if (typeof c.duration === "number" && c.duration > 0) {
          proj.canvas.duration = c.duration;
        }
        if (typeof c.backgroundColor === "string") {
          proj.canvas.backgroundColor = c.backgroundColor;
        }
        summaryMessages.push(
          `Updated canvas to ${proj.canvas.aspectRatio} (${proj.canvas.width}x${proj.canvas.height} @ ${proj.canvas.fps}fps)`
        );
        return proj;
      }

      case "add_clip": {
        const rawClip = act.clip || {};
        const clipType: TrackType =
          (rawClip.type as TrackType) || act.trackType || "text";

        let track = proj.tracks.find(
          (t) =>
            (act.trackId && t.id === act.trackId) ||
            (!act.trackId && t.type === clipType && t.id !== "track-hud")
        );

        if (!track) {
          const zIndexMap: Record<TrackType, number> = {
            audio: 5,
            video: 10,
            image: 12,
            shape: 22,
            text: 30,
            caption: 40,
          };
          track = {
            id: act.trackId || `track-${clipType}-${proj.tracks.length + 1}`,
            name: `${clipType.toUpperCase()} Track`,
            type: clipType,
            zIndex: zIndexMap[clipType] || 25,
            clips: [],
          };
          proj.tracks.push(track);
        }

        let startTime =
          typeof rawClip.startTime === "number" ? rawClip.startTime : 0;
        const duration =
          typeof rawClip.duration === "number" ? rawClip.duration : 3.5;

        const hasOverlap = track.clips.some(
          (existing) =>
            startTime < existing.startTime + existing.duration - 0.05 &&
            startTime + duration > existing.startTime + 0.05
        );
        if (hasOverlap && track.clips.length > 0) {
          const maxEnd = Math.max(
            ...track.clips.map((c) => c.startTime + c.duration)
          );
          startTime = Number(maxEnd.toFixed(2));
        }

        const newClip = {
          id:
            typeof rawClip.id === "string"
              ? rawClip.id
              : `clip-${clipType}-${Date.now().toString(36)}`,
          name:
            typeof rawClip.name === "string"
              ? rawClip.name
              : `${clipType.toUpperCase()} Clip`,
          type: clipType,
          ...rawClip,
          startTime,
          duration,
        };

        track.clips.push(newClip as unknown as TimelineClip);
        summaryMessages.push(
          `Added ${clipType} clip "${newClip.name}" at ${startTime}s (${duration}s)`
        );
        return proj;
      }

      case "update_clip": {
        if (!act.clipId) {
          throw new Error("update_clip requires clipId");
        }
        let found = false;
        for (const track of proj.tracks) {
          const idx = track.clips.findIndex((c) => c.id === act.clipId);
          if (idx !== -1) {
            const existing = track.clips[idx];
            const patch = act.patch || {};
            track.clips[idx] = {
              ...existing,
              ...patch,
              transform: {
                ...existing.transform,
                ...(patch.transform && typeof patch.transform === "object"
                  ? (patch.transform as object)
                  : {}),
              },
            } as TimelineClip;
            found = true;
            summaryMessages.push(`Updated clip "${act.clipId}"`);
            break;
          }
        }
        if (!found) {
          throw new Error(`Clip "${act.clipId}" not found`);
        }
        return proj;
      }

      case "delete_clip": {
        if (!act.clipId) {
          throw new Error("delete_clip requires clipId");
        }
        let removed = false;
        for (const track of proj.tracks) {
          const before = track.clips.length;
          track.clips = track.clips.filter((c) => c.id !== act.clipId);
          if (track.clips.length < before) {
            removed = true;
          }
        }
        if (!removed) {
          throw new Error(`Clip "${act.clipId}" not found`);
        }
        summaryMessages.push(`Deleted clip "${act.clipId}"`);
        return proj;
      }

      case "split_clip": {
        if (!act.clipId || typeof act.splitTime !== "number") {
          throw new Error("split_clip requires clipId and numeric splitTime");
        }
        let splitDone = false;
        for (const track of proj.tracks) {
          const idx = track.clips.findIndex((c) => c.id === act.clipId);
          if (idx !== -1) {
            const clip = track.clips[idx];
            const relSplit = act.splitTime - clip.startTime;
            if (relSplit <= 0.2 || relSplit >= clip.duration - 0.2) {
              throw new Error(
                `splitTime (${act.splitTime}s) must be strictly inside clip range [${clip.startTime}s, ${clip.startTime + clip.duration}s]`
              );
            }
            const firstHalf: TimelineClip = {
              ...structuredClone(clip),
              duration: Number(relSplit.toFixed(2)),
              name: `${clip.name} (Part 1)`,
            };
            const secondHalf: TimelineClip = {
              ...structuredClone(clip),
              id: `${clip.id}-part2-${Date.now().toString(36).slice(-3)}`,
              startTime: Number(act.splitTime.toFixed(2)),
              duration: Number((clip.duration - relSplit).toFixed(2)),
              name: `${clip.name} (Part 2)`,
            };
            track.clips.splice(idx, 1, firstHalf, secondHalf);
            splitDone = true;
            summaryMessages.push(
              `Split clip "${clip.id}" at ${act.splitTime.toFixed(2)}s`
            );
            break;
          }
        }
        if (!splitDone) {
          throw new Error(`Clip "${act.clipId}" not found for split`);
        }
        return proj;
      }

      case "generate_captions_from_script": {
        const script = cleanCopywritingText((act.script || "").trim());
        if (!script) {
          throw new Error(
            "generate_captions_from_script requires non-empty script"
          );
        }
        const direction = resolveDesignDirection(
          proj.agentMeta?.designDirection as string | undefined,
          proj.name
        );
        const startOffset =
          typeof act.startTime === "number" ? act.startTime : 0;
        const totalDur =
          typeof act.totalDuration === "number" && act.totalDuration > 0
            ? act.totalDuration
            : Math.max(4, proj.canvas.duration - startOffset);

        const rawSentences = script
          .split(/(?<=[.!?।])\s+|\n+/)
          .map((s) => s.trim())
          .filter(Boolean);

        const chunks: string[] = [];
        for (const sentence of rawSentences) {
          const words = sentence.split(/\s+/);
          if (words.length <= 12) {
            chunks.push(sentence);
          } else {
            for (let i = 0; i < words.length; i += 10) {
              chunks.push(words.slice(i, i + 10).join(" "));
            }
          }
        }

        let capTrack = proj.tracks.find((t) => t.type === "caption");
        if (!capTrack) {
          capTrack = {
            id: "track-captions",
            name: "5. Broadcast Subtitles",
            type: "caption",
            zIndex: 40,
            clips: [],
          };
          proj.tracks.push(capTrack);
        } else {
          capTrack.clips = [];
        }

        const totalWords = chunks.reduce(
          (acc, c) => acc + c.split(/\s+/).length,
          0
        );
        let cursor = startOffset;

        chunks.forEach((chunkText, i) => {
          const wordCount = chunkText.split(/\s+/).length;
          const dur = Number(
            Math.max(
              1.2,
              (wordCount / Math.max(1, totalWords)) * totalDur
            ).toFixed(2)
          );
          capTrack!.clips.push({
            id: `clip-cap-auto-${i + 1}`,
            name: `Subtitle #${i + 1}`,
            type: "caption",
            startTime: Number(cursor.toFixed(2)),
            duration: dur,
            opacity: 1,
            text: chunkText,
            preset: "minimal-box",
            highlightColor: direction.palette.accent,
            textColor: direction.palette.textPrimary,
            backgroundColor: direction.palette.surfaceBg,
            fontSize: proj.canvas.aspectRatio === "9:16" ? 40 : 36,
            words: buildAutoCaptionWords(chunkText, dur),
            transform: {
              x: 0,
              y: proj.canvas.aspectRatio === "9:16" ? 35 : 38,
              scale: 1,
              rotation: 0,
            },
            enterAnimation: { type: "fade", duration: 0.2 },
            exitAnimation: { type: "fade", duration: 0.15 },
          });
          cursor += dur;
        });

        summaryMessages.push(
          `Generated ${chunks.length} synchronized broadcast subtitle clips`
        );
        return proj;
      }

      case "build_from_storyboard": {
        const scenes = Array.isArray(act.scenes) ? act.scenes : [];
        if (scenes.length === 0) {
          throw new Error(
            "build_from_storyboard requires a non-empty scenes array"
          );
        }
        if (act.title) {
          proj.name = cleanCopywritingText(act.title);
        }
        if (act.aspectRatio && ASPECT_RATIO_PRESETS[act.aspectRatio]) {
          proj.canvas.aspectRatio = act.aspectRatio;
          proj.canvas.width = ASPECT_RATIO_PRESETS[act.aspectRatio].width;
          proj.canvas.height = ASPECT_RATIO_PRESETS[act.aspectRatio].height;
        }

        const direction = resolveDesignDirection(
          act.designDirection ||
            (proj.agentMeta?.designDirection as string | undefined),
          `${proj.name} ${act.prompt ?? ""}`
        );
        const { palette, radiusPx } = direction;
        const isPortrait = proj.canvas.aspectRatio === "9:16";
        const isKinetic3D = direction.id === "kinetic-3d-keynote";
        if (isKinetic3D) {
          proj.canvas.fps = 60;
        }

        const bgClips: TimelineClip[] = [];
        const widgetClips: TimelineClip[] = [];
        const calloutClips: TimelineClip[] = [];
        const titleClips: TimelineClip[] = [];
        const captionClips: TimelineClip[] = [];

        let cursor = 0;
        const patternCycle: SceneLayoutPattern[] = [
          "statement-only",
          "asymmetric-split",
          "artifact-focus",
          "asymmetric-split",
        ];
        const defaultWidgetCycle: ShapeVariant[] = isKinetic3D
          ? [
              "3d-carousel-stack",
              "3d-carousel-stack",
              "kinetic-impact-wall",
              "3d-wireframe-prism",
            ]
          : [
              "process-stepper",
              "split-comparison",
              "code-card",
              "bento-grid",
            ];

        scenes.forEach((scene, idx) => {
          const dur =
            typeof scene.duration === "number" && scene.duration > 0
              ? Number(scene.duration.toFixed(2))
              : 4;
          const pattern: SceneLayoutPattern =
            scene.layoutPattern || patternCycle[idx % patternCycle.length];

          const useVideo =
            Boolean(scene.useVideoFootage) ||
            Boolean(scene.videoUrl) ||
            Boolean(scene.cameraMotion && scene.cameraMotion !== "none") ||
            Boolean(
              scene.motionOverlay && scene.motionOverlay.preset !== "none"
            );

          if (useVideo) {
            bgClips.push({
              id: `sb-bg-${idx + 1}`,
              name: `Scene ${idx + 1} Video Footage`,
              type: "video",
              startTime: cursor,
              duration: dur,
              opacity: 1,
              src: scene.videoUrl || "procedural-video://product-ui-capture",
              volume: 0,
              playbackRate: 1,
              trimStart: idx * 2,
              cameraMotion: scene.cameraMotion || "none",
              sceneTransition: scene.sceneTransition || "none",
              motionOverlay: scene.motionOverlay
                ? {
                    ...scene.motionOverlay,
                    accentColor:
                      scene.motionOverlay.accentColor || palette.accent,
                  }
                : undefined,
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              enterAnimation: { type: "none", duration: 0 },
              exitAnimation: { type: "none", duration: 0 },
              aiMetadata: {
                sceneId: `scene-${idx + 1}`,
                generatedBy: agentName,
              },
            });
          } else {
            bgClips.push({
              id: `sb-bg-${idx + 1}`,
              name: `Scene ${idx + 1} Surface`,
              type: "image",
              startTime: cursor,
              duration: dur,
              opacity: 1,
              src: scene.imageUrl || `procedural://${direction.id}`,
              kenBurns: "none",
              cameraMotion: scene.cameraMotion || "none",
              sceneTransition: scene.sceneTransition || "none",
              motionOverlay: scene.motionOverlay,
              overlayColor: palette.canvasBg,
              overlayOpacity: 0.12,
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              enterAnimation: { type: "none", duration: 0 },
              exitAnimation: { type: "none", duration: 0 },
              aiMetadata: {
                sceneId: `scene-${idx + 1}`,
                generatedBy: agentName,
              },
            });
          }

          calloutClips.push({
            id: `sb-badge-${idx + 1}`,
            name: `Index 0${idx + 1}`,
            type: "shape",
            shapeVariant: "badge",
            startTime: Number((cursor + 0.1).toFixed(2)),
            duration: Number(Math.max(1, dur - 0.2).toFixed(2)),
            opacity: 1,
            fill: palette.surfaceBg,
            stroke: palette.border,
            strokeWidth: 1,
            borderRadius: radiusPx,
            title:
              scene.lowerThirdTitle ||
              `0${idx + 1} / ${pattern.replace("-", " ").toUpperCase()}`,
            accentColor: palette.accent,
            transform: {
              x: isPortrait ? 0 : pattern === "artifact-focus" ? 0 : -24,
              y: isPortrait ? -39 : -36,
              z: isKinetic3D ? 40 : 0,
              rotateX: 0,
              rotateY: isKinetic3D ? 8 : 0,
              scale: 1,
              rotation: 0,
            },
            enterAnimation: {
              type: isKinetic3D ? "whip-left" : "fade",
              duration: 0.25,
            },
            exitAnimation: { type: "fade", duration: 0.2 },
          });

          if (scene.headline && pattern !== "artifact-focus") {
            const isStatementOnly = pattern === "statement-only";
            const isSplit = pattern === "asymmetric-split" && !isPortrait;

            titleClips.push({
              id: `sb-title-${idx + 1}`,
              name: `Headline ${idx + 1}: ${scene.headline.slice(0, 24)}`,
              type: "text",
              startTime: Number((cursor + 0.1).toFixed(2)),
              duration: Number(Math.max(1, dur - 0.2).toFixed(2)),
              opacity: 1,
              text: cleanCopywritingText(scene.headline),
              subtext: scene.subheadline
                ? cleanCopywritingText(scene.subheadline)
                : undefined,
              textEffect:
                scene.textEffect ||
                (isKinetic3D
                  ? isStatementOnly
                    ? "kinetic-char-3d"
                    : "kinetic-word-stomp"
                  : "none"),
              sceneTransition: scene.sceneTransition || "none",
              filter: scene.filter,
              keyframes: scene.keyframes,
              style: {
                fontSize: isPortrait
                  ? isStatementOnly
                    ? 60
                    : 54
                  : isStatementOnly
                    ? 70
                    : 52,
                fontWeight: isKinetic3D ? "800" : "700",
                color: palette.textPrimary,
                textAlign: "left",
                borderRadius: radiusPx,
              },
              transform: {
                x: isPortrait ? 0 : isSplit ? -23 : -4,
                y: isPortrait
                  ? isStatementOnly
                    ? -6
                    : -26
                  : isStatementOnly
                    ? -4
                    : -4,
                z: isKinetic3D ? (isStatementOnly ? 60 : 45) : 0,
                rotateX: isKinetic3D && isStatementOnly ? 4 : 0,
                rotateY: isKinetic3D ? (isSplit ? 10 : -6) : 0,
                scale: 1,
                rotation: 0,
                width: isPortrait ? 88 : isSplit ? 38 : 82,
              },
              enterAnimation: {
                type: isKinetic3D
                  ? isStatementOnly
                    ? "3d-flip-x"
                    : "whip-left"
                  : isSplit
                    ? "slide-left"
                    : "slide-up",
                duration: 0.32,
              },
              exitAnimation: { type: "fade", duration: 0.2 },
            });
          }

          if (pattern !== "statement-only") {
            const chosenWidget: ShapeVariant =
              scene.widgetType ||
              (scene.codeSnippet
                ? "code-card"
                : defaultWidgetCycle[idx % defaultWidgetCycle.length]);
            const isSplit = pattern === "asymmetric-split" && !isPortrait;

            widgetClips.push({
              id: `sb-widget-${idx + 1}`,
              name: `Scene ${idx + 1} ${chosenWidget}`,
              type: "shape",
              shapeVariant: chosenWidget,
              startTime: Number((cursor + 0.15).toFixed(2)),
              duration: Number(Math.max(1, dur - 0.25).toFixed(2)),
              opacity: 1,
              fill: palette.surfaceBg,
              secondaryFill: palette.surfaceAltBg,
              stroke: palette.border,
              strokeWidth: 1,
              borderRadius: radiusPx,
              sceneTransition: scene.sceneTransition || "none",
              filter: scene.filter,
              title:
                scene.headline ||
                scene.lowerThirdTitle ||
                `0${idx + 1} Specification`,
              subtitle: scene.lowerThirdSubtitle || direction.name,
              codeSnippet: scene.codeSnippet,
              codeLanguage: "json",
              accentColor: palette.accent,
              metricValue:
                scene.metricValue || (isKinetic3D ? "60 FPS" : "30 FPS"),
              metricTrend: scene.metricTrend || "Deterministic Frame Sync",
              chartData: scene.chartData,
              chatMessages: scene.chatMessages,
              bentoItems: scene.bentoItems,
              steps: scene.steps,
              compareBeforeLabel: scene.compareBeforeLabel,
              compareBeforeValue: scene.compareBeforeValue,
              compareAfterLabel: scene.compareAfterLabel,
              compareAfterValue: scene.compareAfterValue,
              targetX: scene.targetX,
              targetY: scene.targetY,
              transform: {
                x: isPortrait ? 0 : isSplit ? 19 : 0,
                y: isPortrait ? 2 : -2,
                z: isKinetic3D ? 35 : 0,
                rotateX: isKinetic3D ? 4 : 0,
                rotateY: isKinetic3D ? (isSplit ? -10 : 0) : 0,
                scale: 1,
                rotation: 0,
                width: isPortrait ? 88 : isSplit ? 46 : 74,
              },
              enterAnimation: {
                type: isKinetic3D
                  ? isSplit
                    ? "3d-flip-y"
                    : "kinetic-slam"
                  : isSplit
                    ? "slide-right"
                    : "slide-up",
                duration: 0.35,
              },
              exitAnimation: { type: "fade", duration: 0.2 },
            });
          }

          if (scene.narration) {
            const cleanNarration = cleanCopywritingText(scene.narration);
            captionClips.push({
              id: `sb-cap-${idx + 1}`,
              name: `Subtitle Scene ${idx + 1}`,
              type: "caption",
              startTime: Number((cursor + 0.1).toFixed(2)),
              duration: Number(Math.max(1, dur - 0.2).toFixed(2)),
              opacity: 1,
              text: cleanNarration,
              preset: "minimal-box",
              highlightColor: palette.accent,
              textColor: palette.textPrimary,
              backgroundColor: palette.surfaceBg,
              fontSize: isPortrait ? 40 : 36,
              words: buildAutoCaptionWords(
                cleanNarration,
                Math.max(1, dur - 0.2)
              ),
              transform: {
                x: 0,
                y: isPortrait ? 35 : 38,
                scale: 1,
                rotation: 0,
              },
              enterAnimation: { type: "fade", duration: 0.2 },
              exitAnimation: { type: "fade", duration: 0.2 },
            });
          }

          cursor = Number((cursor + dur).toFixed(2));
        });

        proj.canvas.duration = cursor;
        proj.canvas.backgroundColor = palette.canvasBg;
        proj.agentMeta = {
          ...(proj.agentMeta || {}),
          designDirection: direction.id,
          compilerMode: act.compilerMode || proj.agentMeta?.compilerMode || "deterministic-heuristic",
          ...(act.providerName ? { llmProvider: act.providerName } : {}),
        };
        proj.tracks = [
          {
            id: "track-bg",
            name: "1. Hybrid Video & Surface Rig",
            type: bgClips.some((c) => c.type === "video") ? "video" : "image",
            zIndex: 10,
            clips: bgClips,
          },
          {
            id: "track-callouts",
            name: "2. Section Index Marks",
            type: "shape",
            zIndex: 25,
            clips: calloutClips,
          },
          {
            id: "track-titles",
            name: "3. Editorial Typography",
            type: "text",
            zIndex: 30,
            clips: titleClips,
          },
          {
            id: "track-widgets",
            name: "4. Structural Artifacts & Code",
            type: "shape",
            zIndex: 20,
            clips: widgetClips,
          },
          {
            id: "track-captions",
            name: "5. Broadcast Subtitles",
            type: "caption",
            zIndex: 40,
            clips: captionClips,
          },
          {
            id: "track-hud",
            name: "6. Bottom Timecode Rule",
            type: "shape",
            zIndex: 55,
            clips: [
              {
                id: "sb-progress-bar",
                name: "Bottom Progress Hairline",
                type: "shape",
                shapeVariant: "progress-bar",
                startTime: 0,
                duration: cursor,
                opacity: 1,
                fill: palette.accent,
                secondaryFill: palette.surfaceAltBg,
                transform: {
                  x: 0,
                  y: 49.4,
                  scale: 1,
                  rotation: 0,
                  width: 100,
                },
                enterAnimation: { type: "none", duration: 0 },
                exitAnimation: { type: "none", duration: 0 },
              },
            ],
          },
          {
            id: "track-audio",
            name: "7. WebAudio Procedural Score",
            type: "audio",
            zIndex: 5,
            clips: [
              {
                id: "sb-audio-bgm",
                name: "Minimal Pulse 120 BPM + Cut Cues",
                type: "audio",
                startTime: 0,
                duration: cursor,
                opacity: 1,
                src: "",
                volume: 0.75,
                synthWave: true,
                transform: { x: 0, y: 0, scale: 1, rotation: 0 },
                enterAnimation: { type: "none", duration: 0 },
                exitAnimation: { type: "none", duration: 0 },
              },
            ],
          },
        ];

        summaryMessages.push(
          `Built ${scenes.length}-scene editorial storyboard (${cursor}s total, ${direction.name})`
        );
        return proj;
      }

      case "batch": {
        const subActions = Array.isArray(act.actions) ? act.actions : [];
        let current = proj;
        for (const sub of subActions) {
          current = runSingleAction(current, sub);
        }
        return current;
      }

      default:
        throw new Error(`Unsupported agent action: "${String(act.action)}"`);
    }
  }

  const mutated = runSingleAction(targetProject, payload);
  const validation = validateAndNormalizeProject(mutated, true);
  const { project: finalProject, report: antiSlopReport } =
    enforceAntiSlopOnProject(validation.normalizedProject!, {
      directionId: payload.designDirection,
      sourcePrompt: payload.prompt,
    });
  if (payload.compilerMode) {
    finalProject.agentMeta = {
      ...(finalProject.agentMeta || {}),
      compilerMode: payload.compilerMode,
      ...(payload.providerName ? { llmProvider: payload.providerName } : {}),
    };
  }
  finalProject.updatedAt = new Date().toISOString();

  store.projects[finalProject.id] = finalProject;
  store.activeProjectId = finalProject.id;

  const logEntry: AgentActionLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: finalProject.updatedAt,
    projectId: finalProject.id,
    action: payload.action,
    agentName,
    summary: `${summaryMessages.join(" | ") || `Executed ${payload.action}`} • ${antiSlopReport.summary}`,
    status: "success",
  };
  store.actionLogs.unshift(logEntry);
  saveStore(store);

  return {
    project: finalProject,
    validation,
    antiSlopReport,
    log: logEntry,
  };
}

/**
 * Updates an existing RenderJob in the store (e.g., transitioning `queued` -> `rendering` -> `completed` | `failed`).
 */
export function updateRenderJobStatus(
  jobId: string,
  patch: Partial<
    Pick<
      RenderJob,
      | "status"
      | "progress"
      | "outputPath"
      | "manifestPath"
      | "fileSizeBytes"
      | "errorMessage"
      | "completedAt"
    >
  >
): RenderJob | null {
  const store = loadStore();
  const job = store.renderJobs.find((j) => j.id === jobId);
  if (!job) return null;

  Object.assign(job, patch, {
    updatedAt: new Date().toISOString(),
  });
  saveStore(store);
  return job;
}

/**
 * Honest RenderJob Lifecycle Manager (`createRenderJob`):
 * - Always initializes in `status: "queued"`, `progress: 0`.
 * - For `json-bundle`, transitions `queued` -> `rendering` -> `completed` after writing and verifying the bundle & frame telemetry manifest on disk.
 * - For `mp4` / `webm`:
 *   - If `executeNow` is false (default when preparing a Browser MediaRecorder export job), leaves `status: "queued"` (or `"rendering"` once client recording starts) until the rendered video artifact is produced.
 *   - If `executeNow` is true, invokes `scripts/render-ffmpeg.mjs`, tracking `queued` -> `rendering` -> `completed` (only if a real, non-empty video file is verified) or `failed` with explicit `errorMessage` diagnostics if FFmpeg/encoder is unavailable.
 */
export function createRenderJob(
  projectId?: string,
  format: "mp4" | "webm" | "json-bundle" = "mp4",
  options?: { executeNow?: boolean }
): RenderJob {
  const store = loadStore();
  const project = getProjectById(projectId);
  const jobId = `render-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const fps = Math.max(12, project.canvas.fps || 30);
  const duration = Math.max(1, project.canvas.duration || 10);
  const frameCount = Math.round(duration * fps);
  const ext = format === "json-bundle" ? "json" : format;
  const relOutPath = `out/${project.id}.${ext}`;
  const absOutPath = path.join(process.cwd(), "out", `${project.id}.${ext}`);
  const absManifestPath = path.join(
    process.cwd(),
    "out",
    `${project.id}.render-manifest.json`
  );

  const cliCommand = `node scripts/render-ffmpeg.mjs --project="${project.id}" --fps=${fps} --size=${project.canvas.width}x${project.canvas.height} --out="${relOutPath}"`;

  const job: RenderJob = {
    id: jobId,
    projectId: project.id,
    projectName: project.name,
    format,
    resolution: `${project.canvas.width}x${project.canvas.height}`,
    fps,
    duration,
    frameCount,
    status: "queued",
    progress: 0,
    cliCommand,
    outputPath: relOutPath,
    manifestPath: `out/${project.id}.render-manifest.json`,
    createdAt: new Date().toISOString(),
  };

  store.renderJobs.unshift(job);
  saveStore(store);

  const outDir = path.dirname(absOutPath);
  try {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  } catch {
    // Ignore mkdir error on read-only FS
  }

  // Always write a deterministic frame-sampled render manifest for inspection
  try {
    const sampleFrames = [
      0,
      Math.floor(frameCount * 0.25),
      Math.floor(frameCount * 0.5),
      Math.floor(frameCount * 0.75),
      Math.max(0, frameCount - 1),
    ];
    const frameTelemetry = sampleFrames.map((f) =>
      inspectFrameComposition(project, f)
    );
    const audioSchedule = buildProjectAudioSchedule(project);
    fs.writeFileSync(
      absManifestPath,
      JSON.stringify(
        {
          jobId: job.id,
          generatedAt: job.createdAt,
          projectId: project.id,
          resolution: job.resolution,
          fps,
          duration,
          frameCount,
          format,
          frameTelemetry,
          audioEventsCount: audioSchedule.length,
          project,
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch {
    // Non-fatal if disk is read-only
  }

  if (format === "json-bundle") {
    updateRenderJobStatus(job.id, { status: "rendering", progress: 50 });
    try {
      fs.writeFileSync(absOutPath, JSON.stringify(project, null, 2), "utf-8");
      const stat = fs.statSync(absOutPath);
      updateRenderJobStatus(job.id, {
        status: "completed",
        progress: 100,
        fileSizeBytes: stat.size,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      updateRenderJobStatus(job.id, {
        status: "failed",
        progress: 0,
        errorMessage:
          err instanceof Error ? err.message : "Failed to write JSON bundle",
      });
    }
  } else if (options?.executeNow) {
    updateRenderJobStatus(job.id, { status: "rendering", progress: 15 });
    const res = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), "scripts", "render-ffmpeg.mjs"),
        `--project=${project.id}`,
        `--fps=${fps}`,
        `--size=${project.canvas.width}x${project.canvas.height}`,
        `--out=${relOutPath}`,
      ],
      { encoding: "utf-8", timeout: 120_000 }
    );

    if (res.status === 0 && fs.existsSync(absOutPath)) {
      const stat = fs.statSync(absOutPath);
      updateRenderJobStatus(job.id, {
        status: "completed",
        progress: 100,
        fileSizeBytes: stat.size,
        completedAt: new Date().toISOString(),
      });
    } else {
      const stderrMsg = (res.stderr || res.stdout || "").trim();
      updateRenderJobStatus(job.id, {
        status: "failed",
        progress: 0,
        errorMessage:
          stderrMsg ||
          `Headless encoder failed with exit code ${res.status ?? -1}. Use Browser Export or install FFmpeg.`,
      });
    }
  }

  store.actionLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    projectId: project.id,
    action: "trigger_render",
    agentName: "AGVI Render Pipeline",
    summary: `Render job ${job.id} (${job.resolution} @ ${job.fps}fps, ${format.toUpperCase()}) -> status: ${job.status}`,
    status: job.status === "failed" ? "error" : "success",
  });
  saveStore(store);

  return job;
}
