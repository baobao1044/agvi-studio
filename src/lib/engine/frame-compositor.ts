import {
  AGVIProject,
  CaptionClip,
  ImageClip,
  ShapeClip,
  TextClip,
  VideoClip,
  VideoMotionOverlay,
} from "../schema/timeline-schema";
import {
  DESIGN_DIRECTION_PRESETS,
  DesignDirectionPreset,
  resolveDesignDirection,
} from "../anti-slop/anti-slop-filter";
import { interpolate, spring } from "./agvi-engine";
import {
  ActiveSceneLayoutContext,
  computeCameraRigStyle,
  evaluateClipAtFrame,
  getActiveSceneContextForTime,
} from "./keyframe-evaluator";
import { renderProcedural3DTo2DContext } from "./webgl-stage";

export interface FrameCompositionTelemetry {
  frame: number;
  fps: number;
  timestampSec: number;
  width: number;
  height: number;
  designDirection: string;
  activeClipCount: number;
  activeClipIds: string[];
  activeTrackTypes: string[];
}

export interface FrameAssetCache {
  images?: Map<string, HTMLImageElement | ImageBitmap>;
  videos?: Map<string, HTMLVideoElement>;
}

/**
 * Evaluates which clips are active at a given frame without needing a DOM canvas.
 * Useful for server-side verification, manifest generation, and telemetry checks.
 */
