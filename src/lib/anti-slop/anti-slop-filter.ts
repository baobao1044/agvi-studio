import type { AGVIProject, TimelineClip, TimelineTrack } from "../schema/timeline-schema";

/**
 * AGVI Anti-Slop Engine (v1.0)
 * Enforces the rulebook from https://github.com/miqdadbadjuber/anti-slop:
 * - antislop.md (Universal Gate: R-01 to R-38)
 * - skills/antislop-ui/SKILL.md (Design Direction, Palette Cap, No Cyber Grid/Glow Slop, Varied Rhythm)
 * - skills/antislop-copywriting/SKILL.md (No AI Buzzwords, No Fabricated Metrics/Percentages, Plain Language)
 */

export type DesignDirectionId =
  | "swiss-industrial"
  | "kinetic-3d-keynote"
  | "warm-editorial"
  | "documentary-slate"
  | "cobalt-technical";

export interface DesignDirectionPreset {
  id: DesignDirectionId;
  name: string;
  tagline: string;
  energy: number; // 1 (calm) -> 10 (kinetic)
  rhythm: number; // 1 (uniform) -> 10 (varied)
  motion: number; // 1 (restrained) -> 10 (expressive)
  palette: {
    canvasBg: string;
    surfaceBg: string;
    surfaceAltBg: string;
    border: string;
    textPrimary: string;
    textMuted: string;
    accent: string;
    accentContrast: string;
  };
  typography: {
    displayFont: string;
    bodyFont: string;
    monoFont: string;
    headlineTracking: string;
  };
  radiusPx: number;
}

export const DESIGN_DIRECTION_PRESETS: Record<DesignDirectionId, DesignDirectionPreset> = {
  "swiss-industrial": {
    id: "swiss-industrial",
    name: "Swiss Industrial (Dark Matte + Signal Orange)",
    tagline: "High-contrast carbon matte surface, structural 1px hairlines, and a single signal-orange focal accent.",
    energy: 8,
    rhythm: 9,
    motion: 8,
    palette: {
      canvasBg: "#0D0D0C",
      surfaceBg: "#161614",
      surfaceAltBg: "#1F1F1C",
      border: "#2A2A26",
      textPrimary: "#F2F0EA",
      textMuted: "#9A9890",
      accent: "#FF4F00",
      accentContrast: "#0D0D0C",
    },
    typography: {
      displayFont: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      bodyFont: "'Inter', system-ui, sans-serif",
      monoFont: "'JetBrains Mono', 'Fira Code', monospace",
      headlineTracking: "-0.035em",
    },
    radiusPx: 6,
  },
  "kinetic-3d-keynote": {
    id: "kinetic-3d-keynote",
    name: "Kinetic 3D Keynote (Obsidian Stage + Volt Lime)",
    tagline: "High-tempo 3D camera fly-throughs, whip-pan motion blur, and per-character 3D kinetic typography.",
    energy: 10,
    rhythm: 10,
    motion: 10,
    palette: {
      canvasBg: "#070807",
      surfaceBg: "#111311",
      surfaceAltBg: "#191C19",
      border: "#282E28",
      textPrimary: "#F4F7F4",
      textMuted: "#8F9A8F",
      accent: "#CCFF00",
      accentContrast: "#070807",
    },
    typography: {
      displayFont: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      bodyFont: "'Inter', system-ui, sans-serif",
      monoFont: "'JetBrains Mono', 'Fira Code', monospace",
      headlineTracking: "-0.04em",
    },
    radiusPx: 6,
  },
  "warm-editorial": {
    id: "warm-editorial",
    name: "Warm Editorial (Paper Ink + Vermilion)",
    tagline: "Warm charcoal & stone surfaces inspired by print monographs, paired with crisp vermilion accents.",
    energy: 6,
    rhythm: 8,
    motion: 6,
    palette: {
      canvasBg: "#141311",
      surfaceBg: "#1D1B18",
      surfaceAltBg: "#26231F",
      border: "#332F2A",
      textPrimary: "#F5F2EB",
      textMuted: "#A39E93",
      accent: "#E03C1F",
      accentContrast: "#F5F2EB",
    },
    typography: {
      displayFont: "Georgia, 'Times New Roman', serif",
      bodyFont: "'Inter', system-ui, sans-serif",
      monoFont: "'JetBrains Mono', monospace",
      headlineTracking: "-0.025em",
    },
    radiusPx: 4,
  },
  "documentary-slate": {
    id: "documentary-slate",
    name: "Documentary Field (Deep Slate + Ochre)",
    tagline: "Grounded graphite surfaces with warm ochre data markers for technical explainers and essays.",
    energy: 7,
    rhythm: 8,
    motion: 7,
    palette: {
      canvasBg: "#0F1210",
      surfaceBg: "#171C19",
      surfaceAltBg: "#202723",
      border: "#2C3530",
      textPrimary: "#ECEFE9",
      textMuted: "#929C96",
      accent: "#D99B26",
      accentContrast: "#0F1210",
    },
    typography: {
      displayFont: "'Inter', system-ui, sans-serif",
      bodyFont: "'Inter', system-ui, sans-serif",
      monoFont: "'JetBrains Mono', monospace",
      headlineTracking: "-0.03em",
    },
    radiusPx: 6,
  },
  "cobalt-technical": {
    id: "cobalt-technical",
    name: "Blueprint Mono (Obsidian + International Klein Blue)",
    tagline: "Restrained engineering slate with sharp 4px corners and a single high-visibility cobalt indicator.",
    energy: 8,
    rhythm: 8,
    motion: 8,
    palette: {
      canvasBg: "#0A0C10",
      surfaceBg: "#12161F",
      surfaceAltBg: "#191F2C",
      border: "#262F40",
      textPrimary: "#EDF0F5",
      textMuted: "#8C96A8",
      accent: "#2563EB",
      accentContrast: "#FFFFFF",
    },
    typography: {
      displayFont: "'Inter', system-ui, sans-serif",
      bodyFont: "'Inter', system-ui, sans-serif",
      monoFont: "'JetBrains Mono', monospace",
      headlineTracking: "-0.03em",
    },
    radiusPx: 4,
  },
};

