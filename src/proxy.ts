import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute } from "@/lib/role-access";
import type { UserRole } from "@/types";

const PRIVATE_PREFIXES = [
  "/admin",
  "/assets",
  "/audit",
  "/checklists",
  "/dashboard",
  "/reports",
  "/scan",
];

function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname === "/login";
  const isProtectedRoute = isPrivateRoute(pathname);
  if (!isProtectedRoute && !isLoginRoute) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return isProtectedRoute
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    if (isLoginRoute) return response;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role,is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    return isLoginRoute
      ? response
      : NextResponse.redirect(new URL("/login", request.url));
  }

  if (isLoginRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!canAccessRoute(profile.role as UserRole, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
