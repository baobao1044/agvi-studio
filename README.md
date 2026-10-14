# AGVI Studio — Agentic Video & Motion Graphics Engine (100% MIT)

**AGVI Studio** is a zero-Remotion, 100% MIT-licensed programmatic video editor and hybrid motion graphics engine built specifically for AI Agents and developers.

## ✨ Key Features

- **100% MIT-Licensed Native Frame Engine (`src/lib/engine/agvi-engine.tsx`)**: Deterministic `requestAnimationFrame` clock, cubic-bezier & spring physics interpolation, `<AGVIPlayer>` transport controls, and zero-dependency client-side WebM/MP4 video export via `MediaRecorder`.
- **Hybrid Video + Motion Graphics Compositing (`src/components/remotion/AGVIComposition.tsx`)**:
  - **Camera Rig**: `ken-burns-in`, `ken-burns-out`, `pan-left-right`, `cinematic-drift`, `handheld-float`
  - **Scene Transitions**: `whip-pan`, `iris-reveal`, `glitch-cut`, `flash-cut`, `slide-up`, `fade`
  - **Attached Motion Overlays**: `hud-telemetry`, `spotlight-pointer`, `lower-third-ribbon`, `data-ticker`, `floating-kpi`, `corner-frame`
  - **Motion Graphic Widgets**: KPI Stat Counters, Animated Bar Charts, Code Terminals, AI Chat Simulations, Waveforms, and Bento Feature Grids.
- **Anti-Slop Aesthetic Guardrails**: Strict editorial monochrome & single-accent palettes, tabular numerals, max 2 concurrent content elements per scene, and collision-free responsive layout zoning across `16:9`, `9:16`, and `1:1`.
- **AI Agent REST API & One-Call Auto-Enhancer**:
  - `GET /api/agent/schema` — Inspect full JSON Schema & Agent action catalog
  - `POST /api/agent/actions` — Execute deterministic actions (`generate_from_prompt`, `enhance_video_with_motion`, `add_clip`, `update_clip`, `apply_template`, etc.)

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to launch AGVI Studio.

## 🤖 Example Agent Call (`enhance_video_with_motion`)

```bash
curl -X POST http://localhost:3000/api/agent/actions \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enhance_video_with_motion",
    "payload": {
      "style": "tech-hud",
      "transitionStyle": "whip-pan",
      "addSoundEffects": true
    }
  }'
```

## 📄 License

MIT License — 100% free for commercial and enterprise use.
