import { StatusLookup } from "@/components/status-lookup"

export default async function Page({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const { ticket } = await searchParams
  return <StatusLookup initialTicket={ticket ?? ""} />
}
