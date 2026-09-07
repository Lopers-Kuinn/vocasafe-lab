import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

interface RateLimitRpcRow {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function isRateLimitRpcRow(value: unknown): value is RateLimitRpcRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.allowed === "boolean" &&
    Number.isInteger(row.remaining) &&
    (row.remaining as number) >= 0 &&
    Number.isInteger(row.retry_after_seconds) &&
    (row.retry_after_seconds as number) >= 1
  );
}

export async function consumeAiRateLimit(
  supabase: SupabaseServerClient,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("consume_ai_rate_limit", {
    p_endpoint: "risk-recommendation",
  });

  if (error) {
    console.error("[AI Rate Limit] RPC failed", {
      code: error.code ?? "unknown",
    });
    throw new Error("AI rate limiter unavailable.");
  }

  let row: unknown = data;
  if (Array.isArray(data)) {
    if (data.length !== 1) {
      console.error("[AI Rate Limit] RPC returned an unexpected row count", {
        rowCount: data.length,
      });
      throw new Error("AI rate limiter returned an invalid result.");
    }

    row = data[0];
  }

  if (!isRateLimitRpcRow(row)) {
    console.error("[AI Rate Limit] RPC returned an invalid result shape");
    throw new Error("AI rate limiter returned an invalid result.");
  }

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
  };
}
