import type { Metadata, Viewport } from "next"
import { Barlow, Caudex } from "next/font/google"
import { ServiceWorker } from "@/components/service-worker"
import { brand } from "@/lib/brand"
import "./globals.css"

const sans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
})

const serif = Caudex({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-caudex",
})

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: "Repair intake for Simpson Jewelers.",
  applicationName: brand.name,
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  themeColor: brand.colors.ink,
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  )
}
