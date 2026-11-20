import Link from "next/link"
import { Shell } from "@/components/shell"

const reports = [
  ["/reports/in-progress", "In progress", "Everything not yet ready for pickup."],
  ["/reports/awaiting", "Awaiting approval", "Quoted, not yet approved."],
  ["/reports/not-picked-up", "Not picked up", "Ready for 30 days or more."],
  ["/reports/at-risk", "Abandoned / at risk", "Approaching or past the one-year lien mark."],
  ["/reports/queue", "Courtesy queue", "Pickup reminders waiting for a staff send."],
]

export default function Page() {
  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Reports</p>
      <h1 className="serif text-4xl">One tap</h1>
      <ul className="mt-6 grid gap-3">
        {reports.map(([href, title, copy]) => (
          <li key={href}>
            <Link href={href} className="block border border-line bg-white p-5">
              <span className="serif text-3xl">{title}</span>
              <span className="mt-1 block text-sm text-muted">{copy}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  )
}
