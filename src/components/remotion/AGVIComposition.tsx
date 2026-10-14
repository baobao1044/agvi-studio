"use client";

import React, { useEffect, useRef } from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "../../lib/engine/agvi-engine";
import {
  AGVIProject,
  CameraMotionEffect,
  CaptionClip,
  ClipAnimation,
  ImageClip,
  SceneTransitionEffect,
  ShapeClip,
  TextClip,
  TimelineClip,
  VideoClip,
  VideoMotionOverlay,
} from "../../lib/schema/timeline-schema";
import {
  DESIGN_DIRECTION_PRESETS,
  DesignDirectionPreset,
  resolveDesignDirection,
} from "../../lib/anti-slop/anti-slop-filter";

export interface AGVICompositionProps {
  project: AGVIProject;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string) => void;
  showSafeZones?: boolean;
}

/**
 * Restrained, functional motion curves (anti-slop-ui Rule: Max 1-2 animated properties simultaneously).
 */
function computeAnimationStyles(
  localFrame: number,
  durationInFrames: number,
  fps: number,
  enter: ClipAnimation,
  exit: ClipAnimation
): {
  opacityMultiplier: number;
  translateX: number;
  translateY: number;
  scaleMultiplier: number;
  blurPx: number;
} {
  let opacityMultiplier = 1;
  let translateX = 0;
  let translateY = 0;
  let scaleMultiplier = 1;
  let blurPx = 0;

  const enterFrames = Math.max(1, Math.round((enter?.duration || 0.3) * fps));
  const exitFrames = Math.max(1, Math.round((exit?.duration || 0.25) * fps));

  if (enter && enter.type !== "none" && localFrame <= enterFrames) {
    const progress = interpolate(localFrame, [0, enterFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const springVal = spring({
      frame: localFrame,
      fps,
      config: { damping: 22, stiffness: 160, mass: 0.9 },
    });

    switch (enter.type) {
      case "fade":
        opacityMultiplier *= progress;
        break;
      case "slide-up":
        opacityMultiplier *= progress;
        translateY += interpolate(springVal, [0, 1], [32, 0]);
        break;
      case "slide-down":
        opacityMultiplier *= progress;
        translateY += interpolate(springVal, [0, 1], [-32, 0]);
        break;
      case "slide-left":
        opacityMultiplier *= progress;
        translateX += interpolate(springVal, [0, 1], [-48, 0]);
        break;
      case "slide-right":
        opacityMultiplier *= progress;
        translateX += interpolate(springVal, [0, 1], [48, 0]);
        break;
      case "zoom-in":
        opacityMultiplier *= progress;
        scaleMultiplier *= interpolate(springVal, [0, 1], [0.94, 1]);
        break;
      case "zoom-out":
        opacityMultiplier *= progress;
        scaleMultiplier *= interpolate(springVal, [0, 1], [1.06, 1]);
        break;
      case "pop-spring":
        opacityMultiplier *= Math.min(1, progress * 1.4);
        scaleMultiplier *= interpolate(springVal, [0, 1], [0.92, 1]);
        break;
      case "blur-in":
        opacityMultiplier *= progress;
        blurPx += interpolate(progress, [0, 1], [8, 0]);
        break;
    }
  }

  const exitStart = durationInFrames - exitFrames;
  if (exit && exit.type !== "none" && localFrame >= exitStart) {
    const exitProgress = interpolate(
      localFrame,
      [exitStart, durationInFrames],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
    opacityMultiplier *= 1 - exitProgress;
    if (exit.type === "slide-down") {
      translateY += interpolate(exitProgress, [0, 1], [0, 20]);
    } else if (exit.type === "zoom-out") {
      scaleMultiplier *= interpolate(exitProgress, [0, 1], [1, 0.96]);
    }
  }

  return {
    opacityMultiplier,
    translateX,
    translateY,
    scaleMultiplier,
    blurPx,
  };
}

/**
 * Computes declarative Scene Entrance Transition styles (`shutter-wipe`, `editorial-curtain`, `iris-frame`, `flash-cut`).
 */
function computeSceneTransitionStyle(
  transition: SceneTransitionEffect | undefined,
  localFrame: number,
  fps: number
): {
  clipPath?: string;
  extraBrightness?: number;
} {
  if (!transition || transition === "none") return {};
  const transFrames = Math.max(6, Math.round(fps * 0.45));
  if (localFrame >= transFrames) return {};

  const p = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 140 },
  });

  switch (transition) {
    case "shutter-wipe": {
      const rightInset = Math.max(0, (1 - p) * 100);
      return { clipPath: `inset(0% ${rightInset.toFixed(1)}% 0% 0%)` };
    }
    case "editorial-curtain": {
      const vInset = Math.max(0, (1 - p) * 50);
      return {
        clipPath: `inset(${vInset.toFixed(1)}% 0% ${vInset.toFixed(1)}% 0%)`,
      };
    }
    case "iris-frame": {
      const inset = Math.max(0, (1 - p) * 38);
      return {
        clipPath: `inset(${inset.toFixed(1)}% ${inset.toFixed(1)}% ${inset.toFixed(1)}% ${inset.toFixed(1)}% round 6px)`,
      };
    }
    case "flash-cut": {
      const flash = interpolate(localFrame, [0, 8], [1.65, 1], {
        extrapolateRight: "clamp",
      });
      return { extraBrightness: flash };
    }
    default:
      return {};
  }
}

/**
 * Computes declarative Smart Camera Rig transforms (`cinema-dolly`, `focus-zoom-left`, `focus-zoom-right`, `isometric-3d-frame`).
 */
