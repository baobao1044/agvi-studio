import { NextRequest, connection } from "next/server";
import {
  createRenderJob,
  getProjectById,
  getStoreSnapshot,
} from "@/lib/server/project-store";

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
  try {
    const body = await request.json().catch(() => ({}));
    const projectId =
      typeof body.projectId === "string" ? body.projectId : undefined;
    const format =
      body.format === "webm" || body.format === "json-bundle"
        ? body.format
        : "mp4";

    const job = createRenderJob(projectId, format);
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
