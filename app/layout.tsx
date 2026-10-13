import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Every page depends on who is signed in (the header changes), so render
// on each request instead of caching one copy at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Three Takes",
  description: "Post a photo. AI captions it in three voices. Vote for the take that wins.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<SiteHeaderFallback />}>
          <SiteHeader />
        </Suspense>
        {children}
        <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-white/35 sm:px-6">
          Three Takes · captions written by AI, judged by people · a Columbia “Designing for GenAI”
          project
        </footer>
      </body>
    </html>
  );
}