function computeCameraRigStyle(
  cameraMotion: CameraMotionEffect | undefined,
  localFrame: number,
  durationInFrames: number,
  fps: number
): {
  transform: string;
  isFramed3D: boolean;
  isLetterbox: boolean;
} {
  const mode = cameraMotion || "none";
  const progress = interpolate(
    localFrame,
    [0, Math.max(1, durationInFrames)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const focusSpring = spring({
    frame: Math.max(0, localFrame - 6),
    fps,
    config: { damping: 22, stiffness: 90 },
  });

  switch (mode) {
    case "cinema-dolly": {
      const scale = interpolate(progress, [0, 1], [1, 1.08]);
      return {
        transform: `scale(${scale.toFixed(4)})`,
        isFramed3D: false,
        isLetterbox: false,
      };
    }
    case "focus-zoom-left": {
      const scale = interpolate(focusSpring, [0, 1], [1, 1.24]);
      const tx = interpolate(focusSpring, [0, 1], [0, 9]);
      const ty = interpolate(focusSpring, [0, 1], [0, 3]);
      return {
        transform: `scale(${scale.toFixed(3)}) translate3d(${tx.toFixed(2)}%, ${ty.toFixed(2)}%, 0)`,
        isFramed3D: false,
        isLetterbox: false,
      };
    }
    case "focus-zoom-right": {
      const scale = interpolate(focusSpring, [0, 1], [1, 1.24]);
      const tx = interpolate(focusSpring, [0, 1], [0, -9]);
      const ty = interpolate(focusSpring, [0, 1], [0, 3]);
      return {
        transform: `scale(${scale.toFixed(3)}) translate3d(${tx.toFixed(2)}%, ${ty.toFixed(2)}%, 0)`,
        isFramed3D: false,
        isLetterbox: false,
      };
    }
    case "isometric-3d-frame": {
      const rotY = interpolate(progress, [0, 1], [-11, -5]);
      const rotX = interpolate(progress, [0, 1], [6, 3]);
      return {
        transform: `perspective(1600px) rotateY(${rotY.toFixed(2)}deg) rotateX(${rotX.toFixed(2)}deg) scale(0.84)`,
        isFramed3D: true,
        isLetterbox: false,
      };
    }
    case "letterbox-cinema": {
      const scale = interpolate(progress, [0, 1], [1.02, 1.08]);
      return {
        transform: `scale(${scale.toFixed(3)})`,
        isFramed3D: false,
        isLetterbox: true,
      };
    }
    default:
      return {
        transform: "none",
        isFramed3D: false,
        isLetterbox: false,
      };
  }
}

interface ActiveSceneLayoutContext {
  hasSpotlight: boolean;
  hasRightWidget: boolean;
  hasHeadline: boolean;
}

/**
 * Zero-Effort Motion Graphics Overlay attached directly to a Video or Image clip!
 * Automatically adapts its placement based on active scene elements so it NEVER
 * collides with foreground headlines or right-column widgets.
 */
const AttachedMotionOverlayRenderer: React.FC<{
  overlay: VideoMotionOverlay;
  durationInFrames: number;
  direction: DesignDirectionPreset;
  sceneContext?: ActiveSceneLayoutContext;
}> = ({ overlay, durationInFrames, direction, sceneContext }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, typography, radiusPx } = direction;

  if (!overlay || overlay.preset === "none") return null;

  const enterSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 20, stiffness: 130 },
  });

  // 1. SPOTLIGHT POINTER (Dimmed mask + Animated SVG Reticle + Leader Line + Callout Box)
  if (overlay.preset === "spotlight-pointer") {
    const hasRightWidget = Boolean(sceneContext?.hasRightWidget);
    const hasHeadline = Boolean(sceneContext?.hasHeadline);

    let targetLeftPct: number;
    let targetTopPct: number;
    let cardLeftPct: number;
    let cardTopPct: number;
    let cardMaxWidth = 380;

    if (hasRightWidget && hasHeadline) {
      // Scene has BOTH an Upper-Left Headline AND a Right-Column Widget:
      // Place Spotlight Reticle & Callout Card cleanly in the Lower-Left Quadrant!
      targetLeftPct = 13;
      targetTopPct = 62;
      cardLeftPct = 20;
      cardTopPct = 52;
      cardMaxWidth = 340;
    } else if (hasHeadline) {
      // Scene has a Headline (auto-docked to Left Column) and NO Right Widget:
      // Place Spotlight Reticle & Callout Card cleanly in the Right Stage!
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

    const startX = targetLeftPct * 10;
    const startY = targetTopPct * 5.62;
    const elbowX = (cardLeftPct - 2.5) * 10;
    const endX = cardLeftPct * 10;
    const endY = (cardTopPct + 6) * 5.62;

    return (
      <AbsoluteFill style={{ pointerEvents: "none", zIndex: 10 }}>
        {/* Subtle Vignette Highlighting Target Area */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle 240px at ${targetLeftPct}% ${targetTopPct}%, transparent 0%, transparent 55%, rgba(10, 10, 10, 0.55) 100%)`,
            opacity: enterSpring,
          }}
        />

        {/* SVG Reticle & Animated Leader Line (Terminates cleanly at outer left border of Card) */}
        <svg
          viewBox="0 0 1000 562"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: enterSpring,
          }}
        >
          <circle
            cx={startX}
            cy={startY}
            r={24 * enterSpring}
            fill="none"
            stroke={palette.accent}
            strokeWidth="2.5"
          />
          <circle cx={startX} cy={startY} r={5} fill={palette.accent} />
          <polyline
            points={`${startX},${startY} ${elbowX},${endY} ${endX},${endY}`}
            fill="none"
            stroke={palette.accent}
            strokeWidth="2"
            strokeDasharray="300"
            strokeDashoffset={interpolate(enterSpring, [0, 1], [300, 0])}
          />
        </svg>

        {/* High-Contrast Editorial Annotation Box */}
        <div
          style={{
            position: "absolute",
            left: `${cardLeftPct}%`,
            top: `${cardTopPct}%`,
            width: cardMaxWidth,
            padding: "14px 18px",
            backgroundColor: palette.surfaceBg,
            border: `1px solid ${palette.border}`,
            borderLeft: `4px solid ${palette.accent}`,
            borderRadius: radiusPx,
            opacity: enterSpring,
            transform: `translateY(${interpolate(enterSpring, [0, 1], [10, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily: typography.monoFont,
              fontSize: 12,
              fontWeight: 700,
              color: palette.accent,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            SPOTLIGHT LOCK [{Math.round(targetLeftPct - 50)}%,{" "}
            {Math.round(targetTopPct - 50)}%]
          </div>
          <div
            style={{
              fontFamily: typography.displayFont,
              fontSize: 21,
              fontWeight: 700,
              color: palette.textPrimary,
              lineHeight: 1.2,
            }}
          >
            {overlay.title || "Focal Feature Callout"}
          </div>
          {overlay.subtitle && (
            <div
              style={{
                marginTop: 5,
                fontFamily: typography.bodyFont,
                fontSize: 14,
                color: palette.textMuted,
                lineHeight: 1.35,
              }}
            >
              {overlay.subtitle}
            </div>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // 2. HUD TELEMETRY OVERLAY (Top-Right Telemetry Pill + Subtle Frame Readout, Zero Top-Left Badge Collision)
  if (overlay.preset === "hud-telemetry") {
    const sec = Math.floor(frame / fps);
    const remFrames = frame % fps;
    const tc = `00:00:${String(sec).padStart(2, "0")}:${String(remFrames).padStart(2, "0")}`;

    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          zIndex: 10,
          padding: "56px 56px",
          justifyContent: "space-between",
        }}
      >
        {/* Top-Right Only Telemetry Bar so Top-Left Section Index Badge is 100% clear */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            fontFamily: typography.monoFont,
            fontSize: 14,
            color: palette.textPrimary,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              backgroundColor: palette.surfaceBg,
              border: `1px solid ${palette.border}`,
              borderRadius: radiusPx,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                backgroundColor: palette.accent,
              }}
            />
            <span style={{ fontWeight: 700 }}>
              {overlay.title || "LIVE VIDEO FEED"}
            </span>
          </div>

          <div
            style={{
              padding: "6px 12px",
              backgroundColor: palette.surfaceBg,
              border: `1px solid ${palette.border}`,
              borderRadius: radiusPx,
              fontVariantNumeric: "tabular-nums",
              color: palette.accent,
            }}
          >
            TC {tc} • {fps} FPS
          </div>
        </div>

        {/* Bottom-Right Frame Readout (Above Subtitle Safe Zone) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            marginBottom: "8%",
            fontFamily: typography.monoFont,
            fontSize: 13,
            color: palette.textMuted,
          }}
        >
          <span
            style={{
              padding: "5px 10px",
              backgroundColor: palette.surfaceBg,
              border: `1px solid ${palette.border}`,
              borderRadius: radiusPx,
            }}
          >
            {overlay.subtitle || "CAMERA RIG LOCKED"} • F:
            {String(frame).padStart(3, "0")}
          </span>
        </div>
      </AbsoluteFill>
    );
  }

  // 3. LOWER CHYRON (Broadcast Documentary Lower-Third Bar over Video)
  if (overlay.preset === "lower-chyron") {
    return (
      <div
        style={{
          position: "absolute",
          left: "5%",
          bottom: "16%",
          zIndex: 10,
          display: "flex",
          alignItems: "stretch",
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderRadius: radiusPx,
          overflow: "hidden",
          opacity: enterSpring,
          transform: `translateY(${interpolate(enterSpring, [0, 1], [20, 0])}px)`,
          maxWidth: "70%",
        }}
      >
        <div style={{ width: 6, backgroundColor: palette.accent }} />
        <div style={{ padding: "14px 22px" }}>
          <div
            style={{
              fontFamily: typography.displayFont,
              fontSize: 26,
              fontWeight: 700,
              color: palette.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            {overlay.title || "Video Footage Annotation"}
          </div>
          {overlay.subtitle && (
            <div
              style={{
                marginTop: 4,
                fontFamily: typography.monoFont,
                fontSize: 16,
                color: palette.accent,
              }}
            >
              {overlay.subtitle}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. STEP ANNOTATIONS (Sequential 01 -> 02 -> 03 Callout Pills over Footage)
  if (overlay.preset === "step-annotations") {
    const steps =
      overlay.steps && overlay.steps.length > 0
        ? overlay.steps.map((s) =>
            s.detail ? `${s.title} (${s.detail})` : s.title
          )
        : overlay.items && overlay.items.length > 0
          ? overlay.items
          : [
              "01 / Ingest Video Stream",
              "02 / Attach Camera & Motion Rig",
              "03 / Render Deterministic Output",
            ];

    return (
      <div
        style={{
          position: "absolute",
          right: "5%",
          top: "20%",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: 360,
        }}
      >
        {steps.map((stepText, idx) => {
          const stepSpring = spring({
            frame: Math.max(0, frame - idx * 12 - 6),
            fps,
            config: { damping: 20, stiffness: 130 },
          });
          const isCurrent =
            frame >= idx * 12 + 6 &&
            (idx === steps.length - 1 || frame < (idx + 1) * 12 + 6);
          return (
            <div
              key={idx}
              style={{
                padding: "14px 18px",
                backgroundColor: palette.surfaceBg,
                border: `1px solid ${isCurrent ? palette.accent : palette.border}`,
                borderLeft: `4px solid ${isCurrent ? palette.accent : palette.border}`,
                borderRadius: radiusPx,
                opacity: stepSpring,
                transform: `translateX(${interpolate(stepSpring, [0, 1], [24, 0])}px)`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontFamily: typography.monoFont,
                  fontSize: 15,
                  fontWeight: 700,
                  color: isCurrent ? palette.accent : palette.textMuted,
                }}
              >
                0{idx + 1}
              </span>
              <span
                style={{
                  fontFamily: typography.bodyFont,
                  fontSize: 18,
                  fontWeight: 600,
                  color: palette.textPrimary,
                }}
              >
                {stepText}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // 5. SPLIT COMPARE WIPE (Before / After Divider over Footage)
  if (overlay.preset === "split-compare") {
    const wipePct = interpolate(
      Math.sin((frame / Math.max(1, durationInFrames)) * Math.PI * 1.5),
      [-1, 1],
      [28, 72]
    );
    const leftLabel = overlay.items?.[0] || "RAW FOOTAGE";
    const rightLabel = overlay.items?.[1] || "COMPOSITED MOTION RIG";

    return (
      <AbsoluteFill style={{ pointerEvents: "none", zIndex: 10 }}>
        {/* Left Side Tonal Filter to distinguish Before vs After */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${wipePct}%`,
            backgroundColor: "rgba(0,0,0,0.32)",
            borderRight: `2px solid ${palette.accent}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 36,
            padding: "6px 14px",
            backgroundColor: palette.surfaceBg,
            border: `1px solid ${palette.border}`,
            borderRadius: radiusPx,
            fontFamily: typography.monoFont,
            fontSize: 15,
            fontWeight: 600,
            color: palette.textMuted,
          }}
        >
          {leftLabel}
        </div>
        <div
          style={{
            position: "absolute",
            top: 32,
            right: 36,
            padding: "6px 14px",
            backgroundColor: palette.surfaceBg,
            border: `1px solid ${palette.accent}`,
            borderRadius: radiusPx,
            fontFamily: typography.monoFont,
            fontSize: 15,
            fontWeight: 700,
            color: palette.accent,
          }}
        >
          {rightLabel}
        </div>
      </AbsoluteFill>
    );
  }

  return null;
};

/**
 * Resolves canvas-relative coordinates (-50 to +50) while preserving intentional
 * asymmetric split-screen layouts (e.g. x = -22 left column, x = +20 right column) on 16:9,
 * and gracefully stacking vertically on 9:16 portrait so elements never collide.
 */
function resolveResponsiveLayout(
  clip: TimelineClip,
  canvasW: number,
  canvasH: number,
  sceneContext?: ActiveSceneLayoutContext
): {
  x: number;
  y: number;
  scale: number;
  widthPct?: number;
  heightPct?: number;
} {
  const isPortrait = canvasH > canvasW * 1.15;
  const isSquare = Math.abs(canvasW - canvasH) <= canvasW * 0.15;

  let x = clip.transform.x ?? 0;
  let y = clip.transform.y ?? 0;
  let scale = clip.transform.scale ?? 1;
  let widthPct = clip.transform.width;
  let heightPct = clip.transform.height;

  // Smart Camera Mode: "split-stage-left" automatically docks the video/image into the left column on 16:9!
  if (
    (clip.type === "video" || clip.type === "image") &&
    clip.cameraMotion === "split-stage-left"
  ) {
    if (isPortrait) {
      return { x: 0, y: -14, scale: 1, widthPct: 90, heightPct: 38 };
    }
    return { x: -22, y: -2, scale: 1, widthPct: 46, heightPct: 68 };
  }

  if (clip.type === "shape" && clip.shapeVariant === "progress-bar") {
    return {
      x: 0,
      y: 49.4,
      scale: 1,
      widthPct: 100,
    };
  }

  if (clip.type === "shape" && clip.shapeVariant === "hud-telemetry") {
    return {
      x: 0,
      y: 0,
      scale: 1,
      widthPct: 100,
      heightPct: 100,
    };
  }

  if (clip.type === "shape" && clip.shapeVariant === "badge") {
    if (isPortrait) {
      x = 0;
      if (y > -30) y = -39;
      scale *= 0.92;
    } else if (Math.abs(x) < 6 && y > -24) {
      y = -36;
    }
  }

  if (clip.type === "text") {
    if (isPortrait) {
      x = 0;
      if (y > -18 && y < 10) {
        y = -26;
      }
      scale *= 0.82;
      widthPct = widthPct || 90;
    } else if (isSquare) {
      if (Math.abs(x) > 10) {
        x = 0;
      }
      if (y > -15 && y < 10) {
        y = -25;
      }
      scale *= 0.88;
      widthPct = Math.max(widthPct || 84, 80);
    } else {
      // 16:9 Landscape Collision Prevention:
      // 1) If the scene has a Spotlight / Step-Annotation on the video AND a Right-Column Widget,
      //    keep the headline in the Upper-Left quadrant (x = -23, y = -15, width = 38%) so Lower-Left is free for the Spotlight!
      if (sceneContext?.hasSpotlight && sceneContext?.hasRightWidget) {
        x = -23;
        y = -15;
        widthPct = Math.min(widthPct || 38, 38);
        scale *= 0.88;
      } else if (sceneContext?.hasSpotlight || sceneContext?.hasRightWidget) {
        // 2) If the scene has EITHER a Spotlight on the video OR a Right-Column Widget,
        //    dock the headline to the Left Column (x = -23, y = -6, width = 40%) so the Right Stage is 100% free!
        x = -23;
        y = -6;
        widthPct = Math.min(widthPct || 40, 40);
        if ((clip.style?.fontSize || 60) > 56) {
          scale *= 0.82;
        }
      }
    }
  }

  if (clip.type === "shape") {
    const isHeroWidget =
      clip.shapeVariant === "code-card" ||
      clip.shapeVariant === "terminal-window" ||
      clip.shapeVariant === "kpi-counter" ||
      clip.shapeVariant === "bar-chart" ||
      clip.shapeVariant === "chat-simulation" ||
      clip.shapeVariant === "bento-grid" ||
      clip.shapeVariant === "spotlight-callout" ||
      clip.shapeVariant === "process-stepper" ||
      clip.shapeVariant === "split-comparison";

    if (isHeroWidget) {
      if (isPortrait) {
        x = 0;
        y = 2;
        widthPct = Math.max(widthPct || 88, 88);
        scale *= 0.92;
      } else if (isSquare) {
        x = 0;
        y = 3;
        widthPct = Math.max(widthPct || 84, 82);
      } else {
        if (Math.abs(x) < 8 && y < -8) {
          y = 3;
        }
        widthPct = widthPct || (Math.abs(x) >= 10 ? 48 : 66);
      }
    }

    if (clip.shapeVariant === "lower-third") {
      if (isPortrait) {
        x = 0;
        y = 22;
        scale *= 0.88;
      } else if (y < 14) {
        y = 21;
      }
    }

    if (clip.shapeVariant === "audio-waveform") {
      if (isPortrait) {
        x = 0;
        y = 43;
        widthPct = 86;
      }
    }
  }

  if (clip.type === "caption") {
    x = 0;
    if (isPortrait) {
      y = 34;
      scale *= 0.9;
    } else {
      y = 34;
    }
  }

  return { x, y, scale, widthPct, heightPct };
}

/**
 * R-01 & R-07 Compliant Image & Backdrop Renderer + Camera Rig + Attached Motion Overlay
 */
const ImageClipRenderer: React.FC<{
  clip: ImageClip;
  durationInFrames: number;
  direction: DesignDirectionPreset;
  sceneContext?: ActiveSceneLayoutContext;
}> = ({ clip, durationInFrames, direction, sceneContext }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  let kbScale = 1;
  let kbX = 0;
  const kb = clip.kenBurns || "none";
  if (kb === "zoom-in") {
    kbScale = interpolate(progress, [0, 1], [1, 1.05]);
  } else if (kb === "zoom-out") {
    kbScale = interpolate(progress, [0, 1], [1.05, 1]);
  } else if (kb === "pan-left") {
    kbScale = 1.04;
    kbX = interpolate(progress, [0, 1], [1.5, -1.5]);
  } else if (kb === "pan-right") {
    kbScale = 1.04;
    kbX = interpolate(progress, [0, 1], [-1.5, 1.5]);
  }

  const camRig = computeCameraRigStyle(
    clip.cameraMotion,
    frame,
    durationInFrames,
    fps
  );

  const isProcedural = !clip.src || clip.src.startsWith("procedural://");
  const { palette, radiusPx } = direction;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius:
          clip.borderRadius || camRig.isFramed3D
            ? `${clip.borderRadius || radiusPx}px`
            : undefined,
        border:
          camRig.isFramed3D || clip.cameraMotion === "split-stage-left"
            ? `1px solid ${palette.border}`
            : undefined,
        position: "relative",
        backgroundColor: palette.canvasBg,
        transform: camRig.transform !== "none" ? camRig.transform : undefined,
      }}
    >
      {/* Subtle Matte Tonal Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${palette.surfaceBg} 0%, ${palette.canvasBg} 100%)`,
          opacity: 0.7,
        }}
      />

      {/* Intentional Architectural Frame Rule (1px Structural Margin Hairline) */}
      <div
        style={{
          position: "absolute",
          inset: "42px",
          border: `1px solid ${palette.border}`,
          pointerEvents: "none",
          opacity: 0.65,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -1,
            left: -1,
            width: 24,
            height: 2,
            backgroundColor: palette.accent,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -1,
            left: -1,
            width: 2,
            height: 24,
            backgroundColor: palette.accent,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 24,
            height: 2,
            backgroundColor: palette.accent,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 2,
            height: 24,
            backgroundColor: palette.accent,
          }}
        />
      </div>

      {!isProcedural && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={clip.src}
          alt={clip.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: clip.objectFit || "cover",
            transform: `scale(${kbScale}) translateX(${kbX}%)`,
            position: "relative",
            zIndex: 1,
            opacity: 0.9,
          }}
        />
      )}

      {clip.overlayColor && (clip.overlayOpacity ?? 0) > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: clip.overlayColor,
            opacity: clip.overlayOpacity ?? 0.15,
            zIndex: 2,
          }}
        />
      )}

      {clip.motionOverlay && (
        <AttachedMotionOverlayRenderer
          overlay={clip.motionOverlay}
          durationInFrames={durationInFrames}
          direction={direction}
          sceneContext={sceneContext}
        />
      )}
    </div>
  );
};

