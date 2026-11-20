import { NextResponse, type NextRequest } from "next/server"
import { hasStaffSession, staffLockEnabled, staffPassword } from "@/lib/staff-auth"

const PUBLIC_PREFIXES = [
  "/login",
  "/status",
  "/a/",
  "/api/login",
  "/api/logout",
  "/api/status",
  "/api/approve",
  "/api/twilio",
  "/brand/",
  "/samples/",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.ico",
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isPublic(pathname)) return NextResponse.next()
  if (!staffLockEnabled()) return NextResponse.next()
  if (await hasStaffSession(request.headers.get("cookie"))) return NextResponse.next()

  if (pathname.startsWith("/api/")) {
    const message = staffPassword()
      ? "Sign in to use the bench."
      : "Set STAFF_PASSWORD on the server before using the bench."
    return NextResponse.json({ error: message }, { status: 401 })
  }

  const login = request.nextUrl.clone()
  login.pathname = "/login"
  login.searchParams.set("next", pathname)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
