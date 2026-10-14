"use client";

import React from "react";
import {
  Check,
  Code2,
  Copy,
  Compass,
  Sliders,
  Sparkles,
  Trash2,
  Tv,
} from "lucide-react";
import {
  AGVIProject,
  AnimationType,
  AspectRatio,
  CameraMotionEffect,
  CaptionPreset,
  KenBurnsEffect,
  MotionOverlayPreset,
  SceneTransitionEffect,
  ShapeVariant,
  TimelineClip,
  buildAutoCaptionWords,
} from "@/lib/schema/timeline-schema";

interface InspectorPanelProps {
  project: AGVIProject;
  selectedClip: TimelineClip | null;
  onUpdateClip: (clipId: string, patch: Record<string, unknown>) => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onUpdateCanvas: (canvasPatch: Record<string, unknown>) => void;
}

const ANIMATION_OPTIONS: AnimationType[] = [
  "none",
  "fade",
  "pop-spring",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "zoom-in",
  "zoom-out",
  "blur-in",
];

const SCENE_TRANSITION_OPTIONS: SceneTransitionEffect[] = [
  "none",
  "shutter-wipe",
  "iris-frame",
  "editorial-curtain",
  "flash-cut",
];

const CAMERA_MOTION_OPTIONS: CameraMotionEffect[] = [
  "none",
  "focus-zoom-left",
  "focus-zoom-right",
  "isometric-3d-frame",
  "split-stage-left",
  "letterbox-cinema",
  "cinema-dolly",
];

const MOTION_OVERLAY_PRESETS: MotionOverlayPreset[] = [
  "none",
  "spotlight-pointer",
  "hud-telemetry",
  "step-annotations",
  "lower-chyron",
  "split-compare",
];

