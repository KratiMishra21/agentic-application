import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Button } from "@/components/ui/button";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HireAI | AI-Powered Hiring",
  description: "A modern hiring platform for candidates and HR teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffef9_0%,_#ffffff_45%,_#fffaf0_100%)]">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-white/95 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <a href="/" className="flex items-center gap-3 text-xl font-semibold tracking-tight text-slate-900">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm shadow-primary/30">
                  H
                </span>
                HireAI
              </a>

              <nav className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-600 sm:gap-4 lg:gap-6">
                <a href="/apply" className="rounded-full px-3 py-2 transition hover:bg-muted hover:text-slate-900">Apply for a Job</a>
                <a href="/hr/post-job" className="rounded-full px-3 py-2 transition hover:bg-muted hover:text-slate-900">HR Portal</a>
              </nav>

              <Button asChild variant="outline" size="sm" className="hidden md:inline-flex rounded-full border-primary/40 bg-white text-slate-800 hover:bg-primary/10">
                <a href="/apply">Start hiring</a>
              </Button>
            </div>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
