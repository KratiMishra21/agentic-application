import { Briefcase, ShieldCheck, Sparkles, ArrowRight, Phone, Brain, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden grid items-center gap-8 rounded-[28px] border border-border bg-card p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.25)] sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:p-10">

        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-purple-500/5 blur-3xl" />

        <div className="relative space-y-6 text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Agentic AI · RAG · Voice NLP
          </span>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              AI-Powered Hiring,{" "}
              <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Done Right
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0 lg:text-xl">
              From resume upload to AI phone interview — fully automated, legally compliant, and powered by RAG + LLM agents.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Button asChild className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-cyan-600 border-0">
              <Link href="/apply">
                Upload Your Resume
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
              <Link href="/hr/dashboard">HR Portal</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm lg:justify-start">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-600 dark:text-emerald-400">✓ RAG resume matching</span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary">✓ AI voice screening</span>
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-purple-600 dark:text-purple-400">✓ Auto summaries</span>
          </div>
        </div>

        <aside className="relative rounded-[24px] border border-border bg-muted/50 p-5 sm:p-6">
          <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hiring overview</p>
                <h2 className="text-xl font-semibold text-foreground">This week</h2>
              </div>
              <span className="animate-pulse rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-500">● Live</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                { value: "16", label: "Applications", color: "from-blue-500 to-blue-700" },
                { value: "8", label: "Shortlisted", color: "from-emerald-500 to-teal-600" },
                { value: "92%", label: "Response rate", color: "from-purple-500 to-indigo-600" },
              ].map(({ value, label, color }) => (
                <article key={label} className={`rounded-2xl bg-gradient-to-br ${color} p-4 text-white shadow-sm`}>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-white/80">{label}</p>
                </article>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {[
                { label: "Resume uploaded", status: "done" },
                { label: "AI shortlisted", status: "done" },
                { label: "Voice call scheduled", status: "active" },
                { label: "Summary sent to HR", status: "pending" },
              ].map(({ label, status }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-muted/60 px-3 py-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${
                    status === 'done' ? 'bg-emerald-500' :
                    status === 'active' ? 'bg-primary animate-pulse' :
                    'bg-muted-foreground/30'
                  }`} />
                  <p className="text-xs text-foreground">{label}</p>
                  {status === 'done' && <span className="ml-auto text-xs text-emerald-500 font-medium">✓</span>}
                  {status === 'active' && <span className="ml-auto text-xs text-primary font-medium">In progress</span>}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="space-y-4">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">The pipeline</p>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">How HireAI works</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: FileText, step: "01", title: "Resume upload", text: "Candidate submits resume via web portal", color: "from-blue-500 to-blue-700" },
            { icon: Brain, step: "02", title: "RAG matching", text: "AI embeds JD and resume, scores similarity", color: "from-purple-500 to-indigo-600" },
            { icon: Phone, step: "03", title: "AI voice call", text: "Agent calls candidate, handles salary logic", color: "from-emerald-500 to-teal-600" },
            { icon: Sparkles, step: "04", title: "HR summary", text: "Structured report lands in HR dashboard", color: "from-amber-500 to-orange-600" },
          ].map(({ icon: Icon, step, title, text, color }, index) => (
            <article key={title} className="relative rounded-[24px] border border-border bg-card p-5 shadow-sm">
              {index < 3 && (
                <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-muted-foreground/40 md:block" />
              )}
              <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${color} p-2.5 text-white shadow-sm`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-muted-foreground mb-1">STEP {step}</p>
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Briefcase,
            title: "Apply in minutes",
            text: "Candidates share a resume, pick a preferred call time, and let the AI handle the rest.",
            tag: "Candidate",
            tagClass: "bg-primary/10 text-primary border-primary/20",
          },
          {
            icon: ShieldCheck,
            title: "Legally compliant",
            text: "AI discloses itself on every call. No audio recording — only text transcripts. DPDP Act aligned.",
            tag: "Compliance",
            tagClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          },
          {
            icon: Sparkles,
            title: "Smart hiring signals",
            text: "HR gets salary negotiation outcomes, question-by-question answers, and an overall hire recommendation.",
            tag: "HR Intelligence",
            tagClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          },
        ].map(({ icon: Icon, title, text, tag, tagClass }) => (
          <article key={title} className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <div className="inline-flex rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tagClass}`}>{tag}</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{text}</p>
          </article>
        ))}
      </section>

      {/* ── CTA BANNER ── */}
      <section className="rounded-[28px] bg-gradient-to-r from-blue-600 to-purple-700 p-8 text-center text-white shadow-lg">
        <h2 className="text-2xl font-bold sm:text-3xl">Ready to hire smarter?</h2>
        <p className="mt-2 text-blue-100">Post a job, let the AI screen candidates, and review summaries — all in one place.</p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 border-0">
            <Link href="/hr/post-job">Post a Job</Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-full border border-white/30 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
            <Link href="/apply">Apply as Candidate</Link>
          </Button>
        </div>
      </section>

    </main>
  );
}