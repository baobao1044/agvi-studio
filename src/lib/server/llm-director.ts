import {
  AspectRatio,
  CameraMotionEffect,
  KineticTextEffect,
  SceneTransitionEffect,
  ShapeVariant,
} from "../schema/timeline-schema";
import {
  DesignDirectionId,
  cleanCopywritingText,
  extractVerifiedFactsFromPrompt,
  resolveDesignDirection,
} from "../anti-slop/anti-slop-filter";
import type { StoryboardSceneInput } from "./project-store";

export type CompilerMode = "llm-provider" | "deterministic-heuristic";

export interface CompiledStoryboardResult {
  title: string;
  aspectRatio: AspectRatio;
  designDirection: DesignDirectionId;
  scenes: StoryboardSceneInput[];
  compilerMode: CompilerMode;
  providerName?: string;
}

/**
 * Deterministic Heuristic Prompt-to-Storyboard Compiler:
 * - R-05: Alternates scene layouts (`statement-only` -> `asymmetric-split` -> `artifact-focus` -> `asymmetric-split`)
 * - R-16 / R-36: Strips AI buzzwords and hype
 * - R-17 / C-5: Never fabricates percentages or metrics not in the user's prompt!
 */
export function compilePromptToStoryboardHeuristic(
  prompt: string,
  requestedRatio?: AspectRatio,
  requestedDirection?: DesignDirectionId
): CompiledStoryboardResult {
  const rawClean = prompt.trim() || "Schema-Driven Video Engine for AI Agents";
  const clean = cleanCopywritingText(rawClean);
  const lower = clean.toLowerCase();

  const detectedRatio: AspectRatio =
    requestedRatio ||
    (lower.includes("9:16") ||
    lower.includes("tiktok") ||
    lower.includes("short") ||
    lower.includes("reel") ||
    lower.includes("dọc")
      ? "9:16"
      : lower.includes("1:1") || lower.includes("square")
        ? "1:1"
        : "16:9");

  const direction = resolveDesignDirection(requestedDirection, clean);
  const verifiedFacts = extractVerifiedFactsFromPrompt(clean);

  const shortTopic =
    clean.length > 48 ? `${clean.slice(0, 46).trim()}…` : clean;

  const isVietnamese =
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      clean
    );

  const clauses = clean
    .split(/[,.;•\-\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);

  const is3DKinetic = direction.id === "kinetic-3d-keynote";

  if (is3DKinetic) {
    return {
      title: shortTopic,
      aspectRatio: detectedRatio,
      designDirection: direction.id,
      compilerMode: "deterministic-heuristic",
      scenes: [
        {
          duration: 3.5,
          layoutPattern: "statement-only",
          useVideoFootage: true,
          videoUrl: "procedural-video://webgl-3d-prism",
          cameraMotion: "hyper-push-in",
          sceneTransition: "whip-blur-cut",
          textEffect: "kinetic-char-3d",
          filter: {
            motionBlur: 0.7,
            chromaticAberration: 0.45,
            cameraShake: 0.35,
          },
          keyframes: [
            {
              offset: 0,
              x: -26,
              y: 8,
              z: -240,
              rotateX: 25,
              rotateY: -28,
              scale: 0.75,
              opacity: 0,
              easing: "whip",
            },
            {
              offset: 0.25,
              x: -4,
              y: -4,
              z: 65,
              rotateX: 2,
              rotateY: -5,
              scale: 1.03,
              opacity: 1,
              easing: "expo-out",
            },
            {
              offset: 1,
              x: 4,
              y: -4,
              z: 30,
              rotateX: 0,
              rotateY: 6,
              scale: 1,
              opacity: 1,
              easing: "ease-in-out",
            },
          ],
          motionOverlay: {
            preset: "3d-parallax-grid",
            title: "6-DOF 3D STAGE // 60 FPS",
            subtitle: "PERSPECTIVE 1400PX • VELOCITY GRAPH",
          },
          headline: shortTopic,
          subheadline:
            clauses[1] ||
            (isVietnamese
              ? "Tích hợp không gian 3D thực thụ, Camera 6 bậc tự do và đồ thị vận tốc Multi-Keyframe."
              : "6-DOF 3D camera rig, WebGL wireframe geometry, and multi-keyframe velocity graphs."),
          narration: isVietnamese
            ? `Khởi tạo không gian 3D nhịp độ cao cho chủ đề ${clean.slice(0, 75)}`
            : `High-tempo 3D motion stage for ${clean.slice(0, 75)}`,
          lowerThirdTitle: "01 / 60FPS 3D STAGE & VELOCITY GRAPH",
        },
        {
          duration: 3.5,
          layoutPattern: "asymmetric-split",
          useVideoFootage: true,
          videoUrl: "procedural-video://webgl-3d-prism",
          cameraMotion: "orbit-3d-left",
          sceneTransition: "3d-cube-spin",
          textEffect: "kinetic-word-stomp",
          filter: {
            motionBlur: 0.65,
            chromaticAberration: 0.35,
            cameraShake: 0.25,
          },
          motionOverlay: {
            preset: "hud-telemetry",
            title: "MULTI-KEYFRAME CURVES",
            subtitle: "WHIP • EXPO-OUT • ELASTIC • BOUNCE",
          },
          headline: isVietnamese
            ? "Đồ Thị Vận Tốc & 3D Carousel"
            : "Multi-Keyframe Velocity & 3D Stack",
          subheadline: isVietnamese
            ? "Nội suy mượt mà tọa độ X/Y/Z và góc xoay 3 chiều theo đường cong gia tốc After Effects."
            : "Interpolate X/Y/Z depth and 3D rotation with non-linear whip and exponential curves.",
          narration: isVietnamese
            ? "Mỗi lớp đồ họa được điều khiển bởi đường cong vận tốc phi tuyến tính và xoay 3 chiều"
            : "Every layer is driven by non-linear velocity curves and 3D perspective depth",
          widgetType: "3d-carousel-stack",
          bentoItems: [
            {
              title: clauses[0]?.slice(0, 28) || "6-DOF Camera Rig",
              subtitle:
                "Orbit Left/Right, Fly-Through Z, Whip-Pan 3D & Hyper Push-In.",
              metric: "3D RIG",
            },
            {
              title: "Velocity Graph Editor",
              subtitle:
                "Whip, Expo-Out, Back-Out, Elastic & Bounce easing curves.",
              metric: "CURVES",
            },
            {
              title: "Directional Motion Blur",
              subtitle:
                "Velocity-driven blur, RGB chromatic shift & impact shake.",
              metric: "POST-FX",
            },
          ],
          lowerThirdTitle: "02 / 3D CAROUSEL & VELOCITY CURVES",
        },
        {
          duration: 3.5,
          layoutPattern: "artifact-focus",
          useVideoFootage: true,
          videoUrl: "procedural-video://webgl-3d-tunnel",
          cameraMotion: "fly-through-z",
          sceneTransition: "zoom-punch",
          filter: {
            motionBlur: 0.8,
            chromaticAberration: 0.5,
            cameraShake: 0.4,
          },
          motionOverlay: {
            preset: "3d-parallax-grid",
            title: "Z-AXIS FLY-THROUGH",
            subtitle: "KINETIC STOMP WALL • 60 FPS",
          },
          headline: shortTopic.toUpperCase(),
          narration: isVietnamese
            ? "Chuyển cảnh xuyên tâm trục Z kết hợp tường chữ Kinetic 3D và hiệu ứng rung chấn camera"
            : "Z-axis camera fly-through paired with a 3D kinetic stomp wall and impact shake",
          widgetType: "kinetic-impact-wall",
          lowerThirdTitle: "03 / KINETIC IMPACT WALL",
        },
        {
          duration: 3.5,
          layoutPattern: "asymmetric-split",
          useVideoFootage: true,
          videoUrl: "procedural-video://webgl-3d-prism",
          cameraMotion: "whip-pan-3d",
          sceneTransition: "glitch-slice",
          textEffect: "split-mask-reveal",
          filter: {
            motionBlur: 0.6,
            chromaticAberration: 0.35,
          },
          motionOverlay: {
            preset: "spotlight-pointer",
            title: "3D WIREFRAME PRISM",
            subtitle: "1-Call API: choreograph_3d_kinetic_scene",
            targetX: 18,
            targetY: -4,
          },
          headline: isVietnamese
            ? "Điều Khiển Cảnh 3D Bằng 1 Lệnh API"
            : "1-Call 3D Choreography API",
          subheadline: isVietnamese
            ? "Gọi choreograph_3d_kinetic_scene và xuất trực tiếp file video .webm / .mp4 ngay trên trình duyệt."
            : "Trigger choreograph_3d_kinetic_scene and export .webm / .mp4 video directly in the browser.",
          narration: isVietnamese
            ? "Toàn bộ hệ thống tọa độ 3D đồ thị vận tốc và kết xuất video đều hoạt động trực tiếp"
            : "Full 3D spatial coordinates velocity graphs and native browser video export ready out of the box",
          widgetType: "3d-wireframe-prism",
          metricValue: verifiedFacts[0]?.value || "60 FPS",
          lowerThirdTitle: "04 / 3D WIREFRAME PRISM & EXPORT",
        },
      ],
    };
  }

  if (isVietnamese) {
    return {
      title: shortTopic,
      aspectRatio: detectedRatio,
      designDirection: direction.id,
      compilerMode: "deterministic-heuristic",
      scenes: [
        {
          duration: 4,
          layoutPattern: "statement-only",
          useVideoFootage: true,
          videoUrl: "procedural-video://product-ui-capture",
          cameraMotion: "letterbox-cinema",
          sceneTransition: "shutter-wipe",
          motionOverlay: {
            preset: "hud-telemetry",
            title: "LIVE CAPTURE // 30 FPS SYNC",
            subtitle: `DIRECTION: ${direction.id.toUpperCase()}`,
          },
          headline: shortTopic,
          subheadline:
            clauses[1] ||
            "Kết hợp trực tiếp video quay màn hình thực tế với lớp phủ Motion Graphics tự động.",
          narration: `Trọng tâm của chủ đề: ${clean.slice(0, 80)}`,
          lowerThirdTitle: "01 / LUẬN ĐIỂM & VIDEO TELEMETRY",
        },
        {
          duration: 4,
          layoutPattern: "asymmetric-split",
          useVideoFootage: true,
          videoUrl: "procedural-video://product-ui-capture",
          cameraMotion: "focus-zoom-left",
          sceneTransition: "iris-frame",
          motionOverlay: {
            preset: "spotlight-pointer",
            title: "TIÊU ĐIỂM TRÊN VIDEO",
            subtitle:
              "Tự động làm tối vùng ngoại vi, zoom camera và vẽ đường dẫn SVG tới vị trí (-14%, -8%).",
            targetX: -14,
            targetY: -8,
          },
          headline: "Tích Hợp Motion Vào Video Thực Tế",
          subheadline:
            "AI Agent chỉ cần truyền 1 thuộc tính motionOverlay thay vì tính toán tọa độ đa lớp.",
          narration:
            "Mỗi phân cảnh kết hợp mượt mà giữa video gốc hiệu ứng camera và lớp chỉ dẫn đồ họa",
          widgetType: "process-stepper",
          steps: [
            {
              step: "01",
              title: "Nạp Video Stream",
              detail:
                "Đồng bộ khung hình HTML5 <video> hoặc luồng quay UI ở 30fps.",
              status: "done",
            },
            {
              step: "02",
              title: "Gắn Camera Rig & Spotlight",
              detail:
                "Tự động pan/zoom vào vùng cần nhấn mạnh kèm nhãn SVG.",
              status: "active",
            },
            {
              step: "03",
              title: "Kiểm Duyệt Anti-Slop",
              detail:
                "Đảm bảo bảng màu tối giản và không chồng chéo bố cục.",
              status: "pending",
            },
          ],
          lowerThirdTitle: "02 / HYBRID VIDEO + MOTION",
        },
        {
          duration: 4,
          layoutPattern: "artifact-focus",
          sceneTransition: "editorial-curtain",
          narration:
            "So sánh trực diện giữa cách dựng thủ công phức tạp và cơ chế gắn hiệu ứng tự động cho AI Agent",
          widgetType:
            verifiedFacts.length > 0 ? "kpi-counter" : "split-comparison",
          metricValue: verifiedFacts[0]?.value,
          metricTrend:
            verifiedFacts[0]?.label || "Thông số trích xuất từ kịch bản gốc",
          compareBeforeLabel: "THỦ CÔNG ĐA TRACK",
          compareBeforeValue:
            "Tự tính toán X/Y & canh nhịp từng khung hình",
          compareAfterLabel: "1-CALL MOTION COMPOSITING",
          compareAfterValue:
            "Gắn trực tiếp cameraMotion + motionOverlay vào clip video",
          bentoItems: [
            {
              title: clauses[0]?.slice(0, 28) || "Đặc Tả Kịch Bản",
              subtitle:
                "Trích xuất trực tiếp từ nội dung yêu cầu của người dùng.",
              metric: "01",
            },
            {
              title: "Camera Rig Tự Động",
              subtitle:
                "Hỗ trợ focus-zoom, isometric-3d, split-stage và letterbox.",
              metric: "02",
            },
            {
              title: "Spotlight & HUD Overlay",
              subtitle: `Giới hạn 2 tông nền phẳng và 1 màu nhấn (${direction.palette.accent}).`,
              metric: "03",
            },
            {
              title: "Không Bịa Số Liệu (R-17)",
              subtitle:
                "Loại bỏ hoàn toàn các con số phần trăm phóng đại vô căn cứ.",
              metric: "04",
            },
          ],
          lowerThirdTitle: "03 / SO SÁNH KIẾN TRÚC",
        },
        {
          duration: 4,
          layoutPattern: "asymmetric-split",
          useVideoFootage: true,
          videoUrl: "procedural-video://product-ui-capture",
          cameraMotion: "isometric-3d-frame",
          sceneTransition: "shutter-wipe",
          headline: "Một Lệnh JSON Để Dựng Cảnh Phức Hợp",
          subheadline:
            "Gọi trực tiếp action enhance_video_with_motion hoặc chỉnh ngay trên bảng Inspector.",
          narration:
            "Toàn bộ hiệu ứng chuyển cảnh camera và lớp phủ đồ họa đều điều khiển được qua giao thức mở",
          widgetType: "code-card",
          codeSnippet: `{\n  "action": "enhance_video_with_motion",\n  "cameraMotion": "focus-zoom-left",\n  "sceneTransition": "shutter-wipe",\n  "motionOverlay": {\n    "preset": "spotlight-pointer",\n    "targetX": -14, "targetY": -8\n  }\n}`,
          lowerThirdTitle: "04 / GIAO THỨC LOW-EFFORT",
        },
      ],
    };
  }

  return {
    title: shortTopic,
    aspectRatio: detectedRatio,
    designDirection: direction.id,
    compilerMode: "deterministic-heuristic",
    scenes: [
      {
        duration: 4,
        layoutPattern: "statement-only",
        useVideoFootage: true,
        videoUrl: "procedural-video://product-ui-capture",
        cameraMotion: "letterbox-cinema",
        sceneTransition: "shutter-wipe",
        motionOverlay: {
          preset: "hud-telemetry",
          title: "LIVE CAPTURE // 30 FPS SYNC",
          subtitle: `DIRECTION: ${direction.id.toUpperCase()}`,
        },
        headline: shortTopic,
        subheadline:
          clauses[1] ||
          "Native video footage composited with deterministic motion graphics overlays.",
        narration: `Core focus: ${clean.slice(0, 80)}`,
        lowerThirdTitle: "01 / EDITORIAL THESIS & VIDEO RIG",
      },
      {
        duration: 4,
        layoutPattern: "asymmetric-split",
        useVideoFootage: true,
        videoUrl: "procedural-video://product-ui-capture",
        cameraMotion: "focus-zoom-left",
        sceneTransition: "iris-frame",
        motionOverlay: {
          preset: "spotlight-pointer",
          title: "AUTO-SPOTLIGHT ON VIDEO",
          subtitle:
            "Single property dims background, zooms camera, and draws SVG reticle to (-14%, -8%).",
          targetX: -14,
          targetY: -8,
        },
        headline: "Low-Effort Video + Motion Compositing",
        subheadline:
          "Attach spotlight callouts, camera rigs, and steppers directly onto video clips.",
        narration:
          "Each scene blends real video footage camera rigs and vector motion overlays without manual math",
        widgetType: "process-stepper",
        steps: [
          {
            step: "01",
            title: "Ingest Video Footage",
            detail:
              "Frame-accurate HTML5 <video> or procedural UI capture at 30fps.",
            status: "done",
          },
          {
            step: "02",
            title: "Attach Motion Overlay",
            detail:
              "Auto-compute spotlight masks, SVG leader lines, and camera zoom.",
            status: "active",
          },
          {
            step: "03",
            title: "Anti-Slop Verification",
            detail: "Enforce 2-neutral + 1-accent palette and zero overlap.",
            status: "pending",
          },
        ],
        lowerThirdTitle: "02 / HYBRID COMPOSITING",
      },
      {
        duration: 4,
        layoutPattern: "artifact-focus",
        sceneTransition: "editorial-curtain",
        narration:
          "Compare manual multi track keyframing against single property declarative video compositing",
        widgetType:
          verifiedFacts.length > 0 ? "kpi-counter" : "split-comparison",
        metricValue: verifiedFacts[0]?.value,
        metricTrend:
          verifiedFacts[0]?.label || "Extracted directly from user prompt",
        compareBeforeLabel: "MANUAL MULTI-TRACK",
        compareBeforeValue:
          "Complex X/Y coordinate math & manual keyframe sync",
        compareAfterLabel: "DECLARATIVE OVERLAY",
        compareAfterValue:
          "1 JSON property attaches Camera Rig + Spotlight Callout",
        bentoItems: [
          {
            title: clauses[0]?.slice(0, 28) || "Primary Specification",
            subtitle: "Derived directly from the user prompt without filler.",
            metric: "01",
          },
          {
            title: "Camera Rigs",
            subtitle:
              "Focus zoom, isometric 3D frame, split-stage, and letterbox.",
            metric: "02",
          },
          {
            title: "Palette Cap (R-29)",
            subtitle: `Locked to 2 matte neutrals + 1 accent (${direction.palette.accent}).`,
            metric: "03",
          },
          {
            title: "Verified Claims (R-17)",
            subtitle:
              "Zero invented statistics or unverified benchmark numbers.",
            metric: "04",
          },
        ],
        lowerThirdTitle: "03 / ARCHITECTURE COMPARISON",
      },
      {
        duration: 4,
        layoutPattern: "asymmetric-split",
        useVideoFootage: true,
        videoUrl: "procedural-video://product-ui-capture",
        cameraMotion: "isometric-3d-frame",
        sceneTransition: "shutter-wipe",
        headline: "One API Call for Hybrid Scenes",
        subheadline:
          "Invoke enhance_video_with_motion or tweak Camera Rig & Overlays in the Inspector.",
        narration:
          "Every camera rig transition and motion overlay remains accessible through the open schema",
        widgetType: "code-card",
        codeSnippet: `{\n  "action": "enhance_video_with_motion",\n  "cameraMotion": "focus-zoom-left",\n  "sceneTransition": "shutter-wipe",\n  "motionOverlay": {\n    "preset": "spotlight-pointer",\n    "targetX": -14, "targetY": -8\n  }\n}`,
        lowerThirdTitle: "04 / LOW-EFFORT AGENT API",
      },
    ],
  };
}

