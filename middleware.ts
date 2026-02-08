import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login"];

// API routes that should be publicly accessible
const PUBLIC_API_ROUTES = ["/api/auth"];

function isPublicRoute(pathname: string): boolean {
  // Check if it's a public page route
  if (PUBLIC_ROUTES.some((route) => pathname === route)) {
    return true;
  }

  // Check if it's a public API route (Better Auth endpoints)
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return true;
  }

  // Static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return true;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    // If user is authenticated and trying to access login, redirect to dashboard
    if (pathname === "/login") {
      const sessionCookie = request.cookies.get("better-auth.session_token");
      if (sessionCookie) {
        // Verify session is valid by checking with the auth API
        const sessionResponse = await fetch(
          new URL("/api/auth/get-session", request.url),
          {
            headers: {
              cookie: request.headers.get("cookie") || "",
            },
          },
        );

        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          if (session?.user) {
            return NextResponse.redirect(new URL("/home", request.url));
          }
        }
      }
    }
    return NextResponse.next();
  }

  // For protected routes, verify the session
  const sessionCookie = request.cookies.get("better-auth.session_token");

  if (!sessionCookie) {
    // No session cookie, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the session is valid
  const sessionResponse = await fetch(
    new URL("/api/auth/get-session", request.url),
    {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    },
  );

  if (!sessionResponse.ok) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await sessionResponse.json();

  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
