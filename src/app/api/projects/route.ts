import { NextRequest } from "next/server";
import { getStoreSnapshot, saveProject } from "@/lib/server/project-store";

export async function GET() {
  const snapshot = getStoreSnapshot();
  return Response.json({
    ok: true,
    ...snapshot,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const agentName =
      typeof body.agentName === "string"
        ? body.agentName
        : request.headers.get("x-agent-name") || "External AI Agent";
    const projectPayload = body.project ?? body;
    const saved = saveProject(projectPayload, agentName, true);
    return Response.json({
      ok: true,
      project: saved.project,
      validation: saved.validation,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to save project",
      },
      { status: 400 }
    );
  }
}
