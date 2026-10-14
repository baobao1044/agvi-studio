# AI Agent API & Integration Guide

AGVI Studio is built **API-first**. Every button in the studio interface maps 1:1 to a deterministic JSON action on the REST API, allowing LLM Agents (Claude, GPT-4o, Gemini, LangChain, CrewAI, or MCP tools) to direct, edit, and enhance videos programmatically.

---

## 1. Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/schema` | Returns the machine-readable JSON Schema, supported clip types, motion presets, and example payloads. |
| `GET` | `/api/projects` | Returns the active `AGVIProject` state and starter template catalog. |
| `POST` | `/api/agent/actions` | Executes a single action or a batch of actions (`AgentActionRequest` or `{ actions: [...] }`). |
| `POST` | `/api/agent/generate` | Compiles a natural-language prompt or script directly into a multi-track `AGVIProject`. |
| `POST` | `/api/render` | Validates the timeline and prepares the render manifest. |

---

## 2. High-Leverage Agent Workflows

### Workflow A: Generate a Complete Video from a Prompt

An AI Agent can generate a complete 6-track video from a single natural language prompt (in English or Vietnamese):

```bash
curl -X POST http://localhost:3000/api/agent/actions \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_from_prompt",
    "payload": {
      "prompt": "Build a 16-second product launch video for an AI coding assistant with throughput benchmarks, terminal demo, and architecture overview",
      "aspectRatio": "16:9",
      "duration": 16
    }
  }'
```

### Workflow B: One-Call Hybrid Video + Motion Graphics Enhancer (`enhance_video_with_motion`)

Instead of forcing an AI Agent to calculate frame coordinates for dozens of overlays, call `enhance_video_with_motion` once. AGVI Studio will automatically:
1. Attach cinematic **Camera Rigs** (`ken-burns-in`, `pan-left-right`, `cinematic-drift`) to all footage.
2. Add **Scene Transitions** (`whip-pan`, `iris-reveal`, `glitch-cut`) at every cut point.
3. Bind **Attached Motion Overlays** (`hud-telemetry`, `spotlight-pointer`, `lower-third-ribbon`, `floating-kpi`) directly onto video clips.
4. Synchronize transition **SFX** (`whoosh`, `pop`, `riser`).

```bash
curl -X POST http://localhost:3000/api/agent/actions \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enhance_video_with_motion",
    "payload": {
      "style": "tech-hud",
      "transitionStyle": "whip-pan",
      "addSoundEffects": true
    }
  }'
```

**Supported `style` presets:**
- `"tech-hud"` — Cyber telemetry brackets, spotlight reticles, and floating KPI badges.
- `"editorial-clean"` — Minimalist lower-third ribbons, corner frames, and subtle Ken Burns motion.
- `"kinetic-hype"` — High-energy whip-pans, data tickers, and rapid camera movement.

---

### Workflow C: Fine-Grained Clip Manipulation (Batch Actions)

Agents can also pass an array of atomic mutations in a single HTTP request:

```bash
curl -X POST http://localhost:3000/api/agent/actions \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      {
        "action": "set_aspect_ratio",
        "payload": { "aspectRatio": "16:9" }
      },
      {
        "action": "update_clip",
        "payload": {
          "clipId": "clip-vid-1",
          "patch": {
            "cameraMotion": "ken-burns-in",
            "sceneTransition": "whip-pan",
            "motionOverlay": "spotlight-pointer",
            "overlayTitle": "01 / CORE ENGINE",
            "overlayMetric": "60 FPS NATIVE"
          }
        }
      }
    ]
  }'
```

---

## 3. TypeScript SDK Example for AI Agents

```ts
export async function enhanceProjectWithAgent(baseUrl = "http://localhost:3000") {
  // 1. Inspect available schema & current project state
  const stateRes = await fetch(`${baseUrl}/api/projects`);
  const { activeProject } = await stateRes.json();

  // 2. Apply Hybrid Motion Graphics Rig in one call
  const enhanceRes = await fetch(`${baseUrl}/api/agent/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "enhance_video_with_motion",
      payload: {
        style: "tech-hud",
        transitionStyle: "whip-pan",
        addSoundEffects: true,
      },
    }),
  });

  return await enhanceRes.json();
}
```
