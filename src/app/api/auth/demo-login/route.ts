import { NextResponse, type NextRequest } from "next/server";

import { DEMO_ACCOUNTS, getDemoCredentials, isDemoModeEnabled } from "@/lib/demo-accounts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

const DEMO_ROLES = new Set<UserRole>([
  "mahasiswa",
  "dosen",
  "teknisi",
  "kepala_lab",
  "admin",
]);

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!isDemoModeEnabled()) {
    return response({ error: "Mode demo tidak aktif." }, 404);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return response({ error: "Permintaan tidak diizinkan." }, 403);
  }

  let role: UserRole;
  try {
    const body = (await request.json()) as { role?: unknown };
    if (typeof body.role !== "string" || !DEMO_ROLES.has(body.role as UserRole)) {
      return response({ error: "Role demo tidak valid." }, 400);
    }
    role = body.role as UserRole;
  } catch {
    return response({ error: "Permintaan demo tidak valid." }, 400);
  }

  const credentials = getDemoCredentials(role);
  if (!credentials) {
    return response({ error: "Akun demo belum dikonfigurasi." }, 503);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error || !data.user) {
      console.error("[DemoLogin] Demo sign-in failed", {
        role,
        message: error?.message ?? "User session missing",
      });
      return response({ error: "Akun demo belum dapat digunakan." }, 503);
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role,is_active")
      .eq("id", data.user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.is_active !== true ||
      profile.role !== role
    ) {
      await supabase.auth.signOut({ scope: "local" });
      console.error("[DemoLogin] Demo profile validation failed", {
        role,
        message: profileError?.message ?? "Profile role or status mismatch",
      });
      return response({ error: "Profil akun demo tidak valid." }, 403);
    }

    return response(
      {
        role,
        fullName: DEMO_ACCOUNTS[role].fullName,
        redirectTo: "/dashboard",
      },
      200,
    );
  } catch (error) {
    console.error("[DemoLogin] Unexpected error", {
      role,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return response({ error: "Layanan akun demo sedang tidak tersedia." }, 500);
  }
}
