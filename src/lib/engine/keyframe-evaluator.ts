import {
  computeCameraShake,
  computeMotionVelocity,
  evaluateClipKeyframes,
  evaluateEasing,
  interpolate,
  spring,
} from "./agvi-engine";
import {
  AGVIProject,
  CameraMotionEffect,
  ClipAnimation,
  SceneTransitionEffect,
  TimelineClip,
} from "../schema/timeline-schema";
import { DesignDirectionPreset } from "../anti-slop/anti-slop-filter";

export interface ActiveSceneLayoutContext {
  hasSpotlight: boolean;
  hasRightWidget: boolean;
  hasHeadline: boolean;
}

export interface EvaluatedAnimationStyles {
  opacityMultiplier: number;
  translateX: number;
  translateY: number;
  translateZ: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scaleMultiplier: number;
  blurPx: number;
}

/**
 * High-tempo & editorial motion curves supporting both restrained transitions and
 * After Effects-style 3D / whip / slam kinetic choreography.
 */
export function computeAnimationStyles(
  localFrame: number,
  durationInFrames: number,
  fps: number,
  enter: ClipAnimation,
  exit: ClipAnimation
): EvaluatedAnimationStyles {
  let opacityMultiplier = 1;
  let translateX = 0;
  let translateY = 0;
  let translateZ = 0;
  let rotateX = 0;
  let rotateY = 0;
  let rotateZ = 0;
  let scaleMultiplier = 1;
  let blurPx = 0;

  const enterFrames = Math.max(1, Math.round((enter?.duration || 0.3) * fps));
  const exitFrames = Math.max(1, Math.round((exit?.duration || 0.25) * fps));

  if (enter && enter.type !== "none" && localFrame <= enterFrames) {
    const rawProgress = interpolate(localFrame, [0, enterFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const easedProgress = evaluateEasing(enter.easing || "expo-out", rawProgress);
    const springVal = spring({
      frame: localFrame,
      fps,
      config: { damping: 20, stiffness: 170, mass: 0.85 },
    });
    const stompSpring = spring({
      frame: localFrame,
      fps,
      config: { damping: 11, stiffness: 240, mass: 0.7 },
    });

    switch (enter.type) {
      case "fade":
        opacityMultiplier *= rawProgress;
        break;
      case "slide-up":
        opacityMultiplier *= rawProgress;
        translateY += interpolate(springVal, [0, 1], [36, 0]);
        break;
      case "slide-down":
        opacityMultiplier *= rawProgress;
        translateY += interpolate(springVal, [0, 1], [-36, 0]);
        break;
      case "slide-left":
        opacityMultiplier *= rawProgress;
        translateX += interpolate(springVal, [0, 1], [-52, 0]);
        break;
      case "slide-right":
        opacityMultiplier *= rawProgress;
        translateX += interpolate(springVal, [0, 1], [52, 0]);
        break;
      case "zoom-in":
        opacityMultiplier *= rawProgress;
        scaleMultiplier *= interpolate(springVal, [0, 1], [0.92, 1]);
        break;
      case "zoom-out":
        opacityMultiplier *= rawProgress;
        scaleMultiplier *= interpolate(springVal, [0, 1], [1.08, 1]);
        break;
      case "pop-spring":
        opacityMultiplier *= Math.min(1, rawProgress * 1.4);
        scaleMultiplier *= interpolate(springVal, [0, 1], [0.88, 1]);
        break;
      case "blur-in":
        opacityMultiplier *= rawProgress;
        blurPx += interpolate(rawProgress, [0, 1], [10, 0]);
        break;
      case "whip-left": {
        const whip = evaluateEasing(enter.easing || "whip", rawProgress);
        opacityMultiplier *= Math.min(1, rawProgress * 2.2);
        translateX += (1 - whip) * -420;
        blurPx += (1 - Math.abs(rawProgress * 2 - 1)) * 14;
        break;
      }
      case "whip-right": {
        const whip = evaluateEasing(enter.easing || "whip", rawProgress);
        opacityMultiplier *= Math.min(1, rawProgress * 2.2);
        translateX += (1 - whip) * 420;
        blurPx += (1 - Math.abs(rawProgress * 2 - 1)) * 14;
        break;
      }
      case "whip-up": {
        const whip = evaluateEasing(enter.easing || "whip", rawProgress);
        opacityMultiplier *= Math.min(1, rawProgress * 2.2);
        translateY += (1 - whip) * 320;
        blurPx += (1 - Math.abs(rawProgress * 2 - 1)) * 12;
        break;
      }
      case "3d-flip-x": {
        opacityMultiplier *= Math.min(1, rawProgress * 2);
        rotateX += (1 - easedProgress) * -85;
        translateZ += (1 - easedProgress) * -280;
        break;
      }
      case "3d-flip-y": {
        opacityMultiplier *= Math.min(1, rawProgress * 2);
        rotateY += (1 - easedProgress) * 85;
        translateZ += (1 - easedProgress) * -280;
        break;
      }
      case "3d-fly-through": {
        opacityMultiplier *= Math.min(1, rawProgress * 1.8);
        translateZ += (1 - easedProgress) * -950;
        rotateX += (1 - easedProgress) * 18;
        scaleMultiplier *= interpolate(easedProgress, [0, 1], [0.45, 1]);
        blurPx += (1 - easedProgress) * 10;
        break;
      }
      case "kinetic-slam": {
        opacityMultiplier *= Math.min(1, rawProgress * 2.8);
        scaleMultiplier *= interpolate(stompSpring, [0, 1], [2.1, 1]);
        translateZ += (1 - stompSpring) * 320;
        blurPx += Math.max(0, (1 - rawProgress * 1.6) * 12);
        break;
      }
      case "elastic-stomp": {
        const el = evaluateEasing(enter.easing || "elastic", rawProgress);
        opacityMultiplier *= Math.min(1, rawProgress * 2.2);
        scaleMultiplier *= 0.4 + 0.6 * el;
        translateY += (1 - el) * -90;
        rotateZ += (1 - el) * -6;
        break;
      }
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
    const easedExit = evaluateEasing(exit.easing || "expo-in", exitProgress);
    opacityMultiplier *= 1 - exitProgress;
    if (exit.type === "slide-down" || exit.type === "whip-up") {
      translateY += interpolate(easedExit, [0, 1], [0, 60]);
    } else if (exit.type === "whip-left") {
      translateX += interpolate(easedExit, [0, 1], [0, -340]);
      blurPx += easedExit * 12;
    } else if (exit.type === "whip-right") {
      translateX += interpolate(easedExit, [0, 1], [0, 340]);
      blurPx += easedExit * 12;
    } else if (exit.type === "3d-fly-through") {
      translateZ += interpolate(easedExit, [0, 1], [0, 620]);
      scaleMultiplier *= interpolate(easedExit, [0, 1], [1, 1.5]);
      blurPx += easedExit * 10;
    } else if (exit.type === "zoom-out") {
      scaleMultiplier *= interpolate(easedExit, [0, 1], [1, 0.88]);
    }
  }

  return {
    opacityMultiplier,
    translateX,
    translateY,
    translateZ,
    rotateX,
    rotateY,
    rotateZ,
    scaleMultiplier,
    blurPx,
  };
}

/**
 * Computes declarative Scene Entrance Transition styles (`shutter-wipe`, `editorial-curtain`, `iris-frame`, `flash-cut`, `whip-blur-cut`, `3d-cube-spin`, `glitch-slice`, `zoom-punch`).
 */
export function computeSceneTransitionStyle(
  transition: SceneTransitionEffect | undefined,
  localFrame: number,
  fps: number
): {
  clipPath?: string;
  extraBrightness?: number;
  extraBlurPx?: number;
  extraTransform3D?: string;
  wipeProgress?: number;
} {
  if (!transition || transition === "none") return {};
  const transFrames = Math.max(6, Math.round(fps * 0.45));
  if (localFrame >= transFrames) return {};

  const rawT = localFrame / Math.max(1, transFrames);
  const p = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  switch (transition) {
    case "shutter-wipe": {
      const rightInset = Math.max(0, (1 - p) * 100);
      return {
        clipPath: `inset(0% ${rightInset.toFixed(1)}% 0% 0%)`,
        wipeProgress: p,
      };
    }
    case "editorial-curtain": {
      const vInset = Math.max(0, (1 - p) * 50);
      return {
        clipPath: `inset(${vInset.toFixed(1)}% 0% ${vInset.toFixed(1)}% 0%)`,
        wipeProgress: p,
      };
    }
    case "iris-frame": {
      const inset = Math.max(0, (1 - p) * 38);
      return {
        clipPath: `inset(${inset.toFixed(1)}% ${inset.toFixed(1)}% ${inset.toFixed(1)}% ${inset.toFixed(1)}% round 6px)`,
        wipeProgress: p,
      };
    }
    case "flash-cut": {
      const flash = interpolate(localFrame, [0, 8], [1.65, 1], {
        extrapolateRight: "clamp",
      });
      return { extraBrightness: flash, wipeProgress: p };
    }
    case "whip-blur-cut": {
      const whip = evaluateEasing("whip", rawT);
      const tx = (1 - whip) * -280;
      const blur = (1 - Math.abs(rawT * 2 - 1)) * 18;
      return {
        extraBlurPx: blur,
        extraTransform3D: `translate3d(${tx.toFixed(1)}px, 0px, 0px) skewX(${((1 - whip) * -12).toFixed(1)}deg)`,
        wipeProgress: whip,
      };
    }
    case "3d-cube-spin": {
      const rotY = (1 - p) * -88;
      const tz = (1 - p) * -320;
      return {
        extraTransform3D: `rotateY(${rotY.toFixed(1)}deg) translateZ(${tz.toFixed(1)}px)`,
        wipeProgress: p,
      };
    }
    case "zoom-punch": {
      const punch = evaluateEasing("back-out", rawT);
      const sc = 1.65 - 0.65 * punch;
      const blur = Math.max(0, (1 - rawT * 1.5) * 12);
      return {
        extraBlurPx: blur,
        extraBrightness: 1 + (1 - rawT) * 0.35,
        extraTransform3D: `scale(${sc.toFixed(3)})`,
        wipeProgress: punch,
      };
    }
    case "glitch-slice": {
      const jitterX = Math.sin(localFrame * 9.3) * (1 - rawT) * 28;
      const topInset = ((localFrame * 17) % 35) * (1 - rawT);
      return {
        extraBrightness: localFrame % 2 === 0 ? 1.35 : 0.92,
        extraTransform3D: `translate3d(${jitterX.toFixed(1)}px, 0px, 0px)`,
        clipPath: `inset(${topInset.toFixed(1)}% 0% 0% 0%)`,
        wipeProgress: rawT,
      };
    }
    default:
      return {};
  }
}

/**
 * Computes declarative Smart 2D & 3D Camera Rig transforms.
 */
export function computeCameraRigStyle(
  cameraMotion: CameraMotionEffect | undefined,
  localFrame: number,
  durationInFrames: number,
  fps: number
): {
  transform: string;
  isFramed3D: boolean;
  isLetterbox: boolean;
  scale: number;
  txPct: number;
  tyPct: number;
  tzPx: number;
  rotXDeg: number;
  rotYDeg: number;
  rotZDeg: number;
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
        scale,
        txPct: 0,
        tyPct: 0,
        tzPx: 0,
        rotXDeg: 0,
        rotYDeg: 0,
        rotZDeg: 0,
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
        scale,
        txPct: tx,
        tyPct: ty,
        tzPx: 0,
        rotXDeg: 0,
        rotYDeg: 0,
        rotZDeg: 0,
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
        scale,
        txPct: tx,
        tyPct: ty,
        tzPx: 0,
        rotXDeg: 0,
        rotYDeg: 0,
        rotZDeg: 0,
      };
    }
    case "isometric-3d-frame": {
      const rotY = interpolate(progress, [0, 1], [-11, -5]);
      const rotX = interpolate(progress, [0, 1], [6, 3]);
      return {
        transform: `perspective(1600px) rotateY(${rotY.toFixed(2)}deg) rotateX(${rotX.toFixed(2)}deg) scale(0.84)`,
        isFramed3D: true,
        isLetterbox: false,
        scale: 0.84,
        txPct: 0,
        tyPct: 0,
        tzPx: 0,
        rotXDeg: rotX,
        rotYDeg: rotY,
        rotZDeg: 0,
      };
    }
    case "orbit-3d-left": {
      const eased = evaluateEasing("ease-in-out", progress);
      const rotY = interpolate(eased, [0, 1], [-22, 14]);
      const rotX = interpolate(eased, [0, 1], [10, -4]);
      const tz = interpolate(eased, [0, 0.5, 1], [-120, 60, -40]);
      return {
        transform: `perspective(1400px) translateZ(${tz.toFixed(1)}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(0.88)`,
        isFramed3D: true,
        isLetterbox: false,
        scale: 0.88,
        txPct: 0,
        tyPct: 0,
        tzPx: tz,
        rotXDeg: rotX,
        rotYDeg: rotY,
        rotZDeg: 0,
      };
    }
    case "orbit-3d-right": {
      const eased = evaluateEasing("ease-in-out", progress);
      const rotY = interpolate(eased, [0, 1], [22, -14]);
      const rotX = interpolate(eased, [0, 1], [8, -6]);
      const tz = interpolate(eased, [0, 0.5, 1], [-100, 70, -30]);
      return {
        transform: `perspective(1400px) translateZ(${tz.toFixed(1)}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(0.88)`,
        isFramed3D: true,
        isLetterbox: false,
        scale: 0.88,
        txPct: 0,
        tyPct: 0,
        tzPx: tz,
        rotXDeg: rotX,
        rotYDeg: rotY,
        rotZDeg: 0,
      };
    }
    case "fly-through-z": {
      const whip = evaluateEasing("expo-out", progress);
      const tz = interpolate(whip, [0, 1], [-520, 140]);
      const rotZ = interpolate(progress, [0, 1], [-4, 1.5]);
      return {
        transform: `perspective(1200px) translateZ(${tz.toFixed(1)}px) rotateZ(${rotZ.toFixed(2)}deg)`,
        isFramed3D: true,
        isLetterbox: true,
        scale: 1 + tz / 1200,
        txPct: 0,
        tyPct: 0,
        tzPx: tz,
        rotXDeg: 0,
        rotYDeg: 0,
        rotZDeg: rotZ,
      };
    }
    case "whip-pan-3d": {
      const whip = evaluateEasing("whip", Math.min(1, progress * 1.4));
      const rotY = interpolate(whip, [0, 1], [-38, -4]);
      const tx = interpolate(whip, [0, 1], [-18, 0]);
      return {
        transform: `perspective(1350px) translate3d(${tx.toFixed(2)}%, 0%, 0px) rotateY(${rotY.toFixed(2)}deg) scale(0.88)`,
        isFramed3D: true,
        isLetterbox: false,
        scale: 0.88,
        txPct: tx,
        tyPct: 0,
        tzPx: 0,
        rotXDeg: 0,
        rotYDeg: rotY,
        rotZDeg: 0,
      };
    }
    case "dutch-roll-impact": {
      const shake = computeCameraShake(localFrame, fps, 1.2, 16);
      const rotZ = interpolate(progress, [0, 1], [-7, 2]) + shake.drot;
      const scale = interpolate(focusSpring, [0, 1], [1.16, 1.02]);
      return {
        transform: `perspective(1400px) translate3d(${shake.dx.toFixed(1)}px, ${shake.dy.toFixed(1)}px, 0px) rotateZ(${rotZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
        isFramed3D: true,
        isLetterbox: true,
        scale,
        txPct: shake.dx * 0.05,
        tyPct: shake.dy * 0.05,
        tzPx: 0,
        rotXDeg: 0,
        rotYDeg: 0,
        rotZDeg: rotZ,
      };
    }
    case "hyper-push-in": {
      const expo = evaluateEasing("whip", progress);
      const scale = interpolate(expo, [0, 1], [0.86, 1.28]);
      const rotX = interpolate(expo, [0, 1], [12, 0]);
      return {
        transform: `perspective(1300px) rotateX(${rotX.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
        isFramed3D: true,
        isLetterbox: true,
        scale,
        txPct: 0,
        tyPct: 0,
        tzPx: 0,
        rotXDeg: rotX,
        rotYDeg: 0,
        rotZDeg: 0,
      };
    }
    case "letterbox-cinema": {
      const scale = interpolate(progress, [0, 1], [1.02, 1.08]);
      return {
        transform: `scale(${scale.toFixed(3)})`,
        isFramed3D: false,
        isLetterbox: true,
        scale,
        txPct: 0,
        tyPct: 0,
        tzPx: 0,
        rotXDeg: 0,
        rotYDeg: 0,
        rotZDeg: 0,
      };
    }
    default:
      return {
        transform: "none",
        isFramed3D: false,
        isLetterbox: false,
        scale: 1,
        txPct: 0,
        tyPct: 0,
        tzPx: 0,
        rotXDeg: 0,
        rotYDeg: 0,
        rotZDeg: 0,
      };
  }
}

/**
 * Resolves canvas-relative coordinates (-50 to +50) while preserving intentional
 * asymmetric split-screen layouts (e.g. x = -22 left column, x = +20 right column) on 16:9,
 * and gracefully stacking vertically on 9:16 portrait so elements never collide.
 */
export function resolveResponsiveLayout(
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
  const heightPct = clip.transform.height;

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
      if (sceneContext?.hasSpotlight && sceneContext?.hasRightWidget) {
        x = -23;
        y = -15;
        widthPct = Math.min(widthPct || 38, 38);
        scale *= 0.88;
      } else if (sceneContext?.hasSpotlight || sceneContext?.hasRightWidget) {
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
      clip.shapeVariant === "split-comparison" ||
      clip.shapeVariant === "3d-carousel-stack" ||
      clip.shapeVariant === "kinetic-impact-wall" ||
      clip.shapeVariant === "3d-wireframe-prism";

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
 * Evaluates active scene layout context for a clip or timestamp.
 */
export function getActiveSceneContextForTime(
  project: AGVIProject,
  timestampSec: number
): ActiveSceneLayoutContext {
  const visibleTracks = (project.tracks || []).filter((t) => !t.hidden);
  const allVisibleClips = visibleTracks.flatMap((t) => t.clips);
  const concurrent = allVisibleClips.filter(
    (c) =>
      timestampSec >= c.startTime - 0.1 &&
      timestampSec <= c.startTime + c.duration + 0.1
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
}

export interface EvaluatedClipFrameState {
  clip: TimelineClip;
  localFrame: number;
  durationInFrames: number;
  isFullCanvasBackdrop: boolean;
  layout: ReturnType<typeof resolveResponsiveLayout>;
  anim: EvaluatedAnimationStyles;
  sceneTrans: ReturnType<typeof computeSceneTransitionStyle>;
  kfCurr: ReturnType<typeof evaluateClipKeyframes>;
  velocity: { vx: number; vy: number; speed: number };
  shake: { dx: number; dy: number; drot: number };
  finalTx: number;
  finalTy: number;
  finalTz: number;
  finalRotX: number;
  finalRotY: number;
  finalRotZ: number;
  finalScale: number;
  finalOpacity: number;
  totalBlurPx: number;
  chromaDx: number;
  chromaDy: number;
  chromaShift: number;
  motionStretchX: number;
  motionStretchY: number;
  combinedTransform: string;
}

/**
 * Evaluates full deterministic 6-DOF transform, keyframe, velocity, and post-FX state for a single clip at a given global frame.
 */
export function evaluateClipAtFrame(
  clip: TimelineClip,
  globalFrame: number,
  fps: number,
  canvasW: number,
  canvasH: number,
  direction: DesignDirectionPreset,
  sceneContext?: ActiveSceneLayoutContext
): EvaluatedClipFrameState | null {
  const fromFrame = Math.max(0, Math.round(clip.startTime * fps));
  const durationInFrames = Math.max(1, Math.round(clip.duration * fps));
  const localFrame = globalFrame - fromFrame;

  if (localFrame < 0 || localFrame >= durationInFrames) {
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

  const normProgress = localFrame / Math.max(1, durationInFrames - 1);
  const prevNormProgress =
    Math.max(0, localFrame - 1) / Math.max(1, durationInFrames - 1);

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

  const kfCurr = evaluateClipKeyframes(
    clip.keyframes,
    normProgress,
    defaultKfState
  );
  const kfPrev = evaluateClipKeyframes(
    clip.keyframes,
    prevNormProgress,
    defaultKfState
  );

  const canvasOffsetX = isFullCanvasBackdrop ? 0 : (kfCurr.x / 100) * canvasW;
  const canvasOffsetY = isFullCanvasBackdrop ? 0 : (kfCurr.y / 100) * canvasH;
  const prevCanvasOffsetX = isFullCanvasBackdrop
    ? 0
    : (kfPrev.x / 100) * canvasW;
  const prevCanvasOffsetY = isFullCanvasBackdrop
    ? 0
    : (kfPrev.y / 100) * canvasH;

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

  const shakeIntensity = clip.filter?.cameraShake ?? 0;
  const shake = computeCameraShake(localFrame, fps, shakeIntensity, 14);

  const motionBlurMult =
    clip.filter?.motionBlur ??
    (direction.id === "kinetic-3d-keynote" ? 0.6 : 0);
  const velocityBlurPx = Math.min(16, velocity.speed * 0.08 * motionBlurMult);
  const totalBlurPx =
    anim.blurPx +
    kfCurr.blur +
    (sceneTrans.extraBlurPx ?? 0) +
    velocityBlurPx;

  const chromaMult =
    clip.filter?.chromaticAberration ??
    (direction.id === "kinetic-3d-keynote" ? 0.5 : 0);
  const chromaShift = Math.min(10, (velocity.speed * 0.08 + 1.5) * chromaMult);
  const velNorm = Math.max(1, Math.hypot(velocity.vx, velocity.vy));
  const dirX = Math.abs(velocity.vx) > 0.2 ? velocity.vx / velNorm : 1;
  const dirY = Math.abs(velocity.vy) > 0.2 ? velocity.vy / velNorm : 0;
  const chromaDx = chromaShift * dirX;
  const chromaDy = chromaShift * dirY;

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
  const finalOpacity = Math.max(
    0,
    Math.min(1, kfCurr.opacity * anim.opacityMultiplier)
  );

  const baseTransform3D = `perspective(1400px) translate3d(${finalTx.toFixed(1)}px, ${finalTy.toFixed(1)}px, ${finalTz.toFixed(1)}px) rotateX(${finalRotX.toFixed(2)}deg) rotateY(${finalRotY.toFixed(2)}deg) rotateZ(${finalRotZ.toFixed(2)}deg) scale3d(${(finalScale * motionStretchX).toFixed(3)}, ${(finalScale * motionStretchY).toFixed(3)}, 1)`;
  const combinedTransform = sceneTrans.extraTransform3D
    ? `${baseTransform3D} ${sceneTrans.extraTransform3D}`
    : baseTransform3D;

  return {
    clip,
    localFrame,
    durationInFrames,
    isFullCanvasBackdrop,
    layout,
    anim,
    sceneTrans,
    kfCurr,
    velocity,
    shake,
    finalTx,
    finalTy,
    finalTz,
    finalRotX,
    finalRotY,
    finalRotZ,
    finalScale,
    finalOpacity,
    totalBlurPx,
    chromaDx,
    chromaDy,
    chromaShift,
    motionStretchX,
    motionStretchY,
    combinedTransform,
  };
}
