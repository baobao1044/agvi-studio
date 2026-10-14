import { NextRequest } from "next/server";
import {
  AgentActionPayload,
  executeAgentAction,
  getStoreSnapshot,
} from "@/lib/server/project-store";
import { getAgentSchemaDocumentation } from "@/lib/schema/timeline-schema";

export async function GET() {
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

    const result = executeAgentAction({
      ...body,
      agentName,
    });

    return Response.json({
      ok: true,
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
