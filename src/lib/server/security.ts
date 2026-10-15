import { NextRequest } from "next/server";

/**
 * AGVI API Security, Authentication & Rate-Limiting Guard (`src/lib/server/security.ts`).
 * - Supports optional `AGVI_API_KEY` header/bearer authentication (`x-api-key` or `Authorization: Bearer <token>`).
 *   When `AGVI_API_KEY` is configured in the environment, all mutating endpoints require a valid key.
 * - Implements a sliding-window per-client/IP rate limiter (`AGVI_RATE_LIMIT_MAX`, default 120 req/min).
 * - Enforces request payload size caps (`maxBytes`, default 2MB) to prevent memory exhaustion.
 */

export interface SecurityGuardOptions {
  requireAuthIfConfigured?: boolean;
  rateLimitMaxPerMinute?: number;
  maxBodyBytes?: number;
}

export interface SecurityCheckResult {
  allowed: boolean;
  status: number;
  error?: string;
  clientId: string;
}

const rateLimitBuckets = new Map<string, number[]>();

export function resetRateLimitBuckets(): void {
  rateLimitBuckets.clear();
}

export function extractClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  const agentName = request.headers.get("x-agent-name");
  if (agentName) {
    return `agent:${agentName.trim()}`;
  }
  return "local-client";
}

export function verifyApiSecurity(
  request: NextRequest,
  options?: SecurityGuardOptions
): SecurityCheckResult {
  const clientId = extractClientIdentifier(request);
  const configuredApiKey = process.env.AGVI_API_KEY?.trim();
  const requireAuth = options?.requireAuthIfConfigured ?? true;

  // 1. Optional / Production API Key Authentication
  if (requireAuth && configuredApiKey && configuredApiKey.length > 0) {
    const headerKey = request.headers.get("x-api-key")?.trim();
    const authHeader = request.headers.get("authorization")?.trim() || "";
    const bearerKey = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const providedKey = headerKey || bearerKey;
    if (!providedKey || providedKey !== configuredApiKey) {
      return {
        allowed: false,
        status: 401,
        error:
          "Unauthorized: Valid API key required via 'x-api-key' or 'Authorization: Bearer <AGVI_API_KEY>' header.",
        clientId,
      };
    }
  }

  // 2. Payload Content-Length Validation
  const maxBodyBytes = options?.maxBodyBytes ?? 2 * 1024 * 1024; // 2MB default
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const byteLength = Number(contentLengthHeader);
    if (Number.isFinite(byteLength) && byteLength > maxBodyBytes) {
      return {
        allowed: false,
        status: 413,
        error: `Payload Too Large: Request body (${byteLength} bytes) exceeds maximum allowed (${maxBodyBytes} bytes).`,
        clientId,
      };
    }
  }

  // 3. Sliding-Window Rate Limiting (configurable window, default 60-second window)
  const maxPerMinute =
    options?.rateLimitMaxPerMinute ??
    (Number(process.env.AGVI_RATE_LIMIT_MAX) || 120);
  const windowMs = Number(process.env.AGVI_RATE_LIMIT_WINDOW_MS) || 60_000;
  const now = Date.now();
  const windowStart = now - windowMs;

  const existing = rateLimitBuckets.get(clientId) || [];
  const activeTimestamps = existing.filter((t) => t > windowStart);

  if (activeTimestamps.length >= maxPerMinute) {
    rateLimitBuckets.set(clientId, activeTimestamps);
    return {
      allowed: false,
      status: 429,
      error: `Rate limit exceeded for client "${clientId}" (${maxPerMinute} requests/minute). Please retry shortly.`,
      clientId,
    };
  }

  activeTimestamps.push(now);
  rateLimitBuckets.set(clientId, activeTimestamps);

  return {
    allowed: true,
    status: 200,
    clientId,
  };
}
