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

        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load jobs right now.');
        }

        if (isMounted) {
          setJobs(data.jobs || []);
        }
      } catch (error) {
        if (isMounted) {
          setSubmitError(error instanceof Error ? error.message : 'Unable to load jobs right now.');
        }
      } finally {
        if (isMounted) {
          setLoadingJobs(false);
        }
      }
    };

    loadJobs();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedJobLabel = useMemo(() => {
    return jobs.find((job) => job.id === formValues.jobId)?.title || 'Select a role';
  }, [formValues.jobId, jobs]);

  const validateField = (name: string, value: string) => {
    switch (name) {
      case 'fullName':
        return value.trim().length < 2 ? 'Full name is required.' : '';
      case 'email':
        if (!value.trim()) return 'Email address is required.';
        return emailRegex.test(value.trim()) ? '' : 'Enter a valid email address.';
      case 'phone':
        if (!value.trim()) return 'Phone number is required.';
        return indianPhoneRegex.test(value.trim()) ? '' : 'Use an Indian phone number, e.g. +91 98765 43210.';
      case 'jobId':
        return value ? '' : 'Please choose a job opening.';
      case 'preferredCallDate':
        return value ? '' : 'Preferred call date is required.';
      case 'preferredCallTime':
        return value ? '' : 'Preferred call time is required.';
      default:
        return '';
    }
  };

  const validateResume = (file: File | null) => {
    if (!file) return 'Please upload your resume in PDF format.';
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return 'Only PDF files are accepted.';
    }
    return '';
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;

    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    if (name === 'jobId') {
      setFormErrors((prev) => ({ ...prev, jobId: value ? '' : 'Please choose a job opening.' }));
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    const resumeError = validateResume(file);
    setResumeFile(file);
    setFormErrors((prev) => ({
      ...prev,
      resume: resumeError,
    }));

    if (resumeError) {
      setResumeFile(null);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const droppedFile = event.dataTransfer.files?.[0];
    handleFile(droppedFile);
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

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', formValues.fullName.trim());
      formData.append('email', formValues.email.trim());
      formData.append('phone', formValues.phone.trim());
      formData.append('job_id', formValues.jobId);
      formData.append('preferred_call_date', formValues.preferredCallDate);
      formData.append('preferred_call_time', formValues.preferredCallTime);
      if (resumeFile) {
        formData.append('resume', resumeFile, resumeFile.name);
      }

      const response = await fetch('/api/candidates', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Something went wrong while submitting your application.');
      }

      setIsSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong while submitting your application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-xl border border-emerald-200 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
          <CardContent className="space-y-6 p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">Application submitted successfully.</h1>
              <p className="text-slate-600">We will be in touch soon. Your application has been received.</p>
            </div>
            <Button asChild className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
              <a href="/">Back to homepage</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-3xl border border-border/80 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
        <CardHeader className="space-y-3 border-b border-border/70 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Candidate application</p>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold text-slate-900 sm:text-3xl">Apply for a Position</CardTitle>
            <CardDescription className="text-slate-600">Share your details, choose a role, and upload your resume to get started.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {submitError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                {submitError}
              </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="fullName" className="text-sm font-medium text-slate-700">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formValues.fullName}
                  onChange={handleChange}
                  placeholder="Alex Kumar"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  aria-invalid={Boolean(formErrors.fullName)}
                />
                {formErrors.fullName ? <p className="text-sm text-red-600">{formErrors.fullName}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formValues.email}
                  onChange={handleChange}
                  placeholder="alex@example.com"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  aria-invalid={Boolean(formErrors.email)}
                />
                {formErrors.email ? <p className="text-sm text-red-600">{formErrors.email}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formValues.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  aria-invalid={Boolean(formErrors.phone)}
                />
                <p className="text-xs text-slate-500">Indian format: +91 98765 43210</p>
                {formErrors.phone ? <p className="text-sm text-red-600">{formErrors.phone}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="jobId" className="text-sm font-medium text-slate-700">Select Job</label>
                <select
                  id="jobId"
                  name="jobId"
                  value={formValues.jobId}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  aria-invalid={Boolean(formErrors.jobId)}
                >
                  <option value="">Select a role</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.department ? `${job.title} — ${job.department}` : job.title}
                    </option>
                  ))}
                </select>
                {loadingJobs ? <p className="text-sm text-slate-500">Loading available jobs…</p> : null}
                {formErrors.jobId ? <p className="text-sm text-red-600">{formErrors.jobId}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="preferredCallDate" className="text-sm font-medium text-slate-700">Preferred Call Date</label>
                <input
                  id="preferredCallDate"
                  name="preferredCallDate"
                  type="date"
                  value={formValues.preferredCallDate}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  aria-invalid={Boolean(formErrors.preferredCallDate)}
                  required
                />
                {formErrors.preferredCallDate ? <p className="text-sm text-red-600">{formErrors.preferredCallDate}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Preferred Call Time</label>
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
                        setFormErrors((prev) => ({ ...prev, preferredCallTime: validateField('preferredCallTime', slot.value) }));
                      }}
                      className={`rounded-2xl border p-3 text-center transition-colors ${
                        formValues.preferredCallTime === slot.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-white text-slate-600 hover:border-primary/60 hover:bg-primary/5'
                      }`}
                    >
                      <div className="font-medium">{slot.label}</div>
                      <div className="mt-1 text-xs">{slot.sub}</div>
                    </button>
                  ))}
                </div>
                {formErrors.preferredCallTime ? <p className="text-sm text-red-600">{formErrors.preferredCallTime}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Resume Upload</label>
                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-8 text-center transition ${dragActive ? 'border-primary bg-primary/5' : 'border-border bg-white hover:border-primary/60 hover:bg-primary/5'}`}
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(event) => handleFile(event.target.files?.[0])}
                  />
                  <UploadCloud className="h-8 w-8 text-primary" />
                  <p className="mt-3 text-sm font-semibold text-slate-900">Drag and drop your PDF or click to browse</p>
                  <p className="mt-1 text-xs text-slate-500">PDF files only</p>
                </label>
                {resumeFile ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <FileText className="h-4 w-4" />
                    {resumeFile.name}
                  </div>
                ) : null}
                {formErrors.resume ? <p className="text-sm text-red-600">{formErrors.resume}</p> : null}
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-muted/60 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Applying for:</p>
              <p>{selectedJobLabel}</p>
            </div>

            <Button
              type="submit"
              className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90"
              disabled={submitting}
            >
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </span>
              ) : (
                'Submit Application'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
