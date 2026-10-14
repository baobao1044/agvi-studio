# AGVI Studio — Architecture & Native Frame Engine

![Architecture Pipeline](../public/docs/agvi-architecture-pipeline.svg)

## 1. Why Zero-Remotion? (100% MIT Architecture)

Most programmatic React video tools rely on frameworks with proprietary commercial licenses that charge per-seat or per-company fees for enterprise usage.

**AGVI Studio** is engineered from the ground up with its own **100% MIT-licensed Native Frame Engine** (`src/lib/engine/agvi-engine.tsx`), giving teams complete freedom to embed programmatic video editing, AI video synthesis, and motion graphics compositing inside commercial SaaS products and internal enterprise workflows.

---

## 2. Core Engine Subsystems

| Module | File Path | Responsibility |
| :--- | :--- | :--- |
| **Native Frame Engine** | `src/lib/engine/agvi-engine.tsx` | Provides `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`, `spring()`, `<Sequence>`, `<AbsoluteFill>`, `<AGVIPlayer>`, and WebM/MP4 `MediaRecorder` export. |
| **Hybrid Compositor** | `src/components/remotion/AGVIComposition.tsx` | Renders multi-track clips, Camera Motion Rigs, Scene Transitions, Attached Motion Overlays, and context-aware responsive layout zoning (`16:9`, `9:16`, `1:1`). |
| **Anti-Slop Guardrail** | `src/lib/anti-slop/anti-slop-filter.ts` | Sanitizes AI-generated copy, strips banned clichés & emojis, maps neon colors to editorial palettes, and enforces density caps. |
| **Timeline Schema** | `src/lib/schema/timeline-schema.ts` | Defines the deterministic JSON contract (`AGVIProject`, `Track`, `Clip`, `AgentActionRequest`) shared between the UI and AI Agents. |
| **Procedural Audio Engine** | `src/lib/audio/procedural-sound-engine.ts` | Synthesizes real-time ambient backing tracks and transition SFX (whoosh, pop, sub-drop, riser) via the browser's Web Audio API with zero external MP3 dependencies. |
| **AI Director & Store** | `src/lib/server/project-store.ts` | Executes atomic mutations, natural language prompt-to-video compilation, and the 1-call `enhance_video_with_motion` enhancer. |

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

## 4. Context-Aware Responsive Layout Solver

One of the hardest problems in AI-generated video is **visual collision** (text overlapping widgets, spotlight callouts intersecting headlines, or subtitles getting clipped).

AGVI Studio solves this in `AGVIComposition.tsx` using `ActiveSceneLayoutContext`:
1. Before rendering a frame, the compositor inspects all clips active at the current timestamp (`hasSpotlight`, `hasRightWidget`, `hasHeadline`).
2. If a scene contains both a **Headline** and a **Right-Column Data Widget** (`stat-counter`, `bar-chart`, `code-terminal`), the headline automatically docks to the left editorial column (`x: -23%, width: 38%`).
3. If the background video also carries an attached **`spotlight-pointer`**, the headline anchors to the **Upper-Left**, the Spotlight Reticle & Callout Card anchor to the **Lower-Left**, and the Data Widget occupies the **Right Stage** — guaranteeing zero overlap across `16:9`, `9:16`, and `1:1`.
