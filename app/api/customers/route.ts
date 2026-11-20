import { customerGroups } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ customers: customerGroups() })
}
