import { NextRequest } from "next/server";
import {
  compilePromptToStoryboardWithLLM,
  executeAgentAction,
  withStoreWriteLock,
} from "@/lib/server/project-store";
import { AspectRatio } from "@/lib/schema/timeline-schema";
import { DesignDirectionId } from "@/lib/anti-slop/anti-slop-filter";
import { verifyApiSecurity } from "@/lib/server/security";

export async function POST(request: NextRequest) {
  const sec = verifyApiSecurity(request);
  if (!sec.allowed) {
    return Response.json({ ok: false, error: sec.error }, { status: sec.status });
  }

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

    const designDirection: DesignDirectionId | undefined =
      typeof body.designDirection === "string"
        ? (body.designDirection as DesignDirectionId)
        : undefined;

    const compiled = await compilePromptToStoryboardWithLLM(
      prompt,
      aspectRatio,
      designDirection
    );

    const result = await withStoreWriteLock(() =>
      executeAgentAction({
        action: "generate_from_prompt",
        projectId: body.projectId,
        agentName:
          body.agentName ||
          request.headers.get("x-agent-name") ||
          "AGVI Prompt-to-Video Director",
        prompt,
        title: compiled.title,
        aspectRatio: compiled.aspectRatio,
        designDirection: compiled.designDirection,
        scenes: compiled.scenes,
        compilerMode: compiled.compilerMode,
        providerName: compiled.providerName,
      })
    );

    return Response.json({
      ok: true,
      compilerMode: compiled.compilerMode,
      providerName: compiled.providerName ?? null,
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
