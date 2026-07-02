'use client';

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('hireai-theme');
    if (stored === 'dark') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('hireai-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hireai-theme', 'light');
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">

          <a href="/" className="flex items-center gap-3 text-xl font-bold tracking-tight">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-black text-white shadow-lg shadow-blue-500/30">
              H
            </span>
            <span className="text-foreground">HireAI</span>
          </a>

          <nav className="flex flex-wrap items-center justify-end gap-1 text-sm sm:gap-2">
            <a href="/apply" className="rounded-full px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Apply for a Job
            </a>
            <a href="/hr/post-job" className="rounded-full px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              HR Portal
            </a>

            <button
              onClick={toggleTheme}
              className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            
            <a  href="/hr/dashboard"
              className="hidden md:inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-cyan-600"
            >
              Start hiring
            </a>
          </nav>
        </div>
      </header>

      {children}
    </div>
);
}