/**
 * Normal Video Footage + Procedural Screen-Capture Footage Renderer with:
 * - Frame-locked HTML5 `<video>` playback
 * - Smart Camera Rig (`cinema-dolly`, `focus-zoom-left`, `isometric-3d-frame`, `split-stage-left`, `letterbox-cinema`)
 * - Zero-Effort Attached Motion Overlays (`spotlight-pointer`, `hud-telemetry`, `lower-chyron`, `step-annotations`, `split-compare`)
 */
const VideoClipRenderer: React.FC<{
  clip: VideoClip;
  durationInFrames: number;
  direction: DesignDirectionPreset;
  sceneContext?: ActiveSceneLayoutContext;
}> = ({ clip, durationInFrames, direction, sceneContext }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { palette, radiusPx } = direction;

  const isProceduralVideo =
    !clip.src || clip.src.startsWith("procedural-video://");

  // Keep HTML5 <video> element synchronized with the deterministic frame clock
  useEffect(() => {
    const el = videoRef.current;
    if (!el || isProceduralVideo) return;
    const targetSec =
      (frame / Math.max(1, fps)) * (clip.playbackRate || 1) +
      (clip.trimStart || 0);
    if (Math.abs(el.currentTime - targetSec) > 0.12) {
      try {
        el.currentTime = targetSec;
      } catch {
        // Ignore seek errors before metadata loads
      }
    }
  }, [frame, fps, clip.playbackRate, clip.trimStart, isProceduralVideo]);

  const camRig = computeCameraRigStyle(
    clip.cameraMotion,
    frame,
    durationInFrames,
    fps
  );

  // Subtle playhead sweep inside procedural video backdrop (purely graphical, zero competing text!)
  const playheadPct = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    [15, 85]
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: palette.canvasBg,
        borderRadius:
          clip.borderRadius ||
          camRig.isFramed3D ||
          clip.cameraMotion === "split-stage-left"
            ? `${clip.borderRadius || radiusPx}px`
            : undefined,
        border:
          camRig.isFramed3D || clip.cameraMotion === "split-stage-left"
            ? `1px solid ${palette.border}`
            : undefined,
      }}
    >
      {/* Camera Rig Viewport Transform */}
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: camRig.transform !== "none" ? camRig.transform : undefined,
          transformOrigin: "center center",
          position: "relative",
        }}
      >
        {!isProceduralVideo ? (
          <video
            ref={videoRef}
            src={clip.src}
            muted={(clip.volume ?? 1) === 0}
            loop={clip.loop ?? true}
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: clip.objectFit || "cover",
            }}
          />
        ) : (
          /* Clean Recessed Procedural Video Canvas (Purely graphical waveform + node wireframe, zero competing background text!) */
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: palette.canvasBg,
              position: "relative",
            }}
          >
            {/* Outer Architectural Frame Hairline */}
            <div
              style={{
                position: "absolute",
                inset: "42px",
                border: `1px solid ${palette.border}`,
                opacity: 0.65,
              }}
            >
              {/* Recessed Visual NLE / Telemetry Wireframe Grid (Low opacity so foreground typography is 100% crisp) */}
              <div
                style={{
                  position: "absolute",
                  inset: "48px 56px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 28,
                  opacity: 0.24,
                }}
              >
                <div
                  style={{
                    border: `1px solid ${palette.border}`,
                    borderRadius: radiusPx,
                    backgroundColor: palette.surfaceBg,
                    padding: 28,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    gap: 14,
                  }}
                >
                  {[62, 86, 48, 74].map((w, idx) => (
                    <div
                      key={idx}
                      style={{
                        height: 12,
                        backgroundColor: palette.surfaceAltBg,
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, w * Math.min(1, (frame + idx * 6) / 24))}%`,
                          height: "100%",
                          backgroundColor:
                            idx === 1 ? palette.accent : palette.border,
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    border: `1px solid ${palette.border}`,
                    borderRadius: radiusPx,
                    backgroundColor: palette.surfaceBg,
                    padding: 28,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 14,
                  }}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: 12,
                        backgroundColor: palette.surfaceAltBg,
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: 2,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: `${i * 11}%`,
                          width: `${68 - i * 8}%`,
                          top: 0,
                          bottom: 0,
                          backgroundColor:
                            i === 2 ? palette.accent : palette.border,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Animated Playhead Hairline Sweeping Across the Video Stream */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${playheadPct}%`,
                  width: 1,
                  backgroundColor: palette.accent,
                  opacity: 0.28,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Optional 2.39:1 Widescreen Cinema Letterbox Bars */}
      {camRig.isLetterbox && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "5%",
              backgroundColor: "#050505",
              borderBottom: `1px solid ${palette.border}`,
              zIndex: 8,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "5%",
              backgroundColor: "#050505",
              borderTop: `1px solid ${palette.border}`,
              zIndex: 8,
            }}
          />
        </>
      )}

      {/* Attached Motion Graphics Overlay directly on top of the Video! */}
      {clip.motionOverlay && (
        <AttachedMotionOverlayRenderer
          overlay={clip.motionOverlay}
          durationInFrames={durationInFrames}
          direction={direction}
          sceneContext={sceneContext}
        />
      )}
    </div>
  );
};

