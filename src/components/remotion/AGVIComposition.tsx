"use client";

import React, { useEffect, useRef } from "react";
import {
  AbsoluteFill,
  Sequence,
  computeCameraShake,
  computeMotionVelocity,
  evaluateClipKeyframes,
  evaluateEasing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "../../lib/engine/agvi-engine";
import {
  ActiveSceneLayoutContext,
  computeAnimationStyles,
  computeCameraRigStyle,
  computeSceneTransitionStyle,
  resolveResponsiveLayout,
} from "../../lib/engine/keyframe-evaluator";
import { ProceduralWebGL3DCanvas } from "../../lib/engine/webgl-stage";
import {
  AGVIProject,
  CaptionClip,
  ImageClip,
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

  // 6. 3D PARALLAX GRID & DEPTH HORIZON OVERLAY
  if (overlay.preset === "3d-parallax-grid") {
    const camZ = (frame * 14) % 120;
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          zIndex: 8,
          perspective: "1100px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "-20%",
            right: "-20%",
            bottom: "-30%",
            height: "75%",
            transform: `rotateX(68deg) translateY(${camZ}px)`,
            transformOrigin: "center top",
            backgroundImage: `linear-gradient(to right, ${palette.border} 1px, transparent 1px), linear-gradient(to bottom, ${palette.border} 1px, transparent 1px)`,
            backgroundSize: "120px 120px",
            opacity: 0.45,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 42,
            right: 52,
            padding: "6px 14px",
            backgroundColor: palette.surfaceBg,
            border: `1px solid ${palette.accent}`,
            borderRadius: radiusPx,
            fontFamily: typography.monoFont,
            fontSize: 13,
            fontWeight: 700,
            color: palette.accent,
          }}
        >
          {overlay.title || "3D STAGE PARALLAX • Z-DEPTH RIG"}
        </div>
      </AbsoluteFill>
    );
  }

  return null;
};

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
 * Normal Video Footage + Procedural Screen-Capture & WebGL 3D Stage Renderer with:
 * - Frame-locked HTML5 `<video>` playback
 * - Frame-locked WebGL / 3D wireframe stage (`procedural-video://webgl-3d-prism`, `procedural-video://webgl-3d-tunnel`)
 * - Smart Camera Rig (`cinema-dolly`, `focus-zoom-left`, `isometric-3d-frame`, `orbit-3d-left`, `fly-through-z`, `whip-pan-3d`, `hyper-push-in`)
 * - Zero-Effort Attached Motion Overlays (`spotlight-pointer`, `hud-telemetry`, `lower-chyron`, `step-annotations`, `split-compare`, `3d-parallax-grid`)
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
  const isWebGL3DScene =
    clip.src?.startsWith("procedural-video://webgl-3d") ||
    clip.cameraMotion === "orbit-3d-left" ||
    clip.cameraMotion === "orbit-3d-right" ||
    clip.cameraMotion === "fly-through-z" ||
    clip.cameraMotion === "whip-pan-3d" ||
    clip.cameraMotion === "hyper-push-in";

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
        ) : isWebGL3DScene ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: palette.canvasBg,
              position: "relative",
            }}
          >
            <ProceduralWebGL3DCanvas
              mode={clip.src || "webgl-3d-prism"}
              frame={frame}
              fps={fps}
              palette={palette}
            />
          </div>
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
 * Editorial & High-Tempo 3D Kinetic Typography Renderer
 * Supports:
 * - `none` / `typewriter`
 * - `kinetic-char-3d` (Per-word/character 3D rotateX/translateZ cascade with whip velocity)
 * - `kinetic-word-stomp` (High-energy sequential word stomp with scale impact)
 * - `split-mask-reveal` (Editorial architectural baseline mask reveal)
 * - `glitch-decode` (Deterministic cipher decode into crisp headline)
 */
