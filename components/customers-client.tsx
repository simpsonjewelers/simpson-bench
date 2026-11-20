"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Shell } from "@/components/shell"
import { formatPhone, formatWhen } from "@/lib/format"
import { statusLabel } from "@/lib/statuses"

type Group = {
  phone: string
  name: string
  visits: { id: string; ticketNumber: string; createdAt: string; status: string; requestedRepair: string }[]
}

export function CustomersClient() {
  const [groups, setGroups] = useState<Group[]>([])
  useEffect(() => {
    fetch("/api/customers").then((response) => response.json()).then((data) => setGroups(data.customers ?? []))
  }, [])
  return (
    <Shell>
      <h1 className="serif text-4xl">Customers</h1>
      <ul className="mt-6 space-y-4">
        {groups.map((group) => (
          <li key={group.phone} className="border border-line bg-white p-4">
            <p className="font-medium">{group.name || "No name"}</p>
            <p className="text-sm">{formatPhone(group.phone)} · {group.visits.length} visits</p>
            <ul className="mt-2 text-sm">
              {group.visits.map((visit) => (
                <li key={visit.id}>
                  <Link className="underline" href={`/items/${visit.id}`}>{visit.ticketNumber}</Link>
                  {" · "}{statusLabel(visit.status)} · {formatWhen(visit.createdAt)}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {groups.length === 0 && <li className="text-muted">No customers with a phone number yet.</li>}
      </ul>
    </Shell>
  )
}