const SHAPE_VARIANTS: ShapeVariant[] = [
  "spotlight-callout",
  "process-stepper",
  "split-comparison",
  "hud-telemetry",
  "kpi-counter",
  "bar-chart",
  "chat-simulation",
  "code-card",
  "terminal-window",
  "bento-grid",
  "badge",
  "lower-third",
  "audio-waveform",
  "progress-bar",
  "gradient-backdrop",
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  project,
  selectedClip,
  onUpdateClip,
  onDuplicateClip,
  onDeleteClip,
  onUpdateCanvas,
}) => {
  const [copiedSnippet, setCopiedSnippet] = React.useState(false);

  const handleCopyClipAction = () => {
    if (!selectedClip) return;
    const payload = {
      action: "update_clip",
      projectId: project.id,
      clipId: selectedClip.id,
      patch: selectedClip,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 1800);
  };

  if (!selectedClip) {
    return (
      <div className="w-80 shrink-0 border-l border-slate-800/80 bg-[#0A0E17] flex flex-col overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-800/80 flex items-center gap-2">
          <Tv className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Canvas & Schema Settings
          </h2>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">
              Aspect Ratio Preset (`canvas.aspectRatio`)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["16:9", "9:16", "1:1", "4:5"] as AspectRatio[]).map(
                (ratio) => (
                  <button
                    key={ratio}
                    onClick={() => onUpdateCanvas({ aspectRatio: ratio })}
                    className={`px-2.5 py-2 rounded-lg border text-left font-mono transition cursor-pointer ${
                      project.canvas.aspectRatio === ratio
                        ? "bg-sky-500/20 border-sky-400 text-sky-200 font-semibold"
                        : "bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {ratio}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">
                Duration (sec)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="300"
                value={project.canvas.duration}
                onChange={(e) =>
                  onUpdateCanvas({ duration: Number(e.target.value) || 10 })
                }
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">FPS</label>
              <input
                type="number"
                min="12"
                max="60"
                value={project.canvas.fps}
                onChange={(e) =>
                  onUpdateCanvas({ fps: Number(e.target.value) || 30 })
                }
                className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-100 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">
              Background Color (`canvas.backgroundColor`)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={project.canvas.backgroundColor || "#06080F"}
                onChange={(e) =>
                  onUpdateCanvas({ backgroundColor: e.target.value })
                }
                className="w-8 h-8 rounded bg-transparent border border-slate-700 cursor-pointer"
              />
              <input
                type="text"
                value={project.canvas.backgroundColor}
                onChange={(e) =>
                  onUpdateCanvas({ backgroundColor: e.target.value })
                }
                className="flex-1 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Studio Keyboard Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <div>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">
                  Space
                </kbd>{" "}
                Play/Pause
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">
                  S
                </kbd>{" "}
                Split Clip
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">
                  Del
                </kbd>{" "}
                Delete Clip
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10px]">
                  Ctrl+Z
                </kbd>{" "}
                Undo
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 shrink-0 border-l border-slate-800/80 bg-[#0A0E17] flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="truncate">
            <h2 className="text-xs font-semibold text-slate-100 truncate">
              {selectedClip.name}
            </h2>
            <p className="text-[10px] font-mono text-sky-400">
              id: {selectedClip.id} ({selectedClip.type})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDuplicateClip(selectedClip.id)}
            title="Duplicate clip"
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteClip(selectedClip.id)}
            title="Delete clip"
            className="p-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Form Controls */}
      <div className="p-4 space-y-4 text-xs flex-1 overflow-y-auto">
        <div>
          <label className="block text-slate-400 mb-1">Clip Name</label>
          <input
            type="text"
            value={selectedClip.name}
            onChange={(e) =>
              onUpdateClip(selectedClip.id, { name: e.target.value })
            }
            className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-100"
          />
        </div>

        {/* Timing */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-slate-400 mb-1">
              Start Time (sec)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={selectedClip.startTime}
              onChange={(e) =>
                onUpdateClip(selectedClip.id, {
                  startTime: Math.max(0, Number(e.target.value)),
                })
              }
              className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Duration (sec)</label>
            <input
              type="number"
              step="0.1"
              min="0.2"
              value={selectedClip.duration}
              onChange={(e) =>
                onUpdateClip(selectedClip.id, {
                  duration: Math.max(0.2, Number(e.target.value)),
                })
              }
              className="w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-100 font-mono"
            />
          </div>
        </div>

        {/* Quick Canvas Zone Presets + Transform */}
        <div className="pt-2 border-t border-slate-800/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              Canvas Position (`x%`, `y%`)
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[
              { label: "Badge", x: 0, y: -39 },
              { label: "Top Title", x: 0, y: -27 },
              { label: "Center", x: 0, y: 2 },
              { label: "Lower 3rd", x: -20, y: 20 },
              { label: "Caption", x: 0, y: 37 },
            ].map((pos) => (
              <button
                key={pos.label}
                onClick={() =>
                  onUpdateClip(selectedClip.id, {
                    transform: {
                      ...selectedClip.transform,
                      x: pos.x,
                      y: pos.y,
                    },
                  })
                }
                className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 cursor-pointer"
              >
                {pos.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">
                X Offset %
              </label>
              <input
                type="number"
                step="1"
                value={selectedClip.transform.x}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, {
                    transform: {
                      ...selectedClip.transform,
                      x: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">
                Y Offset %
              </label>
              <input
                type="number"
                step="1"
                value={selectedClip.transform.y}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, {
                    transform: {
                      ...selectedClip.transform,
                      y: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">
                Scale
              </label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="5"
                value={selectedClip.transform.scale}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, {
                    transform: {
                      ...selectedClip.transform,
                      scale: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-100 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Animations & Scene Transition */}
        <div className="pt-2 border-t border-slate-800/70 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 mb-1">Enter Animation</label>
              <select
                value={selectedClip.enterAnimation.type}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, {
                    enterAnimation: {
                      ...selectedClip.enterAnimation,
                      type: e.target.value as AnimationType,
                    },
                  })
                }
                className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
              >
                {ANIMATION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Exit Animation</label>
              <select
                value={selectedClip.exitAnimation.type}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, {
                    exitAnimation: {
                      ...selectedClip.exitAnimation,
                      type: e.target.value as AnimationType,
                    },
                  })
                }
                className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
              >
                {ANIMATION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">
              Scene Cut Transition (`sceneTransition`)
            </label>
            <select
              value={selectedClip.sceneTransition || "none"}
              onChange={(e) =>
                onUpdateClip(selectedClip.id, {
                  sceneTransition: e.target.value as SceneTransitionEffect,
                })
              }
              className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-amber-300 font-mono"
            >
              {SCENE_TRANSITION_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Type-specific properties */}
        {selectedClip.type === "text" && (
          <div className="pt-2 border-t border-slate-800/70 space-y-2.5">
            <div className="text-[11px] font-semibold text-purple-300">
              Typography & Headline Settings
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Headline Text</label>
              <textarea
                rows={2}
                value={selectedClip.text}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, { text: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">
                Subtext Pill (Optional)
              </label>
              <input
                type="text"
                value={selectedClip.subtext || ""}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, { subtext: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">Text Effect</label>
                <select
                  value={selectedClip.textEffect || "none"}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      textEffect: e.target.value,
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
                >
                  <option value="none">none</option>
                  <option value="gradient">gradient</option>
                  <option value="neon-glow">neon-glow</option>
                  <option value="typewriter">typewriter</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Font Size</label>
                <input
                  type="number"
                  value={selectedClip.style.fontSize}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      style: {
                        ...selectedClip.style,
                        fontSize: Number(e.target.value) || 64,
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {selectedClip.type === "caption" && (
          <div className="pt-2 border-t border-slate-800/70 space-y-2.5">
            <div className="text-[11px] font-semibold text-amber-300">
              Karaoke Auto-Caption Settings
            </div>
            <div>
              <label className="block text-slate-400 mb-1">
                Transcript (auto-recomputes word timings)
              </label>
              <textarea
                rows={3}
                value={selectedClip.text}
                onChange={(e) => {
                  const newText = e.target.value;
                  onUpdateClip(selectedClip.id, {
                    text: newText,
                    words: buildAutoCaptionWords(
                      newText,
                      selectedClip.duration
                    ),
                  });
                }}
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">Preset</label>
                <select
                  value={selectedClip.preset}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      preset: e.target.value as CaptionPreset,
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
                >
                  <option value="tiktok-pop">tiktok-pop</option>
                  <option value="neon-cyber">neon-cyber</option>
                  <option value="minimal-box">minimal-box</option>
                  <option value="cinematic">cinematic</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  Active Highlight
                </label>
                <input
                  type="color"
                  value={selectedClip.highlightColor || "#FACC15"}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      highlightColor: e.target.value,
                    })
                  }
                  className="w-full h-8 rounded bg-slate-900 border border-slate-800 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {(selectedClip.type === "video" || selectedClip.type === "image") && (
          <div className="pt-2 border-t border-slate-800/70 space-y-2.5">
            <div className="text-[11px] font-semibold text-orange-400 flex items-center justify-between">
              <span>Hybrid Video & Motion Compositing</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300">
                1-Clip Rig
              </span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                Video / Surface Source (`src`)
              </label>
              <select
                value={
                  selectedClip.src.startsWith("procedural")
                    ? selectedClip.src
                    : "custom"
                }
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    onUpdateClip(selectedClip.id, { src: e.target.value });
                  }
                }}
                className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100 mb-1.5"
              >
                <option value="procedural-video://product-ui-capture">
                  Live Video Stream: Product UI Capture
                </option>
                <option value="procedural://swiss-industrial">
                  Matte Surface: Swiss Industrial
                </option>
                <option value="procedural://warm-editorial">
                  Matte Surface: Warm Editorial
                </option>
                <option value="procedural://documentary-slate">
                  Matte Surface: Documentary Slate
                </option>
                <option value="procedural://cobalt-technical">
                  Matte Surface: Blueprint Mono
                </option>
                <option value="custom">Custom MP4 / Image URL</option>
              </select>
              <input
                type="text"
                placeholder="https://.../footage.mp4 or procedural-video://..."
                value={selectedClip.src}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, { src: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100 font-mono text-[11px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">
                  Camera Rig (`cameraMotion`)
                </label>
                <select
                  value={selectedClip.cameraMotion || "none"}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      cameraMotion: e.target.value as CameraMotionEffect,
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-mono"
                >
                  {CAMERA_MOTION_OPTIONS.map((cam) => (
                    <option key={cam} value={cam}>
                      {cam}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  Attached Motion Overlay
                </label>
                <select
                  value={selectedClip.motionOverlay?.preset || "none"}
                  onChange={(e) => {
                    const preset = e.target.value as MotionOverlayPreset;
                    onUpdateClip(selectedClip.id, {
                      motionOverlay: {
                        ...(selectedClip.motionOverlay || {}),
                        preset,
                        title:
                          selectedClip.motionOverlay?.title ||
                          "01 / FOCUS CALLOUT",
                        subtitle:
                          selectedClip.motionOverlay?.subtitle ||
                          "Gắn trực tiếp lớp chỉ dẫn SVG vào video clip.",
                        targetX: selectedClip.motionOverlay?.targetX ?? -14,
                        targetY: selectedClip.motionOverlay?.targetY ?? -8,
                        accentColor:
                          selectedClip.motionOverlay?.accentColor || "#FF4F00",
                      },
                    });
                  }}
                  className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-orange-300 font-mono"
                >
                  {MOTION_OVERLAY_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedClip.motionOverlay &&
              selectedClip.motionOverlay.preset !== "none" && (
                <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="text-[10px] font-mono uppercase text-orange-300">
                    Overlay Config ({selectedClip.motionOverlay.preset})
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Callout Title
                    </label>
                    <input
                      type="text"
                      value={selectedClip.motionOverlay.title || ""}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          motionOverlay: {
                            ...selectedClip.motionOverlay,
                            title: e.target.value,
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Callout Subtitle
                    </label>
                    <input
                      type="text"
                      value={selectedClip.motionOverlay.subtitle || ""}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          motionOverlay: {
                            ...selectedClip.motionOverlay,
                            subtitle: e.target.value,
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-100"
                    />
                  </div>
                  {selectedClip.motionOverlay.preset === "spotlight-pointer" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Target X % (-40..40)
                        </label>
                        <input
                          type="number"
                          step="2"
                          min="-45"
                          max="45"
                          value={selectedClip.motionOverlay.targetX ?? -14}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              motionOverlay: {
                                ...selectedClip.motionOverlay!,
                                targetX: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-orange-300 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Target Y % (-40..40)
                        </label>
                        <input
                          type="number"
                          step="2"
                          min="-45"
                          max="45"
                          value={selectedClip.motionOverlay.targetY ?? -8}
                          onChange={(e) =>
                            onUpdateClip(selectedClip.id, {
                              motionOverlay: {
                                ...selectedClip.motionOverlay!,
                                targetY: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-orange-300 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

            {selectedClip.type === "image" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Ken Burns Camera
                  </label>
                  <select
                    value={selectedClip.kenBurns || "none"}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        kenBurns: e.target.value as KenBurnsEffect,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
                  >
                    <option value="none">none</option>
                    <option value="zoom-in">zoom-in</option>
                    <option value="zoom-out">zoom-out</option>
                    <option value="pan-left">pan-left</option>
                    <option value="pan-right">pan-right</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Dark Overlay (0-1)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="0.95"
                    value={selectedClip.overlayOpacity ?? 0.12}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        overlayOpacity: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100 font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {selectedClip.type === "shape" && (
          <div className="pt-2 border-t border-slate-800/70 space-y-2.5">
            <div className="text-[11px] font-semibold text-indigo-300">
              Studio Motion Widget Config
            </div>
            <div>
              <label className="block text-slate-400 mb-1">
                Widget Variant (`shapeVariant`)
              </label>
              <select
                value={selectedClip.shapeVariant}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, {
                    shapeVariant: e.target.value as ShapeVariant,
                  })
                }
                className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100 font-mono"
              >
                {SHAPE_VARIANTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Title / Label</label>
              <input
                type="text"
                value={selectedClip.title || ""}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, { title: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Subtitle</label>
              <input
                type="text"
                value={selectedClip.subtitle || ""}
                onChange={(e) =>
                  onUpdateClip(selectedClip.id, { subtitle: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-100"
              />
            </div>
            {selectedClip.shapeVariant === "kpi-counter" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Metric Value
                  </label>
                  <input
                    type="text"
                    value={selectedClip.metricValue || "10.4x"}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        metricValue: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Trend Label
                  </label>
                  <input
                    type="text"
                    value={selectedClip.metricTrend || "+340%"}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        metricTrend: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-mono"
                  />
                </div>
              </div>
            )}
            {(selectedClip.shapeVariant === "code-card" ||
              selectedClip.shapeVariant === "terminal-window") && (
              <div>
                <label className="block text-slate-400 mb-1">
                  Code / CLI Snippet
                </label>
                <textarea
                  rows={4}
                  value={selectedClip.codeSnippet || ""}
                  onChange={(e) =>
                    onUpdateClip(selectedClip.id, {
                      codeSnippet: e.target.value,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-mono text-[11px]"
                />
              </div>
            )}
          </div>
        )}

        {/* Live AI Agent Action Snippet for this Clip */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5 text-sky-400" />
              Clip JSON / API Patch
            </span>
            <button
              onClick={handleCopyClipAction}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-sky-300 cursor-pointer"
            >
              {copiedSnippet ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy Tool Call
                </>
              )}
            </button>
          </div>
          <pre className="p-2.5 rounded-lg bg-[#06080E] border border-slate-800/90 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-44">
            {JSON.stringify(selectedClip, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