/**
 * Editorial Typography Renderer
 */
const TextClipRenderer: React.FC<{
  clip: TextClip;
  durationInFrames: number;
  direction: DesignDirectionPreset;
}> = ({ clip, durationInFrames, direction }) => {
  const frame = useCurrentFrame();
  const s = clip.style;
  const { palette, typography, radiusPx } = direction;

  let displayedText = clip.text;
  if (clip.textEffect === "typewriter") {
    const revealEnd = Math.max(10, Math.round(durationInFrames * 0.55));
    const charCount = Math.floor(
      interpolate(frame, [0, revealEnd], [0, clip.text.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    );
    displayedText = clip.text.slice(0, charCount);
  }

  const align = s.textAlign || "left";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems:
          align === "left"
            ? "flex-start"
            : align === "right"
              ? "flex-end"
              : "center",
        justifyContent: "center",
        padding: `${s.paddingY ?? 10}px ${s.paddingX ?? 20}px`,
        backgroundColor: s.backgroundColor,
        borderRadius: `${Math.min(s.borderRadius ?? radiusPx, 8)}px`,
        width: "100%",
        textAlign: align,
      }}
    >
      <div
        style={{
          fontFamily: s.fontFamily || typography.displayFont,
          fontSize: `${s.fontSize || 60}px`,
          fontWeight: s.fontWeight || "700",
          letterSpacing: typography.headlineTracking,
          lineHeight: s.lineHeight || 1.08,
          color: palette.textPrimary,
        }}
      >
        {displayedText}
      </div>
      {clip.subtext && (
        <div
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            fontSize: `${Math.round((s.fontSize || 60) * 0.35)}px`,
            fontFamily: typography.bodyFont,
            fontWeight: "500",
            color: palette.textMuted,
            lineHeight: 1.4,
            borderLeft: `3px solid ${palette.accent}`,
            paddingLeft: 14,
          }}
        >
          {clip.subtext}
        </div>
      )}
    </div>
  );
};

