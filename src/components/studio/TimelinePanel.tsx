"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Copy,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Layers,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Subtitles,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  AGVIProject,
  ShapeVariant,
  TimelineClip,
  TrackType,
} from "@/lib/schema/timeline-schema";

interface TimelinePanelProps {
  project: AGVIProject;
  currentTime: number;
  isPlaying: boolean;
  isMuted: boolean;
  canUndo: boolean;
  selectedClipId: string | null;
  onSeek: (timeInSeconds: number) => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onUndo: () => void;
  onSelectClip: (clipId: string | null) => void;
  onToggleTrackHidden: (trackId: string) => void;
  onQuickAddClip: (
    trackType: TrackType,
    trackId?: string,
    shapeVariant?: ShapeVariant
  ) => void;
  onSplitSelectedClip: () => void;
  onDuplicateSelectedClip: () => void;
  onDeleteSelectedClip: () => void;
  onPreviewClipTiming: (
    clipId: string,
    startTime: number,
    duration: number
  ) => void;
  onCommitClipTiming: (
    clipId: string,
    startTime: number,
    duration: number
  ) => void;
}

const TRACK_COLORS: Record<
  TrackType,
  { bg: string; border: string; text: string }
> = {
  image: {
    bg: "bg-sky-500/20 hover:bg-sky-500/30",
    border: "border-sky-400/60",
    text: "text-sky-100",
  },
  video: {
    bg: "bg-blue-500/20 hover:bg-blue-500/30",
    border: "border-blue-400/60",
    text: "text-blue-100",
  },
  shape: {
    bg: "bg-indigo-500/25 hover:bg-indigo-500/35",
    border: "border-indigo-400/60",
    text: "text-indigo-100",
  },
  text: {
    bg: "bg-purple-500/25 hover:bg-purple-500/35",
    border: "border-purple-400/60",
    text: "text-purple-100",
  },
  caption: {
    bg: "bg-amber-500/25 hover:bg-amber-500/35",
    border: "border-amber-400/60",
    text: "text-amber-100",
  },
  audio: {
    bg: "bg-emerald-500/20 hover:bg-emerald-500/30",
    border: "border-emerald-400/60",
    text: "text-emerald-100",
  },
};

function TrackIcon({ type }: { type: TrackType }) {
  switch (type) {
    case "video":
      return <Film className="w-3.5 h-3.5 text-blue-400" />;
    case "image":
      return <ImageIcon className="w-3.5 h-3.5 text-sky-400" />;
    case "text":
      return <Type className="w-3.5 h-3.5 text-purple-400" />;
    case "caption":
      return <Subtitles className="w-3.5 h-3.5 text-amber-400" />;
    case "audio":
      return <Music className="w-3.5 h-3.5 text-emerald-400" />;
    case "shape":
    default:
      return <Layers className="w-3.5 h-3.5 text-indigo-400" />;
  }
}

