# AGVI Studio — Architecture & Native Frame Engine

![Architecture Pipeline](../public/docs/agvi-architecture-pipeline.svg)

## 1. Why Zero-Remotion? (100% MIT Architecture)

Most programmatic React video tools rely on frameworks with proprietary commercial licenses that charge per-seat or per-company fees for enterprise usage.

**AGVI Studio** is engineered from the ground up with its own **100% MIT-licensed Native Frame Engine** (`src/lib/engine/agvi-engine.tsx`), giving teams complete freedom to embed programmatic video editing, AI video synthesis, and motion graphics compositing inside commercial SaaS products and internal enterprise workflows.

---

## 2. Core Engine Subsystems

| Module | File Path | Responsibility |
| :--- | :--- | :--- |
| **Native Frame Engine** | `src/lib/engine/agvi-engine.tsx` | Provides `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`, `spring()`, `evaluateEasing()`, `evaluateClipKeyframes()`, `computeCameraShake()`, `<Sequence>`, `<AbsoluteFill>`, and `<AGVIPlayer>`. |
| **6-DOF Keyframe & Layout Solver** | `src/lib/engine/keyframe-evaluator.ts` | Evaluates multi-point 3D keyframes (`x, y, z, scale, rotation, rotateX, rotateY, opacity, blur`), instantaneous frame-to-frame velocity vectors, 3D camera rigs, and responsive collision-free layout zones (`16:9`, `9:16`, `1:1`, `4:5`). |
| **WebGL2 / WebGL1 3D Shader Stage** | `src/lib/engine/webgl-stage.tsx` | Compiles real GLSL vertex (`AGVI_WEBGL_VERTEX_SHADER`) and fragment (`AGVI_WEBGL_FRAGMENT_SHADER`) shaders with 4x4 perspective (`uProjection`) and model-view (`uModelView`) matrices to render depth-tested 3D geometry (`3d-voxel-cube`, `3d-wireframe-sphere`, `3d-cyber-ring`, `3d-prism-pyramid`, `3d-starfield-tunnel`), with automatic 2D projection fallback when WebGL is unavailable. |
| **Unified Frame Compositor** | `src/lib/engine/frame-compositor.ts` | Evaluates every track, clip, 6-DOF transform, camera rig, kinetic text effect, and data widget (`renderProjectFrameToCanvas` & `inspectFrameComposition`) so Browser Video Export and server-side inspection render the actual project timeline rather than static placeholders. |
| **Hybrid React Stage** | `src/components/remotion/AGVIComposition.tsx` | Interactive DOM + WebGL stage for real-time 60FPS preview in the studio viewport. |
| **Anti-Slop Guardrail** | `src/lib/anti-slop/anti-slop-filter.ts` | Sanitizes AI-generated copy, strips banned clichés & fake metrics, maps colors to curated palettes, and preserves intentional 10/10 kinetic 3D effects. |
| **Procedural Audio & Stream Muxer** | `src/lib/audio/procedural-sound-engine.ts` | Synthesizes real-time ambient backing tracks and transition SFX via the Web Audio API, and exposes `createExportAudioStream()` (`AudioContext.createMediaStreamDestination()`) to multiplex audio directly into browser `.webm` / `.mp4` exports. |
| **Dual-Mode AI Director** | `src/lib/server/llm-director.ts` | Compiles natural language prompts into 4-scene storyboards via OpenAI, Gemini, or Anthropic APIs when an API key is configured (`compilerMode: "llm-provider"`), or falls back deterministically to the bilingual heuristic compiler (`compilerMode: "deterministic-heuristic"`). |
| **Atomic Store & Render Lifecycle** | `src/lib/server/project-store.ts` | Persists `.agvi-data/store.json` using atomic temp-file-and-rename writes serialized by `withStoreWriteLock()`, and tracks honest `RenderJob` states (`queued` -> `rendering` -> `completed` \| `failed`). |
| **API Security & Rate Limiter** | `src/lib/server/security.ts` | Enforces optional `AGVI_API_KEY` authentication (`401`), sliding-window rate limiting (`429`), and payload size caps (`413`) across all mutating API endpoints. |

---

## 3. Deterministic Frame Clock & Physics

Every visual property in AGVI Studio is a pure function of the current `frame` number (`0` to `durationInFrames - 1`):

```tsx
const frame = useCurrentFrame();
const { fps, width, height } = useVideoConfig();

// Critically damped spring entrance (Anti-Slop standard: 150ms - 300ms)
const entrance = spring({
  frame,
  fps,
  config: { damping: 24, stiffness: 220, mass: 0.9 },
});

// Cubic-bezier camera zoom interpolation
const scale = interpolate(frame, [0, 120], [1.0, 1.14]);
```

Because animations never rely on unpredictable CSS timers (`setTimeout`), scrubbing the timeline playhead to any millisecond renders the **exact** pixel state of every camera pan, spring transition, typewriter character, and KPI counter.

---

## 4. Export & Rendering Architecture

AGVI Studio provides two honest, frame-accurate export paths:

1. **Full-Duration Browser Video + Audio Exporter (`AGVIStudio.tsx` + `frame-compositor.ts`)**:
   - Renders the complete project duration (`Math.round(project.canvas.duration * fps)` frames — no arbitrary frame cap) using `renderProjectFrameToCanvas()`.
   - Multiplexes synthesized Web Audio soundtrack and transition SFX tracks via `soundEngine.createExportAudioStream()` into the `MediaRecorder` stream (`video/webm;codecs=vp9` or `video/mp4`).
   - Updates the server `RenderJob` via `PATCH /api/render` from `queued` -> `rendering` -> `completed` with verified byte size and frame count.
2. **Headless CLI Rasterizer & FFmpeg Encoder (`scripts/render-ffmpeg.mjs`)**:
   - Evaluates active project tracks, 6-DOF keyframes, 3D wireframe projections, and kinetic typography bars into a raw `rgb24` frame stream piped into `ffmpeg` (`libvpx-vp9` for `.webm` or `libx264` for `.mp4`), then verifies the output container with `ffprobe`.
   - Never writes fake header-only container stubs: if `ffmpeg` is not installed on the host machine and a `.webm` or `.mp4` container is requested, the CLI and `POST /api/render` (`executeNow: true`) report `status: "failed"` with an explicit diagnostic error message.