/**
 * Dual-Mode Storyboard Director (`compilePromptToStoryboardWithLLM`):
 * - When `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY` is configured in the environment,
 *   queries the real LLM with structured JSON output instructions to author bespoke multi-scene storyboards.
 * - Seamlessly falls back to the deterministic heuristic compiler (`compilePromptToStoryboardHeuristic`)
 *   when no API key is set or if the network call fails, recording `compilerMode` honestly.
 */
export async function compilePromptToStoryboardWithLLM(
  prompt: string,
  requestedRatio?: AspectRatio,
  requestedDirection?: DesignDirectionId
): Promise<CompiledStoryboardResult> {
  const heuristicFallback = compilePromptToStoryboardHeuristic(
    prompt,
    requestedRatio,
    requestedDirection
  );

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!openaiKey && !geminiKey && !anthropicKey) {
    return heuristicFallback;
  }

  const systemInstruction = `You are the AGVI Studio 3.0 Video Storyboard Director.
Convert the user's video prompt into a JSON object with:
- "title": string (concise editorial title, max 48 chars)
- "aspectRatio": "16:9" | "9:16" | "1:1" | "4:5"
- "designDirection": "kinetic-3d-keynote" | "swiss-industrial" | "warm-editorial" | "documentary-slate" | "cobalt-technical"
- "scenes": Array of 4 scenes, where each scene has:
  - "duration": number (3.5 to 4.5)
  - "layoutPattern": "statement-only" | "asymmetric-split" | "artifact-focus"
  - "headline": string
  - "subheadline": string
  - "narration": string
  - "cameraMotion": "orbit-3d-left" | "fly-through-z" | "whip-pan-3d" | "hyper-push-in" | "focus-zoom-left" | "isometric-3d-frame" | "letterbox-cinema"
  - "sceneTransition": "whip-blur-cut" | "3d-cube-spin" | "zoom-punch" | "shutter-wipe" | "iris-frame"
  - "textEffect": "kinetic-char-3d" | "kinetic-word-stomp" | "split-mask-reveal" | "typewriter"
  - "widgetType": "3d-carousel-stack" | "kinetic-impact-wall" | "3d-wireframe-prism" | "process-stepper" | "split-comparison" | "code-card" | "bento-grid" | "kpi-counter"
  - "lowerThirdTitle": string
Never invent fake percentages not present in the user prompt. Output ONLY valid JSON.`;

  try {
    let rawJsonText = "";
    let providerName = "";

    if (openaiKey) {
      providerName = "openai";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: process.env.AGVI_OPENAI_MODEL || "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        const data = await res.json();
        rawJsonText = data.choices?.[0]?.message?.content || "";
      }
    } else if (geminiKey) {
      providerName = "gemini";
      const model = process.env.AGVI_GEMINI_MODEL || "gemini-2.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.4,
            },
          }),
          signal: AbortSignal.timeout(12_000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        rawJsonText =
          data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    } else if (anthropicKey) {
      providerName = "anthropic";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.AGVI_ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
          max_tokens: 2048,
          system: systemInstruction,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        const data = await res.json();
        rawJsonText = data.content?.[0]?.text || "";
      }
    }

    if (rawJsonText) {
      const cleaned = rawJsonText
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
        const scenes: StoryboardSceneInput[] = parsed.scenes.map(
          (s: Record<string, unknown>, idx: number) => {
            const baseScene =
              heuristicFallback.scenes[idx % heuristicFallback.scenes.length];
            return {
              ...baseScene,
              duration:
                typeof s.duration === "number" && s.duration > 1
                  ? s.duration
                  : baseScene.duration,
              headline:
                typeof s.headline === "string" && s.headline.trim()
                  ? cleanCopywritingText(s.headline)
                  : baseScene.headline,
              subheadline:
                typeof s.subheadline === "string" && s.subheadline.trim()
                  ? cleanCopywritingText(s.subheadline)
                  : baseScene.subheadline,
              narration:
                typeof s.narration === "string" && s.narration.trim()
                  ? cleanCopywritingText(s.narration)
                  : baseScene.narration,
              cameraMotion:
                (s.cameraMotion as CameraMotionEffect) || baseScene.cameraMotion,
              sceneTransition:
                (s.sceneTransition as SceneTransitionEffect) ||
                baseScene.sceneTransition,
              textEffect:
                (s.textEffect as KineticTextEffect) || baseScene.textEffect,
              widgetType:
                (s.widgetType as ShapeVariant) || baseScene.widgetType,
              lowerThirdTitle:
                typeof s.lowerThirdTitle === "string"
                  ? s.lowerThirdTitle
                  : baseScene.lowerThirdTitle,
            };
          }
        );

        return {
          title:
            typeof parsed.title === "string" && parsed.title.trim()
              ? cleanCopywritingText(parsed.title)
              : heuristicFallback.title,
          aspectRatio: requestedRatio || heuristicFallback.aspectRatio,
          designDirection:
            requestedDirection || heuristicFallback.designDirection,
          scenes,
          compilerMode: "llm-provider",
          providerName,
        };
      }
    }
  } catch {
    // Gracefully fall back to deterministic heuristic compiler on network/parse error
  }

  return heuristicFallback;
}
