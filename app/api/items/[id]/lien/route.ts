import { parseDollars } from "@/lib/format"
import { jsonError } from "@/lib/http"
import { logMailing, recordSale } from "@/lib/repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      action?: "mail" | "sale"
      mailedOn?: string
      tracking?: string
      saleOn?: string
      price?: string
      expenses?: string
      note?: string
    }
    if (body.action === "mail") {
      if (!body.mailedOn) return jsonError("Enter the date the letter was mailed.")
      return Response.json({ item: logMailing(id, body.mailedOn, body.tracking ?? "") })
    }
    if (body.action === "sale") {
      if (!body.saleOn) return jsonError("Enter the sale date.")
      const price = parseDollars(body.price ?? "")
      const expenses = parseDollars(body.expenses ?? "") ?? 0
      if (price == null) return jsonError("Enter the sale price.")
      return Response.json({ item: recordSale(id, { saleOn: body.saleOn, priceCents: price, expensesCents: expenses, note: body.note ?? "" }) })
    }
    return jsonError("Choose mail or sale.")
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "That could not be saved.")
  }
}
