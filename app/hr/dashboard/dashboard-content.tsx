'use client';
import ReactMarkdown from 'react-markdown';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, FileText, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  resume_path?: string | null;
  job_title?: string | null;
  job_id?: string | null;
  match_score?: number | null;
  call_summary?: string | null;
};

const statusStyles: Record<string, string> = {
  pending: 'border-muted-foreground/20 bg-muted text-muted-foreground',
  shortlisted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  interviewed: 'border-primary/30 bg-primary/10 text-primary',
  call_initiated: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  unreachable: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-500',
};

export default function DashboardContent() {
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedJob, setSelectedJob] = useState('All Roles');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isShortlisting, setIsShortlisting] = useState(false);
  const [shortlistMessage, setShortlistMessage] = useState('');
  const [selectedSummary, setSelectedSummary] = useState<Candidate | null>(null);

  const showToast = searchParams.get('posted') === '1';

  const fetchCandidates = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/candidates');
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to load applications.');
      setCandidates(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load applications.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunShortlisting = async (jobId?: string) => {
    setIsShortlisting(true);
    setShortlistMessage('');
    try {
      const url = jobId
        ? `http://localhost:8000/shortlist?job_id=${jobId}`
        : 'http://localhost:8000/shortlist';
      const response = await fetch(url, { method: 'POST' });
      const data = await response.json();
      if (data.status === 'success') {
        setShortlistMessage('Shortlisting complete. Refreshing candidates...');
        await fetchCandidates();
      } else {
        setShortlistMessage(`Error: ${data.message || 'Unable to run shortlisting.'}`);
      }
    } catch {
      setShortlistMessage('Could not reach the backend. Is FastAPI running?');
    } finally {
      setIsShortlisting(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchCandidates(); }, 0);
    const interval = window.setInterval(() => { void fetchCandidates(); }, 30000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, []);

  const jobOptions = useMemo(() => {
    return candidates.reduce<{ id: string; title: string }[]>((acc, candidate) => {
      if (!candidate.job_id || !candidate.job_title || acc.some((item) => item.id === candidate.job_id)) return acc;
      acc.push({ id: candidate.job_id, title: candidate.job_title });
      return acc;
    }, []);
  }, [candidates]);

  const selectedJobId = useMemo(() => {
    if (selectedJob === 'All Roles') return undefined;
    return jobOptions.find((job) => job.title === selectedJob)?.id;
  }, [jobOptions, selectedJob]);

  const filteredCandidates = useMemo(() => {
    if (selectedJob === 'All Roles') return candidates;
    return candidates.filter((candidate) => candidate.job_title === selectedJob);
  }, [candidates, selectedJob]);

  const stats = useMemo(() => ({
    totalApplications: candidates.length,
    shortlisted: candidates.filter((c) => c.status === 'shortlisted').length,
    interviewed: candidates.filter((c) => c.status === 'interviewed').length,
    rejected: candidates.filter((c) => c.status === 'rejected').length,
    pending: candidates.filter((c) => c.status === 'pending').length,
  }), [candidates]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">

      {showToast && (
        <div className="fixed right-4 top-20 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 shadow-lg backdrop-blur-sm">
          <CheckCircle2 className="h-5 w-5" />
          Job posted successfully.
        </div>
      )}

      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">HR dashboard</p>
              <CardTitle className="text-2xl font-semibold text-foreground sm:text-3xl">Applications overview</CardTitle>
              <CardDescription className="text-muted-foreground">Track incoming applications, shortlist progress, and review each candidate in one place.</CardDescription>
            </div>
            <Button asChild className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 hover:from-blue-700 hover:to-cyan-600">
              <a href="/hr/post-job">Create another job</a>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6 sm:p-8">

          {/* ── STATS ── */}
          <section className="grid gap-4 md:grid-cols-5">
            {loading && candidates.length === 0 ? (
              [1,2,3,4,5].map((item) => (
                <article key={item} className="rounded-3xl border border-border bg-muted p-5 animate-pulse">
                  <div className="h-4 w-24 rounded bg-muted-foreground/20" />
                  <div className="mt-4 h-8 w-14 rounded bg-muted-foreground/20" />
                </article>
              ))
            ) : (
              [
                { label: 'Total', value: stats.totalApplications, gradient: 'from-blue-600 to-blue-800', icon: '📋' },
                { label: 'Shortlisted', value: stats.shortlisted, gradient: 'from-emerald-500 to-teal-700', icon: '✅' },
                { label: 'Interviewed', value: stats.interviewed, gradient: 'from-purple-500 to-indigo-700', icon: '🎙️' },
                { label: 'Rejected', value: stats.rejected, gradient: 'from-red-500 to-rose-700', icon: '✕' },
                { label: 'Pending', value: stats.pending, gradient: 'from-amber-500 to-orange-600', icon: '⏳' },
              ].map((item) => (
                <article key={item.label} className={`rounded-3xl bg-gradient-to-br ${item.gradient} p-5 text-white shadow-lg`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-white/80">{item.label}</p>
                    <span className="text-xl">{item.icon}</span>
                  </div>
                  <p className="mt-3 text-3xl font-bold">{item.value}</p>
                </article>
              ))
            )}
          </section>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          {/* ── FILTER + SHORTLIST ── */}
          <section className="rounded-3xl border border-border bg-muted/40 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedJob('All Roles')}
                  className={`rounded-full border px-3 py-2 text-sm transition ${selectedJob === 'All Roles' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                >
                  All Roles
                </button>
                {jobOptions.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJob(job.title)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${selectedJob === job.title ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  >
                    {job.title}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleRunShortlisting(selectedJobId)}
                disabled={isShortlisting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50"
              >
                {isShortlisting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Running...</>
                ) : 'Run Shortlisting'}
              </button>
            </div>
            {shortlistMessage && (
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                {shortlistMessage}
              </div>
            )}
          </section>

          {/* ── TABLE ── */}
          {loading ? (
            <section className="rounded-3xl border border-border bg-card p-4">
              {[1,2,3].map((row) => (
                <div key={row} className="grid grid-cols-7 gap-4 border-b border-border py-4 last:border-b-0">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-4 rounded bg-muted animate-pulse" />
                  ))}
                </div>
              ))}
            </section>
          ) : filteredCandidates.length === 0 ? (
            <section className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-foreground">
                No applications for {selectedJob === 'All Roles' ? 'any role' : selectedJob} yet
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">Applications will appear here automatically as candidates apply.</p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      {['Candidate', 'Email', 'Phone', 'Applied For', 'Status', 'Match', 'Date', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCandidates.map((candidate) => (
                      <tr key={candidate.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white shrink-0">
                              {candidate.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <span className="font-medium text-foreground">{candidate.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{candidate.email}</td>
                        <td className="px-4 py-4 text-muted-foreground">{candidate.phone}</td>
                        <td className="px-4 py-4 text-muted-foreground">{candidate.job_title || 'General'}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[candidate.status] || statusStyles.pending}`}>
                            {candidate.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {candidate.match_score != null ? (
                            <span className={`font-semibold ${
                              candidate.match_score >= 0.5 ? 'text-emerald-600 dark:text-emerald-400' :
                              candidate.match_score >= 0.35 ? 'text-amber-600 dark:text-amber-400' :
                              'text-red-500'
                            }`}>
                              {(candidate.match_score * 100).toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{new Date(candidate.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {candidate.resume_path ? (
                              
                              <a
                                href={candidate.resume_path}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition hover:bg-muted"
                              >
                                Resume
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                            {candidate.call_summary && (
                              <button
                                onClick={() => setSelectedSummary(candidate)}
                                className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:from-purple-700 hover:to-indigo-700"
                              >
                                Summary
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="flex items-center gap-2 rounded-3xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-refreshes every 30 seconds to surface new applications instantly.
          </section>
        </CardContent>
      </Card>

      {/* ── SUMMARY MODAL ── */}
      {selectedSummary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-border">
            <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-purple-600 to-blue-600" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedSummary.name}</h2>
                  <span className="inline-block mt-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {selectedSummary.job_title}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSummary(null)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                <ReactMarkdown>{selectedSummary.call_summary ?? ''}</ReactMarkdown>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                
                <a  href={selectedSummary.resume_path ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline px-3 py-1 border border-primary/30 rounded-full"
                >
                  View Resume
                </a>
                <button
                  onClick={() => setSelectedSummary(null)}
                  className="text-sm bg-muted hover:bg-muted/80 text-foreground px-3 py-1 rounded-full"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}