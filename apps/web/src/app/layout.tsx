import type { Metadata, Viewport } from "next";
import { WEBSITE_DESCRIPTION, WEBSITE_NAME } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${WEBSITE_NAME} — moderation, tickets & live notifications for Discord`,
    template: `%s · ${WEBSITE_NAME}`,
  },
  description: WEBSITE_DESCRIPTION,
  applicationName: WEBSITE_NAME,
  openGraph: {
    title: WEBSITE_NAME,
    description: WEBSITE_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: WEBSITE_NAME,
    description: WEBSITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#05050a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-slate-200 antialiased">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.28),transparent_70%)]" />
          <div className="grid-bg absolute inset-x-0 top-0 h-[620px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
