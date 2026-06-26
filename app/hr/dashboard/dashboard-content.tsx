'use client';

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
  call_summary?: string | null;  // ADD THIS
};

const statusStyles: Record<string, string> = {
  pending: 'border-slate-200 bg-slate-100 text-slate-700',
  shortlisted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  interviewed: 'border-sky-200 bg-sky-50 text-sky-700',
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

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to load applications.');
      }

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
    const timer = window.setTimeout(() => {
      void fetchCandidates();
    }, 0);

    const interval = window.setInterval(() => {
      void fetchCandidates();
    }, 30000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  const jobOptions = useMemo(() => {
    const options = candidates.reduce<{ id: string; title: string }[]>((acc, candidate) => {
      if (!candidate.job_id || !candidate.job_title || acc.some((item) => item.id === candidate.job_id)) {
        return acc;
      }

      acc.push({ id: candidate.job_id, title: candidate.job_title });
      return acc;
    }, []);

    return options;
  }, [candidates]);

  const selectedJobId = useMemo(() => {
    if (selectedJob === 'All Roles') return undefined;
    return jobOptions.find((job) => job.title === selectedJob)?.id;
  }, [jobOptions, selectedJob]);

  const filteredCandidates = useMemo(() => {
    if (selectedJob === 'All Roles') return candidates;
    return candidates.filter((candidate) => candidate.job_title === selectedJob);
  }, [candidates, selectedJob]);

  const stats = useMemo(() => {
    const shortlisted = candidates.filter((candidate) => candidate.status === 'shortlisted').length;
    const pending = candidates.filter((candidate) => candidate.status === 'pending').length;

    return {
      totalApplications: candidates.length,
      shortlisted,
      pendingReview: pending,
    };
  }, [candidates]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      {showToast ? (
        <div className="fixed right-4 top-20 z-50 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg shadow-emerald-100">
          <CheckCircle2 className="h-5 w-5" />
          Job posted successfully.
        </div>
      ) : null}

      <Card className="border border-border/80 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
        <CardHeader className="border-b border-border/80 p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">HR dashboard</p>
              <CardTitle className="text-2xl font-semibold text-slate-900 sm:text-3xl">Applications overview</CardTitle>
              <CardDescription className="text-slate-600">Track incoming applications, shortlist progress, and review each candidate in one place.</CardDescription>
            </div>
            <Button asChild className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
              <a href="/hr/post-job">Create another job</a>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6 sm:p-8">
          <section className="grid gap-4 md:grid-cols-3">
            {loading && candidates.length === 0 ? (
              [1, 2, 3].map((item) => (
                <article key={item} className="rounded-3xl border border-border/80 bg-muted/60 p-5 shadow-sm">
                  <div className="h-4 w-24 rounded bg-slate-200" />
                  <div className="mt-4 h-8 w-14 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
                </article>
              ))
            ) : (
              [
                { label: 'Total Applications', value: stats.totalApplications },
                { label: 'Shortlisted', value: stats.shortlisted },
                { label: 'Pending Review', value: stats.pendingReview },
              ].map((item) => (
                <article key={item.label} className="rounded-3xl border border-border/80 bg-muted/60 p-5 shadow-sm">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
                </article>
              ))
            )}
          </section>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : null}

          <section className="rounded-3xl border border-border/80 bg-[linear-gradient(145deg,#fffdf7_0%,#ffffff_100%)] p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedJob('All Roles')}
                  className={`rounded-full border px-3 py-2 text-sm transition ${selectedJob === 'All Roles' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-700 hover:bg-primary/10'}`}
                >
                  All Roles
                </button>
                {jobOptions.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJob(job.title)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${selectedJob === job.title ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-slate-700 hover:bg-primary/10'}`}
                  >
                    {job.title}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleRunShortlisting(selectedJobId)}
                disabled={isShortlisting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isShortlisting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  'Run Shortlisting'
                )}
              </button>
            </div>

            {shortlistMessage ? (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                {shortlistMessage}
              </div>
            ) : null}
          </section>

          {loading ? (
            <section className="rounded-3xl border border-border/80 bg-white p-4 shadow-sm">
              {[1, 2, 3].map((row) => (
                <div key={row} className="grid grid-cols-7 gap-4 border-b border-border/70 py-4 last:border-b-0">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div key={`${row}-${index}`} className="h-4 rounded bg-slate-200" />
                  ))}
                </div>
              ))}
            </section>
          ) : filteredCandidates.length === 0 ? (
            <section className="rounded-3xl border border-dashed border-border/80 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">No applications yet</h3>
              <p className="mt-2 text-sm text-slate-600">Applications will appear here automatically as candidates apply.</p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-border/80 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border/70 text-left text-sm">
                  <thead className="bg-muted/80 text-slate-600">
                    <tr>
                      {['Candidate Name', 'Email', 'Phone', 'Applied For', 'Status', 'Match Score', 'Applied Date', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {filteredCandidates.map((candidate) => (
                      <tr key={candidate.id} className="hover:bg-muted/40">
                        <td className="px-4 py-4 font-medium text-slate-900">{candidate.name}</td>
                        <td className="px-4 py-4 text-slate-600">{candidate.email}</td>
                        <td className="px-4 py-4 text-slate-600">{candidate.phone}</td>
                        <td className="px-4 py-4 text-slate-600">{candidate.job_title || 'General'}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[candidate.status] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                            {candidate.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {candidate.match_score != null ? `${(candidate.match_score * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-4 text-slate-600">{new Date(candidate.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {candidate.resume_path ? (
                              <Button asChild size="sm" variant="outline" className="rounded-full border-primary/40 bg-white text-slate-800 hover:bg-primary/10">
                                <a href={candidate.resume_path} target="_blank" rel="noreferrer">View Resume</a>
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400">Unavailable</span>
                            )}
                            {candidate.call_summary && (
                              <button
                                onClick={() => setSelectedSummary(candidate)}
                                className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-full transition-colors"
                              >
                                View Summary
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

          <section className="flex items-center gap-2 rounded-3xl border border-border/80 bg-muted/60 p-4 text-sm text-slate-600">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-refreshes every 30 seconds to surface new applications instantly.
          </section>
        </CardContent>
      </Card>

      {selectedSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedSummary.name}</h2>
                <p className="text-sm text-gray-500">{selectedSummary.job_title}</p>
              </div>
              <button
                onClick={() => setSelectedSummary(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
              {selectedSummary.call_summary}
            </pre>
            <div className="mt-4 flex gap-2 justify-end">
              <a
                href={selectedSummary.resume_path ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline px-3 py-1 border border-blue-300 rounded"
              >
                View Resume
              </a>
              <button
                onClick={() => setSelectedSummary(null)}
                className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}