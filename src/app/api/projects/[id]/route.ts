import { NextRequest } from "next/server";
import {
  getProjectById,
  saveProject,
  setActiveProject,
} from "@/lib/server/project-store";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
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
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const agentName =
      typeof body.agentName === "string"
        ? body.agentName
        : request.headers.get("x-agent-name") || "External AI Agent";
    const rawProject = body.project ?? body;
    const saved = saveProject({ ...rawProject, id }, agentName, true);
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
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    if (body.setActive) {
      const active = setActiveProject(id);
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
    const saved = saveProject(merged, body.agentName || "External AI Agent", true);
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