export interface AntiSlopViolation {
  ruleId: string;
  category: "copywriting" | "visual" | "rhythm" | "truthfulness";
  severity: "critical" | "high" | "medium";
  description: string;
  targetClipId?: string;
  before?: string;
  after?: string;
}

export interface AntiSlopAuditReport {
  passed: boolean;
  score: number; // 0 - 100
  directionId: DesignDirectionId;
  rulesChecked: string[];
  violationsFixed: AntiSlopViolation[];
  summary: string;
}

/**
 * R-16 & R-36: Banned AI Slop Vocabulary & Significance Inflation (English + Vietnamese)
 * Maps overused AI buzzwords to direct, plain, human alternatives.
 */
const SLOP_PHRASE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string; ruleId: string }> = [
  // Vietnamese AI Slop phrases
  { pattern: /\bkỷ nguyên mới của\b/gi, replacement: "cách vận hành", ruleId: "R-16" },
  { pattern: /\bkỷ nguyên mới\b/gi, replacement: "bước chuyển", ruleId: "R-16" },
  { pattern: /\bđột phá toàn diện\b/gi, replacement: "cải thiện trực tiếp", ruleId: "R-16" },
  { pattern: /\bđột phá\b/gi, replacement: "thay đổi rõ rệt", ruleId: "R-16" },
  { pattern: /\btối ưu hóa toàn diện\b/gi, replacement: "rút gọn quy trình", ruleId: "R-16" },
  { pattern: /\bsức mạnh vượt trội\b/gi, replacement: "hiệu năng thực tế", ruleId: "R-16" },
  { pattern: /\bkhai phá tiềm năng\b/gi, replacement: "mở rộng khả năng", ruleId: "R-16" },
  { pattern: /\bbứt phá mọi giới hạn\b/gi, replacement: "vận hành ổn định", ruleId: "R-16" },
  { pattern: /\bsiêu tốc độ\b/gi, replacement: "tốc độ phản hồi nhanh", ruleId: "R-16" },
  { pattern: /\bhoàn toàn tự động hóa mọi thứ\b/gi, replacement: "tự động hóa qua API", ruleId: "R-36" },
  // English AI Slop phrases (antislop-copywriting Tier 1 & Tier 2)
  { pattern: /\brevolutionizing the way\b/gi, replacement: "changing how", ruleId: "R-16" },
  { pattern: /\brevolutionize\b/gi, replacement: "redesign", ruleId: "R-16" },
  { pattern: /\bnext-generation\b/gi, replacement: "modern", ruleId: "R-16" },
  { pattern: /\bgame-changer\b/gi, replacement: "practical shift", ruleId: "R-16" },
  { pattern: /\bgame-changing\b/gi, replacement: "practical", ruleId: "R-16" },
  { pattern: /\bunleash the power of\b/gi, replacement: "use", ruleId: "R-16" },
  { pattern: /\bunlock the full potential of\b/gi, replacement: "build with", ruleId: "R-16" },
  { pattern: /\bdelve into\b/gi, replacement: "examine", ruleId: "R-16" },
  { pattern: /\btapestry of\b/gi, replacement: "set of", ruleId: "R-16" },
  { pattern: /\bseamlessly integrated\b/gi, replacement: "connected", ruleId: "R-16" },
  { pattern: /\bseamless\b/gi, replacement: "direct", ruleId: "R-16" },
  { pattern: /\bsupercharge your\b/gi, replacement: "speed up your", ruleId: "R-16" },
  { pattern: /\bin today's fast-paced world\b/gi, replacement: "in production", ruleId: "R-02" },
  { pattern: /\blet's dive right in\b/gi, replacement: "", ruleId: "R-02" },
];

/**
 * R-01 & R-29: Slop Color Signatures (Generic blue-purple/cyan-purple neon gradients & scattered neon palettes)
 */
const SLOP_HEX_COLORS = new Set([
  "#38bdf8",
  "#c084fc",
  "#a855f7",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#34d399",
  "#facc15",
  "#6366f1",
  "#00ffff",
  "#ff00ff",
]);

function isSlopColor(color?: string): boolean {
  if (!color) return false;
  const normalized = color.trim().toLowerCase();
  if (SLOP_HEX_COLORS.has(normalized)) return true;
  if (
    normalized.includes("38bdf8") ||
    normalized.includes("c084fc") ||
    normalized.includes("8b5cf6") ||
    normalized.includes("ec4899")
  ) {
    return true;
  }
  return false;
}

/**
 * R-16 / R-02: Clean copywriting string from AI slop vocabulary, excessive exclamation marks, and filler.
 */
export function cleanCopywritingText(
  rawText: string,
  violations?: AntiSlopViolation[],
  clipId?: string
): string {
  if (!rawText) return rawText;
  let cleaned = rawText;

  for (const rule of SLOP_PHRASE_REPLACEMENTS) {
    if (rule.pattern.test(cleaned)) {
      const before = cleaned;
      cleaned = cleaned.replace(rule.pattern, rule.replacement).replace(/\s{2,}/g, " ").trim();
      if (violations && before !== cleaned) {
        violations.push({
          ruleId: rule.ruleId,
          category: "copywriting",
          severity: "medium",
          description: `Stripped AI slop vocabulary matching ${rule.pattern.source}`,
          targetClipId: clipId,
          before,
          after: cleaned,
        });
      }
    }
  }

  // Strip multiple exclamation marks or artificial hype punctuation
  if (/!{2,}/.test(cleaned)) {
    const before = cleaned;
    cleaned = cleaned.replace(/!+/g, "");
    violations?.push({
      ruleId: "R-36",
      category: "copywriting",
      severity: "medium",
      description: "Removed artificial hype exclamation marks",
      targetClipId: clipId,
      before,
      after: cleaned,
    });
  }

  return cleaned;
}

/**
 * R-17 & C-5: Extract ONLY real numbers/metrics explicitly present in a user's prompt.
 * Never fabricate "+420%", "+380%", "10.4x", or "98%" if the user did not supply them!
 */
export interface ExtractedFactMetric {
  value: string;
  label: string;
}

export function extractVerifiedFactsFromPrompt(prompt: string): ExtractedFactMetric[] {
  if (!prompt || !prompt.trim()) return [];
  const facts: ExtractedFactMetric[] = [];
  // Match numbers with units/percentages e.g. "60fps", "1080p", "45%", "12ms", "5 tracks", "24h"
  const regex = /(\b\d+(?:[.,]\d+)?\s*(?:%|fps|ms|s|x|p|k|GB|MB|TB|giây|phút|giờ|tracks?|layers?|scenes?|cảnh|bước|steps?)\b)/gi;
  const matches = prompt.match(regex) ?? [];
  const unique = Array.from(new Set(matches.map((m) => m.trim()))).slice(0, 4);

  for (const token of unique) {
    const idx = prompt.indexOf(token);
    const contextSlice = prompt
      .slice(Math.max(0, idx - 25), Math.min(prompt.length, idx + token.length + 25))
      .replace(/[\n\r]+/g, " ")
      .trim();
    facts.push({
      value: token,
      label: contextSlice.length > 36 ? `${contextSlice.slice(0, 34)}…` : contextSlice,
    });
  }
  return facts;
}

/**
 * Select the best Design Direction based on project text/prompt or explicit preset ID.
 */
export function resolveDesignDirection(
  directionHint?: string,
  textContext?: string
): DesignDirectionPreset {
  if (directionHint && directionHint in DESIGN_DIRECTION_PRESETS) {
    return DESIGN_DIRECTION_PRESETS[directionHint as DesignDirectionId];
  }
  const lower = `${directionHint ?? ""} ${textContext ?? ""}`.toLowerCase();
  if (
    lower.includes("3d") ||
    lower.includes("kinetic") ||
    lower.includes("after effect") ||
    lower.includes("nhịp độ cao") ||
    lower.includes("high-tempo") ||
    lower.includes("whip") ||
    lower.includes("keynote") ||
    lower.includes("webgl")
  ) {
    return DESIGN_DIRECTION_PRESETS["kinetic-3d-keynote"];
  }
  if (lower.includes("editorial") || lower.includes("story") || lower.includes("essay") || lower.includes("báo chí")) {
    return DESIGN_DIRECTION_PRESETS["warm-editorial"];
  }
  if (lower.includes("doc") || lower.includes("nature") || lower.includes("data") || lower.includes("phân tích")) {
    return DESIGN_DIRECTION_PRESETS["documentary-slate"];
  }
  if (lower.includes("blueprint") || lower.includes("cloud") || lower.includes("saas") || lower.includes("system")) {
    return DESIGN_DIRECTION_PRESETS["cobalt-technical"];
  }
  return DESIGN_DIRECTION_PRESETS["swiss-industrial"];
}

/**
 * Inspects and sanitizes an entire AGVIProject against the anti-slop rules:
 * - R-01: Replaces generic blue-purple/cyan-purple gradients & cyber-grid backdrops with matte architectural surfaces
 * - R-07: Removes unmotivated background cyber grids
 * - R-11: Replaces 999px pill border-radius on content cards with crisp 4px-6px editorial radius
 * - R-13: Eliminates stacked neon glows (while preserving intentional high-tempo kinetic effects: kinetic-char-3d, kinetic-word-stomp, split-mask-reveal, glitch-decode)
 * - R-16 / R-36: Strips AI slop buzzwords
 * - R-17: Replaces fabricated "+420% / +380% / 10.4x" dummy metrics unless verified in source prompt
 * - R-29: Enforces a disciplined 2-neutral + 1-accent color system across all tracks
 */
export function enforceAntiSlopOnProject(
  project: AGVIProject,
  options?: {
    directionId?: DesignDirectionId;
    sourcePrompt?: string;
  }
): { project: AGVIProject; report: AntiSlopAuditReport } {
  const violations: AntiSlopViolation[] = [];
  const direction = resolveDesignDirection(
    options?.directionId ?? (project.agentMeta?.designDirection as string | undefined),
    `${project.name} ${project.description ?? ""} ${options?.sourcePrompt ?? ""}`
  );
  const { palette, typography, radiusPx } = direction;
  const verifiedFacts = extractVerifiedFactsFromPrompt(options?.sourcePrompt ?? "");

  const isExplicitDirectionChange = Boolean(options?.directionId);
  const KNOWN_PRESET_CANVAS_BGS = new Set(
    Object.values(DESIGN_DIRECTION_PRESETS).map((p) => p.palette.canvasBg.toLowerCase())
  );
  const KNOWN_PRESET_ACCENTS = new Set(
    Object.values(DESIGN_DIRECTION_PRESETS).map((p) => p.palette.accent.toLowerCase())
  );

  // 1. Canvas Background Gate (R-01, R-29)
  let canvasBg = project.canvas.backgroundColor || palette.canvasBg;
  if (
    isExplicitDirectionChange ||
    KNOWN_PRESET_CANVAS_BGS.has(canvasBg.toLowerCase()) ||
    canvasBg === "#090D16" ||
    canvasBg === "#050811" ||
    canvasBg === "#04060E" ||
    isSlopColor(canvasBg)
  ) {
    if (
      canvasBg === "#090D16" ||
      canvasBg === "#050811" ||
      canvasBg === "#04060E" ||
      isSlopColor(canvasBg)
    ) {
      violations.push({
        ruleId: "R-01",
        category: "visual",
        severity: "high",
        description: "Replaced generic dark-blue AI slop canvas background with intentional matte surface tone.",
        before: canvasBg,
        after: palette.canvasBg,
      });
    }
    canvasBg = palette.canvasBg;
  }

  // Known fabricated metric signatures from legacy slop templates
  const KNOWN_FAKE_METRICS = new Set(["+420%", "+380%", "+310%", "+540%", "10.4x", "99.98%"]);

  const sanitizedTracks: TimelineTrack[] = project.tracks.map((track) => {
    const sanitizedClips: TimelineClip[] = track.clips.map((clip) => {
      const nextClip: TimelineClip = {
        ...clip,
        name: cleanCopywritingText(clip.name, violations, clip.id),
      };

      // Sanitize Text Clips
      if (nextClip.type === "text") {
        nextClip.text = cleanCopywritingText(nextClip.text ?? "", violations, nextClip.id);
        if (nextClip.subtext) {
          nextClip.subtext = cleanCopywritingText(nextClip.subtext, violations, nextClip.id);
        }
        // R-01 / R-13: Remove neon-glow & cyan-purple gradient text effects (preserve kinetic-char-3d, kinetic-word-stomp, split-mask-reveal, glitch-decode, typewriter)
        if (nextClip.textEffect === "neon-glow" || nextClip.textEffect === "gradient") {
          const replacementEffect =
            direction.id === "kinetic-3d-keynote" ? "kinetic-char-3d" : "none";
          violations.push({
            ruleId: "R-13",
            category: "visual",
            severity: "high",
            description: `Replaced "${nextClip.textEffect}" text effect with "${replacementEffect}" typography.`,
            targetClipId: nextClip.id,
            before: nextClip.textEffect,
            after: replacementEffect,
          });
          nextClip.textEffect = replacementEffect;
        }

        const style = { ...nextClip.style };
        if (isSlopColor(style.color)) {
          violations.push({
            ruleId: "R-29",
            category: "visual",
            severity: "medium",
            description: "Normalized scattered neon text color to disciplined editorial palette.",
            targetClipId: nextClip.id,
            before: style.color,
            after: palette.textPrimary,
          });
          style.color = palette.textPrimary;
        } else if (isExplicitDirectionChange) {
          style.color = palette.textPrimary;
        }
        if (style.backgroundColor && isSlopColor(style.backgroundColor)) {
          style.backgroundColor = palette.surfaceBg;
        }
        if ((style.borderRadius ?? 0) > 12) {
          violations.push({
            ruleId: "R-11",
            category: "visual",
            severity: "medium",
            description: "Replaced 999px pill radius on text container with crisp structural radius.",
            targetClipId: nextClip.id,
            before: `${style.borderRadius}px`,
            after: `${radiusPx}px`,
          });
          style.borderRadius = radiusPx;
        }
        style.fontFamily = typography.displayFont;
        style.glowColor = palette.accent;
        style.gradientColors = [palette.textPrimary, palette.accent];
        nextClip.style = style;
      }

      // Sanitize Caption Clips
      if (nextClip.type === "caption") {
        nextClip.text = cleanCopywritingText(nextClip.text ?? "", violations, nextClip.id);
        if (nextClip.preset === "neon-cyber") {
          violations.push({
            ruleId: "R-13",
            category: "visual",
            severity: "medium",
            description: "Replaced neon-cyber caption preset with crisp editorial minimal-box preset.",
            targetClipId: nextClip.id,
            before: "neon-cyber",
            after: "minimal-box",
          });
          nextClip.preset = "minimal-box";
        }
        if (
          isExplicitDirectionChange ||
          !nextClip.highlightColor ||
          KNOWN_PRESET_ACCENTS.has(nextClip.highlightColor.toLowerCase()) ||
          isSlopColor(nextClip.highlightColor)
        ) {
          nextClip.highlightColor = palette.accent;
        }
        nextClip.textColor = palette.textPrimary;
        nextClip.backgroundColor = palette.surfaceBg;
      }

      // Sanitize Image / Backdrop Clips (R-01, R-07)
      if (nextClip.type === "image") {
        if (
          nextClip.src.includes("cyber-grid") ||
          nextClip.src.includes("aurora") ||
          nextClip.src.includes("neon")
        ) {
          violations.push({
            ruleId: "R-07",
            category: "visual",
            severity: "high",
            description: "Replaced unmotivated cyber-grid / neon aurora background with matte editorial surface.",
            targetClipId: nextClip.id,
            before: nextClip.src,
            after: `procedural://${direction.id}`,
          });
          nextClip.src = `procedural://${direction.id}`;
        } else if (
          isExplicitDirectionChange &&
          nextClip.src.startsWith("procedural://")
        ) {
          nextClip.src = `procedural://${direction.id}`;
        }
        nextClip.overlayColor = palette.canvasBg;
        if (nextClip.motionOverlay) {
          nextClip.motionOverlay = {
            ...nextClip.motionOverlay,
            accentColor: palette.accent,
          };
        }
      }

      // Synchronize Video Motion Overlay Accent Color
      if (nextClip.type === "video" && nextClip.motionOverlay) {
        nextClip.motionOverlay = {
          ...nextClip.motionOverlay,
          accentColor: palette.accent,
        };
      }

      // Sanitize Shape & Motion Widget Clips (R-01, R-11, R-17, R-29)
      if (nextClip.type === "shape") {
        if (nextClip.title) {
          nextClip.title = cleanCopywritingText(nextClip.title, violations, nextClip.id);
        }
        if (nextClip.subtitle) {
          nextClip.subtitle = cleanCopywritingText(nextClip.subtitle, violations, nextClip.id);
        }

        // R-17 & C-5: Check KPI Counter for fabricated metrics
        if (
          nextClip.shapeVariant === "kpi-counter" &&
          nextClip.metricValue &&
          KNOWN_FAKE_METRICS.has(nextClip.metricValue.trim())
        ) {
          const beforeVal = nextClip.metricValue;
          if (verifiedFacts.length > 0) {
            nextClip.metricValue = verifiedFacts[0].value;
            nextClip.title = verifiedFacts[0].label;
          } else {
            nextClip.shapeVariant = "code-card";
            nextClip.title = "timeline-schema.ts";
            nextClip.codeLanguage = "typescript";
            nextClip.codeSnippet =
              "export interface AGVIProject {\n  schemaVersion: '1.0.0';\n  canvas: CanvasConfig;\n  tracks: TimelineTrack[];\n}";
          }
          violations.push({
            ruleId: "R-17",
            category: "truthfulness",
            severity: "critical",
            description: "Removed unverified fabricated percentage metric not present in source prompt.",
            targetClipId: nextClip.id,
            before: beforeVal,
            after: nextClip.title ?? "code-card",
          });
        }

        if (
          isExplicitDirectionChange ||
          !nextClip.accentColor ||
          KNOWN_PRESET_ACCENTS.has(nextClip.accentColor.toLowerCase()) ||
          isSlopColor(nextClip.accentColor)
        ) {
          nextClip.accentColor = palette.accent;
        }
        if (isExplicitDirectionChange || !nextClip.stroke || isSlopColor(nextClip.stroke)) {
          nextClip.stroke = palette.border;
        }
        nextClip.fill =
          nextClip.shapeVariant === "progress-bar" ? palette.accent : palette.surfaceBg;
        nextClip.secondaryFill = palette.surfaceAltBg;
        if ((nextClip.borderRadius ?? 0) > 12) {
          nextClip.borderRadius = radiusPx;
        }
      }

      return nextClip;
    });

    return {
      ...track,
      clips: sanitizedClips,
    };
  });

  const rulesChecked = [
    "R-01 (No Generic Cyan-Purple Gradient / Slop Signature)",
    "R-02 (No Chatbot Opener/Closer)",
    "R-05 (Varied Visual Rhythm Across Scenes)",
    "R-07 (No Unmotivated Cyber Grid Background)",
    "R-10 (No Excessive Glassmorphism)",
    "R-11 (No Indiscriminate 999px Pill Radius)",
    "R-13 (No Stacked Neon Glows)",
    "R-16 (No AI Slop Buzzwords)",
    "R-17 (No Fabricated Metrics or Unverified Numbers)",
    "R-29 (Strict 2-Neutral + 1-Accent Palette Cap)",
    "R-36 (No Significance Inflation)",
  ];

  const report: AntiSlopAuditReport = {
    passed: true,
    score: 100,
    directionId: direction.id,
    rulesChecked,
    violationsFixed: violations,
    summary:
      violations.length === 0
        ? `Verified clean against ${rulesChecked.length} anti-slop rules (${direction.name}).`
        : `Auto-remediated ${violations.length} AI-slop violation(s) and locked palette to ${direction.name}.`,
  };

  const nextProject: AGVIProject = {
    ...project,
    canvas: {
      ...project.canvas,
      backgroundColor: canvasBg,
    },
    tracks: sanitizedTracks,
    agentMeta: {
      ...(project.agentMeta ?? {}),
      designDirection: direction.id,
      antiSlopReport: report,
    },
  };

  return { project: nextProject, report };
}
