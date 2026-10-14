import { NextRequest } from "next/server";
import { executeAgentAction } from "@/lib/server/project-store";
import { AspectRatio } from "@/lib/schema/timeline-schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt =
      typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json(
        {
          ok: false,
          error:
            "Missing required 'prompt' field. Pass any Vietnamese or English video topic or script.",
        },
        { status: 400 }
      );
    }

    const aspectRatio: AspectRatio | undefined =
      body.aspectRatio === "16:9" ||
      body.aspectRatio === "9:16" ||
      body.aspectRatio === "1:1" ||
      body.aspectRatio === "4:5"
        ? body.aspectRatio
        : undefined;

    const result = executeAgentAction({
      action: "generate_from_prompt",
      projectId: body.projectId,
      agentName:
        body.agentName ||
        request.headers.get("x-agent-name") ||
        "AGVI Prompt-to-Video Director",
      prompt,
      aspectRatio,
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
            : "Failed to generate video from prompt",
      },
      { status: 400 }
    );
  }
}
