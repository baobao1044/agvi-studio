"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Code,
  Copy,
  Download,
  FileJson,
  Play,
  ShieldCheck,
  Sliders,
  Terminal,
  Wand2,
} from "lucide-react";
import {
  AGVIProject,
  AspectRatio,
  ValidationIssue,
  getAgentSchemaDocumentation,
  validateAndNormalizeProject,
} from "@/lib/schema/timeline-schema";
import {
  AgentActionLogEntry,
  AgentActionPayload,
} from "@/lib/server/project-store";
import {
  DESIGN_DIRECTION_PRESETS,
  DesignDirectionId,
} from "@/lib/anti-slop/anti-slop-filter";

interface SchemaAndAgentPanelProps {
  project: AGVIProject;
  actionLogs: AgentActionLogEntry[];
  currentTime: number;
  onApplyFullJson: (rawJson: unknown) => Promise<void>;
  onExecuteAgentAction: (payload: AgentActionPayload) => Promise<void>;
}

const PROMPT_CHIPS: Array<{
  label: string;
  prompt: string;
  ratio: AspectRatio;
  direction: DesignDirectionId;
}> = [
  {
    label: "01 / Swiss Industrial (16:9)",
    prompt:
      "Giải thích kiến trúc trình dựng video bằng JSON Schema ở tốc độ 30fps, 6 tracks đồng bộ",
    ratio: "16:9",
    direction: "swiss-industrial",
  },
  {
    label: "02 / Warm Editorial (9:16)",
    prompt:
      "Bốn nguyên tắc thiết kế video dọc 9:16 rõ ràng, không đè chữ, không dùng số liệu ảo",
    ratio: "9:16",
    direction: "warm-editorial",
  },
  {
    label: "03 / Blueprint Mono (16:9)",
    prompt:
      "Tích hợp cổng HTTP REST API và MCP để AI Agent tự động biên dịch kịch bản thành timeline",
    ratio: "16:9",
    direction: "cobalt-technical",
  },
];

const PRESET_AGENT_PAYLOADS: Record<
  string,
  { label: string; description: string; payload: AgentActionPayload }
