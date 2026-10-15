import { NextRequest, connection } from "next/server";
import {
  getAgentSchemaDocumentation,
  validateAndNormalizeProject,
} from "@/lib/schema/timeline-schema";

export async function GET() {
  try {
    await connection();
  } catch {
    // Allow direct in-process unit test invocation outside Next.js request store
  }
  return Response.json({
    ok: true,
    documentation: getAgentSchemaDocumentation(),
  });
}

/**
 * POST /api/schema
 * Allows an AI Agent to dry-run validate and normalize a raw JSON timeline
 * before committing it to a project.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const autoFix = body.autoFix !== false;
    const targetJson = body.project ?? body;
    const result = validateAndNormalizeProject(targetJson, autoFix);
    return Response.json({
      ok: result.valid,
      ...result,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Invalid JSON payload received",
      },
      { status: 400 }
    );
  }
}
