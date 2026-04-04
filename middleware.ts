import { NextRequest, NextResponse } from "next/server";
import { PROVIDER_SESSION_COOKIE } from "@/lib/auth/constants";

const PROTECTED_PATHS = [
  "/dashboard",
  "/doctor",
  "/patients",
  "/accounts",
  "/lab",
  "/review",
  "/pharmacy",
  "/rider",
  "/admin",
];

function isProtectedProviderPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (!isProtectedProviderPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(PROVIDER_SESSION_COOKIE)?.value;

  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const nextPath = `${pathname}${search}`;

  if (nextPath && nextPath !== "/login") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

