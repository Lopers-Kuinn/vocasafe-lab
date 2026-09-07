import { NextResponse } from "next/server";

import { generateRiskRecommendation } from "@/lib/ai/provider";
import { consumeAiRateLimit } from "@/lib/ai/rate-limit";
import {
  validateRiskSuggestionInput,
  type AIRecommendationSource,
} from "@/lib/ai/risk-recommendation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const REPORT_AI_ROLES = new Set<UserRole>([
  "mahasiswa",
  "dosen",
  "teknisi",
  "admin",
]);
const CHECKLIST_AI_ROLES = new Set<UserRole>(["dosen", "teknisi", "admin"]);

function canUseAiSuggestion(role: UserRole, source: AIRecommendationSource) {
  return source === "report"
    ? REPORT_AI_ROLES.has(role)
    : CHECKLIST_AI_ROLES.has(role);
}

function errorResponse(
  error: string,
  status: 400 | 401 | 403 | 429 | 500,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error },
    { status, headers: { ...NO_STORE_HEADERS, ...headers } },
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return errorResponse("Sesi login diperlukan.", 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id,is_active,role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[AI Risk Recommendation] profile query failed", {
        code: profileError.code ?? "unknown",
      });
      return errorResponse("Layanan rekomendasi sedang tidak tersedia.", 500);
    }

    if (
      !profile ||
      profile.is_active !== true ||
      !REPORT_AI_ROLES.has(profile.role as UserRole)
    ) {
      return errorResponse("Profil tidak aktif atau tidak tersedia.", 403);
    }

    const rateLimit = await consumeAiRateLimit(supabase);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Batas permintaan AI tercapai. Coba lagi nanti.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Request rekomendasi tidak valid.", 400);
    }

    const validation = validateRiskSuggestionInput(body);
    if (validation.error || !validation.input) {
      return errorResponse("Request rekomendasi tidak valid.", 400);
    }

    if (!canUseAiSuggestion(profile.role as UserRole, validation.input.source)) {
      return errorResponse("Profil tidak aktif atau tidak tersedia.", 403);
    }

    const result = await generateRiskRecommendation(validation.input);
    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch {
    console.error("[AI Risk Recommendation] request failed");
    return errorResponse("Layanan rekomendasi sedang tidak tersedia.", 500);
  }
}
