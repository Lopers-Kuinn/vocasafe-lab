import { NextResponse, type NextRequest } from "next/server";

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

function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    ({ name, value }) =>
      Boolean(value) && name.startsWith("sb-") && name.includes("-auth-token"),
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!isPrivateRoute(pathname) || hasSupabaseSessionCookie(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
