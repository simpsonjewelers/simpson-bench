/**
 * Simpson Jewelers brand settings.
 * Change shop identity, colors, and type here. Fonts are loaded in app/layout.tsx
 * to match `fonts` below (Caudex for headings, Barlow as the Gotham-style sans).
 */
export const brand = {
  name: "Simpson Jewelers",
  addressLine: "4922 13th Ave",
  cityLine: "Brooklyn, NY 11219",
  address: "4922 13th Ave, Brooklyn, NY 11219",
  phoneDisplay: "(718) 871-0120",
  phoneTel: "+17188710120",
  email: "info@simpsonjewelers.com",
  website: "https://simpsonjewelers.com",
  websiteLabel: "simpsonjewelers.com",
  hours: [
    { days: "Mon–Wed", hours: "11am–6pm" },
    { days: "Thu", hours: "11:30am–6pm" },
    { days: "Fri–Sun", hours: "Closed" },
  ],
  hoursShort: "Mon–Wed 11am–6pm, Thu 11:30am–6pm, Fri–Sun closed",
  timezone: "America/New_York",
  ticketPrefix: "SJ",
  currency: "USD",
  fonts: {
    serif: "Caudex",
    sans: "Barlow",
  },
  colors: {
    background: "#F9F9F9",
    ink: "#111111",
    muted: "#5E5E5E",
    line: "#E4E4E4",
    danger: "#9F1239",
    white: "#FFFFFF",
  },
  logos: {
    black: "/brand/logo-black.png",
    white: "/brand/logo-white.png",
    icon: "/brand/icon.png",
  },
  signoff: "Simpson Jewelers (718) 871-0120",
} as const

export type Brand = typeof brand
