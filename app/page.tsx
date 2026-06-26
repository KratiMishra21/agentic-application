import { Briefcase, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
      <section
        id="hero"
        className="grid items-center gap-8 rounded-[28px] border border-border/80 bg-white p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.25)] sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:p-10"
      >
        <div className="space-y-6 text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-700">
            <Sparkles className="h-3.5 w-3.5" />
            Smart recruiting for serious teams
          </span>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              AI-Powered Hiring, Done Right
            </h1>
            <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg lg:mx-0 lg:text-xl">
              Move faster from resume review to shortlist — with a clean, modern platform built for candidates and HR teams.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Button className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90 sm:px-6">
              Upload Your Resume
            </Button>
            <Button variant="outline" className="rounded-full border-border bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-muted sm:px-6">
              HR Login
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500 lg:justify-start">
            <span className="rounded-full bg-muted px-3 py-1.5">Fast shortlist</span>
            <span className="rounded-full bg-muted px-3 py-1.5">Clear insights</span>
            <span className="rounded-full bg-muted px-3 py-1.5">Human-first workflow</span>
          </div>
        </div>

        <aside className="rounded-[24px] border border-primary/20 bg-[linear-gradient(145deg,#fffdf7_0%,#ffffff_100%)] p-5 shadow-[0_18px_35px_-26px_rgba(15,23,42,0.35)] sm:p-6">
          <div className="rounded-[20px] border border-border/80 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Hiring overview</p>
                <h2 className="text-xl font-semibold text-slate-900">This week</h2>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-slate-700">Live</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                ["16", "Qualified applicants"],
                ["8", "Shortlisted"],
                ["92%", "Response rate"],
              ].map(([value, label]) => (
                <article key={label} className="rounded-2xl border border-border/80 bg-muted/70 p-4">
                  <p className="text-2xl font-semibold text-slate-900">{value}</p>
                  <p className="text-sm text-slate-500">{label}</p>
                </article>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-border/80 bg-primary/5 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Why teams love HireAI</p>
              <p className="mt-1">A polished experience for candidates, stronger hiring visibility for HR, and less time spent on manual screening.</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Briefcase,
            title: "Apply in minutes",
            text: "Candidates can share a resume and see a clear next step without friction.",
          },
          {
            icon: ShieldCheck,
            title: "Built for trust",
            text: "A clean workflow keeps screening professional, transparent, and reliable.",
          },
          {
            icon: Sparkles,
            title: "Smart hiring signals",
            text: "HR teams get concise, useful insights that help move the best applicants forward.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-[24px] border border-border/80 bg-white p-5 shadow-[0_16px_35px_-28px_rgba(15,23,42,0.25)]">
            <div className="mb-3 inline-flex rounded-xl bg-primary/10 p-2 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
