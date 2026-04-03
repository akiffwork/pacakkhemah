import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const isVendorSubdomain = hostname.startsWith("vendor.");
  const pathname = request.nextUrl.pathname;

  // On vendor subdomain, redirect root to /dashboard
  if (isVendorSubdomain && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest|sw.js).*)",
  ],
};