export function inspectFrameComposition(
  project: AGVIProject,
  frame: number
): FrameCompositionTelemetry {
  const fps = Math.max(12, project.canvas.fps || 30);
  const width = Math.max(100, project.canvas.width || 1920);
  const height = Math.max(100, project.canvas.height || 1080);
  const timestampSec = frame / fps;

  const direction =
    resolveDesignDirection(
      project.agentMeta?.designDirection as string | undefined,
      `${project.name} ${project.description ?? ""}`
    ) ?? DESIGN_DIRECTION_PRESETS["swiss-industrial"];

  const visibleTracks = [...(project.tracks || [])]
    .filter((t) => !t.hidden)
    .sort((a, b) => a.zIndex - b.zIndex);

  const activeClipIds: string[] = [];
  const activeTrackTypes = new Set<string>();

  for (const track of visibleTracks) {
    for (const clip of track.clips) {
      if (clip.type === "audio") continue;
      const fromFrame = Math.max(0, Math.round(clip.startTime * fps));
      const durationInFrames = Math.max(1, Math.round(clip.duration * fps));
      const localFrame = frame - fromFrame;
      if (localFrame >= 0 && localFrame < durationInFrames) {
        activeClipIds.push(clip.id);
        activeTrackTypes.add(clip.type);
      }
    }
  }

  return {
    frame,
    fps,
    timestampSec: Number(timestampSec.toFixed(4)),
    width,
    height,
    designDirection: direction.id,
    activeClipCount: activeClipIds.length,
    activeClipIds,
    activeTrackTypes: Array.from(activeTrackTypes),
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rad);
  } else {
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    const width = ctx.measureText(candidate).width;
    if (width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function renderAttachedMotionOverlayCanvas(
  ctx: CanvasRenderingContext2D,
  overlay: VideoMotionOverlay,
  localFrame: number,
  durationInFrames: number,
  fps: number,
  w: number,
  h: number,
  direction: DesignDirectionPreset,
  sceneContext?: ActiveSceneLayoutContext
) {
  if (!overlay || overlay.preset === "none") return;
  const { palette, radiusPx } = direction;
  const enterSpring = spring({
    frame: Math.max(0, localFrame - 6),
    fps,
    config: { damping: 20, stiffness: 130 },
  });

  ctx.save();
  ctx.globalAlpha *= enterSpring;

  if (overlay.preset === "spotlight-pointer") {
    const hasRightWidget = Boolean(sceneContext?.hasRightWidget);
    const hasHeadline = Boolean(sceneContext?.hasHeadline);

    let targetLeftPct: number;
    let targetTopPct: number;
    let cardLeftPct: number;
    let cardTopPct: number;
    let cardMaxWidth = 380;

    if (hasRightWidget && hasHeadline) {
      targetLeftPct = 13;
      targetTopPct = 62;
      cardLeftPct = 20;
      cardTopPct = 52;
      cardMaxWidth = 340;
    } else if (hasHeadline) {
      targetLeftPct = 55;
      targetTopPct = 46;
      cardLeftPct = 63;
      cardTopPct = 30;
      cardMaxWidth = 390;
    } else {
      const tx = overlay.targetX ?? -12;
      const ty = overlay.targetY ?? -6;
      targetLeftPct = Math.max(14, Math.min(82, 50 + tx));
      targetTopPct = Math.max(20, Math.min(74, 50 + ty));
      cardLeftPct = Math.min(64, targetLeftPct + 10);
      cardTopPct = Math.max(22, Math.min(64, targetTopPct - 10));
    }

    const startX = (targetLeftPct / 100) * w;
    const startY = (targetTopPct / 100) * h;
    const cardX = (cardLeftPct / 100) * w;
    const cardY = (cardTopPct / 100) * h;
    const elbowX = cardX - w * 0.025;
    const endX = cardX;
    const endY = cardY + h * 0.06;

    // Reticle circle & leader line
    ctx.strokeStyle = overlay.accentColor || palette.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(startX, startY, Math.max(4, 24 * enterSpring), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = overlay.accentColor || palette.accent;
    ctx.beginPath();
    ctx.arc(startX, startY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(elbowX, endY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Callout Box
    const cardH = overlay.subtitle ? 104 : 76;
    drawRoundedRect(ctx, cardX, cardY, cardMaxWidth, cardH, radiusPx);
    ctx.fillStyle = palette.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = overlay.accentColor || palette.accent;
    ctx.fillRect(cardX, cardY, 4, cardH);

    ctx.font = "700 12px monospace";
    ctx.fillText(
      `SPOTLIGHT LOCK [${Math.round(targetLeftPct - 50)}%, ${Math.round(targetTopPct - 50)}%]`,
      cardX + 16,
      cardY + 24
    );

    ctx.fillStyle = palette.textPrimary;
    ctx.font = "700 20px sans-serif";
    ctx.fillText(
      (overlay.title || "Focal Feature Callout").slice(0, 34),
      cardX + 16,
      cardY + 50
    );

    if (overlay.subtitle) {
      ctx.fillStyle = palette.textMuted;
      ctx.font = "500 14px sans-serif";
      ctx.fillText(overlay.subtitle.slice(0, 48), cardX + 16, cardY + 76);
    }
  } else if (overlay.preset === "hud-telemetry") {
    const sec = Math.floor(localFrame / fps);
    const remFrames = localFrame % fps;
    const tc = `00:00:${String(sec).padStart(2, "0")}:${String(remFrames).padStart(2, "0")}`;

    const pillW = 240;
    const pillH = 34;
    const rightX = w - 56 - pillW - 180;
    const topY = 56;

    drawRoundedRect(ctx, rightX, topY, pillW, pillH, radiusPx);
    ctx.fillStyle = palette.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.fillRect(rightX + 12, topY + 13, 8, 8);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = "700 13px monospace";
    ctx.fillText(
      (overlay.title || "LIVE VIDEO FEED").slice(0, 24),
      rightX + 26,
      topY + 22
    );

    const tcX = rightX + pillW + 10;
    drawRoundedRect(ctx, tcX, topY, 170, pillH, radiusPx);
    ctx.fillStyle = palette.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.fillText(`TC ${tc} • ${fps}FPS`, tcX + 12, topY + 22);
  } else if (overlay.preset === "lower-chyron") {
    const chyX = w * 0.05;
    const chyY = h * 0.76;
    const chyW = Math.min(w * 0.65, 620);
    const chyH = 74;

    drawRoundedRect(ctx, chyX, chyY, chyW, chyH, radiusPx);
    ctx.fillStyle = palette.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.fillRect(chyX, chyY, 6, chyH);

    ctx.fillStyle = palette.textPrimary;
    ctx.font = "700 24px sans-serif";
    ctx.fillText(
      (overlay.title || "Video Footage Annotation").slice(0, 40),
      chyX + 22,
      chyY + 34
    );
    if (overlay.subtitle) {
      ctx.fillStyle = palette.accent;
      ctx.font = "600 15px monospace";
      ctx.fillText(overlay.subtitle.slice(0, 52), chyX + 22, chyY + 58);
    }
  } else if (overlay.preset === "step-annotations") {
    const steps =
      overlay.steps && overlay.steps.length > 0
        ? overlay.steps.map((s) => s.title)
        : overlay.items && overlay.items.length > 0
          ? overlay.items
          : [
              "01 / Ingest Video Stream",
              "02 / Attach Camera & Motion Rig",
              "03 / Render Deterministic Output",
            ];
    steps.forEach((stepText, idx) => {
      const boxX = w - 420;
      const boxY = h * 0.2 + idx * 62;
      drawRoundedRect(ctx, boxX, boxY, 360, 50, radiusPx);
      ctx.fillStyle = palette.surfaceBg;
      ctx.fill();
      ctx.strokeStyle = idx === 0 ? palette.accent : palette.border;
      ctx.stroke();
      ctx.fillStyle = idx === 0 ? palette.accent : palette.textMuted;
      ctx.font = "700 14px monospace";
      ctx.fillText(`0${idx + 1}`, boxX + 16, boxY + 30);
      ctx.fillStyle = palette.textPrimary;
      ctx.font = "600 16px sans-serif";
      ctx.fillText(stepText.slice(0, 32), boxX + 48, boxY + 30);
    });
  } else if (overlay.preset === "split-compare") {
    const wipePct = interpolate(
      Math.sin((localFrame / Math.max(1, durationInFrames)) * Math.PI * 1.5),
      [-1, 1],
      [0.28, 0.72]
    );
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(0, 0, w * wipePct, h);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * wipePct, 0);
    ctx.lineTo(w * wipePct, h);
    ctx.stroke();
  } else if (overlay.preset === "3d-parallax-grid") {
    const pillW = 310;
    const pillX = w - pillW - 52;
    const pillY = 42;
    drawRoundedRect(ctx, pillX, pillY, pillW, 32, radiusPx);
    ctx.fillStyle = palette.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = palette.accent;
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.font = "700 13px monospace";
    ctx.fillText(
      (overlay.title || "3D STAGE PARALLAX • Z-DEPTH RIG").slice(0, 34),
      pillX + 14,
      pillY + 21
    );
  }

  ctx.restore();
}

function renderVideoOrImageClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: VideoClip | ImageClip,
  localFrame: number,
  durationInFrames: number,
  fps: number,
  w: number,
  h: number,
  direction: DesignDirectionPreset,
  sceneContext?: ActiveSceneLayoutContext,
  assets?: FrameAssetCache
) {
  const { palette } = direction;
  const camRig = computeCameraRigStyle(
    clip.cameraMotion,
    localFrame,
    durationInFrames,
    fps
  );

  // Evaluate KenBurns zoom/pan on ImageClip when present
  let kbScale = 1;
  let kbTxPct = 0;
  if (clip.type === "image" && clip.kenBurns && clip.kenBurns !== "none") {
    const kbProg = interpolate(
      localFrame,
      [0, Math.max(1, durationInFrames)],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    if (clip.kenBurns === "zoom-in") {
      kbScale = interpolate(kbProg, [0, 1], [1, 1.12]);
    } else if (clip.kenBurns === "zoom-out") {
      kbScale = interpolate(kbProg, [0, 1], [1.12, 1]);
    } else if (clip.kenBurns === "pan-left") {
      kbScale = 1.08;
      kbTxPct = interpolate(kbProg, [0, 1], [3, -3]);
    } else if (clip.kenBurns === "pan-right") {
      kbScale = 1.08;
      kbTxPct = interpolate(kbProg, [0, 1], [-3, 3]);
    }
  }

  ctx.save();
  // Apply camera rig & KenBurns scale + translation around canvas center
  ctx.translate(
    w / 2 + ((camRig.txPct + kbTxPct) / 100) * w,
    h / 2 + (camRig.tyPct / 100) * h
  );
  if (Math.abs(camRig.rotZDeg) > 0.05) {
    ctx.rotate((camRig.rotZDeg * Math.PI) / 180);
  }
  const perspectiveScale =
    camRig.scale * kbScale * Math.max(0.5, 1 + camRig.tzPx / 1600);
  ctx.scale(perspectiveScale, perspectiveScale);
  ctx.translate(-w / 2, -h / 2);

  // Base surface fill
  ctx.fillStyle = palette.canvasBg;
  ctx.fillRect(0, 0, w, h);

  // Check if external image or video asset is loaded in cache
  const isProcedural =
    !clip.src ||
    clip.src.startsWith("procedural://") ||
    clip.src.startsWith("procedural-video://");

  let drewExternalMedia = false;
  if (!isProcedural && assets) {
    if (clip.type === "image" && assets.images?.has(clip.src)) {
      const img = assets.images.get(clip.src)!;
      try {
        ctx.drawImage(img, 0, 0, w, h);
        drewExternalMedia = true;
      } catch {
        // Fallback to procedural surface
      }
    } else if (clip.type === "video" && assets.videos?.has(clip.src)) {
      const vid = assets.videos.get(clip.src)!;
      try {
        ctx.drawImage(vid, 0, 0, w, h);
        drewExternalMedia = true;
      } catch {
        // Fallback to procedural surface
      }
    }
  }

  if (!drewExternalMedia) {
    const isWebGL3DScene =
      clip.src?.startsWith("procedural-video://webgl") ||
      clip.cameraMotion === "orbit-3d-left" ||
      clip.cameraMotion === "orbit-3d-right" ||
      clip.cameraMotion === "fly-through-z" ||
      clip.cameraMotion === "whip-pan-3d" ||
      clip.cameraMotion === "hyper-push-in";

    if (isWebGL3DScene) {
      renderProcedural3DTo2DContext(
        ctx,
        w,
        h,
        clip.src || "webgl-3d-prism",
        localFrame,
        fps,
        palette
      );
    } else {
      // Architectural frame rule + recessed telemetry grid
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(42, 42, w - 84, h - 84);

      ctx.fillStyle = palette.accent;
      ctx.fillRect(41, 41, 24, 3);
      ctx.fillRect(41, 41, 3, 24);
      ctx.fillRect(w - 65, h - 44, 24, 3);
      ctx.fillRect(w - 44, h - 65, 3, 24);

      if (clip.type === "video") {
        const playheadPct = interpolate(
          localFrame,
          [0, Math.max(1, durationInFrames)],
          [0.15, 0.85]
        );
        ctx.strokeStyle = palette.accent;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.moveTo(w * playheadPct, 42);
        ctx.lineTo(w * playheadPct, h - 42);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Apply ImageClip overlayColor and overlayOpacity if present
  if (
    clip.type === "image" &&
    clip.overlayColor &&
    (clip.overlayOpacity ?? 0) > 0
  ) {
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, clip.overlayOpacity ?? 0.15));
    ctx.fillStyle = clip.overlayColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (camRig.isLetterbox) {
    const barH = h * 0.05;
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, w, barH);
    ctx.fillRect(0, h - barH, w, barH);
  }

  ctx.restore();

  if (clip.motionOverlay) {
    renderAttachedMotionOverlayCanvas(
      ctx,
      clip.motionOverlay,
      localFrame,
      durationInFrames,
      fps,
      w,
      h,
      direction,
      sceneContext
    );
  }
}

function renderTextClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: TextClip,
  localFrame: number,
  durationInFrames: number,
  fps: number,
  boxW: number,
  direction: DesignDirectionPreset,
  chromaDx: number,
  chromaDy: number,
  chromaShift: number
) {
  const { palette } = direction;
  const s = clip.style;
  const fontSize = s?.fontSize || 60;
  const fontWeight = s?.fontWeight || "700";
  const effect = clip.textEffect || "none";

  let displayString = clip.text || "";
  if (effect === "typewriter") {
    const revealEnd = Math.max(10, Math.round(durationInFrames * 0.55));
    const charCount = Math.floor(
      interpolate(localFrame, [0, revealEnd], [0, displayString.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    );
    displayString = displayString.slice(0, charCount);
  } else if (effect === "glitch-decode") {
    const glyphs = "01/#XΔΣΞΩ%+=-";
    const decodeFrames = Math.max(12, Math.round(fps * 0.55));
    displayString = displayString
      .split("")
      .map((ch, idx) => {
        if (ch === " ") return " ";
        const threshold =
          (idx / Math.max(1, displayString.length)) * decodeFrames;
        if (localFrame >= threshold + 4) return ch;
        if (localFrame < threshold - 3) return "";
        return glyphs[(localFrame * 7 + idx * 13) % glyphs.length];
      })
      .join("");
  }

  ctx.font = `${fontWeight} ${fontSize}px sans-serif`;
  ctx.textBaseline = "top";
  const lines = wrapTextLines(ctx, displayString, Math.max(240, boxW - 40));
  const lineHeightPx = fontSize * (s?.lineHeight || 1.12);
  const totalTextH = lines.length * lineHeightPx;
  const startY = -totalTextH / 2;
  const startX = -boxW / 2 + 20;

  lines.forEach((line, idx) => {
    const ly = startY + idx * lineHeightPx;
    if (chromaShift > 0.6) {
      ctx.fillStyle = "rgba(255, 50, 50, 0.75)";
      ctx.fillText(line, startX - chromaDx, ly - chromaDy);
      ctx.fillStyle = "rgba(0, 220, 255, 0.75)";
      ctx.fillText(line, startX + chromaDx, ly + chromaDy);
    }
    ctx.fillStyle =
      effect === "kinetic-char-3d" && idx === lines.length - 1 && lines.length > 1
        ? palette.accent
        : s?.color || palette.textPrimary;
    ctx.fillText(line, startX, ly);
  });

  if (clip.subtext) {
    const subSize = Math.max(16, Math.round(fontSize * 0.35));
    ctx.font = `500 ${subSize}px sans-serif`;
    const subLines = wrapTextLines(ctx, clip.subtext, Math.max(240, boxW - 56));
    const subTop = startY + totalTextH + 16;

    ctx.fillStyle = palette.accent;
    ctx.fillRect(startX, subTop, 3, subLines.length * (subSize * 1.4));

    ctx.fillStyle = palette.textMuted;
    subLines.forEach((sLine, sIdx) => {
      ctx.fillText(sLine, startX + 14, subTop + sIdx * (subSize * 1.4));
    });
  }
}

function renderShapeClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: ShapeClip,
  localFrame: number,
  durationInFrames: number,
  fps: number,
  boxW: number,
  boxH: number,
  canvasW: number,
  canvasH: number,
  direction: DesignDirectionPreset
) {
  const { palette, radiusPx } = direction;
  const accentColor = clip.accentColor || palette.accent;
  const progress = interpolate(
    localFrame,
    [0, Math.max(1, durationInFrames)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  if (clip.shapeVariant === "progress-bar") {
    ctx.fillStyle = palette.surfaceAltBg;
    ctx.fillRect(-canvasW / 2, -4, canvasW, 8);
    ctx.fillStyle = accentColor;
    ctx.fillRect(-canvasW / 2, -4, canvasW * progress, 8);
    return;
  }

  if (clip.shapeVariant === "badge") {
    const text = (clip.title || clip.name || "01 / SECTION").toUpperCase();
    ctx.font = "600 18px monospace";
    const tw = Math.min(540, Math.max(180, ctx.measureText(text).width + 40));
    const th = 42;
    const bx = -boxW / 2;
    const by = -th / 2;
    drawRoundedRect(ctx, bx, by, tw, th, radiusPx);
    ctx.fillStyle = palette.surfaceBg;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = accentColor;
    ctx.fillRect(bx, by, 3, th);
    ctx.fillStyle = palette.textPrimary;
    ctx.textBaseline = "middle";
    ctx.fillText(text, bx + 16, by + th / 2);
    return;
  }

  if (clip.shapeVariant === "spotlight-callout") {
    renderAttachedMotionOverlayCanvas(
      ctx,
      {
        preset: "spotlight-pointer",
        title: clip.title || "Target Feature Callout",
        subtitle: clip.subtitle,
        targetX: clip.targetX ?? -14,
        targetY: clip.targetY ?? -6,
        accentColor,
      },
      localFrame,
      durationInFrames,
      fps,
      canvasW,
      canvasH,
      direction
    );
    return;
  }

  if (clip.shapeVariant === "hud-telemetry") {
    renderAttachedMotionOverlayCanvas(
      ctx,
      {
        preset: "hud-telemetry",
        title: clip.title || "COMPOSITE TELEMETRY VIEW",
        subtitle: clip.subtitle,
        accentColor,
      },
      localFrame,
      durationInFrames,
      fps,
      canvasW,
      canvasH,
      direction
    );
    return;
  }

  const cardW = Math.max(320, boxW);
  const cardH = Math.max(240, boxH);
  const left = -cardW / 2;
  const top = -cardH / 2;

  // Card container
  drawRoundedRect(ctx, left, top, cardW, cardH, radiusPx);
  ctx.fillStyle = palette.surfaceBg;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top accent bar
  ctx.fillStyle = accentColor;
  ctx.fillRect(left, top, cardW, 3);

  // Header
  ctx.fillStyle = palette.textPrimary;
  ctx.font = "700 22px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(
    (clip.title || clip.shapeVariant.toUpperCase()).slice(0, 44),
    left + 24,
    top + 20
  );

  if (clip.subtitle) {
    ctx.fillStyle = palette.textMuted;
    ctx.font = "500 15px monospace";
    ctx.fillText(clip.subtitle.slice(0, 56), left + 24, top + 50);
  }

  // Variant-specific interior rendering
  if (clip.shapeVariant === "kpi-counter") {
    const rawMetric = clip.metricValue || "60 FPS";
    ctx.fillStyle = accentColor;
    ctx.font = "800 68px sans-serif";
    ctx.fillText(rawMetric, left + 24, top + 90);
    if (clip.metricTrend) {
      ctx.fillStyle = palette.textPrimary;
      ctx.font = "600 16px monospace";
      ctx.fillText(clip.metricTrend, left + 24, top + 175);
    }
  } else if (
    clip.shapeVariant === "code-card" ||
    clip.shapeVariant === "terminal-window"
  ) {
    const snippet =
      clip.codeSnippet ||
      `{\n  "action": "choreograph_3d_kinetic_scene",\n  "cameraMotion": "orbit-3d-left"\n}`;
    const lines = snippet.split("\n").slice(0, 7);
    ctx.font = "500 16px monospace";
    lines.forEach((ln, i) => {
      ctx.fillStyle = palette.textMuted;
      ctx.fillText(String(i + 1).padStart(2, "0"), left + 24, top + 86 + i * 24);
      ctx.fillStyle =
        ln.includes(":") || ln.includes("{") ? palette.textPrimary : accentColor;
      ctx.fillText(ln.slice(0, 52), left + 58, top + 86 + i * 24);
    });
  } else if (
    clip.shapeVariant === "3d-carousel-stack" ||
    clip.shapeVariant === "bento-grid"
  ) {
    const items =
      clip.bentoItems && clip.bentoItems.length > 0
        ? clip.bentoItems
        : [
            {
              title: "6-DOF Camera Rig",
              subtitle: "Orbit, Fly-Through Z & Whip-Pan 3D",
              metric: "3D RIG",
            },
            {
              title: "Velocity Graph Editor",
              subtitle: "Whip, Expo-Out, Elastic & Bounce",
              metric: "CURVES",
            },
            {
              title: "Directional Motion Blur",
              subtitle: "Velocity-driven shutter & RGB split",
              metric: "POST-FX",
            },
          ];
    items.slice(0, 3).forEach((item, idx) => {
      const iy = top + 84 + idx * 62;
      drawRoundedRect(ctx, left + 20, iy, cardW - 40, 52, Math.max(2, radiusPx - 2));
      ctx.fillStyle = palette.surfaceAltBg;
      ctx.fill();
      ctx.strokeStyle = idx === 0 ? accentColor : palette.border;
      ctx.stroke();
      ctx.fillStyle = palette.textPrimary;
      ctx.font = "700 17px sans-serif";
      ctx.fillText(item.title.slice(0, 34), left + 34, iy + 10);
      ctx.fillStyle = palette.textMuted;
      ctx.font = "400 13px sans-serif";
      ctx.fillText(item.subtitle.slice(0, 52), left + 34, iy + 31);
      if (item.metric) {
        ctx.fillStyle = accentColor;
        ctx.font = "700 13px monospace";
        ctx.fillText(item.metric, left + cardW - 110, iy + 18);
      }
    });
  } else if (clip.shapeVariant === "kinetic-impact-wall") {
    const rows = (
      clip.title || "TRUE 3D STAGE • VELOCITY GRAPH • KINETIC MOTION BLUR"
    )
      .split(/[•|/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    rows.slice(0, 3).forEach((rowText, idx) => {
      const ry = top + 84 + idx * 56;
      const isHighlight = idx === rows.length - 1;
      drawRoundedRect(ctx, left + 20, ry, cardW - 40, 46, 4);
      ctx.fillStyle = isHighlight ? accentColor : palette.surfaceAltBg;
      ctx.fill();
      ctx.fillStyle = isHighlight ? palette.accentContrast : palette.textPrimary;
      ctx.font = "800 20px sans-serif";
      ctx.fillText(rowText.slice(0, 36), left + 34, ry + 13);
    });
  } else if (clip.shapeVariant === "3d-wireframe-prism") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(left + 8, top + 76, cardW - 16, cardH - 84);
    ctx.clip();
    ctx.translate(left + 8, top + 76);
    renderProcedural3DTo2DContext(
      ctx,
      cardW - 16,
      cardH - 84,
      "webgl-3d-prism",
      localFrame,
      fps,
      palette
    );
    ctx.restore();
  } else if (clip.shapeVariant === "process-stepper") {
    const steps =
      clip.steps && clip.steps.length > 0
        ? clip.steps
        : [
            { step: "01", title: "Ingest Video Stream", detail: "Frame-locked" },
            { step: "02", title: "Attach Motion Rig", detail: "Auto-spotlight" },
            { step: "03", title: "Verify Output", detail: "Zero overlap" },
          ];
    const colW = (cardW - 60) / Math.max(1, steps.length);
    steps.forEach((st, idx) => {
      const sx = left + 20 + idx * (colW + 10);
      const sy = top + 88;
      drawRoundedRect(ctx, sx, sy, colW, cardH - 108, radiusPx);
      ctx.fillStyle = palette.surfaceAltBg;
      ctx.fill();
      ctx.strokeStyle = idx === 0 ? accentColor : palette.border;
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.font = "700 13px monospace";
      ctx.fillText(`STAGE ${st.step || `0${idx + 1}`}`, sx + 12, sy + 14);
      ctx.fillStyle = palette.textPrimary;
      ctx.font = "700 16px sans-serif";
      ctx.fillText(st.title.slice(0, 22), sx + 12, sy + 40);
    });
  } else if (clip.shapeVariant === "bar-chart") {
    const bars =
      clip.chartData && clip.chartData.length > 0
        ? clip.chartData
        : [
            { label: "Track 1 • Video & Camera Rig", value: 100 },
            { label: "Track 2 • Attached Motion Overlays", value: 92 },
            { label: "Track 3 • Editorial Typography", value: 88 },
          ];
    bars.slice(0, 4).forEach((b, idx) => {
      const by = top + 86 + idx * 46;
      ctx.fillStyle = palette.textPrimary;
      ctx.font = "600 15px sans-serif";
      ctx.fillText(b.label.slice(0, 38), left + 24, by);
      ctx.fillStyle = palette.surfaceAltBg;
      ctx.fillRect(left + 24, by + 22, cardW - 48, 12);
      ctx.fillStyle = idx === bars.length - 1 ? accentColor : palette.textMuted;
      ctx.fillRect(
        left + 24,
        by + 22,
        ((cardW - 48) * Math.min(100, b.value) * progress) / 100,
        12
      );
    });
  } else if (clip.shapeVariant === "split-comparison") {
    const beforeLabel = clip.compareBeforeLabel || "MANUAL MULTI-TRACK";
    const beforeValue =
      clip.compareBeforeValue || "Complex X/Y coordinate math & manual sync";
    const afterLabel = clip.compareAfterLabel || "DECLARATIVE OVERLAY";
    const afterValue =
      clip.compareAfterValue || "1 JSON property attaches Camera + Spotlight";
    const colW = (cardW - 56) / 2;
    const colY = top + 88;
    const colH = Math.max(96, cardH - 112);

    // Left / Before column
    drawRoundedRect(ctx, left + 20, colY, colW, colH, Math.max(2, radiusPx - 2));
    ctx.fillStyle = palette.surfaceAltBg;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.stroke();
    ctx.fillStyle = palette.textMuted;
    ctx.font = "700 13px monospace";
    ctx.fillText(beforeLabel.slice(0, 26), left + 34, colY + 18);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = "500 15px sans-serif";
    wrapTextLines(ctx, beforeValue, colW - 28)
      .slice(0, 3)
      .forEach((ln, idx) => {
        ctx.fillText(ln, left + 34, colY + 46 + idx * 22);
      });

    // Right / After column
    const rx = left + 36 + colW;
    drawRoundedRect(ctx, rx, colY, colW, colH, Math.max(2, radiusPx - 2));
    ctx.fillStyle = palette.surfaceAltBg;
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.stroke();
    ctx.fillStyle = accentColor;
    ctx.font = "700 13px monospace";
    ctx.fillText(afterLabel.slice(0, 26), rx + 14, colY + 18);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = "600 15px sans-serif";
    wrapTextLines(ctx, afterValue, colW - 28)
      .slice(0, 3)
      .forEach((ln, idx) => {
        ctx.fillText(ln, rx + 14, colY + 46 + idx * 22);
      });
  } else if (clip.shapeVariant === "chat-simulation") {
    const msgs =
      clip.chatMessages && clip.chatMessages.length > 0
        ? clip.chatMessages
        : [
            {
              sender: "user" as const,
              text: "Choreograph a 60fps 3D kinetic reveal.",
            },
            {
              sender: "ai" as const,
              text: "Applied 6-DOF camera rig & whip velocity curves.",
            },
          ];
    msgs.slice(0, 3).forEach((m, idx) => {
      const my = top + 84 + idx * 60;
      const isAgent = m.sender === "ai";
      drawRoundedRect(
        ctx,
        left + 20,
        my,
        cardW - 40,
        50,
        Math.max(2, radiusPx - 2)
      );
      ctx.fillStyle = palette.surfaceAltBg;
      ctx.fill();
      ctx.strokeStyle = isAgent ? accentColor : palette.border;
      ctx.stroke();
      ctx.fillStyle = isAgent ? accentColor : palette.textMuted;
      ctx.font = "700 12px monospace";
      ctx.fillText(
        isAgent ? "AGVI AI" : "DIRECTOR",
        left + 32,
        my + 10
      );
      ctx.fillStyle = palette.textPrimary;
      ctx.font = "500 14px sans-serif";
      ctx.fillText(m.text.slice(0, 48), left + 32, my + 28);
    });
  } else if (clip.shapeVariant === "audio-waveform") {
    const barCount = 24;
    const barSpacing = (cardW - 48) / barCount;
    const midY = top + 90 + (cardH - 110) / 2;
    for (let b = 0; b < barCount; b++) {
      const amp =
        0.2 +
        0.8 *
          Math.abs(
            Math.sin((localFrame / Math.max(1, fps)) * 6 + b * 0.45) *
              Math.cos(b * 0.25)
          );
      const bh = Math.max(8, (cardH - 120) * amp);
      ctx.fillStyle = b % 3 === 0 ? accentColor : palette.textMuted;
      ctx.fillRect(
        left + 24 + b * barSpacing,
        midY - bh / 2,
        Math.max(3, barSpacing - 4),
        bh
      );
    }
  } else if (clip.shapeVariant === "lower-third") {
    ctx.fillStyle = accentColor;
    ctx.fillRect(left + 24, top + 84, 48, 4);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = "600 16px monospace";
    ctx.fillText(
      (clip.subtitle || "BROADCAST TELEMETRY CHYRON").slice(0, 48),
      left + 24,
      top + 102
    );
  } else if (
    clip.shapeVariant === "gradient-backdrop" ||
    clip.shapeVariant === "cyber-shader"
  ) {
    renderProcedural3DTo2DContext(
      ctx,
      cardW,
      cardH,
      clip.shapeVariant === "cyber-shader"
        ? "webgl-3d-tunnel"
        : "webgl-3d-prism",
      localFrame,
      fps,
      palette
    );
  } else if (clip.shapeVariant === "circle") {
    const rad = Math.min(cardW, cardH) * 0.28;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, top + 95 + rad, rad, 0, Math.PI * 2);
    ctx.stroke();
  } else if (clip.shapeVariant === "rect") {
    ctx.fillStyle = clip.fill || palette.surfaceAltBg;
    ctx.fillRect(left + 24, top + 84, cardW - 48, Math.max(40, cardH - 108));
  }
}

function renderCaptionClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: CaptionClip,
  localFrame: number,
  fps: number,
  canvasW: number,
  direction: DesignDirectionPreset
) {
  const { palette, radiusPx } = direction;
  const localSec = localFrame / Math.max(1, fps);
  const activeAccent = clip.highlightColor || palette.accent;
  const fontSize = Math.min(clip.fontSize || 32, 36);

  const words =
    clip.words && clip.words.length > 0
      ? clip.words
      : (clip.text || "")
          .split(/\s+/)
          .filter(Boolean)
          .map((word, idx, arr) => {
            const step = clip.duration / Math.max(1, arr.length);
            return { word, start: idx * step, end: (idx + 1) * step };
          });

  ctx.font = `700 ${fontSize}px sans-serif`;
  const fullText = words.map((w) => w.word).join(" ");
  const measuredW = Math.min(
    canvasW * 0.82,
    Math.max(320, ctx.measureText(fullText).width + 64)
  );
  const boxH = fontSize + 32;
  const left = -measuredW / 2;
  const top = -boxH / 2;

  drawRoundedRect(ctx, left, top, measuredW, boxH, radiusPx);
  ctx.fillStyle = clip.backgroundColor || palette.surfaceBg;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Render words with active karaoke highlight
  let cursorX = left + 28;
  const textY = top + (boxH - fontSize) / 2;
  ctx.textBaseline = "top";

  for (let i = 0; i < words.length; i++) {
    const wObj = words[i];
    const wordStr = wObj.word;
    const wordW = ctx.measureText(wordStr + " ").width;
    if (cursorX + wordW > left + measuredW - 20) break;

    const isActive = localSec >= wObj.start && localSec <= wObj.end + 0.05;
    const isPast = localSec > wObj.end;

    if (isActive) {
      drawRoundedRect(ctx, cursorX - 4, textY - 4, wordW - 2, fontSize + 8, 4);
      ctx.fillStyle = activeAccent;
      ctx.fill();
      ctx.fillStyle = palette.accentContrast;
    } else {
      ctx.fillStyle = isPast
        ? clip.textColor || palette.textPrimary
        : palette.textMuted;
    }

    ctx.fillText(wordStr, cursorX, textY);
    cursorX += wordW;
  }
}

/**
 * Renders an exact, deterministic timeline frame onto a 2D Canvas context,
 * evaluating all tracks, clips, 6-DOF keyframes, camera rigs, motion blur,
 * chromatic aberration, and responsive layout contexts.
 */
export function renderProjectFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  project: AGVIProject,
  frame: number,
  assets?: FrameAssetCache
): FrameCompositionTelemetry {
  const fps = Math.max(12, project.canvas.fps || 30);
  const w = Math.max(100, project.canvas.width || 1920);
  const h = Math.max(100, project.canvas.height || 1080);

  const direction =
    resolveDesignDirection(
      project.agentMeta?.designDirection as string | undefined,
      `${project.name} ${project.description ?? ""}`
    ) ?? DESIGN_DIRECTION_PRESETS["swiss-industrial"];

  const { palette } = direction;

  // 1. Clear & Paint Matte Stage Background
  ctx.save();
  ctx.fillStyle = project.canvas.backgroundColor || palette.canvasBg || "#070807";
  ctx.fillRect(0, 0, w, h);

  const visibleTracks = [...(project.tracks || [])]
    .filter((t) => !t.hidden)
    .sort((a, b) => a.zIndex - b.zIndex);

  const activeClipIds: string[] = [];
  const activeTrackTypes = new Set<string>();

  for (const track of visibleTracks) {
    for (const clip of track.clips) {
      if (clip.type === "audio") continue;
      const midTime = clip.startTime + clip.duration * 0.5;
      const sceneContext = getActiveSceneContextForTime(project, midTime);
      const evalState = evaluateClipAtFrame(
        clip,
        frame,
        fps,
        w,
        h,
        direction,
        sceneContext
      );
      if (!evalState) continue;

      activeClipIds.push(clip.id);
      activeTrackTypes.add(clip.type);

      ctx.save();
      ctx.globalAlpha = evalState.finalOpacity;

      // Apply SceneTransitionEffect wipe clipping when clip has an active entrance transition
      if (
        evalState.sceneTrans.wipeProgress !== undefined &&
        evalState.sceneTrans.wipeProgress < 0.999 &&
        clip.sceneTransition &&
        clip.sceneTransition !== "none"
      ) {
        const wp = Math.max(0.02, Math.min(1, evalState.sceneTrans.wipeProgress));
        if (clip.sceneTransition === "shutter-wipe") {
          ctx.beginPath();
          ctx.rect(0, 0, w * wp, h);
          ctx.clip();
        } else if (clip.sceneTransition === "editorial-curtain") {
          const insetH = (1 - wp) * 0.5 * h;
          ctx.beginPath();
          ctx.rect(0, insetH, w, Math.max(2, h - insetH * 2));
          ctx.clip();
        } else if (clip.sceneTransition === "iris-frame") {
          const insetX = (1 - wp) * 0.38 * w;
          const insetY = (1 - wp) * 0.38 * h;
          ctx.beginPath();
          ctx.rect(
            insetX,
            insetY,
            Math.max(2, w - insetX * 2),
            Math.max(2, h - insetY * 2)
          );
          ctx.clip();
        }
      }

      if (evalState.isFullCanvasBackdrop) {
        if (clip.type === "video" || clip.type === "image") {
          renderVideoOrImageClipToCanvas(
            ctx,
            clip,
            evalState.localFrame,
            evalState.durationInFrames,
            fps,
            w,
            h,
            direction,
            sceneContext,
            assets
          );
        } else if (clip.type === "shape") {
          ctx.translate(w / 2, h / 2);
          renderShapeClipToCanvas(
            ctx,
            clip,
            evalState.localFrame,
            evalState.durationInFrames,
            fps,
            w,
            h,
            w,
            h,
            direction
          );
        }
      } else {
        // Apply 3D focal projection + 2D translation + rotation + velocity stretch
        const zPerspectiveScale = Math.max(
          0.35,
          1400 / Math.max(250, 1400 - evalState.finalTz)
        );
        const totalScaleX =
          evalState.finalScale * zPerspectiveScale * evalState.motionStretchX;
        const totalScaleY =
          evalState.finalScale * zPerspectiveScale * evalState.motionStretchY;

        ctx.translate(w / 2 + evalState.finalTx, h / 2 + evalState.finalTy);
        if (Math.abs(evalState.finalRotZ) > 0.05) {
          ctx.rotate((evalState.finalRotZ * Math.PI) / 180);
        }
        ctx.scale(totalScaleX, totalScaleY);

        const boxW = evalState.layout.widthPct
          ? (evalState.layout.widthPct / 100) * w
          : w * 0.5;
        const boxH = evalState.layout.heightPct
          ? (evalState.layout.heightPct / 100) * h
          : h * 0.36;

        if (clip.type === "text") {
          renderTextClipToCanvas(
            ctx,
            clip,
            evalState.localFrame,
            evalState.durationInFrames,
            fps,
            boxW,
            direction,
            evalState.chromaDx,
            evalState.chromaDy,
            evalState.chromaShift
          );
        } else if (clip.type === "shape") {
          renderShapeClipToCanvas(
            ctx,
            clip,
            evalState.localFrame,
            evalState.durationInFrames,
            fps,
            boxW,
            boxH,
            w,
            h,
            direction
          );
        } else if (clip.type === "caption") {
          renderCaptionClipToCanvas(
            ctx,
            clip,
            evalState.localFrame,
            fps,
            w,
            direction
          );
        } else if (clip.type === "video" || clip.type === "image") {
          ctx.translate(-boxW / 2, -boxH / 2);
          renderVideoOrImageClipToCanvas(
            ctx,
            clip,
            evalState.localFrame,
            evalState.durationInFrames,
            fps,
            boxW,
            boxH,
            direction,
            sceneContext,
            assets
          );
        }
      }

      // Flash-cut / zoom-punch brightness overlay pulse
      if (
        evalState.sceneTrans.extraBrightness &&
        evalState.sceneTrans.extraBrightness > 1.05
      ) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.45, (evalState.sceneTrans.extraBrightness - 1) * 0.45).toFixed(3)})`;
        ctx.fillRect(-w, -h, w * 3, h * 3);
      }

      ctx.restore();
    }
  }

  ctx.restore();

  return {
    frame,
    fps,
    timestampSec: Number((frame / fps).toFixed(4)),
    width: w,
    height: h,
    designDirection: direction.id,
    activeClipCount: activeClipIds.length,
    activeClipIds,
    activeTrackTypes: Array.from(activeTrackTypes),
  };
}