const TextClipRenderer: React.FC<{
  clip: TextClip;
  durationInFrames: number;
  direction: DesignDirectionPreset;
}> = ({ clip, durationInFrames, direction }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = clip.style;
  const { palette, typography, radiusPx } = direction;
  const align = s.textAlign || "left";
  const effect = clip.textEffect || "none";

  const words = (clip.text || "").split(/\s+/).filter(Boolean);

  const renderKineticContent = () => {
    if (effect === "typewriter") {
      const revealEnd = Math.max(10, Math.round(durationInFrames * 0.55));
      const charCount = Math.floor(
        interpolate(frame, [0, revealEnd], [0, clip.text.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      );
      return clip.text.slice(0, charCount);
    }

    if (effect === "glitch-decode") {
      const glyphs = "01/#XΔΣΞΩ%+=-";
      const decodeFrames = Math.max(12, Math.round(fps * 0.55));
      return clip.text
        .split("")
        .map((ch, idx) => {
          if (ch === " ") return " ";
          const charThreshold = (idx / Math.max(1, clip.text.length)) * decodeFrames;
          if (frame >= charThreshold + 4) return ch;
          if (frame < charThreshold - 3) return "";
          return glyphs[(frame * 7 + idx * 13) % glyphs.length];
        })
        .join("");
    }

    if (effect === "kinetic-char-3d") {
      return (
        <span
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: "0.24em",
            perspective: "900px",
            transformStyle: "preserve-3d",
          }}
        >
          {words.map((word, wIdx) => {
            const delay = wIdx * 2;
            const localF = Math.max(0, frame - delay);
            const rawT = Math.min(1, localF / Math.max(6, Math.round(fps * 0.38)));
            const eased = evaluateEasing("back-out", rawT);
            const rotX = (1 - eased) * -88;
            const tz = (1 - eased) * -140;
            const ty = (1 - eased) * 28;
            const isFocalWord = wIdx === words.length - 1 && words.length > 2;
            return (
              <span
                key={wIdx}
                style={{
                  display: "inline-block",
                  opacity: Math.min(1, rawT * 2.2),
                  transform: `translate3d(0px, ${ty.toFixed(1)}px, ${tz.toFixed(1)}px) rotateX(${rotX.toFixed(1)}deg)`,
                  transformOrigin: "center bottom",
                  color: isFocalWord ? palette.accent : palette.textPrimary,
                }}
              >
                {word}
              </span>
            );
          })}
        </span>
      );
    }

    if (effect === "kinetic-word-stomp") {
      return (
        <span
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: "0.24em",
          }}
        >
          {words.map((word, wIdx) => {
            const delay = wIdx * 3;
            const localF = Math.max(0, frame - delay);
            const stomp = spring({
              frame: localF,
              fps,
              config: { damping: 12, stiffness: 250, mass: 0.7 },
            });
            const scaleVal = localF === 0 ? 2.2 : 2.2 - 1.2 * stomp;
            const opVal = Math.min(1, localF / 3);
            const isAccent = wIdx === 0 || wIdx === words.length - 1;
            return (
              <span
                key={wIdx}
                style={{
                  display: "inline-block",
                  opacity: opVal,
                  transform: `scale(${scaleVal.toFixed(3)})`,
                  color: isAccent ? palette.accent : palette.textPrimary,
                }}
              >
                {word}
              </span>
            );
          })}
        </span>
      );
    }

    if (effect === "split-mask-reveal") {
      return (
        <span
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: "0.24em",
          }}
        >
          {words.map((word, wIdx) => {
            const delay = wIdx * 2;
            const localF = Math.max(0, frame - delay);
            const rawT = Math.min(1, localF / Math.max(6, Math.round(fps * 0.35)));
            const whip = evaluateEasing("expo-out", rawT);
            const yPct = (1 - whip) * 105;
            return (
              <span
                key={wIdx}
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  verticalAlign: "bottom",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transform: `translateY(${yPct.toFixed(1)}%)`,
                  }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </span>
      );
    }

    if (effect === "gradient") {
      return (
        <span
          style={{
            backgroundImage: `linear-gradient(95deg, ${s.color || palette.textPrimary} 0%, ${palette.accent} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {clip.text}
        </span>
      );
    }

    return clip.text;
  };

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
          color: s.color || palette.textPrimary,
          textShadow:
            effect === "neon-glow" ? `0 0 18px ${palette.accent}66` : undefined,
        }}
      >
        {renderKineticContent()}
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
  const activeAccent = clip.highlightColor || palette.accent;
  const isCinematic = clip.preset === "cinematic";
  const isTikTokPop = clip.preset === "tiktok-pop";

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
        gap: isCinematic ? "8px 12px" : "6px 8px",
        maxWidth: "82%",
        padding: isCinematic ? "12px 28px" : "10px 22px",
        backgroundColor: clip.backgroundColor || palette.surfaceBg,
        borderRadius: isCinematic ? 2 : radiusPx,
        border: `1px solid ${palette.border}`,
        borderBottom: isCinematic ? `2px solid ${activeAccent}` : undefined,
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
              fontFamily: isCinematic
                ? typography.displayFont
                : typography.bodyFont,
              fontSize: `${Math.min(clip.fontSize || 32, 36)}px`,
              fontWeight: isActive ? "800" : "500",
              letterSpacing: isCinematic ? "0.04em" : undefined,
              textTransform: isCinematic ? "uppercase" : undefined,
              color: isActive
                ? palette.accentContrast
                : isPast
                  ? clip.textColor || palette.textPrimary
                  : palette.textMuted,
              backgroundColor: isActive ? activeAccent : "transparent",
              padding: isActive ? "2px 8px" : "2px 3px",
              borderRadius: Math.max(2, radiusPx - 2),
              transform:
                isTikTokPop && isActive ? "scale(1.08)" : "scale(1)",
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
  const accentColor = clip.accentColor || palette.accent;

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
            backgroundColor: accentColor,
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
          borderLeft: `3px solid ${accentColor}`,
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
            backgroundColor: accentColor,
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
              color: accentColor,
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
                  border: `1px solid ${isActive ? accentColor : palette.border}`,
                  borderTop: `3px solid ${isActive ? accentColor : palette.border}`,
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
                    color: isActive ? accentColor : palette.textMuted,
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
            borderTop: `3px solid ${accentColor}`,
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
              color: accentColor,
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
                  color: accentColor,
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
                  backgroundColor: isLast ? accentColor : palette.textMuted,
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
              color: accentColor,
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
                      color: isFocal ? accentColor : palette.textMuted,
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
                      backgroundColor: isFocal ? accentColor : palette.textMuted,
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
                backgroundColor: accentColor,
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
                  : `3px solid ${accentColor}`,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontFamily: typography.monoFont,
                  color: isUser ? palette.textMuted : accentColor,
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
                border: `1px solid ${isFocal ? accentColor : palette.border}`,
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
                      color: isFocal ? accentColor : palette.textMuted,
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
                backgroundColor: i % 4 === 0 ? accentColor : palette.textMuted,
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
                backgroundColor: accentColor,
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
                        ? accentColor
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

  // 14. 3D CAROUSEL STACK ("3d-carousel-stack") — Multi-card Z-depth stack with 3D perspective orbit
  if (clip.shapeVariant === "3d-carousel-stack") {
    const cards =
      clip.bentoItems && clip.bentoItems.length > 0
        ? clip.bentoItems
        : [
            {
              title: "3D Camera Stage & Z-Depth",
              subtitle: "Orbit, whip-pan & fly-through across multi-plane Z-space",
              metric: "Z:-400..+300",
            },
            {
              title: "Velocity Graph Keyframes",
              subtitle: "Multi-point keyframes with whip, expo-out & elastic curves",
              metric: "SPEED GRAPH",
            },
            {
              title: "Kinetic Blur & RGB Split",
              subtitle: "Velocity-driven directional shutter blur & camera impact shake",
              metric: "30/60 FPS",
            },
          ];

    return (
      <div
        style={{
          width: "100%",
          minHeight: 280,
          perspective: "1200px",
          transformStyle: "preserve-3d",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {cards.slice(0, 3).map((card, idx) => {
          const delay = idx * 5;
          const localF = Math.max(0, frame - delay);
          const rawT = Math.min(1, localF / Math.max(8, Math.round(fps * 0.45)));
          const whip = evaluateEasing("back-out", rawT);
          const zOffset = (1 - whip) * -280 + (2 - idx) * 18;
          const rotY = (1 - whip) * 28 - idx * 3;
          const rotX = (1 - whip) * -14;
          const isFront = idx === 0;
          return (
            <div
              key={idx}
              style={{
                padding: "20px 24px",
                backgroundColor: palette.surfaceBg,
                border: `1px solid ${isFront ? accentColor : palette.border}`,
                borderLeft: `4px solid ${isFront ? accentColor : palette.border}`,
                borderRadius: radiusPx,
                opacity: Math.min(1, rawT * 1.8),
                transform: `translate3d(${idx * 10}px, 0px, ${zOffset.toFixed(1)}px) rotateY(${rotY.toFixed(1)}deg) rotateX(${rotX.toFixed(1)}deg)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: typography.displayFont,
                    fontSize: 23,
                    fontWeight: 700,
                    color: palette.textPrimary,
                  }}
                >
                  {card.title}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: typography.bodyFont,
                    fontSize: 16,
                    color: palette.textMuted,
                  }}
                >
                  {card.subtitle}
                </div>
              </div>
              <span
                style={{
                  padding: "5px 11px",
                  borderRadius: radiusPx,
                  backgroundColor: palette.surfaceAltBg,
                  border: `1px solid ${isFront ? accentColor : palette.border}`,
                  fontFamily: typography.monoFont,
                  fontSize: 14,
                  fontWeight: 700,
                  color: isFront ? accentColor : palette.textMuted,
                  whiteSpace: "nowrap",
                }}
              >
                {card.metric || `LAYER 0${idx + 1}`}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // 15. KINETIC IMPACT WALL ("kinetic-impact-wall") — High-tempo rhythmic typography & telemetry wall
  if (clip.shapeVariant === "kinetic-impact-wall") {
    const words = (
      clip.title || "TRUE 3D STAGE • VELOCITY GRAPH • KINETIC MOTION BLUR"
    )
      .split(/[•|/]/)
      .map((s) => s.trim())
      .filter(Boolean);

    return (
      <div
        style={{
          width: "100%",
          padding: "26px 30px",
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderTop: `3px solid ${accentColor}`,
          borderRadius: radiusPx,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          perspective: "1000px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: typography.monoFont,
            fontSize: 13,
            color: accentColor,
            letterSpacing: "0.08em",
          }}
        >
          <span>{clip.subtitle || "HIGH-TEMPO KINETIC SEQUENCE"}</span>
          <span>F:{String(frame).padStart(3, "0")}</span>
        </div>
        {words.map((rowText, idx) => {
          const delay = idx * 4;
          const localF = Math.max(0, frame - delay);
          const rawT = Math.min(1, localF / 10);
          const whip = evaluateEasing("whip", rawT);
          const tx = (1 - whip) * (idx % 2 === 0 ? -120 : 120);
          const isHighlight = idx === words.length - 1;
          return (
            <div
              key={idx}
              style={{
                padding: "12px 18px",
                backgroundColor: isHighlight ? accentColor : palette.surfaceAltBg,
                color: isHighlight ? palette.accentContrast : palette.textPrimary,
                borderRadius: Math.max(2, radiusPx - 2),
                fontFamily: typography.displayFont,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                textTransform: "uppercase",
                opacity: Math.min(1, rawT * 2),
                transform: `translate3d(${tx.toFixed(1)}px, 0px, 0px)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{rowText}</span>
              <span
                style={{
                  fontFamily: typography.monoFont,
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                0{idx + 1}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // 16. 3D WIREFRAME PRISM WIDGET ("3d-wireframe-prism") — Interactive 3D geometry artifact card
  if (clip.shapeVariant === "3d-wireframe-prism") {
    return (
      <div
        style={{
          width: "100%",
          height: 310,
          backgroundColor: palette.surfaceBg,
          border: `1px solid ${palette.border}`,
          borderRadius: radiusPx,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "10px 18px",
            backgroundColor: palette.surfaceAltBg,
            borderBottom: `1px solid ${palette.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: typography.monoFont,
            fontSize: 14,
          }}
        >
          <span style={{ color: palette.textPrimary, fontWeight: 700 }}>
            {clip.title || "WEBGL 3D MESH STAGE"}
          </span>
          <span style={{ color: accentColor }}>
            {clip.subtitle || "6-DOF PERSPECTIVE"}
          </span>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <ProceduralWebGL3DCanvas
            mode="webgl-3d-prism"
            frame={frame}
            fps={fps}
            palette={palette}
          />
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

  const prevAnim = computeAnimationStyles(
    Math.max(0, localFrame - 1),
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

  // Evaluate multi-point After Effects keyframe track if present
  const normProgress = localFrame / Math.max(1, durationInFrames - 1);
  const prevNormProgress = Math.max(0, localFrame - 1) / Math.max(1, durationInFrames - 1);

  const defaultKfState = {
    x: layout.x,
    y: layout.y,
    z: clip.transform.z ?? 0,
    scale: layout.scale,
    rotation: clip.transform.rotation ?? 0,
    rotateX: clip.transform.rotateX ?? 0,
    rotateY: clip.transform.rotateY ?? 0,
    opacity: clip.opacity ?? 1,
    blur: clip.filter?.blur ?? 0,
  };

  const kfCurr = evaluateClipKeyframes(clip.keyframes, normProgress, defaultKfState);
  const kfPrev = evaluateClipKeyframes(clip.keyframes, prevNormProgress, defaultKfState);

  const canvasOffsetX = isFullCanvasBackdrop ? 0 : (kfCurr.x / 100) * canvasW;
  const canvasOffsetY = isFullCanvasBackdrop ? 0 : (kfCurr.y / 100) * canvasH;
  const prevCanvasOffsetX = isFullCanvasBackdrop ? 0 : (kfPrev.x / 100) * canvasW;
  const prevCanvasOffsetY = isFullCanvasBackdrop ? 0 : (kfPrev.y / 100) * canvasH;

  // Compute instantaneous velocity for automatic directional motion blur & RGB split
  const velocity = computeMotionVelocity(
    {
      x: prevCanvasOffsetX + prevAnim.translateX,
      y: prevCanvasOffsetY + prevAnim.translateY,
      z: kfPrev.z + prevAnim.translateZ,
      scale: kfPrev.scale * prevAnim.scaleMultiplier,
      rotation: kfPrev.rotation + prevAnim.rotateZ,
      rotateX: kfPrev.rotateX + prevAnim.rotateX,
      rotateY: kfPrev.rotateY + prevAnim.rotateY,
    },
    {
      x: canvasOffsetX + anim.translateX,
      y: canvasOffsetY + anim.translateY,
      z: kfCurr.z + anim.translateZ,
      scale: kfCurr.scale * anim.scaleMultiplier,
      rotation: kfCurr.rotation + anim.rotateZ,
      rotateX: kfCurr.rotateX + anim.rotateX,
      rotateY: kfCurr.rotateY + anim.rotateY,
    }
  );

  // Camera impact shake on clip entrance if configured
  const shakeIntensity = clip.filter?.cameraShake ?? 0;
  const shake = computeCameraShake(localFrame, fps, shakeIntensity, 14);

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

  const motionBlurMult = clip.filter?.motionBlur ?? (direction.id === "kinetic-3d-keynote" ? 0.6 : 0);
  const velocityBlurPx = Math.min(16, velocity.speed * 0.08 * motionBlurMult);
  const totalBlurPx =
    anim.blurPx +
    kfCurr.blur +
    (sceneTrans.extraBlurPx ?? 0) +
    velocityBlurPx;

  const filterParts: string[] = [];
  if (totalBlurPx > 0.15) {
    filterParts.push(`blur(${totalBlurPx.toFixed(1)}px)`);
  }
  const brightnessVal =
    (clip.filter?.brightness ?? 1) * (sceneTrans.extraBrightness ?? 1);
  if (Math.abs(brightnessVal - 1) > 0.02) {
    filterParts.push(`brightness(${brightnessVal.toFixed(2)})`);
  }
  if (clip.filter?.contrast !== undefined) {
    filterParts.push(`contrast(${clip.filter.contrast})`);
  }
  if (clip.filter?.saturate !== undefined) {
    filterParts.push(`saturate(${clip.filter.saturate})`);
  }
  if (clip.filter?.grayscale !== undefined) {
    filterParts.push(`grayscale(${clip.filter.grayscale})`);
  }

  // Chromatic aberration RGB split shadow on high-velocity movement (directional along velocity vector)
  const chromaMult =
    clip.filter?.chromaticAberration ??
    (direction.id === "kinetic-3d-keynote" ? 0.5 : 0);
  const chromaShift = Math.min(10, (velocity.speed * 0.08 + 1.5) * chromaMult);
  const velNorm = Math.max(1, Math.hypot(velocity.vx, velocity.vy));
  const dirX = Math.abs(velocity.vx) > 0.2 ? velocity.vx / velNorm : 1;
  const dirY = Math.abs(velocity.vy) > 0.2 ? velocity.vy / velNorm : 0;
  const chromaDx = chromaShift * dirX;
  const chromaDy = chromaShift * dirY;

  // Directional motion stretch along velocity vector on high-speed whip transitions
  const motionStretchX =
    velocityBlurPx > 1.5 && !isFullCanvasBackdrop
      ? 1 + Math.min(0.08, Math.abs(velocity.vx) * 0.0008 * motionBlurMult)
      : 1;
  const motionStretchY =
    velocityBlurPx > 1.5 && !isFullCanvasBackdrop
      ? 1 + Math.min(0.06, Math.abs(velocity.vy) * 0.0008 * motionBlurMult)
      : 1;

  const finalTx = canvasOffsetX + anim.translateX + shake.dx;
  const finalTy = canvasOffsetY + anim.translateY + shake.dy;
  const finalTz = kfCurr.z + anim.translateZ;
  const finalRotX = kfCurr.rotateX + anim.rotateX;
  const finalRotY = kfCurr.rotateY + anim.rotateY;
  const finalRotZ = kfCurr.rotation + anim.rotateZ + shake.drot;
  const finalScale = kfCurr.scale * anim.scaleMultiplier;

  const baseTransform3D = `perspective(1400px) translate3d(${finalTx.toFixed(1)}px, ${finalTy.toFixed(1)}px, ${finalTz.toFixed(1)}px) rotateX(${finalRotX.toFixed(2)}deg) rotateY(${finalRotY.toFixed(2)}deg) rotateZ(${finalRotZ.toFixed(2)}deg) scale3d(${(finalScale * motionStretchX).toFixed(3)}, ${(finalScale * motionStretchY).toFixed(3)}, 1)`;
  const combinedTransform = sceneTrans.extraTransform3D
    ? `${baseTransform3D} ${sceneTrans.extraTransform3D}`
    : baseTransform3D;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        transformStyle: "preserve-3d",
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
          opacity: kfCurr.opacity * anim.opacityMultiplier,
          transform: combinedTransform,
          transformStyle: "preserve-3d",
          clipPath: sceneTrans.clipPath,
          filter: filterParts.length > 0 ? filterParts.join(" ") : undefined,
          textShadow:
            chromaShift > 0.6 && (clip.type === "text" || clip.type === "caption")
              ? `${(-chromaDx).toFixed(1)}px ${(-chromaDy).toFixed(1)}px 0px rgba(255, 50, 50, 0.78), ${chromaDx.toFixed(1)}px ${chromaDy.toFixed(1)}px 0px rgba(0, 220, 255, 0.78)`
              : undefined,
          boxShadow:
            chromaShift > 0.8 && clip.type === "shape" && !isFullCanvasBackdrop
              ? `${(-chromaDx * 0.85).toFixed(1)}px ${(-chromaDy * 0.85).toFixed(1)}px 0px rgba(255, 50, 50, 0.45), ${(chromaDx * 0.85).toFixed(1)}px ${(chromaDy * 0.85).toFixed(1)}px 0px rgba(0, 220, 255, 0.45)`
              : undefined,
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
        backgroundColor:
          project.canvas.backgroundColor || direction.palette.canvasBg,
        overflow: "hidden",
        perspective: "1600px",
        transformStyle: "preserve-3d",
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
