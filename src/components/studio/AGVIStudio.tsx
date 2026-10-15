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
  Zap,
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
import { renderProjectFrameToCanvas } from "@/lib/engine/frame-compositor";
import { AGVIComposition } from "@/components/remotion/AGVIComposition";
import { SchemaAndAgentPanel } from "./SchemaAndAgentPanel";
import { InspectorPanel } from "./InspectorPanel";
import { TimelinePanel } from "./TimelinePanel";

export const AGVIStudio: React.FC = () => {
  const [project, setProject] = useState<AGVIProject>(
    () => STARTER_TEMPLATES["kinetic-3d-keynote"]
  );
  const [actionLogs, setActionLogs] = useState<AgentActionLogEntry[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    "k3d-title-1"
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
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
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
    const timer = setTimeout(() => {
      void fetchServerSnapshot(true);
    }, 0);
    return () => clearTimeout(timer);
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
    const variant = shapeVariant || "3d-wireframe-prism";
    const defaultClips: Record<TrackType, Record<string, unknown>> = {
      text: {
        name: "3D Kinetic Title",
        type: "text",
        startTime: start,
        duration: 3.5,
        text: "KINETIC 3D MOTION HEADLINE",
        subtext: "6-DOF Depth • Multi-Keyframe Velocity",
        textEffect: "kinetic-char-3d",
        filter: {
          motionBlur: 0.65,
          chromaticAberration: 0.35,
        },
        transform: {
          x: -4,
          y: -18,
          z: 55,
          rotateX: 4,
          rotateY: -8,
          scale: 1,
          rotation: 0,
        },
        enterAnimation: { type: "3d-flip-x", duration: 0.35 },
      },
      caption: {
        name: "Karaoke Caption",
        type: "caption",
        startTime: start,
        duration: 3.5,
        text: "Phụ đề tự động đồng bộ từng từ trên timeline không đè chữ",
        preset: "minimal-box",
        highlightColor: "#CCFF00",
        transform: { x: 0, y: 37, scale: 1, rotation: 0 },
      },
      shape: {
        name: `3D Layer: ${variant}`,
        type: "shape",
        shapeVariant: variant,
        startTime: start,
        duration: 3.8,
        title:
          variant === "3d-wireframe-prism"
            ? "WEBGL 3D PRISM STAGE"
            : variant === "3d-carousel-stack"
              ? "3D CAROUSEL STACK"
              : variant === "kinetic-impact-wall"
                ? "HIGH-TEMPO 3D ENGINE"
                : "AI Telemetry Widget",
        subtitle: "60FPS Frame-Locked 3D",
        metricValue: "60 FPS",
        metricTrend: "Deterministic Sync",
        accentColor: "#CCFF00",
        transform: {
          x: 0,
          y: 2,
          z: 40,
          rotateX: 4,
          rotateY: -10,
          scale: 1,
          rotation: 0,
          width: 66,
        },
        enterAnimation: { type: "3d-flip-y", duration: 0.35 },
      },
      image: {
        name: "3D Matte Backdrop",
        type: "image",
        startTime: start,
        duration: 4,
        src: "procedural://kinetic-3d-keynote",
        kenBurns: "zoom-in",
      },
      video: {
        name: "3D WebGL Stage",
        type: "video",
        startTime: start,
        duration: 4,
        src: "procedural-video://webgl-3d-prism",
        cameraMotion: "orbit-3d-left",
        sceneTransition: "3d-cube-spin",
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
      } else if (
        e.key.toLowerCase() === "s" &&
        !e.ctrlKey &&
        !e.metaKey &&
        selectedClipId
      ) {
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
      pushUndoSnapshot(project);
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          agentName: "Top Magic Prompt Bar",
          prompt: quickPrompt.trim(),
          aspectRatio: project.canvas.aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate video from prompt");
      }
      lastUpdatedAtRef.current = data.project.updatedAt;
      setProject(data.project);
      soundEngine.playTechChime();
      if (data.log) {
        setActionLogs((prev) => [data.log, ...prev]);
        showToast(data.log.summary);
      }
      setQuickPrompt("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingQuick(false);
    }
  };

  const handleTriggerRender = async (
    format: "mp4" | "webm" | "json-bundle" = "webm"
  ) => {
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        format,
      }),
    });
    const data = await res.json();
    if (data.ok && data.job) {
      setLatestRenderJob(data.job);
      setRenderModalOpen(true);
    }
  };

  /**
   * Real Client-Side Full-Duration Video + Audio Exporter (.webm / .mp4 via Unified Frame Compositor + WebAudio MediaRecorder).
   * - Renders every frame across the full project duration (`Math.round(project.canvas.duration * fps)`) — NO 180-frame cap!
   * - Evaluates all timeline tracks, 6-DOF keyframes, camera rigs, motion overlays, and widget variants via `renderProjectFrameToCanvas`.
   * - Multiplexes the synthesized Web Audio soundtrack & transition/Sub-Bass SFX stream into `MediaRecorder` via `soundEngine.createExportAudioStream()`.
   * - Updates the server `RenderJob` status honestly (`queued` -> `rendering` -> `completed` | `failed`).
   */
  const handleBrowserVideoExport = async () => {
    if (isRecordingVideo) return;

    const requestedFormat = latestRenderJob?.format || "webm";
    const activeJobId = latestRenderJob?.id;

    if (requestedFormat === "json-bundle") {
      const jsonStr = JSON.stringify(project, null, 2);
      const blob = new Blob([jsonStr], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.id || "agvi-project"}-bundle.json`;
      a.click();
      URL.revokeObjectURL(url);
      if (activeJobId) {
        fetch("/api/render", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: activeJobId,
            status: "completed",
            progress: 100,
            fileSizeBytes: blob.size,
          }),
        })
          .then((r) => r.json())
          .then((d) => d.job && setLatestRenderJob(d.job))
          .catch(() => {});
      }
      showToast(`Exported JSON Bundle (${project.id}-bundle.json)`);
      return;
    }

    setIsRecordingVideo(true);
    setRecordingProgress(0);

    const { stream: audioStream, cleanup: cleanupAudioStream } =
      soundEngine.createExportAudioStream();

    try {
      if (activeJobId) {
        const res = await fetch("/api/render", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: activeJobId,
            status: "rendering",
            progress: 1,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.job) setLatestRenderJob(data.job);
      }

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = project.canvas.width;
      exportCanvas.height = project.canvas.height;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      const fps = Math.min(60, Math.max(24, project.canvas.fps || 30));
      const videoStream = exportCanvas.captureStream(fps);

      // Multiplex Canvas Video Track + WebAudio Soundtrack Track into a unified MediaStream
      const combinedTracks: MediaStreamTrack[] = [
        ...videoStream.getVideoTracks(),
        ...(audioStream ? audioStream.getAudioTracks() : []),
      ];
      const combinedStream = new MediaStream(combinedTracks);

      const prefersMp4 = requestedFormat === "mp4";
      const mp4Candidate =
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("video/mp4;codecs=avc1,mp4a.40.2")
          ? "video/mp4;codecs=avc1,mp4a.40.2"
          : typeof MediaRecorder !== "undefined" &&
              MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
            ? "video/mp4;codecs=avc1"
            : typeof MediaRecorder !== "undefined" &&
                MediaRecorder.isTypeSupported("video/mp4")
              ? "video/mp4"
              : "";
      const webmCandidate =
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : typeof MediaRecorder !== "undefined" &&
              MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
            ? "video/webm;codecs=vp8,opus"
            : typeof MediaRecorder !== "undefined" &&
                MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
              ? "video/webm;codecs=vp9"
              : typeof MediaRecorder !== "undefined" &&
                  MediaRecorder.isTypeSupported("video/webm")
                ? "video/webm"
                : "";

      const mimeType = prefersMp4
        ? mp4Candidate || webmCandidate
        : webmCandidate || mp4Candidate;
      const fileExt =
        prefersMp4 && mp4Candidate
          ? "mp4"
          : !prefersMp4 && webmCandidate
            ? "webm"
            : mp4Candidate
              ? "mp4"
              : "webm";

      const recorder = new MediaRecorder(
        combinedStream,
        mimeType
          ? { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 }
          : { videoBitsPerSecond: 8_000_000 }
      );

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const donePromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(
            new Blob(chunks, {
              type: mimeType || (fileExt === "mp4" ? "video/mp4" : "video/webm"),
            })
          );
        };
      });

      recorder.start(100);

      // Full timeline duration rendering — NO arbitrary 180-frame cap!
      const projectDuration = Math.max(1, project.canvas.duration || 10);
      const totalExportFrames = Math.max(1, Math.round(projectDuration * fps));
      const frameIntervalMs = Math.max(8, Math.round(1000 / fps));

      // Preload external ImageClip & VideoClip URLs into FrameAssetCache so non-procedural assets render cleanly
      const imageCache = new Map<string, HTMLImageElement>();
      const videoCache = new Map<string, HTMLVideoElement>();
      for (const trk of project.tracks) {
        if (trk.hidden) continue;
        for (const clip of trk.clips) {
          if (
            (clip.type === "image" || clip.type === "video") &&
            clip.src &&
            !clip.src.startsWith("procedural://") &&
            !clip.src.startsWith("procedural-video://")
          ) {
            if (clip.type === "image" && !imageCache.has(clip.src)) {
              const imgEl = new Image();
              imgEl.crossOrigin = "anonymous";
              imgEl.src = clip.src;
              imageCache.set(clip.src, imgEl);
            } else if (clip.type === "video" && !videoCache.has(clip.src)) {
              const vidEl = document.createElement("video");
              vidEl.crossOrigin = "anonymous";
              vidEl.muted = true;
              vidEl.playsInline = true;
              vidEl.preload = "auto";
              vidEl.src = clip.src;
              videoCache.set(clip.src, vidEl);
            }
          }
        }
      }
      const frameAssets = { images: imageCache, videos: videoCache };

      for (let f = 0; f < totalExportFrames; f++) {
        const simSec = f / fps;
        playerRef.current?.seekTo(f);

        // Sync any preloaded HTMLVideoElement timestamps to the current frame time
        for (const trk of project.tracks) {
          if (trk.hidden) continue;
          for (const clip of trk.clips) {
            if (
              clip.type === "video" &&
              clip.src &&
              videoCache.has(clip.src) &&
              simSec >= clip.startTime &&
              simSec <= clip.startTime + clip.duration
            ) {
              const vidEl = videoCache.get(clip.src)!;
              const targetTime =
                (clip.trimStart || 0) +
                (simSec - clip.startTime) * (clip.playbackRate || 1);
              if (Math.abs(vidEl.currentTime - targetTime) > 0.08) {
                try {
                  vidEl.currentTime = targetTime;
                } catch {
                  // Ignore seek errors on unbuffered streams
                }
              }
            }
          }
        }

        // Trigger synchronized procedural soundtrack + transition SFX into the multiplexed AudioStream
        soundEngine.syncTime(simSec, project, true, true);

        // Composite the exact frame using the unified deterministic frame compositor
        renderProjectFrameToCanvas(ctx, project, f, frameAssets);

        const pct = Math.round(((f + 1) / totalExportFrames) * 100);
        setRecordingProgress(pct);
        await new Promise((r) => setTimeout(r, frameIntervalMs));
      }

      recorder.stop();
      const videoBlob = await donePromise;
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.id || "agvi-3d-render"}.${fileExt}`;
      a.click();
      URL.revokeObjectURL(url);

      if (activeJobId) {
        const res = await fetch("/api/render", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: activeJobId,
            status: "completed",
            progress: 100,
            fileSizeBytes: videoBlob.size,
            outputPath: `${project.id || "agvi-3d-render"}.${fileExt}`,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.job) setLatestRenderJob(data.job);
      }

      showToast(
        `Exported Full ${projectDuration}s (${totalExportFrames} frames @ ${fps}fps) Video + Audio (${project.id}.${fileExt})`
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (activeJobId) {
        fetch("/api/render", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: activeJobId,
            status: "failed",
            progress: 0,
            errorMessage: errMsg,
          }),
        })
          .then((r) => r.json())
          .then((d) => d.job && setLatestRenderJob(d.job))
          .catch(() => {});
      }
      showToast(`Video export error: ${errMsg}`);
    } finally {
      cleanupAudioStream();
      setIsRecordingVideo(false);
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
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-lime-400/10 border border-lime-400/35">
            <Cpu className="w-4 h-4 text-lime-400" />
            <span className="font-bold text-sm tracking-tight text-white">
              AGVI 3D
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-lime-400 text-slate-950 font-bold">
              60FPS Motion Engine
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <LayoutTemplate className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={
                Object.keys(STARTER_TEMPLATES).find(
                  (k) => STARTER_TEMPLATES[k].id === project.id
                ) || "kinetic-3d-keynote"
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
              <option value="kinetic-3d-keynote">
                Showcase 0: Kinetic 3D Motion Engine (60fps 16:9)
              </option>
              <option value="ai-tech-explainer">
                Showcase 1: Hybrid Video + Motion Rig (16:9)
              </option>
              <option value="tiktok-short-reel">
                Showcase 2: Vertical Editorial Essay (9:16)
              </option>
              <option value="product-launch-ad">
                Showcase 3: Blueprint Mono Release & CLI (16:9)
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
            placeholder="Nhập ý tưởng bất kỳ để AI tự dựng video 3D / Kinetic 7 Tracks (VD: Motion Graphics 3D nhịp độ cao 60fps)..."
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isGeneratingQuick || !quickPrompt.trim()}
            className="px-2.5 py-1 rounded-lg bg-lime-400 hover:bg-lime-300 disabled:opacity-40 text-slate-950 font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Wand2 className="w-3 h-3" />
            {isGeneratingQuick ? "Generating..." : "AI Dựng 3D"}
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

          <button
            onClick={() =>
              handleExecuteAgentAction({
                action: "choreograph_3d_kinetic_scene",
                agentName: "Studio 3D Kinetic Rig",
                clipId: selectedClipId ?? undefined,
                cameraMotion: "orbit-3d-left",
                sceneTransition: "3d-cube-spin",
                textEffect: "kinetic-char-3d",
              })
            }
            title="1-Click: Attach 6-DOF 3D Camera Rig, 4-Point Whip Keyframe Graph & Directional Motion Blur"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-lime-400/15 hover:bg-lime-400/25 border border-lime-400/45 text-lime-300 font-semibold text-xs transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-lime-400" />
            3D Kinetic Rig
          </button>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300">
            <span className="text-lime-400 font-semibold">
              {project.canvas.aspectRatio}
            </span>
            <span>•</span>
            <span>
              {project.canvas.width}×{project.canvas.height}
            </span>
            <span>•</span>
            <span className="text-sky-400">{project.canvas.fps}fps</span>
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
            onClick={() => handleTriggerRender("webm")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-lime-400 hover:bg-lime-300 text-slate-950 font-bold text-xs shadow-md shadow-lime-400/15 transition cursor-pointer"
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
                <Film className="w-4 h-4 text-lime-400" />
                <h3 className="text-sm font-bold text-white">
                  AGVI 3D Render & Browser Video Export (`POST /api/render`)
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
              <div className="grid grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Job ID</div>
                  <div className="font-mono font-semibold text-sky-300 mt-0.5 truncate">
                    {latestRenderJob.id}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Lifecycle Status</div>
                  <div className="font-mono font-semibold mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        latestRenderJob.status === "completed"
                          ? "bg-emerald-400"
                          : latestRenderJob.status === "failed"
                            ? "bg-rose-400"
                            : latestRenderJob.status === "rendering"
                              ? "bg-amber-400 animate-pulse"
                              : "bg-sky-400"
                      }`}
                    />
                    <span
                      className={
                        latestRenderJob.status === "completed"
                          ? "text-emerald-300"
                          : latestRenderJob.status === "failed"
                            ? "text-rose-300"
                            : latestRenderJob.status === "rendering"
                              ? "text-amber-300"
                              : "text-sky-300"
                      }
                    >
                      {latestRenderJob.status} ({latestRenderJob.progress}%)
                    </span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Resolution & FPS</div>
                  <div className="font-mono font-semibold text-slate-100 mt-0.5">
                    {latestRenderJob.resolution} @ {latestRenderJob.fps}fps
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Duration & Frames</div>
                  <div className="font-mono font-semibold text-emerald-300 mt-0.5">
                    {latestRenderJob.duration}s (
                    {latestRenderJob.frameCount ??
                      Math.round(
                        latestRenderJob.duration * latestRenderJob.fps
                      )}
                    f)
                  </div>
                </div>
              </div>

              {latestRenderJob.errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 font-mono text-[11px] text-rose-300">
                  {latestRenderJob.errorMessage}
                </div>
              )}

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-slate-300 font-medium">
                  Output Format (`format`)
                </span>
                <div className="flex items-center gap-1.5">
                  {(["webm", "mp4", "json-bundle"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => handleTriggerRender(fmt)}
                      className={`px-2.5 py-1 rounded font-mono text-[11px] transition cursor-pointer ${
                        latestRenderJob.format === fmt
                          ? "bg-lime-400 text-slate-950 font-bold"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" />
                    Headless FFmpeg Render Command
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

              {isRecordingVideo && (
                <div className="p-3 rounded-lg bg-lime-400/10 border border-lime-400/30 space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-[11px] text-lime-300">
                    <span>Rendering 60fps 3D WebGL & Kinetic Video Stream...</span>
                    <span>{recordingProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded bg-slate-900 overflow-hidden">
                    <div
                      style={{ width: `${recordingProgress}%` }}
                      className="h-full bg-lime-400 transition-all"
                    />
                  </div>
                </div>
              )}

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
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download JSON Bundle
                </button>
                <button
                  onClick={handleBrowserVideoExport}
                  disabled={isRecordingVideo}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-slate-950 font-bold cursor-pointer"
                >
                  <Film className="w-3.5 h-3.5" />
                  {isRecordingVideo
                    ? `Rendering Video (${recordingProgress}%)...`
                    : latestRenderJob?.format === "json-bundle"
                      ? "Export .json-bundle Package"
                      : `Record & Download .${latestRenderJob?.format || "webm"} Video (${project.canvas.fps || 60}fps)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
