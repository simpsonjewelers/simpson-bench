export function publicBase(request?: Request): string {
  const configured = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "")
  if (configured) return configured
  if (!request) return ""
  const url = new URL(request.url)
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "")
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || url.host
  return `${proto}://${host}`
}

export function webhookUrl(request: Request): string {
  const url = new URL(request.url)
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "")
  if (base) return `${base}${url.pathname}${url.search}`
  return `${publicBase(request)}${url.pathname}${url.search}`
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request.headers.get("x-real-ip") || "local"
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status })
}
