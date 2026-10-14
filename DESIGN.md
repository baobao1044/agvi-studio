# AGVI Studio — Design Direction (`DESIGN.md`)

Enforced by [`src/lib/anti-slop/anti-slop-filter.ts`](file:///c:/Users/Admin/Downloads/agvi/src/lib/anti-slop/anti-slop-filter.ts) following [`miqdadbadjuber/anti-slop`](https://github.com/miqdadbadjuber/anti-slop).

## 1. Aesthetic Direction & Domain Exemplars
- **Studio UI & Default Video Aesthetic**: **Swiss Industrial Editorial** — inspired by Linear, Teenage Engineering, and Monocle print monographs.
- **Core Dials**:
  - `ENERGY`: `5/10` (Crisp, deliberate cuts; zero chaotic bouncing)
  - `RHYTHM`: `8/10` (Alternating scene compositions: Full-Bleed Statement $\rightarrow$ Asymmetric Split $\rightarrow$ Single Artifact Focus $\rightarrow$ Action Summary)
  - `MOTION`: `4/10` (Restrained, functional transitions; max 2 simultaneous animated properties per element)

## 2. Color Palette & Atmospheric Polarity (`R-01`, `R-29`)
- **Strict Cap**: 2 neutral surface tones + 1 high-contrast text hierarchy + **1 intentional focal accent**.
- **Banned Slop Signatures**: No cyan-to-purple gradients (`#38BDF8` $\rightarrow$ `#C084FC`), no glowing neon borders, no unmotivated `60px` background cyber-grids (`R-07`), and no floating blurred radial orbs behind every card.
- **Built-in Art Direction Presets**:
  1. `swiss-industrial`: Carbon Matte (`#0D0D0C` / `#161614`), Structural Hairline (`#2A2A26`), Warm Paper Ink (`#F2F0EA`), Signal Orange Accent (`#FF4F00`).
  2. `warm-editorial`: Deep Espresso Paper (`#141311` / `#1D1B18`), Stone Border (`#332F2A`), Editorial Cream (`#F5F2EB`), Vermilion Accent (`#E03C1F`).
  3. `documentary-slate`: Graphite Field (`#0F1210` / `#171C19`), Slate Border (`#2C3530`), Bone Text (`#ECEFE9`), Ochre Accent (`#D99B26`).
  4. `cobalt-technical`: Obsidian Slate (`#0A0C10` / `#12161F`), Blueprint Hairline (`#262F40`), Crisp White (`#EDF0F5`), Klein Blue Accent (`#2563EB`).

## 3. Typography & Scannable Hierarchy (`R-11`, `R-12`)
- **Display / Headlines**: Tight tracking (`-0.03em` to `-0.035em`), line-height `1.08`, strong weight contrast (`700` vs `400`), left-aligned by default for editorial authority.
- **Technical / Metadata / Timecodes**: Monospace with `font-variant-numeric: tabular-nums`.
- **Corner Radius**: `4px` to `6px` structural geometry. Never apply `999px` pill border-radius to content cards, code blocks, or multi-line captions.

## 4. Layout & Scene Rhythm (`R-05`, `R-14`)
Generated videos must **never** repeat the same centered 4-element vertical stack (`Badge + Title + Widget + Caption`) across consecutive scenes. Scenes rotate across distinct editorial layouts:
1. **Scene Pattern A — Full-Bleed Editorial Statement**: Large left-aligned display typography with a thin top index rule (`01 / OVERVIEW`) and zero competing widgets.
2. **Scene Pattern B — Asymmetric Split-Screen (`16:9`) / Stacked Split (`9:16`)**: Left column anchors the claim and context; right column presents a single concrete artifact (code diff, terminal output, or verified comparison table).
3. **Scene Pattern C — Focused Single Artifact**: One high-craft component (e.g., interactive workflow trace or structured specification grid) occupies the focal plane without redundant headline clutter.
4. **Scene Pattern D — Direct Action / Summary**: Clean closing specification with concrete command or endpoint.

## 5. Copywriting & Truthfulness Gate (`R-02`, `R-16`, `R-17`, `R-36`)
- **Zero Fabricated Metrics (`R-17`, `C-5`)**: Never invent percentages (`+420%`, `+380%`, `98%`) or multipliers (`10.4x`) unless those exact numbers appear in the user's input prompt. When no numbers are supplied, show concrete workflow steps, real schema fields, or qualitative before/after mechanics.
- **Zero AI Slop Vocabulary (`R-16`, `R-36`)**: Automatically strip phrases like *"Kỷ nguyên mới"*, *"Đột phá toàn diện"*, *"Siêu tốc độ"*, *"Revolutionizing"*, *"Next-generation"*, *"Unleash"*, *"Game-changer"*, and replace them with plain, specific product language.
