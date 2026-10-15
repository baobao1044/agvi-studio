import { NextRequest, connection } from "next/server";
import {
  getProjectById,
  saveProject,
  setActiveProject,
  withStoreWriteLock,
} from "@/lib/server/project-store";
import { verifyApiSecurity } from "@/lib/server/security";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await connection();
  } catch {
    // Allow direct in-process unit test invocation outside Next.js request store
  }
  const { id } = await ctx.params;
  const project = getProjectById(id);
  return Response.json({
    ok: true,
    project,
  });
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const sec = verifyApiSecurity(request);
  if (!sec.allowed) {
    return Response.json({ ok: false, error: sec.error }, { status: sec.status });
  }

  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const agentName =
      typeof body.agentName === "string"
        ? body.agentName
        : request.headers.get("x-agent-name") || "External AI Agent";
    const rawProject = body.project ?? body;
    const saved = await withStoreWriteLock(() =>
      saveProject({ ...rawProject, id }, agentName, true)
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
        error: err instanceof Error ? err.message : "Failed to update project",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const sec = verifyApiSecurity(request);
  if (!sec.allowed) {
    return Response.json({ ok: false, error: sec.error }, { status: sec.status });
  }

  try {
    const { id } = await ctx.params;
    const body = await request.json();
    if (body.setActive) {
      const active = await withStoreWriteLock(() => setActiveProject(id));
      if (!active) {
        return Response.json(
          { ok: false, error: `Project "${id}" not found` },
          { status: 404 }
        );
      }
      return Response.json({ ok: true, project: active });
    }
    const existing = getProjectById(id);
    const merged = { ...existing, ...body, id };
    const saved = await withStoreWriteLock(() =>
      saveProject(merged, body.agentName || "External AI Agent", true)
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
        error: err instanceof Error ? err.message : "Failed to patch project",
      },
      { status: 400 }
    );
  }
}
