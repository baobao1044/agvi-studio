<div align="center">

# 🎬 AGVI Studio 3.0
### **The 100% MIT High-Tempo 3D & Kinetic Motion Graphics Engine for AI Agents**
*Trình dựng Video, 3D Stage & High-Tempo Motion Graphics mã nguồn mở chuẩn After Effects dành riêng cho AI Agent (Zero Remotion)*

[![License: MIT](https://img.shields.io/badge/License-MIT_100%25_Commercial_Free-10B981?style=for-the-badge)](./LICENSE)
[![Engine: 3D + 60FPS](https://img.shields.io/badge/Engine-60FPS_3D_&_WebGL_Core-CCFF00?style=for-the-badge&labelColor=0D0D0C)](./src/lib/engine/agvi-engine.tsx)
[![Design: Anti-Slop](https://img.shields.io/badge/Aesthetic-Anti--Slop_Enforced-F59E0B?style=for-the-badge)](./src/lib/anti-slop/anti-slop-filter.ts)
[![Next.js 16](https://img.shields.io/badge/Next.js_16-React_19_%2B_TypeScript-27272A?style=for-the-badge)](./package.json)

[**🇻🇳 Tài liệu Tiếng Việt**](./docs/VIETNAMESE_GUIDE.md) • [**📐 System Architecture**](./docs/ARCHITECTURE.md) • [**🤖 AI Agent API Guide**](./docs/AGENT_API_GUIDE.md) • [**✨ Motion Effects Catalog**](./docs/HYBRID_MOTION_EFFECTS.md)

</div>

---

![AGVI Studio Interface & Hybrid Compositing Stage](./public/docs/agvi-hero-banner.svg)

---

## 💡 What is AGVI Studio 3.0? (Dự án này là gì?)

**AGVI Studio** (**A**gentic **G**enerative **V**ideo **I**nterface) is a web-based Non-Linear Video Editor (NLE), **6-DOF 3D Stage & WebGL Shader Compositor**, and deterministic 60FPS rendering engine designed so **AI Agents (Claude, GPT, Gemini, MCP) and humans can collaborate on After Effects-grade kinetic videos using simple JSON actions.**

> **🇻🇳 Tóm tắt cho người mới:**
> Thay vì phải mở After Effects/Premiere chỉnh từng keyframe đồ thị vận tốc (Speed Graph) hay bị kẹt giấy phép thương mại của Remotion, **AGVI Studio 3.0** cung cấp một trình dựng **High-Tempo 3D & Kinetic Motion Graphics** chạy trực tiếp trên trình duyệt kèm **REST API cho AI Agent**. Chỉ với **1 lệnh gọi API** (`choreograph_3d_kinetic_scene`, `enhance_video_with_motion`, hoặc `generate_from_prompt`), AI có thể tự động dựng sân khấu **WebGL 3D**, điều khiển **Camera 3D bay xuyên trục Z (`fly-through-z`, `orbit-3d-left`, `whip-pan-3d`)**, nội suy **Multi-Keyframe theo đường cong vận tốc (`whip`, `expo-out`, `elastic`, `back-out`)**, tạo chữ lật 3D từng ký tự (`kinetic-char-3d`), nhòe chuyển động theo hướng bay (**Directional Motion Blur**), tách kênh màu RGB (**Chromatic Aberration**), rung chấn camera (**Camera Impact Shake**) và âm trầm **Sub-Bass Drop SFX** ở tốc độ 60FPS.

### Why AGVI Studio 3.0 vs. Existing Tools?

| Capability | After Effects / Premiere | Remotion | Text-to-Video AI (Sora / Runway) | **AGVI Studio 3.0** |
| :--- | :--- | :--- | :--- | :--- |
| **Commercial License** | Paid Subscription | Proprietary Company License | Paid Credits | **100% Free MIT License** |
| **AI Agent Controllability** | ❌ Manual GUI only | ⚠️ Requires writing & compiling React code | ❌ Black-box pixel diffusion | **✅ Instant REST JSON Actions** |
| **True 3D Stage & WebGL** | ⚠️ High manual setup effort | ⚠️ Manual Three.js boilerplate | ❌ No deterministic 3D coordinates | **✅ 6-DOF `x,y,z,rotX,rotY` + WebGL 3D** |
| **Multi-Keyframe Speed Graph** | Manual Bezier handles | Manual math per frame | ❌ None | **✅ Built-in Velocity Graph (`whip`, `elastic`)** |
| **Directional Blur & RGB Split** | Slow frame render | ❌ None built-in | ❌ None | **✅ Automatic Velocity-Driven Blur & Shake** |
| **Anti-Slop Layout Guardrails**| ❌ None | ❌ None | ❌ Prone to visual clutter | **✅ Zero-Overlap Solver + 10/10 Kinetic Mode** |

---

## 🏗️ How It Works — End-to-End Architecture

![AGVI Architecture Pipeline](./public/docs/agvi-architecture-pipeline.svg)

1. **AI Director & 3D Choreography API (`/api/agent/actions`, `/api/agent/generate`)**: Accepts natural language prompts or structured atomic mutations (`choreograph_3d_kinetic_scene`, `enhance_video_with_motion`, `build_from_storyboard`, `update_clip`) from any LLM or MCP server.
2. **Anti-Slop Gate with 10/10 Kinetic Preservation (`src/lib/anti-slop/anti-slop-filter.ts`)**: Strips AI buzzwords and unverified fake percentages (`R-16`, `R-17`), locks color tokens to disciplined studio presets (including **`kinetic-3d-keynote`** with Obsidian `#070807` + Volt Lime `#CCFF00`), and preserves intentional 3D keyframes, velocity curves, and post-FX.
3. **6-DOF 3D & Hybrid Motion Compositor (`src/components/remotion/AGVIComposition.tsx`)**: Evaluates multi-point 3D keyframes (`evaluateClipKeyframes`), computes instantaneous frame-to-frame velocity vectors `(vx, vy, speed)` for directional motion blur and RGB chromatic split, renders procedural WebGL shaders & 3D polyhedra, and prevents layout collisions across `16:9`, `9:16`, `1:1`, and `4:5`.
4. **100% MIT Native 60FPS Frame Engine (`src/lib/engine/agvi-engine.tsx`)**: Drives deterministic `useCurrentFrame()`, harmonic `spring()`, 8 Speed-Graph easing solvers (`evaluateEasing`), `computeCameraShake()`, procedural Web Audio API soundtracks + Sub-Bass drops, and client-side `.webm` / `.mp4` video capture.

---

## ✨ 5-Pillar High-Tempo 3D & Motion Graphics System

![4-Layer Hybrid Motion Rig](./public/docs/agvi-hybrid-motion-showcase.svg)

Any clip on the timeline can declare **6-DOF 3D coordinates, multi-point velocity keyframes, 3D camera rigs, and velocity-driven post-processing FX** directly in JSON:

```json
{
  "id": "clip-kinetic-hero",
  "type": "text",
  "name": "3D Kinetic Hero Title",
  "startTime": 0,
  "duration": 3.5,
  "text": "TRUE 3D STAGE • 60 FPS",
  "textEffect": "kinetic-char-3d",
  "sceneTransition": "whip-blur-cut",
  "transform": {
    "x": -22,
    "y": -8,
    "z": 120,
    "rotateX": 8,
    "rotateY": 16,
    "rotation": 0,
    "scale": 1
  },
  "keyframes": [
    { "offset": 0, "x": -42, "z": -650, "rotateX": 38, "rotateY": -45, "scale": 0.45, "opacity": 0, "easing": "whip" },
    { "offset": 0.28, "x": -22, "z": 90, "rotateX": -6, "rotateY": 14, "scale": 1.06, "opacity": 1, "easing": "back-out" },
    { "offset": 0.78, "x": -22, "z": 0, "rotateX": 0, "rotateY": 6, "scale": 1, "opacity": 1, "easing": "expo-out" },
    { "offset": 1, "x": 18, "z": 360, "rotateX": -18, "rotateY": 28, "scale": 1.18, "opacity": 0, "easing": "expo-in" }
  ],
  "filter": {
    "motionBlur": 0.85,
    "chromaticAberration": 0.65,
    "cameraShake": 0.6
  }
}
```

| Pillar | Property | Built-in Presets & Capabilities |
| :--- | :--- | :--- |
| **1. 3D Camera Rig** | `cameraMotion` | `orbit-3d-left`, `orbit-3d-right`, `fly-through-z`, `whip-pan-3d`, `dutch-roll-impact`, `hyper-push-in`, `isometric-3d-frame`, `focus-zoom-left`, `focus-zoom-right`, `split-stage-left`, `letterbox-cinema`, `cinema-dolly` |
| **2. High-Tempo Cuts** | `sceneTransition` | `whip-blur-cut`, `3d-cube-spin`, `zoom-punch`, `glitch-slice`, `shutter-wipe`, `iris-frame`, `editorial-curtain`, `flash-cut` |
| **3. Velocity Graph** | `keyframes[].easing` | `whip` (AE speed peak), `expo-out`, `expo-in`, `back-out` (overshoot), `elastic`, `bounce`, `ease-in-out`, `linear` |
| **4. Kinetic Typography** | `textEffect` | `kinetic-char-3d` (3D character cascade), `kinetic-word-stomp` (Z-space word slam), `split-mask-reveal`, `glitch-decode`, `typewriter`, `gradient`, `neon-glow` |
| **5. 3D & Data Widgets** | `shapeVariant` | `3d-carousel-stack`, `kinetic-impact-wall`, `3d-wireframe-prism`, `spotlight-callout`, `process-stepper`, `split-comparison`, `hud-telemetry`, `kpi-counter`, `bar-chart`, `code-card`, `terminal-window`, `bento-grid`, `chat-simulation`, `audio-waveform` |
| **6. WebGL 3D Streams** | `video.src` | `procedural-video://webgl-3d-prism`, `procedural-video://webgl-tunnel`, `procedural-video://webgl-particles`, `procedural-video://product-ui-capture` |

---

## 🛡️ Anti-Slop Design Guardrails + 10/10 Kinetic Mode

![Generic AI Slop vs AGVI Anti-Slop Engine](./public/docs/agvi-anti-slop-comparison.svg)

Inspired by the [Anti-Slop Design Manifesto](https://github.com/miqdadbadjuber/anti-slop), AGVI Studio enforces studio-grade restraint while supporting **5 curated Art Direction Presets**:
1. **`kinetic-3d-keynote` (`10/10 Energy & Motion`)**: Obsidian Stage (`#070807`) + Volt Lime Accent (`#CCFF00`) — built for 60FPS 3D camera fly-throughs, whip-pan motion blur, and per-character 3D typography.
2. **`swiss-industrial`**: Carbon Matte (`#0D0D0C`) + Signal Orange (`#FF4F00`).
3. **`warm-editorial`**: Deep Espresso Paper (`#141311`) + Vermilion (`#E03C1F`).
4. **`documentary-slate`**: Graphite Field (`#0F1210`) + Ochre (`#D99B26`).
5. **`cobalt-technical`**: Obsidian Slate (`#0A0C10`) + International Klein Blue (`#2563EB`).

---

## 🚀 Quick Start (Chạy dự án trong 60 giây)

### 1. Clone & Install

```bash
git clone https://github.com/baobao1044/agvi-studio.git
cd agvi-studio
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in Chrome, Edge, or Brave.

### 2. Try the 3D & High-Tempo Features Immediately
1. **Showcase 0 — High-Tempo 3D Kinetic Keynote (60fps)**: Loads by default! Press `Space` to experience 60FPS WebGL 3D geometry, Z-depth camera fly-throughs, per-character 3D typography, directional motion blur, and Sub-Bass drops.
2. **⚡ 3D Kinetic Rig Button (Top Header)**: Click **⚡ 3D Kinetic Rig** to automatically inject a 4-point 3D Whip Velocity Curve, WebGL 3D stage, Motion Blur, Chromatic Aberration, and Impact Shake into your active project in 1 click.
3. **Interactive Velocity Graph & Keyframe Editor (Right Inspector)**: Click any clip on the timeline (clips with keyframes show `◆` Volt diamond markers), inspect the live SVG **Velocity Curve**, and tweak `Offset`, `X%`, `Y%`, `Z(px)`, `Scale`, `RotX°`, `RotY°`, and `Alpha`.
4. **Export `.webm` / `.mp4` / `.json-bundle`**: Click **Export** in the top-right corner to record and download a real 60FPS `.webm` / `.mp4` video directly in your browser or run the headless CLI renderer (`node scripts/render-ffmpeg.mjs`).

---

## 🤖 Controlling AGVI Studio from an AI Agent

### 1. One-Call 3D Kinetic Choreography (`choreograph_3d_kinetic_scene`)

```bash
curl -X POST http://localhost:3000/api/agent/actions \
  -H "Content-Type: application/json" \
  -d '{
    "action": "choreograph_3d_kinetic_scene",
    "cameraMotion": "fly-through-z",
    "sceneTransition": "whip-blur-cut",
    "textEffect": "kinetic-char-3d",
    "easing": "whip",
    "motionBlur": 0.85,
    "chromaticAberration": 0.65,
    "cameraShake": 0.65
  }'
```

### 2. Generate a Multi-Track 3D Storyboard from Natural Language (`generate_from_prompt`)

```bash
curl -X POST http://localhost:3000/api/agent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Dựng video 3D 60fps nhịp độ cao giới thiệu kiến trúc AI Agent với 3D carousel stack và code terminal",
    "aspectRatio": "16:9",
    "designDirection": "kinetic-3d-keynote"
  }'
```

### 3. Run the Automated 8-Suite Verification Script

```bash
npx tsx scripts/verify-3d-engine.ts
```

---

## 📂 Repository Structure

```text
agvi-studio/
├── public/docs/                             # Vector SVG architectural & UI illustrations
├── docs/                                    # Developer & User Documentation (VN / EN)
├── scripts/
│   ├── verify-3d-engine.ts                  # 8-Suite automated 3D Engine, Keyframe & API test runner
│   └── render-ffmpeg.mjs                    # Headless CLI video & manifest exporter (.webm / .mp4)
├── src/
│   ├── lib/
│   │   ├── engine/agvi-engine.tsx           # 100% MIT 60FPS Frame Clock, Easing, Shake, Spring & Player
│   │   ├── schema/timeline-schema.ts        # 6-DOF 3D Transform, Keyframe & Timeline JSON Schema
│   │   ├── schema/starter-templates.ts      # 5 Showcase Templates (incl. 60FPS Kinetic 3D Keynote)
│   │   ├── anti-slop/anti-slop-filter.ts    # Anti-Slop gate + 5 Art Direction presets
│   │   ├── audio/procedural-sound-engine.ts # Web Audio API 120BPM score, whip whoosh & Sub-Bass SFX
│   │   └── server/project-store.ts          # 3D Prompt compiler & atomic AI action reducer
│   ├── components/
│   │   ├── remotion/AGVIComposition.tsx     # 6-DOF 3D Stage, WebGL Shader & Motion Blur Compositor
│   │   └── studio/                          # NLE Studio UI (Velocity Graph Editor, Timeline, Exporter)
│   └── app/api/                             # Dynamic Next.js 16 REST API Routes (/agent/*, /render, /schema)
└── LICENSE                                  # 100% MIT License
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for full details. Free for commercial, SaaS, and enterprise deployment.
