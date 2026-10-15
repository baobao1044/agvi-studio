import { NextRequest, connection } from "next/server";
import {
  getStoreSnapshot,
  saveProject,
  withStoreWriteLock,
} from "@/lib/server/project-store";
import { verifyApiSecurity } from "@/lib/server/security";

export async function GET() {
  try {
    await connection();
  } catch {
    // Allow direct in-process unit test invocation outside Next.js request store
  }
  const snapshot = getStoreSnapshot();
  return Response.json({
    ok: true,
    ...snapshot,
  });
}

export async function POST(request: NextRequest) {
  const sec = verifyApiSecurity(request);
  if (!sec.allowed) {
    return Response.json({ ok: false, error: sec.error }, { status: sec.status });
  }

  try {
    const body = await request.json();
    const agentName =
      typeof body.agentName === "string"
        ? body.agentName
        : request.headers.get("x-agent-name") || "External AI Agent";
    const projectPayload = body.project ?? body;
    const saved = await withStoreWriteLock(() =>
      saveProject(projectPayload, agentName, true)
    );
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
