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
  themeColor: "#04040a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-slate-200 antialiased">
        <div className="app-backdrop" aria-hidden="true">
          <div className="app-glow app-glow-a" />
          <div className="app-glow app-glow-b" />
          <div className="app-glow app-glow-c" />
          <div className="app-grid" />
          <div className="app-noise" />
        </div>
        {children}
      </body>
    </html>
  );
}
