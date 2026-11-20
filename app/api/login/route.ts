import { jsonError } from "@/lib/http"
import { CLEARED_STAFF_COOKIE, hasStaffSession, staffCookie, staffPassword } from "@/lib/staff-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const password = staffPassword()
  if (!password) return jsonError("STAFF_PASSWORD is not set on the server.", 503)
  const body = (await request.json().catch(() => ({}))) as { password?: string }
  if (body.password !== password) return jsonError("That password is not right.", 401)
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": await staffCookie() } },
  )
}

export async function GET(request: Request) {
  return Response.json({ signedIn: await hasStaffSession(request.headers.get("cookie")) })
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": CLEARED_STAFF_COOKIE } })
}
