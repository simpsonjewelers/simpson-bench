import { ApproveClient } from "@/components/approve-client"

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <ApproveClient token={token} />
}
