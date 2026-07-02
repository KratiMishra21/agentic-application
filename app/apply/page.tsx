'use client';

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface JobOption {
  id: string;
  title: string;
  department?: string;
}

interface FormValues {
  fullName: string;
  email: string;
  phone: string;
  jobId: string;
  preferredCallDate: string;
  preferredCallTime: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  jobId?: string;
  preferredCallDate?: string;
  preferredCallTime?: string;
  resume?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const indianPhoneRegex = /^(?:\+91[-\s]?)?(?:[6-9]\d{9})$/;

export default function ApplyPage() {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>({
    fullName: '',
    email: '',
    phone: '',
    jobId: '',
    preferredCallDate: '',
    preferredCallTime: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  useEffect(() => {
    let isMounted = true;
    const loadJobs = async () => {
      try {
        const response = await fetch('/api/jobs');
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Unable to load jobs right now.');
        if (isMounted) setJobs(data.jobs || []);
      } catch (error) {
        if (isMounted) setSubmitError(error instanceof Error ? error.message : 'Unable to load jobs right now.');
      } finally {
        if (isMounted) setLoadingJobs(false);
      }
    };
    loadJobs();
    return () => { isMounted = false; };
  }, []);

  const selectedJobLabel = useMemo(() => {
    return jobs.find((job) => job.id === formValues.jobId)?.title || 'Select a role';
  }, [formValues.jobId, jobs]);

  const validateField = (name: string, value: string) => {
    switch (name) {
      case 'fullName': return value.trim().length < 2 ? 'Full name is required.' : '';
      case 'email':
        if (!value.trim()) return 'Email address is required.';
        return emailRegex.test(value.trim()) ? '' : 'Enter a valid email address.';
      case 'phone':
        if (!value.trim()) return 'Phone number is required.';
        return indianPhoneRegex.test(value.trim()) ? '' : 'Use an Indian phone number, e.g. +91 98765 43210.';
      case 'jobId': return value ? '' : 'Please choose a job opening.';
      case 'preferredCallDate': return value ? '' : 'Preferred call date is required.';
      case 'preferredCallTime': return value ? '' : 'Preferred call time is required.';
      default: return '';
    }
  };

  const validateResume = (file: File | null) => {
    if (!file) return 'Please upload your resume in PDF format.';
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'Only PDF files are accepted.';
    return '';
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const resumeError = validateResume(file);
    if (resumeError) { setFormErrors((prev) => ({ ...prev, resume: resumeError })); setResumeFile(null); return; }
    setResumeFile(file);
    setFormErrors((prev) => ({ ...prev, resume: '' }));
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {
      fullName: validateField('fullName', formValues.fullName),
      email: validateField('email', formValues.email),
      phone: validateField('phone', formValues.phone),
      jobId: validateField('jobId', formValues.jobId),
      preferredCallDate: validateField('preferredCallDate', formValues.preferredCallDate),
      preferredCallTime: validateField('preferredCallTime', formValues.preferredCallTime),
      resume: validateResume(resumeFile),
    };
    setFormErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', formValues.fullName.trim());
      formData.append('email', formValues.email.trim());
      formData.append('phone', formValues.phone.trim());
      formData.append('job_id', formValues.jobId);
      formData.append('preferred_call_date', formValues.preferredCallDate);
      formData.append('preferred_call_time', formValues.preferredCallTime);
      if (resumeFile) formData.append('resume', resumeFile, resumeFile.name);
      const response = await fetch('/api/candidates', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Something went wrong while submitting your application.');
      setIsSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-2xl border border-border bg-card px-4 py-3 text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

  if (isSuccess) {
    return (
      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-xl border border-emerald-500/30 bg-card shadow-lg">
          <CardContent className="space-y-6 p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">Application submitted successfully.</h1>
              <p className="text-muted-foreground">We will be in touch soon. Your application has been received.</p>
            </div>
            <Button asChild className="w-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 sm:w-auto">
              <a href="/">Back to homepage</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-3xl border border-border bg-card shadow-lg">
        <CardHeader className="space-y-3 border-b border-border p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1 text-xs font-bold text-white uppercase tracking-widest">
              Now Hiring
            </span>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold text-foreground sm:text-3xl">Apply for a Position</CardTitle>
            <CardDescription className="text-muted-foreground">Share your details, choose a role, and upload your resume. Our AI will be in touch.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {submitError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                {submitError}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <input name="fullName" type="text" value={formValues.fullName} onChange={handleChange} placeholder="Alex Kumar" className={inputClass} />
                {formErrors.fullName && <p className="text-sm text-red-500">{formErrors.fullName}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <input name="email" type="email" value={formValues.email} onChange={handleChange} placeholder="alex@example.com" className={inputClass} />
                {formErrors.email && <p className="text-sm text-red-500">{formErrors.email}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Phone Number</label>
                <input name="phone" type="tel" value={formValues.phone} onChange={handleChange} placeholder="+91 98765 43210" className={inputClass} />
                <p className="text-xs text-muted-foreground">Indian format: +91 98765 43210</p>
                {formErrors.phone && <p className="text-sm text-red-500">{formErrors.phone}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Select Job</label>
                <select name="jobId" value={formValues.jobId} onChange={handleChange} className={inputClass}>
                  <option value="">Select a role</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.department ? `${job.title} — ${job.department}` : job.title}
                    </option>
                  ))}
                </select>
                {loadingJobs && <p className="text-sm text-muted-foreground">Loading available jobs…</p>}
                {formErrors.jobId && <p className="text-sm text-red-500">{formErrors.jobId}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Preferred Call Date</label>
                <input name="preferredCallDate" type="date" value={formValues.preferredCallDate} onChange={handleChange} className={inputClass} />
                {formErrors.preferredCallDate && <p className="text-sm text-red-500">{formErrors.preferredCallDate}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Preferred Call Time</label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { value: 'morning', label: 'Morning', sub: '9 AM – 12 PM' },
                    { value: 'afternoon', label: 'Afternoon', sub: '12 PM – 4 PM' },
                    { value: 'evening', label: 'Evening', sub: '4 PM – 7 PM' },
                  ].map((slot) => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => {
                        setFormValues((prev) => ({ ...prev, preferredCallTime: slot.value }));
                        setFormErrors((prev) => ({ ...prev, preferredCallTime: '' }));
                      }}
                      className={`rounded-2xl border p-3 text-center transition-colors ${
                        formValues.preferredCallTime === slot.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:bg-primary/5'
                      }`}
                    >
                      <div className="font-medium">{slot.label}</div>
                      <div className="mt-1 text-xs">{slot.sub}</div>
                    </button>
                  ))}
                </div>
                {formErrors.preferredCallTime && <p className="text-sm text-red-500">{formErrors.preferredCallTime}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Resume Upload</label>
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-8 text-center transition ${
                    dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/60 hover:bg-primary/5'
                  }`}
                >
                  <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                  <UploadCloud className="h-8 w-8 text-primary" />
                  <p className="mt-3 text-sm font-semibold text-foreground">Drag and drop your PDF or click to browse</p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF files only</p>
                </label>
                {resumeFile && (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <FileText className="h-4 w-4" />
                    {resumeFile.name}
                  </div>
                )}
                {formErrors.resume && <p className="text-sm text-red-500">{formErrors.resume}</p>}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Applying for:</p>
              <p>{selectedJobLabel}</p>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 hover:from-blue-700 hover:to-cyan-600 py-3"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </span>
              ) : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}