import { NextRequest, NextResponse } from "next/server";

/**
 * Auth middleware for Lurk web admin.
 *
 * Checks for a Firebase session token stored in the "__session" cookie
 * (the conventional name for Firebase Auth cookies on hosting platforms)
 * or an Authorization header. If neither is present the user is redirected
 * to /login.
 *
 * Note: This performs a *presence* check only. Full token verification
 * happens server-side in API routes / server components via firebase-admin.
 */

const PUBLIC_PATHS = new Set(["/login"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Allow Next.js internals and static assets through
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|woff2?)$/)) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie (set after Firebase Auth sign-in)
  const sessionCookie = request.cookies.get("__session")?.value;

  // Also accept Authorization bearer token (for programmatic access)
  const authHeader = request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!sessionCookie && !bearerToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