> = {
  hybridVideoMotion: {
    label: "01. 1-Call Hybrid Video + Motion Rig",
    description:
      "Action: enhance_video_with_motion — Attaches Camera Zoom Rig + Shutter Wipe + SVG Spotlight Callout directly onto video footage.",
    payload: {
      action: "enhance_video_with_motion",
      agentName: "AGVI Motion Compositor Agent",
      videoSrc: "procedural-video://product-ui-capture",
      cameraMotion: "focus-zoom-left",
      sceneTransition: "shutter-wipe",
      motionOverlay: {
        preset: "spotlight-pointer",
        title: "01 / AUTO-SPOTLIGHT TARGET",
        subtitle:
          "Chỉ 1 lệnh JSON tự động làm tối vùng ngoại vi, zoom camera và vẽ đường dẫn SVG vào video.",
        targetX: -14,
        targetY: -8,
      },
    },
  },
  promptDirector: {
    label: "02. Hybrid Prompt-to-Video Compiler",
    description:
      "Action: generate_from_prompt — Compiles 4 scenes combining live video streams, camera rigs, spotlight callouts & process steppers.",
    payload: {
      action: "generate_from_prompt",
      agentName: "AGVI Editorial Director",
      aspectRatio: "16:9",
      designDirection: "swiss-industrial",
      prompt:
        "Tích hợp hiệu ứng Motion Graphics trực tiếp vào video thực tế với Camera Rig, Spotlight Callout và bộ lọc Anti-Slop",
    },
  },
  storyboard: {
    label: "03. Varied Rhythm 4-Scene Storyboard",
    description:
      "Action: build_from_storyboard — Alternates statement-only -> asymmetric-split -> artifact-focus with video + motion.",
    payload: {
      action: "build_from_storyboard",
      agentName: "Editorial Storyboard Agent",
      title: "AGVI Hybrid Video + Motion Walkthrough",
      aspectRatio: "16:9",
      designDirection: "swiss-industrial",
      scenes: [
        {
          duration: 4,
          layoutPattern: "statement-only",
          useVideoFootage: true,
          cameraMotion: "letterbox-cinema",
          sceneTransition: "shutter-wipe",
          motionOverlay: {
            preset: "hud-telemetry",
            title: "LIVE CAPTURE // 30 FPS SYNC",
          },
          headline: "Tích Hợp Motion Graphics Vào Video Thực Tế.",
          subheadline:
            "Không cần tính toán tọa độ đa lớp, không bịa đặt số liệu phần trăm.",
          narration:
            "Mở đầu bằng luồng video thực tế kết hợp khung ngắm thông số kỹ thuật và chữ lớn căn trái",
          lowerThirdTitle: "01 / VIDEO + HUD TELEMETRY",
        },
        {
          duration: 4,
          layoutPattern: "asymmetric-split",
          useVideoFootage: true,
          cameraMotion: "focus-zoom-left",
          sceneTransition: "iris-frame",
          motionOverlay: {
            preset: "spotlight-pointer",
            title: "TIÊU ĐIỂM TỰ ĐỘNG",
            subtitle: "Tự động zoom camera và vẽ đường chỉ dẫn SVG tới (-14%, -8%).",
            targetX: -14,
            targetY: -8,
          },
          headline: "Gắn Spotlight & Quy Trình 3 Bước",
          subheadline:
            "Cột trái tự động thu phóng vào tiêu điểm video, cột phải hiển thị tiến trình.",
          narration:
            "Cảnh hai tự động làm tối vùng ngoại vi và gắn nhãn chỉ dẫn trực tiếp lên luồng video",
          widgetType: "process-stepper",
          lowerThirdTitle: "02 / SPOTLIGHT + STEPPER",
        },
        {
          duration: 4,
          layoutPattern: "artifact-focus",
          sceneTransition: "editorial-curtain",
          narration:
            "Cảnh ba so sánh trực diện giữa cách dựng đa lớp thủ công và cơ chế gắn hiệu ứng một chạm",
          widgetType: "split-comparison",
          lowerThirdTitle: "03 / BEFORE VS AFTER",
        },
        {
          duration: 4,
          layoutPattern: "asymmetric-split",
          useVideoFootage: true,
          cameraMotion: "isometric-3d-frame",
          sceneTransition: "shutter-wipe",
          headline: "Điều Khiển Qua Giao Thức HTTP",
          subheadline:
            "Tương thích trực tiếp với mọi AI Agent chỉ bằng 1 thuộc tính JSON.",
          narration:
            "Cảnh kết dựng khung hình nghiêng ba chiều và hiển thị mã lệnh điều khiển trực tiếp",
          widgetType: "code-card",
          codeSnippet: `{\n  "action": "enhance_video_with_motion",\n  "cameraMotion": "focus-zoom-left",\n  "motionOverlay": {\n    "preset": "spotlight-pointer"\n  }\n}`,
          lowerThirdTitle: "04 / 3D RIG + API",
        },
      ],
    },
  },
  switchDirection: {
    label: "04. Switch Art Direction Preset",
    description:
      "Action: set_design_direction — Switches palette & typography to Warm Editorial (Paper Ink + Vermilion).",
    payload: {
      action: "set_design_direction",
      agentName: "Art Direction Agent",
      designDirection: "warm-editorial",
    },
  },
};

