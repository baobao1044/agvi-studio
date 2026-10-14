# Hybrid Video + Motion Graphics Effects Reference

![Hybrid Motion Showcase](../public/docs/agvi-hybrid-motion-showcase.svg)

AGVI Studio allows any raw video clip (`type: "video"`) or image clip (`type: "image"`) to carry a **4-Layer Hybrid Motion Rig** directly inside its JSON clip definition — eliminating the need for complex multi-track coordinate math.

---

## Layer 1: Camera Motion Rig (`clip.cameraMotion`)

Applies continuous, frame-accurate virtual camera movement over the duration of the clip:

| Preset | Visual Effect | Best Used For |
| :--- | :--- | :--- |
| `ken-burns-in` | Smooth `1.0x → 1.14x` focal push with subtle upward drift | Opening hook scenes & product hero shots |
| `ken-burns-out` | Smooth `1.15x → 1.0x` wide reveal | Architecture overviews & closing summary scenes |
| `pan-left-right` | Horizontal camera track across wide canvas | UI walkthroughs, timelines & diagrams |
| `pan-right-left` | Reverse horizontal camera track | Counter-movement on consecutive scenes |
| `cinematic-drift` | Subtle 3D perspective tilt + diagonal glide | Deep-tech explainers & B-roll |
| `handheld-float` | Organic dual-sine micro-motion | Documentary & human-centric storytelling |

---

## Layer 2: Scene Transitions (`clip.sceneTransition`)

Triggered automatically during the entrance window (`0ms – 450ms`) of the clip:

| Preset | Visual Effect |
| :--- | :--- |
| `whip-pan` | High-velocity horizontal whip with directional motion blur |
| `iris-reveal` | Circular geometric mask expanding from center (`clip-path: circle()`) |
| `glitch-cut` | Digital scanline slice + RGB chromatic shift during first 10 frames |
| `flash-cut` | High-contrast editorial exposure flash fading into the scene |
| `slide-up` | Crisp spring-driven vertical curtain entrance |
| `fade` | Smooth opacity cross-dissolve |

---

## Layer 3: Attached Motion Overlays (`clip.motionOverlay`)

Rendered directly inside the clip's coordinate space and automatically synchronized with the scene layout solver:

| Preset | Description | Customizable Fields |
| :--- | :--- | :--- |
| `spotlight-pointer` | Animated target reticle (`circle`) + SVG leader line + glass callout card | `overlayTitle`, `overlayMetric`, `accentColor` |
| `hud-telemetry` | Corner framing brackets + live FPS/Camera telemetry status pills | `overlayTitle`, `overlayMetric`, `accentColor` |
| `lower-third-ribbon` | Broadcast-grade editorial lower-third banner with animated accent bar | `overlayTitle`, `overlayMetric`, `accentColor` |
| `floating-kpi` | Compact glassmorphic metric badge anchored to the top-right safe zone | `overlayTitle`, `overlayMetric`, `accentColor` |
| `data-ticker` | Horizontal live status ticker tape at the bottom of the frame | `overlayTitle`, `overlayMetric` |
| `corner-frame` | Minimalist architectural viewfinder ticks | `accentColor` |

---

## Layer 4: Standalone Motion Graphic Widgets

In addition to attached video overlays, AGVI Studio includes 7 dedicated data & UI motion components:

1. **`stat-counter`**: Animated tabular number counter (`0 → target`) with trend badge and SVG sparkline.
2. **`bar-chart`**: Multi-row animated comparative bar chart with staggered spring fills.
3. **`code-terminal`**: macOS-style terminal window with character-by-character typewriter code execution.
4. **`ai-chat`**: Prompt-to-response conversational simulation card.
5. **`feature-grid`**: 2x2 Bento architecture grid with staggered entrance.
6. **`waveform`**: 36-bar procedural audio spectrum visualizer.
7. **`caption`**: Broadcast subtitle bar with real-time active-word karaoke highlighting.
