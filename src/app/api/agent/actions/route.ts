import { NextRequest, connection } from "next/server";
import {
  AgentActionPayload,
  executeAgentAction,
  getStoreSnapshot,
  withStoreWriteLock,
} from "@/lib/server/project-store";
import { getAgentSchemaDocumentation } from "@/lib/schema/timeline-schema";
import { verifyApiSecurity } from "@/lib/server/security";

export async function GET() {
  try {
    await connection();
  } catch {
    // Allow direct in-process unit test invocation outside Next.js request store
  }
  const snapshot = getStoreSnapshot();
  const docs = getAgentSchemaDocumentation();
  return Response.json({
    ok: true,
    activeProjectId: snapshot.activeProjectId,
    actionLogs: snapshot.actionLogs,
    supportedActions: docs.supportedActions,
    openaiToolDefinitions: docs.openaiToolDefinitions,
  });
}

export async function POST(request: NextRequest) {
  const sec = verifyApiSecurity(request);
  if (!sec.allowed) {
    return Response.json({ ok: false, error: sec.error }, { status: sec.status });
  }

  try {
    const body = (await request.json()) as AgentActionPayload;
    if (!body || typeof body.action !== "string") {
      return Response.json(
        {
          ok: false,
          error:
            "Missing required field 'action'. Call GET /api/agent/actions to inspect supported actions.",
        },
        { status: 400 }
      );
    }

    const agentName =
      body.agentName ||
      request.headers.get("x-agent-name") ||
      "AI Agent (Tool Call)";

    let actionPayload: AgentActionPayload = {
      ...body,
      agentName,
    };

    if (
      body.action === "generate_from_prompt" &&
      (!Array.isArray(body.scenes) || body.scenes.length === 0)
    ) {
      const { compilePromptToStoryboardWithLLM } = await import(
        "@/lib/server/project-store"
      );
      const compiled = await compilePromptToStoryboardWithLLM(
        body.prompt || "Schema-Driven Video Engine",
        body.aspectRatio,
        body.designDirection
      );
      actionPayload = {
        ...actionPayload,
        title: body.title || compiled.title,
        aspectRatio: body.aspectRatio || compiled.aspectRatio,
        designDirection: body.designDirection || compiled.designDirection,
        scenes: compiled.scenes,
        compilerMode: compiled.compilerMode,
        providerName: compiled.providerName,
      };
    }

    const result = await withStoreWriteLock(() =>
      executeAgentAction(actionPayload)
    );

    return Response.json({
      ok: true,
      compilerMode: result.project.agentMeta?.compilerMode ?? null,
      providerName: result.project.agentMeta?.llmProvider ?? null,
      project: result.project,
      validation: result.validation,
      log: result.log,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to execute AI agent action",
      },
      { status: 400 }
    );
  }
}
