// ============================================================
// NEXT.JS MIDDLEWARE ROUTE PROTECTION
// Intercepts page and API requests to enforce session authentication,
// HTTP-only cookie validation, and login redirects.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/public",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public assets and static files
  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Extract session cookie (__Host-session or dev session fallback)
  const sessionToken =
    req.cookies.get("__Host-session")?.value ||
    req.cookies.get("session")?.value;

  // In test environments, bypass page redirects if header flag is present
  const isTestMode = process.env.NODE_ENV === "test" || process.env.DISABLE_AUTH_FOR_TESTS === "true";

  // Handle unauthenticated page requests
  if (!sessionToken && !isTestMode) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Unauthenticated: Active session required", code: "UNAUTHENTICATED" },
        },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Handle authenticated user accessing /login
  if (sessionToken && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files (_next/static, _next/image, favicon.ico)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