interface DragState {
  mode: "move" | "resize-left" | "resize-right" | "scrub";
  clipId?: string;
  initialClientX: number;
  initialStartTime: number;
  initialDuration: number;
  latestStartTime: number;
  latestDuration: number;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  project,
  currentTime,
  isPlaying,
  isMuted,
  canUndo,
  selectedClipId,
  onSeek,
  onTogglePlay,
  onToggleMute,
  onUndo,
  onSelectClip,
  onToggleTrackHidden,
  onQuickAddClip,
  onSplitSelectedClip,
  onDuplicateSelectedClip,
  onDeleteSelectedClip,
  onPreviewClipTiming,
  onCommitClipTiming,
}) => {
  const [zoom, setZoom] = useState(1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const timelineLaneRef = useRef<HTMLDivElement>(null);

  const duration = Math.max(1, project.canvas.duration || 10);
  const playheadPercent = Math.min(
    100,
    Math.max(0, (currentTime / duration) * 100)
  );

  // Global pointermove / pointerup for smooth clip dragging & edge resizing
  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!timelineLaneRef.current) return;
      const rect = timelineLaneRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      if (dragState.mode === "scrub") {
        const clickX = e.clientX - rect.left;
        const ratio = Math.min(1, Math.max(0, clickX / rect.width));
        onSeek(Number((ratio * duration).toFixed(2)));
        return;
      }

      if (!dragState.clipId) return;
      const deltaSec =
        ((e.clientX - dragState.initialClientX) / rect.width) * duration;

      if (dragState.mode === "move") {
        let nextStart = Math.max(
          0,
          Math.min(
            duration - dragState.initialDuration,
            dragState.initialStartTime + deltaSec
          )
        );
        // Magnetic snap to playhead if within 0.15s
        if (Math.abs(nextStart - currentTime) < 0.15) {
          nextStart = currentTime;
        }
        nextStart = Number(nextStart.toFixed(2));
        setDragState((prev) =>
          prev ? { ...prev, latestStartTime: nextStart } : null
        );
        onPreviewClipTiming(
          dragState.clipId,
          nextStart,
          dragState.initialDuration
        );
      } else if (dragState.mode === "resize-right") {
        const nextDur = Number(
          Math.max(
            0.4,
            Math.min(
              duration - dragState.initialStartTime,
              dragState.initialDuration + deltaSec
            )
          ).toFixed(2)
        );
        setDragState((prev) =>
          prev ? { ...prev, latestDuration: nextDur } : null
        );
        onPreviewClipTiming(
          dragState.clipId,
          dragState.initialStartTime,
          nextDur
        );
      } else if (dragState.mode === "resize-left") {
        const maxDelta = dragState.initialDuration - 0.4;
        const clampedDelta = Math.max(
          -dragState.initialStartTime,
          Math.min(maxDelta, deltaSec)
        );
        const nextStart = Number(
          (dragState.initialStartTime + clampedDelta).toFixed(2)
        );
        const nextDur = Number(
          (dragState.initialDuration - clampedDelta).toFixed(2)
        );
        setDragState((prev) =>
          prev
            ? {
                ...prev,
                latestStartTime: nextStart,
                latestDuration: nextDur,
              }
            : null
        );
        onPreviewClipTiming(dragState.clipId, nextStart, nextDur);
      }
    };

    const onPointerUp = () => {
      if (
        dragState.clipId &&
        (dragState.latestStartTime !== dragState.initialStartTime ||
          dragState.latestDuration !== dragState.initialDuration)
      ) {
        onCommitClipTiming(
          dragState.clipId,
          dragState.latestStartTime,
          dragState.latestDuration
        );
      }
      setDragState(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [
    dragState,
    duration,
    currentTime,
    onSeek,
    onPreviewClipTiming,
    onCommitClipTiming,
  ]);

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!timelineLaneRef.current) return;
    const rect = timelineLaneRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, clickX / rect.width));
    onSeek(Number((ratio * duration).toFixed(2)));
    setDragState({
      mode: "scrub",
      initialClientX: e.clientX,
      initialStartTime: 0,
      initialDuration: 0,
      latestStartTime: 0,
      latestDuration: 0,
    });
  };

  const tickCount = Math.ceil(duration);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i);

  return (
    <div className="flex flex-col h-72 border-t border-slate-800/80 bg-[#080B12] select-none">
      {/* Timeline Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-[#0B0F19]">
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            title="Play / Pause (Shortcut: Space)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" /> Play
              </>
            )}
          </button>

          <button
            onClick={() => onSeek(0)}
            title="Restart (0.0s)"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleMute}
            title={
              isMuted
                ? "Unmute WebAudio Synthwave & SFX"
                : "Mute WebAudio Synthwave & SFX"
            }
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
              !isMuted
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-slate-800/80 border-slate-700 text-slate-400"
            }`}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-rose-400" /> Muted
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Synth Audio
              </>
            )}
          </button>

          <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 font-mono text-xs text-sky-400">
            {currentTime.toFixed(2)}s{" "}
            <span className="text-slate-500">/ {duration.toFixed(2)}s</span>
            <span className="ml-2 text-slate-500">
              (F:{Math.round(currentTime * project.canvas.fps)})
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-xs text-slate-200 transition cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </button>

          <button
            onClick={onSplitSelectedClip}
            disabled={!selectedClipId}
            title="Split selected clip at playhead (Shortcut: S)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-xs text-slate-200 transition cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" /> Split (S)
          </button>

          <button
            onClick={onDuplicateSelectedClip}
            disabled={!selectedClipId}
            title="Duplicate selected clip"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none text-xs text-slate-200 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-sky-400" /> Duplicate
          </button>

          <button
            onClick={onDeleteSelectedClip}
            disabled={!selectedClipId}
            title="Delete selected clip (Shortcut: Delete)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 disabled:opacity-35 disabled:pointer-events-none text-xs text-rose-300 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>

        {/* Quick Add Studio Widgets + Zoom */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 hidden xl:flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-sky-400" /> Add Widget:
          </span>
          <button
            onClick={() => onQuickAddClip("shape", undefined, "kpi-counter")}
            className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-[11px] text-indigo-200 border border-indigo-500/40 transition cursor-pointer"
          >
            <Plus className="w-3 h-3 text-indigo-400" /> KPI Card
          </button>
          <button
            onClick={() => onQuickAddClip("shape", undefined, "bar-chart")}
            className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-[11px] text-sky-200 border border-sky-500/40 transition cursor-pointer"
          >
            <BarChart3 className="w-3 h-3 text-sky-400" /> Chart
          </button>
          <button
            onClick={() =>
              onQuickAddClip("shape", undefined, "chat-simulation")
            }
            className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[11px] text-emerald-200 border border-emerald-500/40 transition cursor-pointer"
          >
            <Plus className="w-3 h-3 text-emerald-400" /> AI Chat
          </button>
          <button
            onClick={() => onQuickAddClip("text")}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700/70 transition cursor-pointer"
          >
            <Plus className="w-3 h-3 text-purple-400" /> Title
          </button>
          <button
            onClick={() => onQuickAddClip("caption")}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700/70 transition cursor-pointer"
          >
            <Plus className="w-3 h-3 text-amber-400" /> Caption
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            onClick={() =>
              setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))
            }
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            title="Zoom Out Timeline"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-400 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() =>
              setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))
            }
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            title="Zoom In Timeline"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tracks + Timeline Scroll Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Track Headers */}
        <div className="w-60 shrink-0 border-r border-slate-800/80 bg-[#0A0E17] flex flex-col">
          <div className="h-7 border-b border-slate-800/80 px-3 flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span>TRACKS ({project.tracks.length})</span>
            <span className="font-mono text-[10px] text-sky-400">
              DRAG TO MOVE/RESIZE
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {project.tracks.map((track) => (
              <div
                key={track.id}
                className="h-10 px-3 flex items-center justify-between hover:bg-slate-900/60 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TrackIcon type={track.type} />
                  <div className="truncate">
                    <div className="text-xs font-medium text-slate-200 truncate">
                      {track.name}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      z:{track.zIndex} • {track.clips.length} clips
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onQuickAddClip(track.type, track.id)}
                    title={`Add clip to ${track.name}`}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onToggleTrackHidden(track.id)}
                    title={track.hidden ? "Show Track" : "Hide Track"}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {track.hidden ? (
                      <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Timeline Lanes */}
        <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#070A10]">
          <div
            ref={timelineLaneRef}
            style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
            className="relative min-h-full flex flex-col"
          >
            {/* Time Ruler (Drag to scrub) */}
            <div
              onPointerDown={handleRulerPointerDown}
              className="h-7 border-b border-slate-800/80 bg-[#0B0F19] relative sticky top-0 z-20 cursor-ew-resize"
            >
              {ticks.map((sec) => {
                const leftPct = (sec / duration) * 100;
                if (leftPct > 100) return null;
                return (
                  <div
                    key={sec}
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-0 bottom-0 flex flex-col justify-end pb-1 pointer-events-none"
                  >
                    <div className="h-2.5 w-px bg-slate-700" />
                    <span className="text-[10px] font-mono text-slate-400 pl-1">
                      {sec}s
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Track Rows */}
            <div
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  handleRulerPointerDown(e);
                }
              }}
              className="divide-y divide-slate-800/50 flex-1 relative"
            >
              {project.tracks.map((track) => {
                const palette = TRACK_COLORS[track.type] || TRACK_COLORS.shape;
                return (
                  <div
                    key={track.id}
                    onPointerDown={(e) => {
                      if (e.target === e.currentTarget) {
                        handleRulerPointerDown(e);
                      }
                    }}
                    className={`h-10 relative ${track.hidden ? "opacity-40" : ""}`}
                  >
                    {track.clips.map((clip: TimelineClip) => {
                      const leftPct = (clip.startTime / duration) * 100;
                      const widthPct = Math.max(
                        1.5,
                        (clip.duration / duration) * 100
                      );
                      const isSelected = selectedClipId === clip.id;
                      const isDraggingThis = dragState?.clipId === clip.id;

                      return (
                        <div
                          key={clip.id}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            onSelectClip(clip.id);
                            setDragState({
                              mode: "move",
                              clipId: clip.id,
                              initialClientX: e.clientX,
                              initialStartTime: clip.startTime,
                              initialDuration: clip.duration,
                              latestStartTime: clip.startTime,
                              latestDuration: clip.duration,
                            });
                          }}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          className={`group absolute top-1 bottom-1 rounded-md border px-2 flex items-center justify-between overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${palette.bg} ${
                            isSelected
                              ? "ring-2 ring-sky-400 border-sky-300 z-10 shadow-lg shadow-sky-500/25"
                              : palette.border
                          }`}
                        >
                          {/* Left Resize Handle */}
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id);
                              setDragState({
                                mode: "resize-left",
                                clipId: clip.id,
                                initialClientX: e.clientX,
                                initialStartTime: clip.startTime,
                                initialDuration: clip.duration,
                                latestStartTime: clip.startTime,
                                latestDuration: clip.duration,
                              });
                            }}
                            title="Drag to trim start"
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 hover:bg-sky-400/60 z-20"
                          />

                          {/* Decorative Audio Waveform Pattern */}
                          {clip.type === "audio" && (
                            <div className="absolute inset-0 flex items-center justify-around opacity-25 pointer-events-none px-2">
                              {Array.from({ length: 36 }).map((_, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    height: `${25 + ((idx * 37) % 65)}%`,
                                  }}
                                  className="w-0.5 bg-emerald-300 rounded-full"
                                />
                              ))}
                            </div>
                          )}

                          <div className="truncate flex items-center gap-1.5 relative z-10 pointer-events-none">
                            <span
                              className={`text-[11px] font-semibold truncate ${palette.text}`}
                            >
                              {clip.name}
                            </span>
                            {clip.type === "shape" && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/30 text-indigo-200">
                                {clip.shapeVariant}
                              </span>
                            )}
                            {clip.type === "text" && (
                              <span className="text-[10px] text-slate-300/80 truncate">
                                “{clip.text}”
                              </span>
                            )}
                            {clip.type === "caption" && (
                              <span className="text-[10px] text-amber-200/80 truncate">
                                “{clip.text}”
                              </span>
                            )}
                          </div>

                          <span className="text-[9px] font-mono text-slate-200/90 shrink-0 ml-1 relative z-10 pointer-events-none">
                            {isDraggingThis
                              ? `${clip.startTime.toFixed(1)}s–${(clip.startTime + clip.duration).toFixed(1)}s`
                              : `${clip.duration}s`}
                          </span>

                          {/* Right Resize Handle */}
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id);
                              setDragState({
                                mode: "resize-right",
                                clipId: clip.id,
                                initialClientX: e.clientX,
                                initialStartTime: clip.startTime,
                                initialDuration: clip.duration,
                                latestStartTime: clip.startTime,
                                latestDuration: clip.duration,
                              });
                            }}
                            title="Drag to resize duration"
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/0 hover:bg-sky-400/60 z-20"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Playhead Line */}
            <div
              style={{ left: `${playheadPercent}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none shadow-[0_0_10px_#f43f5e]"
            >
              <div className="w-3 h-3 -ml-[5px] bg-rose-500 rotate-45 rounded-xs" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
