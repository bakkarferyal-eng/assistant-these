import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import NavTabs from "@/components/NavTabs";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Assistant de Thèse",
  description: "Assistant de rédaction de mémoire de master",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="max-w-5xl mx-auto w-full px-4 py-6 relative overflow-hidden">
          <div
            className="hex-deco"
            style={{ width: 160, height: 160, top: -40, right: -30 }}
          />
          <div
            className="hex-deco"
            style={{ width: 90, height: 90, top: 90, right: 150 }}
          />
          <header className="mb-5 relative flex items-center justify-between gap-3">
            <Link href="/">
              <h1
                className="disp text-2xl font-semibold"
                style={{ letterSpacing: "-0.01em" }}
              >
                Assistant de Thèse
              </h1>
            </Link>
            <a href="/api/export" className="btn-ghost text-sm shrink-0">
              Exporter en .docx
            </a>
          </header>
          <nav className="mb-6">
            <NavTabs />
          </nav>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