/**
 * Crisp Broadcast Subtitle Renderer
 */
const CaptionClipRenderer: React.FC<{
  clip: CaptionClip;
  direction: DesignDirectionPreset;
}> = ({ clip, direction }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localSec = frame / fps;
  const { palette, typography, radiusPx } = direction;

  const words =
    clip.words && clip.words.length > 0
      ? clip.words
      : clip.text.split(/\s+/).map((word, idx, arr) => {
          const step = clip.duration / Math.max(1, arr.length);
          return {
            word,
            start: idx * step,
            end: (idx + 1) * step,
          };
        });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "6px 8px",
        maxWidth: "78%",
        padding: "10px 22px",
        backgroundColor: palette.surfaceBg,
        borderRadius: radiusPx,
        border: `1px solid ${palette.border}`,
      }}
    >
      {words.map((w, i) => {
        const isActive = localSec >= w.start && localSec <= w.end + 0.05;
        const isPast = localSec > w.end;

        return (
          <span
            key={`${w.word}-${i}`}
            style={{
              display: "inline-block",
              fontFamily: typography.bodyFont,
              fontSize: `${Math.min(clip.fontSize || 32, 34)}px`,
              fontWeight: isActive ? "700" : "500",
              color: isActive
                ? palette.accentContrast
                : isPast
                  ? palette.textPrimary
                  : palette.textMuted,
              backgroundColor: isActive ? palette.accent : "transparent",
              padding: isActive ? "2px 8px" : "2px 3px",
              borderRadius: Math.max(2, radiusPx - 2),
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};

const ShapeClipRenderer: React.FC<{
  clip: ShapeClip;
  durationInFrames: number;
  direction: DesignDirectionPreset;
}> = ({ clip, durationInFrames, direction }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const { palette, typography, radiusPx } = direction;

  // 1. PROGRESS BAR
  if (clip.shapeVariant === "progress-bar") {
    return (
      <div
        style={{
          width: "100%",
          height: 6,
          backgroundColor: palette.surfaceAltBg,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            backgroundColor: palette.accent,
          }}
        />
      </div>
    );
  }

  // 2. EDITORIAL SECTION INDEX / BADGE
  if (clip.shapeVariant === "badge") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderLeft: `3px solid ${palette.accent}`,
          borderRadius: radiusPx,
        }}
      >
        <span
          style={{
            fontFamily: typography.monoFont,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: palette.textPrimary,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {clip.title || clip.name}
        </span>
      </div>
    );
  }

  // 3. LOWER THIRD
  if (clip.shapeVariant === "lower-third") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderRadius: radiusPx,
          overflow: "hidden",
          minWidth: 440,
          maxWidth: "90%",
        }}
      >
        <div
          style={{
            width: 6,
            backgroundColor: palette.accent,
          }}
        />
        <div style={{ padding: "16px 24px" }}>
          <div
            style={{
              fontFamily: typography.displayFont,
              fontSize: 28,
              fontWeight: 700,
              color: palette.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            {clip.title || "Specification Note"}
          </div>
          {clip.subtitle && (
            <div
              style={{
                marginTop: 4,
                fontSize: 18,
                fontWeight: 500,
                color: palette.textMuted,
                fontFamily: typography.monoFont,
              }}
            >
              {clip.subtitle}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. STANDALONE SPOTLIGHT CALLOUT ("spotlight-callout")
  if (clip.shapeVariant === "spotlight-callout") {
    return (
      <AttachedMotionOverlayRenderer
        overlay={{
          preset: "spotlight-pointer",
          title: clip.title || "Target Feature Callout",
          subtitle:
            clip.subtitle ||
            "Automated SVG reticle and callout pointer composited over footage",
          targetX: clip.targetX ?? -14,
          targetY: clip.targetY ?? -6,
        }}
        durationInFrames={durationInFrames}
        direction={direction}
      />
    );
  }

  // 5. ANIMATED PROCESS STEPPER ("process-stepper")
  if (clip.shapeVariant === "process-stepper") {
    const structuredSteps =
      clip.steps && clip.steps.length > 0
        ? clip.steps
        : clip.stepperItems && clip.stepperItems.length > 0
          ? clip.stepperItems.map((label, idx) => ({
              step: `0${idx + 1}`,
              title: label,
              detail: "",
            }))
          : [
              {
                step: "01",
                title: "Source Video Stream",
                detail: "30fps Frame-Locked HTML5 Video",
              },
              {
                step: "02",
                title: "Camera & Focus Rig",
                detail: "Auto Zoom, Isometric 3D & Split Stage",
              },
              {
                step: "03",
                title: "Motion Overlay Composite",
                detail: "SVG Spotlight Reticle & Stepper",
              },
            ];

    return (
      <div
        style={{
          width: "100%",
          padding: "28px 32px",
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderRadius: radiusPx,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${palette.border}`,
            paddingBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: typography.displayFont,
                fontSize: 26,
                fontWeight: 700,
                color: palette.textPrimary,
              }}
            >
              {clip.title || "Composite Video Pipeline"}
            </div>
            <div
              style={{
                fontFamily: typography.monoFont,
                fontSize: 15,
                color: palette.textMuted,
                marginTop: 2,
              }}
            >
              {clip.subtitle || "Synchronized Multi-Stage Execution"}
            </div>
          </div>
          <span
            style={{
              fontFamily: typography.monoFont,
              fontSize: 14,
              color: palette.accent,
              padding: "4px 10px",
              backgroundColor: palette.surfaceAltBg,
              border: `1px solid ${palette.border}`,
              borderRadius: radiusPx,
            }}
          >
            {structuredSteps.length} STAGES
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${structuredSteps.length}, 1fr)`,
            gap: 14,
          }}
        >
          {structuredSteps.map((sItem, idx) => {
            const stepDelay = idx * 8;
            const stepSpring = spring({
              frame: Math.max(0, frame - stepDelay),
              fps,
              config: { damping: 20, stiffness: 130 },
            });
            const isActive = frame >= stepDelay;
            return (
              <div
                key={idx}
                style={{
                  padding: "18px 16px",
                  backgroundColor: palette.surfaceAltBg,
                  border: `1px solid ${isActive ? palette.accent : palette.border}`,
                  borderTop: `3px solid ${isActive ? palette.accent : palette.border}`,
                  borderRadius: radiusPx,
                  opacity: Math.max(0.25, stepSpring),
                  transform: `translateY(${interpolate(stepSpring, [0, 1], [12, 0])}px)`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: typography.monoFont,
                    fontSize: 14,
                    fontWeight: 700,
                    color: isActive ? palette.accent : palette.textMuted,
                  }}
                >
                  STAGE {sItem.step || `0${idx + 1}`}
                </span>
                <span
                  style={{
                    fontFamily: typography.bodyFont,
                    fontSize: 19,
                    fontWeight: 600,
                    color: palette.textPrimary,
                    lineHeight: 1.3,
                  }}
                >
                  {sItem.title}
                </span>
                {sItem.detail && (
                  <span
                    style={{
                      fontFamily: typography.bodyFont,
                      fontSize: 14,
                      color: palette.textMuted,
                      lineHeight: 1.35,
                    }}
                  >
                    {sItem.detail}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 6. SPLIT COMPARISON CARD ("split-comparison")
  if (clip.shapeVariant === "split-comparison") {
    const leftTitle =
      clip.compareBeforeLabel ||
      clip.stepperItems?.[0] ||
      "Manual Keyframe NLE (High Effort)";
    const rightTitle =
      clip.compareAfterLabel ||
      clip.stepperItems?.[1] ||
      "AGVI Declarative Motion Rig (1 JSON Property)";

    return (
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          border: `1px solid ${palette.border}`,
          borderRadius: radiusPx,
          overflow: "hidden",
          backgroundColor: palette.surfaceBg,
        }}
      >
        <div
          style={{
            padding: "26px 28px",
            backgroundColor: palette.canvasBg,
            borderRight: `1px solid ${palette.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: typography.monoFont,
              fontSize: 14,
              color: palette.textMuted,
            }}
          >
            BEFORE • MANUAL WORKFLOW
          </span>
          <div
            style={{
              fontFamily: typography.displayFont,
              fontSize: 24,
              fontWeight: 700,
              color: palette.textMuted,
            }}
          >
            {leftTitle}
          </div>
          <div
            style={{
              fontFamily: typography.bodyFont,
              fontSize: 17,
              color: palette.textMuted,
              lineHeight: 1.4,
            }}
          >
            {clip.compareBeforeValue ||
              "Requires manual track layering, keyframe curves, and coordinate math for every callout."}
          </div>
        </div>

        <div
          style={{
            padding: "26px 28px",
            backgroundColor: palette.surfaceBg,
            borderTop: `3px solid ${palette.accent}`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: typography.monoFont,
              fontSize: 14,
              fontWeight: 700,
              color: palette.accent,
            }}
          >
            AFTER • DECLARATIVE MOTION RIG
          </span>
          <div
            style={{
              fontFamily: typography.displayFont,
              fontSize: 24,
              fontWeight: 700,
              color: palette.textPrimary,
            }}
          >
            {rightTitle}
          </div>
          <div
            style={{
              fontFamily: typography.bodyFont,
              fontSize: 17,
              color: palette.textPrimary,
              lineHeight: 1.4,
            }}
          >
            {clip.compareAfterValue ||
              clip.subtitle ||
              "Set cameraMotion and motionOverlay on any video clip to composite callouts automatically."}
          </div>
        </div>
      </div>
    );
  }

  // 7. HUD TELEMETRY STANDALONE ("hud-telemetry")
  if (clip.shapeVariant === "hud-telemetry") {
    return (
      <AttachedMotionOverlayRenderer
        overlay={{
          preset: "hud-telemetry",
          title: clip.title || "COMPOSITE TELEMETRY VIEW",
          subtitle: clip.subtitle || "CAMERA RIG + MOTION GRAPHICS SYNCED",
        }}
        durationInFrames={durationInFrames}
        direction={direction}
      />
    );
  }

  // 8. VERIFIED METRIC / SPECIFICATION CARD ("kpi-counter")
  if (clip.shapeVariant === "kpi-counter") {
    const rawMetric = clip.metricValue || "60 FPS";
    const numMatch = rawMetric.match(/^([+-]?)(\d+(?:\.\d+)?)(.*)$/);
    const prefix = numMatch ? numMatch[1] : "";
    const targetNum = numMatch ? parseFloat(numMatch[2]) : null;
    const suffix = numMatch ? numMatch[3] : "";
    const hasDecimal = rawMetric.includes(".");

    const countSpring = spring({
      frame,
      fps,
      config: { damping: 22, stiffness: 110 },
    });
    const currentVal =
      targetNum !== null
        ? `${prefix}${(targetNum * countSpring).toFixed(hasDecimal ? 1 : 0)}${suffix}`
        : rawMetric;

    const sparkBars = [42, 58, 64, 78, 88, 100];

    return (
      <div
        style={{
          width: "100%",
          padding: "28px 34px",
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderRadius: radiusPx,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 17,
              fontFamily: typography.monoFont,
              color: palette.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 600,
            }}
          >
            {clip.title || "VERIFIED SPECIFICATION"}
          </div>
          <div
            style={{
              fontFamily: typography.displayFont,
              fontSize: 80,
              fontWeight: 700,
              lineHeight: 1,
              color: palette.textPrimary,
              letterSpacing: "-0.04em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {currentVal}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            {clip.metricTrend && (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: Math.max(2, radiusPx - 2),
                  backgroundColor: palette.surfaceAltBg,
                  border: `1px solid ${palette.border}`,
                  color: palette.accent,
                  fontSize: 17,
                  fontWeight: 600,
                  fontFamily: typography.monoFont,
                }}
              >
                {clip.metricTrend}
              </span>
            )}
            {clip.subtitle && (
              <span style={{ fontSize: 19, color: palette.textMuted, fontWeight: 500 }}>
                {clip.subtitle}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            height: 120,
            padding: "12px 16px",
            borderRadius: radiusPx,
            backgroundColor: palette.surfaceAltBg,
            border: `1px solid ${palette.border}`,
          }}
        >
          {sparkBars.map((val, idx) => {
            const barSpring = spring({
              frame: Math.max(0, frame - idx * 3),
              fps,
              config: { damping: 18, stiffness: 130 },
            });
            const isLast = idx === sparkBars.length - 1;
            return (
              <div
                key={idx}
                style={{
                  width: 16,
                  height: `${Math.max(12, val * barSpring)}%`,
                  borderRadius: 2,
                  backgroundColor: isLast ? palette.accent : palette.textMuted,
                  opacity: isLast ? 1 : 0.45,
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // 9. STRUCTURED COMPARISON CHART ("bar-chart")
  if (clip.shapeVariant === "bar-chart") {
    const items =
      clip.chartData && clip.chartData.length > 0
        ? clip.chartData
        : [
            { label: "Track 1 • Video & Camera Rig", value: 100 },
            { label: "Track 2 • Attached Motion Overlays", value: 92 },
            { label: "Track 3 • Editorial Typography", value: 88 },
          ];

    return (
      <div
        style={{
          width: "100%",
          padding: "28px 34px",
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderRadius: radiusPx,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 22,
            paddingBottom: 14,
            borderBottom: `1px solid ${palette.border}`,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: typography.displayFont,
                fontSize: 26,
                fontWeight: 700,
                color: palette.textPrimary,
              }}
            >
              {clip.title || "Timeline Architecture Breakdown"}
            </div>
            <div
              style={{
                fontSize: 17,
                color: palette.textMuted,
                fontFamily: typography.monoFont,
                marginTop: 2,
              }}
            >
              {clip.subtitle || "Deterministic Layer Allocation"}
            </div>
          </div>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: Math.max(2, radiusPx - 2),
              backgroundColor: palette.surfaceAltBg,
              border: `1px solid ${palette.border}`,
              color: palette.accent,
              fontFamily: typography.monoFont,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            SCHEMA v1.0
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {items.map((item, idx) => {
            const barProgress = spring({
              frame: Math.max(0, frame - idx * 4),
              fps,
              config: { damping: 20, stiffness: 120 },
            });
            const widthVal = Math.min(100, Math.max(8, item.value * barProgress));
            const isFocal = idx === items.length - 1;

            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 19,
                    fontWeight: 600,
                    color: isFocal ? palette.textPrimary : palette.textMuted,
                    fontFamily: typography.bodyFont,
                  }}
                >
                  <span>{item.label}</span>
                  <span
                    style={{
                      fontFamily: typography.monoFont,
                      color: isFocal ? palette.accent : palette.textMuted,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {Math.round(item.value * barProgress)}
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 14,
                    backgroundColor: palette.surfaceAltBg,
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${widthVal}%`,
                      height: "100%",
                      backgroundColor: isFocal ? palette.accent : palette.textMuted,
                      opacity: isFocal ? 1 : 0.55,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 10. AGENT WORKFLOW TRACE ("chat-simulation")
  if (clip.shapeVariant === "chat-simulation") {
    const messages =
      clip.chatMessages && clip.chatMessages.length > 0
        ? clip.chatMessages
        : [
            {
              sender: "user" as const,
              text:
                clip.title ||
                "POST /api/agent/actions { action: 'enhance_video_with_motion' }",
            },
            {
              sender: "ai" as const,
              text:
                clip.subtitle ||
                "Attached focus-zoom camera rig and SVG spotlight pointer to video clip.",
            },
          ];

    return (
      <div
        style={{
          width: "100%",
          padding: "26px 30px",
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderRadius: radiusPx,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${palette.border}`,
            paddingBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 8,
                height: 8,
                backgroundColor: palette.accent,
              }}
            />
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: palette.textPrimary,
                fontFamily: typography.monoFont,
              }}
            >
              AGENT PIPELINE TRACE
            </span>
          </div>
          <span
            style={{
              fontSize: 16,
              color: palette.textMuted,
              fontFamily: typography.monoFont,
            }}
          >
            /api/agent/actions
          </span>
        </div>

        {messages.map((msg, idx) => {
          const msgSpring = spring({
            frame: Math.max(0, frame - idx * 8),
            fps,
            config: { damping: 20, stiffness: 130 },
          });
          const isUser = msg.sender === "user";
          return (
            <div
              key={idx}
              style={{
                opacity: Math.min(1, msgSpring * 1.4),
                transform: `translateY(${interpolate(msgSpring, [0, 1], [14, 0])}px)`,
                padding: "16px 20px",
                borderRadius: radiusPx,
                backgroundColor: isUser ? palette.surfaceAltBg : palette.canvasBg,
                border: `1px solid ${palette.border}`,
                borderLeft: isUser
                  ? `3px solid ${palette.textMuted}`
                  : `3px solid ${palette.accent}`,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontFamily: typography.monoFont,
                  color: isUser ? palette.textMuted : palette.accent,
                  fontWeight: 600,
                  marginBottom: 6,
                  letterSpacing: "0.06em",
                }}
              >
                {isUser ? "INPUT BRIEF" : "COMPILED OUTPUT"}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: palette.textPrimary,
                  lineHeight: 1.4,
                  fontFamily: typography.bodyFont,
                }}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 11. SPECIFICATION MATRIX ("bento-grid")
  if (clip.shapeVariant === "bento-grid") {
    const items =
      clip.bentoItems && clip.bentoItems.length > 0
        ? clip.bentoItems
        : [
            {
              title: "Smart Camera Rig",
              subtitle: "focus-zoom-left & isometric-3d-frame",
              metric: "01",
            },
            {
              title: "Spotlight Pointer",
              subtitle: "SVG reticle + leader line over footage",
              metric: "02",
            },
            {
              title: "Process Stepper",
              subtitle: "Sequential stage flow diagrams",
              metric: "03",
            },
            {
              title: "Scene Transitions",
              subtitle: "shutter-wipe & iris-frame reveals",
              metric: "04",
            },
          ];

    return (
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        {items.slice(0, 4).map((item, idx) => {
          const cardSpring = spring({
            frame: Math.max(0, frame - idx * 3),
            fps,
            config: { damping: 20, stiffness: 130 },
          });
          const isFocal = idx === 0;
          return (
            <div
              key={idx}
              style={{
                padding: "20px 22px",
                backgroundColor: palette.surfaceBg,
                border: `1px solid ${isFocal ? palette.accent : palette.border}`,
                borderRadius: radiusPx,
                opacity: Math.min(1, cardSpring * 1.5),
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: typography.displayFont,
                    fontSize: 22,
                    fontWeight: 700,
                    color: palette.textPrimary,
                  }}
                >
                  {item.title}
                </span>
                {item.metric && (
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: isFocal ? palette.accent : palette.textMuted,
                      fontFamily: typography.monoFont,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {item.metric}
                  </span>
                )}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 17,
                  color: palette.textMuted,
                  fontWeight: 400,
                  lineHeight: 1.35,
                }}
              >
                {item.subtitle}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 12. AUDIO LEVEL METER ("audio-waveform")
  if (clip.shapeVariant === "audio-waveform") {
    const barCount = 28;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: 48,
          padding: "8px 18px",
          borderRadius: radiusPx,
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
        }}
      >
        {Array.from({ length: barCount }).map((_, i) => {
          const wave =
            Math.abs(
              Math.sin(frame * 0.22 + i * 0.4) *
                Math.cos(frame * 0.14 - i * 0.18)
            ) *
              0.8 +
            0.18;
          return (
            <div
              key={i}
              style={{
                width: 4,
                height: `${Math.round(wave * 100)}%`,
                backgroundColor: i % 4 === 0 ? palette.accent : palette.textMuted,
                opacity: i % 4 === 0 ? 0.95 : 0.45,
              }}
            />
          );
        })}
      </div>
    );
  }

  // 13. CODE CARD & TERMINAL ARTIFACT ("code-card" | "terminal-window")
  if (
    clip.shapeVariant === "code-card" ||
    clip.shapeVariant === "terminal-window"
  ) {
    const lines = (
      clip.codeSnippet ||
      `{\n  "action": "enhance_video_with_motion",\n  "cameraMotion": "focus-zoom-left",\n  "motionOverlay": "spotlight-pointer"\n}`
    ).split("\n");
    const visibleLines = Math.max(
      1,
      Math.ceil(
        interpolate(
          frame,
          [0, Math.min(22, Math.max(5, durationInFrames * 0.35))],
          [1, lines.length],
          { extrapolateRight: "clamp" }
        )
      )
    );
    const isTerminal = clip.shapeVariant === "terminal-window";

    return (
      <div
        style={{
          width: "100%",
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderRadius: radiusPx,
          overflow: "hidden",
          fontFamily: typography.monoFont,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            backgroundColor: palette.surfaceAltBg,
            borderBottom: `1px solid ${palette.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 8,
                height: 8,
                backgroundColor: palette.accent,
              }}
            />
            <span
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: palette.textPrimary,
              }}
            >
              {clip.title || (isTerminal ? "agvi-cli" : "motion-rig.json")}
            </span>
          </div>
          <span
            style={{
              fontSize: 14,
              color: palette.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {clip.subtitle || "DECLARATIVE SPEC"}
          </span>
        </div>

        <div style={{ padding: "20px 24px", fontSize: 21, lineHeight: 1.55 }}>
          {lines.slice(0, visibleLines).map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 16 }}>
              <span
                style={{
                  color: palette.textMuted,
                  opacity: 0.5,
                  userSelect: "none",
                  minWidth: 24,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {isTerminal ? "$" : String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  color:
                    line.includes(":") || line.startsWith("POST") || line.startsWith("GET")
                      ? palette.textPrimary
                      : line.startsWith("✓") || line.includes("PASSED")
                        ? palette.accent
                        : palette.textMuted,
                  whiteSpace: "pre-wrap",
                }}
              >
                {line}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "8px 20px",
            backgroundColor: palette.canvasBg,
            borderTop: `1px solid ${palette.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 14,
            color: palette.textMuted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>AGVI NATIVE ENGINE (MIT)</span>
          <span>
            FRAME {String(frame).padStart(3, "0")}/{String(durationInFrames).padStart(3, "0")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: palette.surfaceBg,
        border: `1px solid ${palette.border}`,
        borderRadius: clip.borderRadius ? `${Math.min(clip.borderRadius, 8)}px` : undefined,
      }}
    />
  );
};

const ClipWrapper: React.FC<{
  clip: TimelineClip;
  fps: number;
  direction: DesignDirectionPreset;
  isSelected: boolean;
  onSelect?: (clipId: string) => void;
  sceneContext?: ActiveSceneLayoutContext;
}> = ({ clip, fps, direction, isSelected, onSelect, sceneContext }) => {
  const localFrame = useCurrentFrame();
  const { width: canvasW, height: canvasH } = useVideoConfig();
  const durationInFrames = Math.max(1, Math.round(clip.duration * fps));

  if (clip.type === "audio") {
    return null;
  }

  const anim = computeAnimationStyles(
    localFrame,
    durationInFrames,
    fps,
    clip.enterAnimation,
    clip.exitAnimation
  );

  const sceneTrans = computeSceneTransitionStyle(
    clip.sceneTransition,
    localFrame,
    fps
  );

  const isDockedSplitStage =
    (clip.type === "video" || clip.type === "image") &&
    clip.cameraMotion === "split-stage-left";

  const isFullCanvasBackdrop =
    !isDockedSplitStage &&
    (clip.type === "image" ||
      clip.type === "video" ||
      (clip.type === "shape" &&
        (clip.shapeVariant === "gradient-backdrop" ||
          clip.shapeVariant === "cyber-shader" ||
          clip.shapeVariant === "spotlight-callout" ||
          clip.shapeVariant === "hud-telemetry")));

  const layout = resolveResponsiveLayout(clip, canvasW, canvasH, sceneContext);

  const canvasOffsetX = isFullCanvasBackdrop ? 0 : (layout.x / 100) * canvasW;
  const canvasOffsetY = isFullCanvasBackdrop ? 0 : (layout.y / 100) * canvasH;

  const widthStyle = isFullCanvasBackdrop
    ? "100%"
    : layout.widthPct
      ? `${layout.widthPct}%`
      : "auto";
  const heightStyle = isFullCanvasBackdrop
    ? "100%"
    : layout.heightPct
      ? `${layout.heightPct}%`
      : "auto";

  const filterParts: string[] = [];
  if (anim.blurPx > 0.1 || (clip.filter?.blur ?? 0) > 0) {
    filterParts.push(
      `blur(${(anim.blurPx + (clip.filter?.blur ?? 0)).toFixed(1)}px)`
    );
  }
  const brightnessVal =
    (clip.filter?.brightness ?? 1) * (sceneTrans.extraBrightness ?? 1);
  if (Math.abs(brightnessVal - 1) > 0.02) {
    filterParts.push(`brightness(${brightnessVal.toFixed(2)})`);
  }
  if (clip.filter?.contrast !== undefined) {
    filterParts.push(`contrast(${clip.filter.contrast})`);
  }

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(clip.id);
        }}
        style={{
          pointerEvents: "auto",
          cursor: onSelect ? "pointer" : "default",
          width: widthStyle,
          height: heightStyle,
          opacity: (clip.opacity ?? 1) * anim.opacityMultiplier,
          transform: `translate3d(${canvasOffsetX + anim.translateX}px, ${canvasOffsetY + anim.translateY}px, 0) scale(${layout.scale * anim.scaleMultiplier}) rotate(${clip.transform.rotation ?? 0}deg)`,
          clipPath: sceneTrans.clipPath,
          filter: filterParts.length > 0 ? filterParts.join(" ") : undefined,
          outline: isSelected ? `2px solid ${direction.palette.accent}` : undefined,
          outlineOffset: isSelected ? "4px" : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {clip.type === "image" && (
          <ImageClipRenderer
            clip={clip}
            durationInFrames={durationInFrames}
            direction={direction}
            sceneContext={sceneContext}
          />
        )}
        {clip.type === "video" && (
          <VideoClipRenderer
            clip={clip}
            durationInFrames={durationInFrames}
            direction={direction}
            sceneContext={sceneContext}
          />
        )}
        {clip.type === "text" && (
          <TextClipRenderer
            clip={clip}
            durationInFrames={durationInFrames}
            direction={direction}
          />
        )}
        {clip.type === "caption" && (
          <CaptionClipRenderer clip={clip} direction={direction} />
        )}
        {clip.type === "shape" && (
          <ShapeClipRenderer
            clip={clip}
            durationInFrames={durationInFrames}
            direction={direction}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

export const AGVIComposition: React.FC<AGVICompositionProps> = ({
  project,
  selectedClipId,
  onSelectClip,
  showSafeZones = false,
}) => {
  const { fps } = useVideoConfig();

  const direction =
    resolveDesignDirection(
      project.agentMeta?.designDirection as string | undefined,
      `${project.name} ${project.description ?? ""}`
    ) ?? DESIGN_DIRECTION_PRESETS["swiss-industrial"];

  const visibleTracks = [...(project.tracks || [])]
    .filter((t) => !t.hidden)
    .sort((a, b) => a.zIndex - b.zIndex);

  const allVisibleClips = visibleTracks.flatMap((t) => t.clips);

  const getSceneContextForClip = (target: TimelineClip): ActiveSceneLayoutContext => {
    const midTime = target.startTime + target.duration * 0.5;
    const concurrent = allVisibleClips.filter(
      (c) => midTime >= c.startTime - 0.1 && midTime <= c.startTime + c.duration + 0.1
    );
    const hasSpotlight = concurrent.some(
      (c) =>
        ((c.type === "video" || c.type === "image") &&
          (c.motionOverlay?.preset === "spotlight-pointer" ||
            c.motionOverlay?.preset === "step-annotations")) ||
        (c.type === "shape" && c.shapeVariant === "spotlight-callout")
    );
    const hasRightWidget = concurrent.some(
      (c) =>
        c.type === "shape" &&
        c.shapeVariant !== "badge" &&
        c.shapeVariant !== "progress-bar" &&
        c.shapeVariant !== "hud-telemetry" &&
        (c.transform.x ?? 0) > 8
    );
    const hasHeadline = concurrent.some((c) => c.type === "text");
    return { hasSpotlight, hasRightWidget, hasHeadline };
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: direction.palette.canvasBg,
        overflow: "hidden",
      }}
    >
      {visibleTracks.map((track) =>
        track.clips.map((clip) => {
          const fromFrame = Math.max(0, Math.round(clip.startTime * fps));
          const durationInFrames = Math.max(1, Math.round(clip.duration * fps));
          const sceneContext = getSceneContextForClip(clip);
          return (
            <Sequence
              key={clip.id}
              from={fromFrame}
              durationInFrames={durationInFrames}
              name={`${track.name}: ${clip.name}`}
            >
              <ClipWrapper
                clip={clip}
                fps={fps}
                direction={direction}
                isSelected={selectedClipId === clip.id}
                onSelect={onSelectClip}
                sceneContext={sceneContext}
              />
            </Sequence>
          );
        })
      )}

      {showSafeZones && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            border: `1px dashed ${direction.palette.accent}`,
            margin: "5%",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
