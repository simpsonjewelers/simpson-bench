import Link from "next/link"
import { DemoBanner } from "@/components/demo-banner"
import { LogoutButton } from "@/components/logout-button"
import { brand } from "@/lib/brand"

const links = [
  ["/", "Bench"],
  ["/reports", "Reports"],
  ["/catalog", "Parts"],
  ["/customers", "Customers"],
  ["/settings", "Settings"],
]

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <DemoBanner />
      <header className="no-print sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="shrink-0">
            <img src={brand.logos.black} alt={brand.name} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <LogoutButton />
            <Link href="/intake" className="border border-ink bg-ink px-4 py-2 text-xs uppercase tracking-[0.16em] text-white">
              New intake
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-5 overflow-x-auto px-4 pb-3 text-xs uppercase tracking-[0.16em]">
          {links.map(([href, label]) => (
            <Link key={label} href={href} className="shrink-0 text-muted hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">{children}</main>
    </div>
  )
}

export function CustomerFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <DemoBanner />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-8 text-center">
          <img src={brand.logos.black} alt={brand.name} className="h-10 w-auto" />
          <p className="mt-4 text-sm text-muted">{brand.address}</p>
          <p className="text-sm">
            <a href={`tel:${brand.phoneTel}`}>{brand.phoneDisplay}</a>
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-lg px-5 pb-10 text-center text-sm text-muted">
        <p>{brand.hoursShort}</p>
        <p className="mt-2">
          <a href={brand.website}>{brand.websiteLabel}</a>
          {" · "}
          <a href={`mailto:${brand.email}`}>{brand.email}</a>
        </p>
      </footer>
    </div>
  )
}