export const SchemaAndAgentPanel: React.FC<SchemaAndAgentPanelProps> = ({
  project,
  actionLogs,
  onApplyFullJson,
  onExecuteAgentAction,
}) => {
  const [activeTab, setActiveTab] = useState<"agent" | "json" | "docs">(
    "agent"
  );
  const currentDirectionId =
    (project.agentMeta?.designDirection as DesignDirectionId | undefined) ||
    "swiss-industrial";

  const [promptInput, setPromptInput] = useState<string>(
    "Giải thích kiến trúc trình dựng video bằng JSON Schema ở tốc độ 30fps, 6 tracks đồng bộ"
  );
  const [promptRatio, setPromptRatio] = useState<AspectRatio>(
    project.canvas.aspectRatio
  );
  const [selectedDirection, setSelectedDirection] =
    useState<DesignDirectionId>(currentDirectionId);

  const [jsonText, setJsonText] = useState<string>(() =>
    JSON.stringify(project, null, 2)
  );
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    []
  );
  const [isJsonValid, setIsJsonValid] = useState<boolean>(true);
  const [parseError, setParseError] = useState<string | null>(null);

  const [actionText, setActionText] = useState<string>(() =>
    JSON.stringify(PRESET_AGENT_PAYLOADS.promptDirector.payload, null, 2)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedTools, setCopiedTools] = useState(false);

  useEffect(() => {
    setJsonText(JSON.stringify(project, null, 2));
    setPromptRatio(project.canvas.aspectRatio);
    if (project.agentMeta?.designDirection) {
      setSelectedDirection(
        project.agentMeta.designDirection as DesignDirectionId
      );
    }
    setParseError(null);
    setValidationIssues([]);
    setIsJsonValid(true);
  }, [project]);

  const handleGenerateFromPrompt = async (
    customPrompt?: string,
    customRatio?: AspectRatio,
    customDirection?: DesignDirectionId
  ) => {
    const finalPrompt = (customPrompt ?? promptInput).trim();
    if (!finalPrompt) return;
    const finalRatio = customRatio ?? promptRatio;
    const finalDirection = customDirection ?? selectedDirection;
    const payload: AgentActionPayload = {
      action: "generate_from_prompt",
      agentName: "AGVI Editorial Director",
      prompt: finalPrompt,
      aspectRatio: finalRatio,
      designDirection: finalDirection,
    };
    setActionText(JSON.stringify(payload, null, 2));
    try {
      setIsSubmitting(true);
      await onExecuteAgentAction(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectionChange = async (dirId: DesignDirectionId) => {
    setSelectedDirection(dirId);
    const payload: AgentActionPayload = {
      action: "set_design_direction",
      agentName: "Art Direction Controller",
      designDirection: dirId,
    };
    setActionText(JSON.stringify(payload, null, 2));
    try {
      setIsSubmitting(true);
      await onExecuteAgentAction(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJsonChange = (val: string) => {
    setJsonText(val);
    try {
      const parsed = JSON.parse(val);
      setParseError(null);
      const res = validateAndNormalizeProject(parsed, true);
      setIsJsonValid(res.valid);
      setValidationIssues(res.issues);
    } catch (e) {
      setIsJsonValid(false);
      setParseError(e instanceof Error ? e.message : "Syntax error in JSON");
    }
  };

  const handleFormatAndNormalize = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const res = validateAndNormalizeProject(parsed, true);
      if (res.normalizedProject) {
        setJsonText(JSON.stringify(res.normalizedProject, null, 2));
        setParseError(null);
        setValidationIssues(res.issues);
        setIsJsonValid(res.valid);
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  const handleApplyJsonClick = async () => {
    try {
      setIsSubmitting(true);
      const parsed = JSON.parse(jsonText);
      await onApplyFullJson(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunActionClick = async () => {
    try {
      setIsSubmitting(true);
      const parsed = JSON.parse(actionText) as AgentActionPayload;
      await onExecuteAgentAction({
        projectId: project.id,
        ...parsed,
      });
    } catch (e) {
      alert(
        `Invalid Action JSON: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCurl = () => {
    const compact = actionText.replace(/\n\s*/g, " ");
    const curl = `curl -X POST http://localhost:3000/api/agent/actions \\\n  -H "Content-Type: application/json" \\\n  -H "x-agent-name: External-AI-Agent" \\\n  -d '${compact}'`;
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 1800);
  };

  const handleCopyOpenAITools = () => {
    const docs = getAgentSchemaDocumentation();
    navigator.clipboard.writeText(
      JSON.stringify(docs.openaiToolDefinitions, null, 2)
    );
    setCopiedTools(true);
    setTimeout(() => setCopiedTools(false), 1800);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.id || "agvi-project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activePreset =
    DESIGN_DIRECTION_PRESETS[selectedDirection] ||
    DESIGN_DIRECTION_PRESETS["swiss-industrial"];

  return (
    <div className="w-[410px] shrink-0 border-r border-[#2A2A26] bg-[#111110] flex flex-col overflow-hidden">
      {/* Top Mode Switcher (Crisp structural tabs, zero slop gradients) */}
      <div className="grid grid-cols-3 border-b border-[#2A2A26] bg-[#0D0D0C] p-1 gap-1">
        <button
          onClick={() => setActiveTab("agent")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition cursor-pointer ${
            activeTab === "agent"
              ? "bg-[#1F1F1C] text-[#F2F0EA] border border-[#FF4F00]/60"
              : "text-[#9A9890] hover:text-[#F2F0EA]"
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-[#FF4F00]" />
          Director & Gate
        </button>
        <button
          onClick={() => setActiveTab("json")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition cursor-pointer ${
            activeTab === "json"
              ? "bg-[#1F1F1C] text-[#F2F0EA] border border-[#FF4F00]/60"
              : "text-[#9A9890] hover:text-[#F2F0EA]"
          }`}
        >
          <FileJson className="w-3.5 h-3.5" />
          JSON Schema
        </button>
        <button
          onClick={() => setActiveTab("docs")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition cursor-pointer ${
            activeTab === "docs"
              ? "bg-[#1F1F1C] text-[#F2F0EA] border border-[#FF4F00]/60"
              : "text-[#9A9890] hover:text-[#F2F0EA]"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Logs & Spec
        </button>
      </div>

      {/* TAB 1: EDITORIAL DIRECTOR + ANTI-SLOP GATE + API PLAYGROUND */}
      {activeTab === "agent" && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3.5 space-y-3.5">
          {/* Anti-Slop Design Direction & Dials Card */}
          <div className="p-3 rounded bg-[#161614] border border-[#2A2A26] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#F2F0EA] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FF4F00]" />
                Anti-Slop Gate • 11/11 Rules Active
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1F1F1C] text-[#FF4F00] border border-[#2A2A26]">
                DESIGN.md
              </span>
            </div>

            {/* Art Direction Preset Selector */}
            <div className="grid grid-cols-2 gap-1.5">
              {(
                Object.values(DESIGN_DIRECTION_PRESETS) as Array<
                  (typeof DESIGN_DIRECTION_PRESETS)[DesignDirectionId]
                >
              ).map((preset) => {
                const isSelected = selectedDirection === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleDirectionChange(preset.id)}
                    className={`p-2 rounded text-left border transition cursor-pointer ${
                      isSelected
                        ? "bg-[#1F1F1C] border-[#FF4F00] text-[#F2F0EA]"
                        : "bg-[#0D0D0C] border-[#2A2A26] text-[#9A9890] hover:text-[#F2F0EA]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold truncate">
                        {preset.id}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: preset.palette.accent }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-[#9A9890] mt-0.5">
                      E:{preset.energy} R:{preset.rhythm} M:{preset.motion}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-[#9A9890] pt-1 border-t border-[#2A2A26]">
              <span className="flex items-center gap-1">
                <Sliders className="w-3 h-3 text-[#FF4F00]" />
                ENERGY {activePreset.energy}/10 • RHYTHM {activePreset.rhythm}/10 • MOTION {activePreset.motion}/10
              </span>
              <span style={{ color: activePreset.palette.accent }}>
                Accent {activePreset.palette.accent}
              </span>
            </div>
          </div>

          {/* Prompt-to-Video Compiler Box */}
          <div className="p-3 rounded bg-[#161614] border border-[#2A2A26] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F2F0EA] flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-[#FF4F00]" />
                Editorial Prompt-to-Video Compiler
              </span>
              <div className="flex items-center gap-1">
                {(["16:9", "9:16", "1:1"] as AspectRatio[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setPromptRatio(r)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                      promptRatio === r
                        ? "bg-[#FF4F00] text-[#0D0D0C] font-bold"
                        : "bg-[#0D0D0C] text-[#9A9890] border border-[#2A2A26] hover:text-[#F2F0EA]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={2}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Nhập kịch bản hoặc chủ đề (Trích xuất thông số thực tế, không tự bịa % ảo)..."
              className="w-full p-2.5 rounded bg-[#0D0D0C] border border-[#2A2A26] focus:border-[#FF4F00] focus:outline-none text-xs text-[#F2F0EA] resize-none"
            />

            <div className="flex flex-wrap gap-1">
              {PROMPT_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPromptInput(chip.prompt);
                    setPromptRatio(chip.ratio);
                    setSelectedDirection(chip.direction);
                    handleGenerateFromPrompt(
                      chip.prompt,
                      chip.ratio,
                      chip.direction
                    );
                  }}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-[#0D0D0C] hover:bg-[#1F1F1C] text-[#F2F0EA] border border-[#2A2A26] transition cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleGenerateFromPrompt()}
              disabled={isSubmitting}
              className="w-full py-2 px-3 rounded bg-[#FF4F00] hover:bg-[#e04600] text-[#0D0D0C] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {isSubmitting
                ? "Đang biên dịch & kiểm duyệt Anti-Slop..."
                : `Biên Dịch Video (${promptRatio} • ${selectedDirection})`}
            </button>
          </div>

          {/* Preset Action Templates */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9A9890] mb-1.5">
              Mẫu Lệnh REST API (`POST /api/agent/actions`)
            </label>
            <div className="space-y-1.5">
              {Object.entries(PRESET_AGENT_PAYLOADS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() =>
                    setActionText(JSON.stringify(item.payload, null, 2))
                  }
                  className="w-full text-left p-2 rounded bg-[#161614] hover:bg-[#1F1F1C] border border-[#2A2A26] transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#F2F0EA]">
                      {item.label}
                    </span>
                    <span className="text-[10px] font-mono text-[#FF4F00] bg-[#0D0D0C] px-1.5 py-0.5 rounded border border-[#2A2A26]">
                      {item.payload.action}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9A9890] mt-0.5 line-clamp-1">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* JSON Payload Editor */}
          <div className="flex-1 flex flex-col min-h-[150px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono text-[#9A9890]">
                API Request Payload (`JSON`)
              </span>
              <button
                onClick={handleCopyCurl}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#161614] hover:bg-[#1F1F1C] border border-[#2A2A26] text-[10px] text-[#F2F0EA] cursor-pointer"
              >
                {copiedCurl ? (
                  <>
                    <Check className="w-3 h-3 text-[#FF4F00]" /> Copied cURL
                  </>
                ) : (
                  <>
                    <Terminal className="w-3 h-3 text-[#FF4F00]" /> Copy cURL
                  </>
                )}
              </button>
            </div>
            <textarea
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full p-2.5 rounded bg-[#0D0D0C] border border-[#2A2A26] focus:border-[#FF4F00] focus:outline-none font-mono text-[11px] text-[#F2F0EA] leading-relaxed resize-none"
            />
          </div>

          <button
            onClick={handleRunActionClick}
            disabled={isSubmitting}
            className="w-full py-2 px-4 rounded bg-[#1F1F1C] hover:bg-[#2A2A26] border border-[#FF4F00]/60 text-[#F2F0EA] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current text-[#FF4F00]" />
            Thực Thi Payload JSON (`POST /api/agent/actions`)
          </button>
        </div>
      )}

      {/* TAB 2: FULL JSON TIMELINE SCHEMA EDITOR */}
      {activeTab === "json" && (
        <div className="flex-1 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {isJsonValid && !parseError ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-[#F2F0EA] bg-[#161614] border border-[#2A2A26] px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#FF4F00]" />
                  Schema v1.0 Valid
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Invalid JSON
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleFormatAndNormalize}
                title="Auto-fix missing fields & normalize timestamps"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#161614] hover:bg-[#1F1F1C] border border-[#2A2A26] text-[11px] text-[#F2F0EA] cursor-pointer"
              >
                <Wand2 className="w-3 h-3 text-[#FF4F00]" /> Normalize
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(jsonText);
                  setCopiedJson(true);
                  setTimeout(() => setCopiedJson(false), 1500);
                }}
                className="p-1.5 rounded bg-[#161614] hover:bg-[#1F1F1C] border border-[#2A2A26] text-[#F2F0EA] cursor-pointer"
                title="Copy JSON"
              >
                {copiedJson ? (
                  <Check className="w-3.5 h-3.5 text-[#FF4F00]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={handleDownloadJson}
                className="p-1.5 rounded bg-[#161614] hover:bg-[#1F1F1C] border border-[#2A2A26] text-[#F2F0EA] cursor-pointer"
                title="Download .json file"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {parseError && (
            <div className="p-2 rounded bg-rose-500/15 border border-rose-500/40 text-[11px] font-mono text-rose-300">
              {parseError}
            </div>
          )}

          {validationIssues.length > 0 && !parseError && (
            <div className="p-2 rounded bg-[#161614] border border-[#2A2A26] text-[11px] text-[#9A9890] max-h-20 overflow-y-auto space-y-1">
              {validationIssues.map((iss, idx) => (
                <div key={idx}>
                  <span className="font-mono text-[#FF4F00]">{iss.path}:</span>{" "}
                  {iss.message}
                </div>
              ))}
            </div>
          )}

          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-3 rounded bg-[#0D0D0C] border border-[#2A2A26] focus:border-[#FF4F00] focus:outline-none font-mono text-[11px] text-[#F2F0EA] leading-relaxed resize-none"
          />

          <button
            onClick={handleApplyJsonClick}
            disabled={isSubmitting || Boolean(parseError)}
            className="w-full py-2.5 px-4 rounded bg-[#FF4F00] hover:bg-[#e04600] disabled:opacity-40 text-[#0D0D0C] font-bold text-xs transition cursor-pointer"
          >
            {isSubmitting
              ? "Updating Project..."
              : "Cập Nhật JSON & Kiểm Duyệt Anti-Slop (PUT /api/projects)"}
          </button>
        </div>
      )}

      {/* TAB 3: API SPECS, ANTI-SLOP RULES & AUDIT LOGS */}
      {activeTab === "docs" && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
          <div className="p-3 rounded bg-[#161614] border border-[#2A2A26] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#F2F0EA] flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-[#FF4F00]" />
                LLM Function Calling / Tool Specs
              </span>
              <button
                onClick={handleCopyOpenAITools}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#1F1F1C] hover:bg-[#2A2A26] border border-[#2A2A26] text-[#F2F0EA] text-[11px] font-medium cursor-pointer"
              >
                {copiedTools ? (
                  <>
                    <Check className="w-3 h-3 text-[#FF4F00]" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy OpenAI Tools
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-[#9A9890] leading-relaxed">
              Định nghĩa Function Calling chuẩn cho OpenAI, Gemini, Claude hoặc MCP Server.
            </p>
          </div>

          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#9A9890] mb-2">
              Enforced Anti-Slop Rules (`miqdadbadjuber/anti-slop`)
            </h3>
            <div className="space-y-1 font-mono text-[10px] text-[#F2F0EA] bg-[#0D0D0C] p-2.5 rounded border border-[#2A2A26]">
              <div>• R-01: No cyan-purple gradient or blurred radial orbs</div>
              <div>• R-05: Varied scene rhythm (Statement / Split / Artifact)</div>
              <div>• R-07: No unmotivated 60px cyber-grid background</div>
              <div>• R-11: Crisp 4px-6px radius (no 999px pill spam)</div>
              <div>• R-16: Strip AI buzzwords (EN & VI)</div>
              <div>• R-17: Zero fabricated % or unverified metrics</div>
              <div>• R-29: Strict 2-neutral + 1-accent color cap</div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#9A9890] mb-2">
              Lịch Sử Tác Động & Kiểm Duyệt ({actionLogs.length})
            </h3>
            <div className="space-y-1.5">
              {actionLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded bg-[#161614] border border-[#2A2A26] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#FF4F00] font-semibold">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-[#9A9890] font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#F2F0EA]">{log.summary}</p>
                  <div className="text-[10px] text-[#9A9890]">
                    Agent: <span className="text-[#F2F0EA]">{log.agentName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
