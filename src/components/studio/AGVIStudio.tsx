"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AGVIPlayer, AGVIPlayerRef } from "@/lib/engine/agvi-engine";
import {
  Check,
  Copy,
  Cpu,
  Download,
  Film,
  Grid,
  LayoutTemplate,
  Radio,
  Sparkles,
  Terminal,
  Wand2,
  X,
} from "lucide-react";
import {
  AGVIProject,
  ShapeVariant,
  TimelineClip,
  TrackType,
} from "@/lib/schema/timeline-schema";
import { STARTER_TEMPLATES } from "@/lib/schema/starter-templates";
import {
  AgentActionLogEntry,
  AgentActionPayload,
  RenderJob,
} from "@/lib/server/project-store";
import { soundEngine } from "@/lib/audio/procedural-sound-engine";
import { AGVIComposition } from "@/components/remotion/AGVIComposition";
import { SchemaAndAgentPanel } from "./SchemaAndAgentPanel";
import { InspectorPanel } from "./InspectorPanel";
import { TimelinePanel } from "./TimelinePanel";

export const AGVIStudio: React.FC = () => {
  const [project, setProject] = useState<AGVIProject>(
    () => STARTER_TEMPLATES["ai-tech-explainer"]
  );
  const [actionLogs, setActionLogs] = useState<AgentActionLogEntry[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    "widget-chat-1"
  );
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showSafeZones, setShowSafeZones] = useState<boolean>(false);
  const [liveSyncEnabled, setLiveSyncEnabled] = useState<boolean>(true);
  const [renderModalOpen, setRenderModalOpen] = useState<boolean>(false);
  const [latestRenderJob, setLatestRenderJob] = useState<RenderJob | null>(
    null
  );
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickPrompt, setQuickPrompt] = useState<string>("");
  const [isGeneratingQuick, setIsGeneratingQuick] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<AGVIProject[]>([]);

  const playerRef = useRef<AGVIPlayerRef>(null);
  const lastUpdatedAtRef = useRef<string>(project.updatedAt);

  const pushUndoSnapshot = useCallback((proj: AGVIProject) => {
    setUndoStack((prev) => [structuredClone(proj), ...prev.slice(0, 19)]);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  // Sync WebAudio Procedural Soundtrack & Transition SFX with currentTime
  useEffect(() => {
    soundEngine.syncTime(currentTime, project, isPlaying);
  }, [currentTime, project, isPlaying]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Initial fetch & Live API polling so external AI agent calls immediately reflect on screen
  const fetchServerSnapshot = useCallback(
    async (isInitial = false) => {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && data.activeProject) {
          const incoming: AGVIProject = data.activeProject;
          if (isInitial || incoming.updatedAt !== lastUpdatedAtRef.current) {
            lastUpdatedAtRef.current = incoming.updatedAt;
            setProject(incoming);
            setActionLogs(data.actionLogs || []);
            if (!isInitial && data.actionLogs?.[0]) {
              showToast(`AI Sync: ${data.actionLogs[0].summary}`);
            }
          }
        }
      } catch {
        // Ignore network poll errors
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchServerSnapshot(true);
  }, [fetchServerSnapshot]);

  useEffect(() => {
    if (!liveSyncEnabled) return;
    const interval = setInterval(() => {
      fetchServerSnapshot(false);
    }, 2000);
    return () => clearInterval(interval);
  }, [liveSyncEnabled, fetchServerSnapshot]);

  const handleFrameChange = useCallback(
    (frame: number) => {
      const sec = frame / (project.canvas.fps || 30);
      setCurrentTime(sec);
    },
    [project.canvas.fps]
  );

  const handlePlayStateChange = useCallback((playing: boolean) => {
    if (playing) {
      soundEngine.resetTracking();
    }
    setIsPlaying(playing);
  }, []);

  const handleSeek = useCallback(
    (timeInSeconds: number) => {
      const clamped = Math.max(
        0,
        Math.min(project.canvas.duration, timeInSeconds)
      );
      soundEngine.resetTracking();
      setCurrentTime(clamped);
      const targetFrame = Math.round(clamped * project.canvas.fps);
      playerRef.current?.seekTo(targetFrame);
    },
    [project.canvas.duration, project.canvas.fps]
  );

  const handleTogglePlay = useCallback(() => {
    playerRef.current?.toggle();
  }, []);

  // Execute an AI Agent Action via POST /api/agent/actions
  const handleExecuteAgentAction = useCallback(
    async (payload: AgentActionPayload) => {
      pushUndoSnapshot(project);
      const res = await fetch("/api/agent/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Action failed");
      }
      lastUpdatedAtRef.current = data.project.updatedAt;
      setProject(data.project);
      soundEngine.playTechChime();
      if (data.log) {
        setActionLogs((prev) => [data.log, ...prev]);
        showToast(data.log.summary);
      }
    },
    [project, pushUndoSnapshot, showToast]
  );

  // Replace full JSON schema via PUT /api/projects/[id]
  const handleApplyFullJson = useCallback(
    async (rawJson: unknown) => {
      pushUndoSnapshot(project);
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: "Studio Schema Editor",
          project: rawJson,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save JSON schema");
      }
      lastUpdatedAtRef.current = data.project.updatedAt;
      setProject(data.project);
      showToast("Updated project JSON schema");
      fetchServerSnapshot(true);
    },
    [project, pushUndoSnapshot, showToast, fetchServerSnapshot]
  );

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const [previous, ...rest] = undoStack;
    setUndoStack(rest);
    setProject(previous);
    await fetch(`/api/projects/${previous.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName: "Studio Undo",
        project: previous,
      }),
    });
    showToast("Undid last action");
  }, [undoStack, showToast]);

  const handleUpdateClip = useCallback(
    async (clipId: string, patch: Record<string, unknown>) => {
      await handleExecuteAgentAction({
        action: "update_clip",
        agentName: "Studio Inspector",
        clipId,
        patch,
      });
    },
    [handleExecuteAgentAction]
  );

  // Optimistic local state update during timeline drag/resize so it runs at 60fps
  const handlePreviewClipTiming = useCallback(
    (clipId: string, newStartTime: number, newDuration: number) => {
      setProject((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId
              ? { ...c, startTime: newStartTime, duration: newDuration }
              : c
          ),
        })),
      }));
    },
    []
  );

  const handleCommitClipTiming = useCallback(
    async (clipId: string, newStartTime: number, newDuration: number) => {
      await handleUpdateClip(clipId, {
        startTime: newStartTime,
        duration: newDuration,
      });
    },
    [handleUpdateClip]
  );

  const handleDeleteClip = useCallback(
    async (clipId: string) => {
      await handleExecuteAgentAction({
        action: "delete_clip",
        agentName: "Studio Inspector",
        clipId,
      });
      if (selectedClipId === clipId) {
        setSelectedClipId(null);
      }
    },
    [handleExecuteAgentAction, selectedClipId]
  );

  const handleDuplicateClip = useCallback(
    async (clipId: string) => {
      for (const track of project.tracks) {
        const found = track.clips.find((c) => c.id === clipId);
        if (found) {
          const clone = structuredClone(found);
          clone.id = `${found.id}-copy-${Date.now().toString(36).slice(-3)}`;
          clone.name = `${found.name} (Copy)`;
          clone.startTime = Number(
            (found.startTime + found.duration).toFixed(2)
          );
          await handleExecuteAgentAction({
            action: "add_clip",
            agentName: "Studio Duplicate",
            trackId: track.id,
            trackType: track.type,
            clip: clone as unknown as Record<string, unknown>,
          });
          setSelectedClipId(clone.id);
          break;
        }
      }
    },
    [project.tracks, handleExecuteAgentAction]
  );

  const handleUpdateCanvas = async (canvasPatch: Record<string, unknown>) => {
    await handleExecuteAgentAction({
      action: "set_canvas",
      agentName: "Studio Canvas Config",
      canvas: canvasPatch,
    });
  };

  const handleToggleTrackHidden = async (trackId: string) => {
    const updatedTracks = project.tracks.map((t) =>
      t.id === trackId ? { ...t, hidden: !t.hidden } : t
    );
    await handleApplyFullJson({ ...project, tracks: updatedTracks });
  };

  const handleQuickAddClip = async (
    trackType: TrackType,
    trackId?: string,
    shapeVariant?: ShapeVariant
  ) => {
    const start = Number(currentTime.toFixed(2));
    const variant = shapeVariant || "kpi-counter";
    const defaultClips: Record<TrackType, Record<string, unknown>> = {
      text: {
        name: "Kinetic Title",
        type: "text",
        startTime: start,
        duration: 3.5,
        text: "AI Headline Overlay",
        subtext: "Edited via AGVI 2.0 Studio",
        textEffect: "gradient",
        transform: { x: 0, y: -27, scale: 1, rotation: 0 },
      },
      caption: {
        name: "Karaoke Caption",
        type: "caption",
        startTime: start,
        duration: 3.5,
        text: "Phụ đề tự động đồng bộ từng từ trên timeline không đè chữ",
        preset: "tiktok-pop",
        highlightColor: "#FACC15",
        transform: { x: 0, y: 37, scale: 1, rotation: 0 },
      },
      shape: {
        name: `Widget: ${variant}`,
        type: "shape",
        shapeVariant: variant,
        startTime: start,
        duration: 3.8,
        title:
          variant === "kpi-counter"
            ? "AI VELOCITY LIFT"
            : variant === "bar-chart"
              ? "Hiệu Suất Sản Xuất Video"
              : "AI Agent Callout",
        subtitle: "Realtime Telemetry",
        metricValue: "+380%",
        metricTrend: "Verified Speedup",
        accentColor: "#38BDF8",
        transform: { x: 0, y: 3, scale: 1, rotation: 0, width: 66 },
      },
      image: {
        name: "Shader Backdrop",
        type: "image",
        startTime: start,
        duration: 4,
        src: "procedural://aurora-mesh",
        kenBurns: "zoom-in",
      },
      video: {
        name: "Video Layer",
        type: "video",
        startTime: start,
        duration: 4,
        src: "",
      },
      audio: {
        name: "Synth Audio Cue",
        type: "audio",
        startTime: start,
        duration: 4,
        volume: 0.8,
        synthWave: true,
      },
    };

    await handleExecuteAgentAction({
      action: "add_clip",
      agentName: "Studio Quick Add",
      trackId,
      trackType,
      clip: defaultClips[trackType],
    });
  };

  const selectedClip: TimelineClip | null = React.useMemo(() => {
    if (!selectedClipId) return null;
    for (const track of project.tracks) {
      const found = track.clips.find((c) => c.id === selectedClipId);
      if (found) return found;
    }
    return null;
  }, [project.tracks, selectedClipId]);

  const handleSplitSelectedClip = useCallback(async () => {
    if (!selectedClip) return;
    const splitPoint =
      currentTime > selectedClip.startTime + 0.25 &&
      currentTime < selectedClip.startTime + selectedClip.duration - 0.25
        ? currentTime
        : Number(
            (selectedClip.startTime + selectedClip.duration / 2).toFixed(2)
          );

    await handleExecuteAgentAction({
      action: "split_clip",
      agentName: "Studio Timeline",
      clipId: selectedClip.id,
      splitTime: splitPoint,
    });
  }, [selectedClip, currentTime, handleExecuteAgentAction]);

  // Global Keyboard Shortcuts (Space, Delete, S, ArrowLeft/Right, Ctrl+Z)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedClipId
      ) {
        e.preventDefault();
        handleDeleteClip(selectedClipId);
      } else if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey && selectedClipId) {
        e.preventDefault();
        handleSplitSelectedClip();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSeek(currentTime - (e.shiftKey ? 1 : 0.1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSeek(currentTime + (e.shiftKey ? 1 : 0.1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleTogglePlay,
    handleDeleteClip,
    handleSplitSelectedClip,
    handleUndo,
    handleSeek,
    selectedClipId,
    currentTime,
  ]);

  const handleQuickPromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    try {
      setIsGeneratingQuick(true);
      await handleExecuteAgentAction({
        action: "generate_from_prompt",
        agentName: "Top Magic Prompt Bar",
        prompt: quickPrompt.trim(),
        aspectRatio: project.canvas.aspectRatio,
      });
      setQuickPrompt("");
    } finally {
      setIsGeneratingQuick(false);
    }
  };

  const handleTriggerRender = async () => {
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        format: "mp4",
      }),
    });
    const data = await res.json();
    if (data.ok && data.job) {
      setLatestRenderJob(data.job);
      setRenderModalOpen(true);
    }
  };

  const durationInFrames = Math.max(
    1,
    Math.round((project.canvas.duration || 10) * (project.canvas.fps || 30))
  );

  const isVertical = project.canvas.aspectRatio === "9:16";

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#06080E] text-slate-100 font-sans">
      {/* Top Studio Header */}
      <header className="h-14 shrink-0 border-b border-slate-800/80 bg-[#0A0E17] px-4 flex items-center justify-between gap-3">
        {/* Brand & Template Selector */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border border-sky-500/30">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-sm tracking-tight text-white">
              AGVI 2.0
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500 text-slate-950 font-bold">
              AI Video Studio
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <LayoutTemplate className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={
                Object.keys(STARTER_TEMPLATES).find(
                  (k) => STARTER_TEMPLATES[k].id === project.id
                ) || "ai-tech-explainer"
              }
              onChange={(e) =>
                handleExecuteAgentAction({
                  action: "apply_template",
                  agentName: "Template Switcher",
                  templateId: e.target.value,
                })
              }
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 font-medium cursor-pointer"
            >
              <option value="ai-tech-explainer">
                Showcase 1: AI Video Director (16:9)
              </option>
              <option value="tiktok-short-reel">
                Showcase 2: Viral TikTok / Reels (9:16)
              </option>
              <option value="product-launch-ad">
                Showcase 3: SaaS Launch Bento & CLI (16:9)
              </option>
            </select>
          </div>
        </div>

        {/* Center AI Prompt-to-Video Magic Bar */}
        <form
          onSubmit={handleQuickPromptSubmit}
          className="hidden lg:flex flex-1 max-w-xl items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#06080E] border border-sky-500/35 focus-within:border-sky-400 shadow-inner"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <input
            type="text"
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            placeholder="Nhập ý tưởng bất kỳ để AI tự dựng video 7 Tracks (VD: Khóa học AI TikTok 9:16 tăng +450%)..."
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isGeneratingQuick || !quickPrompt.trim()}
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-sky-400 to-indigo-400 hover:from-sky-300 hover:to-indigo-300 disabled:opacity-40 text-slate-950 font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Wand2 className="w-3 h-3" />
            {isGeneratingQuick ? "Generating..." : "AI Dựng Ngay"}
          </button>
        </form>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {toastMessage && (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/40 text-xs text-sky-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="max-w-[220px] truncate">{toastMessage}</span>
            </div>
          )}

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300">
            <span className="text-sky-400 font-semibold">
              {project.canvas.aspectRatio}
            </span>
            <span>•</span>
            <span>
              {project.canvas.width}×{project.canvas.height}
            </span>
            <span>•</span>
            <span>{project.canvas.duration}s</span>
          </div>

          <button
            onClick={() => setLiveSyncEnabled((v) => !v)}
            title="Automatically sync when external AI agents call /api/agent/actions"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
              liveSyncEnabled
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            <Radio
              className={`w-3.5 h-3.5 ${liveSyncEnabled ? "text-emerald-400 animate-pulse" : ""}`}
            />
            Live Sync
          </button>

          <button
            onClick={() => setShowSafeZones((s) => !s)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition cursor-pointer ${
              showSafeZones
                ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> Safe Zone
          </button>

          <button
            onClick={handleTriggerRender}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/15 transition cursor-pointer"
          >
            <Film className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <SchemaAndAgentPanel
          project={project}
          actionLogs={actionLogs}
          currentTime={currentTime}
          onApplyFullJson={handleApplyFullJson}
          onExecuteAgentAction={handleExecuteAgentAction}
        />

        {/* Center Remotion Video Preview Stage */}
        <main className="flex-1 flex flex-col items-center justify-center bg-[#05070B] p-5 relative overflow-hidden">
          <div
            className="relative flex items-center justify-center w-full h-full"
            onClick={() => setSelectedClipId(null)}
          >
            <div
              style={{
                aspectRatio: `${project.canvas.width} / ${project.canvas.height}`,
                maxHeight: "100%",
                maxWidth: isVertical ? "360px" : "100%",
                width: isVertical ? "auto" : "100%",
                height: isVertical ? "100%" : "auto",
              }}
              className="rounded-xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)] border border-slate-800/90 bg-black"
            >
              <AGVIPlayer
                ref={playerRef}
                component={AGVIComposition}
                inputProps={{
                  project,
                  selectedClipId,
                  onSelectClip: (id: string) => setSelectedClipId(id),
                  showSafeZones,
                }}
                durationInFrames={durationInFrames}
                compositionWidth={project.canvas.width}
                compositionHeight={project.canvas.height}
                fps={project.canvas.fps}
                onFrameChange={handleFrameChange}
                onPlayStateChange={handlePlayStateChange}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                controls
                loop
              />
            </div>
          </div>
        </main>

        <InspectorPanel
          project={project}
          selectedClip={selectedClip}
          onUpdateClip={handleUpdateClip}
          onDuplicateClip={handleDuplicateClip}
          onDeleteClip={handleDeleteClip}
          onUpdateCanvas={handleUpdateCanvas}
        />
      </div>

      {/* Bottom Interactive Multi-Track Timeline */}
      <TimelinePanel
        project={project}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isMuted={isMuted}
        canUndo={undoStack.length > 0}
        selectedClipId={selectedClipId}
        onSeek={handleSeek}
        onTogglePlay={handleTogglePlay}
        onToggleMute={handleToggleMute}
        onUndo={handleUndo}
        onSelectClip={setSelectedClipId}
        onToggleTrackHidden={handleToggleTrackHidden}
        onQuickAddClip={handleQuickAddClip}
        onSplitSelectedClip={handleSplitSelectedClip}
        onDuplicateSelectedClip={() =>
          selectedClipId && handleDuplicateClip(selectedClipId)
        }
        onDeleteSelectedClip={() =>
          selectedClipId && handleDeleteClip(selectedClipId)
        }
        onPreviewClipTiming={handlePreviewClipTiming}
        onCommitClipTiming={handleCommitClipTiming}
      />

      {/* Render / Export Modal */}
      {renderModalOpen && latestRenderJob && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#0B0F19] border border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">
                  AGVI Render & Export Pipeline (`POST /api/render`)
                </h3>
              </div>
              <button
                onClick={() => setRenderModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Job ID</div>
                  <div className="font-mono font-semibold text-sky-300 mt-0.5">
                    {latestRenderJob.id}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Resolution & FPS</div>
                  <div className="font-mono font-semibold text-slate-100 mt-0.5">
                    {latestRenderJob.resolution} @ {latestRenderJob.fps}fps
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Duration</div>
                  <div className="font-mono font-semibold text-emerald-300 mt-0.5">
                    {latestRenderJob.duration}s (
                    {Math.round(
                      latestRenderJob.duration * latestRenderJob.fps
                    )}{" "}
                    frames)
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" />
                    Headless Render Command
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(latestRenderJob.cliCommand);
                      setCopiedCli(true);
                      setTimeout(() => setCopiedCli(false), 1800);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] cursor-pointer"
                  >
                    {copiedCli ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Command
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-[#06080E] border border-slate-800 font-mono text-[11px] text-sky-300 overflow-x-auto">
                  {latestRenderJob.cliCommand}
                </pre>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(project, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${project.id}-bundle.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Project JSON Bundle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
