const COOKIE = "sj_staff"
const MESSAGE = "simpson-jewelers-staff"

export function staffPassword(): string {
  return process.env.STAFF_PASSWORD?.trim() ?? ""
}

export function staffLockEnabled(): boolean {
  return Boolean(staffPassword()) || process.env.NODE_ENV === "production"
}

export async function staffToken(password = staffPassword()): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(MESSAGE))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function staffCookie(): Promise<string> {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `${COOKIE}=${await staffToken()}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`
}

export function readStaffCookie(header: string | null): string {
  if (!header) return ""
  const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))
  return pair ? decodeURIComponent(pair.slice(COOKIE.length + 1)) : ""
}

export async function hasStaffSession(cookieHeader: string | null): Promise<boolean> {
  const password = staffPassword()
  if (!password) return process.env.NODE_ENV !== "production"
  const given = readStaffCookie(cookieHeader)
  const expected = await staffToken(password)
  if (given.length !== expected.length) return false
  let mismatch = 0
  for (let index = 0; index < given.length; index += 1) mismatch |= given.charCodeAt(index) ^ expected.charCodeAt(index)
  return mismatch === 0
}

export const CLEARED_STAFF_COOKIE = `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
