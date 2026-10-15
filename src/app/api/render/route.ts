import { NextRequest, connection } from "next/server";
import {
  createRenderJob,
  getProjectById,
  getStoreSnapshot,
  updateRenderJobStatus,
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
    renderJobs: snapshot.renderJobs,
  });
}

export async function POST(request: NextRequest) {
  const sec = verifyApiSecurity(request);
  if (!sec.allowed) {
    return Response.json({ ok: false, error: sec.error }, { status: sec.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const projectId =
      typeof body.projectId === "string" ? body.projectId : undefined;
    const format =
      body.format === "webm" || body.format === "json-bundle"
        ? body.format
        : "mp4";
    const executeNow = Boolean(body.executeNow);

    const job = await withStoreWriteLock(() =>
      createRenderJob(projectId, format, { executeNow })
    );
    const project = getProjectById(projectId);

    return Response.json({
      ok: true,
      job,
      projectSnapshot: project,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Failed to queue render job",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const sec = verifyApiSecurity(request);
  if (!sec.allowed) {
    return Response.json({ ok: false, error: sec.error }, { status: sec.status });
  }

  try {
    const body = await request.json();
    if (!body || typeof body.jobId !== "string") {
      return Response.json(
        { ok: false, error: "Missing required field 'jobId'" },
        { status: 400 }
      );
    }

    const validStatuses = ["queued", "rendering", "completed", "failed"] as const;
    const requestedStatus =
      typeof body.status === "string" &&
      (validStatuses as readonly string[]).includes(body.status)
        ? (body.status as (typeof validStatuses)[number])
        : undefined;

    if (body.status !== undefined && !requestedStatus) {
      return Response.json(
        {
          ok: false,
          error: `Invalid RenderJob status "${String(body.status)}". Allowed: queued, rendering, completed, failed.`,
        },
        { status: 400 }
      );
    }

    if (
      requestedStatus === "completed" &&
      typeof body.fileSizeBytes === "number" &&
      body.fileSizeBytes <= 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Cannot mark RenderJob as completed with fileSizeBytes <= 0 (empty or unverified artifact).",
        },
        { status: 400 }
      );
    }

    const clampedProgress =
      typeof body.progress === "number" && Number.isFinite(body.progress)
        ? Math.max(0, Math.min(100, Math.round(body.progress)))
        : undefined;

    const updated = await withStoreWriteLock(() =>
      updateRenderJobStatus(body.jobId, {
        status: requestedStatus,
        progress: clampedProgress,
        outputPath:
          typeof body.outputPath === "string" ? body.outputPath : undefined,
        fileSizeBytes:
          typeof body.fileSizeBytes === "number" && body.fileSizeBytes >= 0
            ? body.fileSizeBytes
            : undefined,
        errorMessage:
          typeof body.errorMessage === "string" ? body.errorMessage : undefined,
        completedAt:
          requestedStatus === "completed" ? new Date().toISOString() : undefined,
      })
    );

    if (!updated) {
      return Response.json(
        { ok: false, error: `RenderJob "${body.jobId}" not found` },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      job: updated,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to update render job status",
      },
      { status: 400 }
    );
  }
}
