'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight, Plus, Sparkles, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const defaultQuestions = [ 'Why did you leave your last company?',
  'What is your notice period?',
  'Are you currently interviewing elsewhere?',
  'Where do you see yourself in 5 years?',
  'Can you walk us through a challenging project you worked on recently?',];

export default function PostJobPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    positions: 1,
    keywords: [] as string[],
    keywordInput: '',
    salaryBudget: '',
    experience: '',
    questions: defaultQuestions,
    startTime: '10:00',
    endTime: '18:00',
    callDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const progressLabel = useMemo(() => ['Job Details', 'Requirements', 'Interview Setup'][step - 1], [step]);

  const validateStep = () => {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.title.trim()) nextErrors.title = 'Job title is required.';
      if (formData.description.trim().length < 100) nextErrors.description = 'Description must be at least 100 characters.';
      if (!formData.positions || Number(formData.positions) < 1) nextErrors.positions = 'Open positions must be at least 1.';
    }

    if (step === 2) {
      if (!formData.salaryBudget || Number(formData.salaryBudget) <= 0) nextErrors.salaryBudget = 'Salary budget is required.';
      if (formData.experience && Number(formData.experience) < 0) nextErrors.experience = 'Experience cannot be negative.';
    }

    if (step === 3) {
      if (!formData.startTime) nextErrors.startTime = 'Select a start time.';
      if (!formData.endTime) nextErrors.endTime = 'Select an end time.';
      if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
        nextErrors.endTime = 'End time must be after the start time.';
      }
      if (formData.callDays.length === 0) nextErrors.callDays = 'Select at least one call day.';
      formData.questions.forEach((question, index) => {
        if (!question.trim()) nextErrors[`question-${index}`] = 'Question cannot be empty.';
      });
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    setError('');
    if (validateStep()) setStep((prev) => Math.min(prev + 1, 3));
  };

  const goBack = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const addKeyword = () => {
    const keyword = formData.keywordInput.trim().toLowerCase();
    if (!keyword || formData.keywords.includes(keyword)) {
      setFormData((prev) => ({ ...prev, keywordInput: '' }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      keywords: [...prev.keywords, keyword],
      keywordInput: '',
    }));
  };

  const handleKeywordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addKeyword();
    }
  };

  const removeKeyword = (word: string) => {
    setFormData((prev) => ({ ...prev, keywords: prev.keywords.filter((item) => item !== word) }));
  };

  const updateQuestion = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? value : q)),
    }));
    setErrors((prev) => ({ ...prev, [`question-${index}`]: '' }));
  };

  const addQuestion = () => {
    if (formData.questions.length >= 6) return;
    setFormData((prev) => ({ ...prev, questions: [...prev.questions, ''] }));
  };

  const removeQuestion = (index: number) => {
    if (formData.questions.length === 1) return;
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => {
      const exists = prev.callDays.includes(day);
      return {
        ...prev,
        callDays: exists ? prev.callDays.filter((item) => item !== day) : [...prev.callDays, day],
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!validateStep()) return;

    setLoading(true);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          positions: Number(formData.positions),
          keywords: formData.keywords,
          salaryBudget: Number(formData.salaryBudget),
          minimumExperience: formData.experience ? Number(formData.experience) : 0,
          questions: formData.questions.filter((question) => question.trim().length > 0),
          callWindow: { startTime: formData.startTime, endTime: formData.endTime },
          callDays: formData.callDays,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to post the job right now.');

      router.push('/hr/dashboard?posted=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post the job right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <Card className="w-full border border-border/80 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]">
        <CardHeader className="border-b border-border/80 p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">HR workspace</p>
              <CardTitle className="text-2xl font-semibold text-slate-900 sm:text-3xl">Post a New Job</CardTitle>
              <CardDescription className="max-w-2xl text-slate-600">Create a polished hiring brief with requirements, salary guidance, and interview details in three easy steps.</CardDescription>
            </div>

            <div className="rounded-3xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Current step</p>
              <p>{step} / 3 — {progressLabel}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {['Job Details', 'Requirements', 'Interview Setup'].map((label, index) => {
              const active = index + 1 === step;
              const done = index + 1 < step;
              return (
                <div
                  key={label}
                  className={`rounded-2xl border p-4 text-sm transition ${active ? 'border-primary bg-primary/10' : done ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-muted/60'}`}
                >
                  <p className="font-semibold text-slate-900">Step {index + 1}</p>
                  <p className="text-slate-600">{label}</p>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}

            {step === 1 && (
              <section className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Job Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(event) => { setFormData((prev) => ({ ...prev, title: event.target.value })); setErrors((prev) => ({ ...prev, title: '' })); }}
                    placeholder="Senior Front-End Engineer"
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.title ? <p className="text-sm text-red-600">{errors.title}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Job Description</label>
                  <textarea
                    rows={6}
                    value={formData.description}
                    onChange={(event) => { setFormData((prev) => ({ ...prev, description: event.target.value })); setErrors((prev) => ({ ...prev, description: '' })); }}
                    placeholder="Describe responsibilities, team fit, and what makes this role exciting. Provide at least 100 characters."
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="text-xs text-slate-500">Minimum 100 characters required.</p>
                  {errors.description ? <p className="text-sm text-red-600">{errors.description}</p> : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Number of Open Positions</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.positions}
                    onChange={(event) => { setFormData((prev) => ({ ...prev, positions: Number(event.target.value) || 1 })); setErrors((prev) => ({ ...prev, positions: '' })); }}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.positions ? <p className="text-sm text-red-600">{errors.positions}</p> : null}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Required Keywords</label>
                  <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
                    <input
                      type="text"
                      value={formData.keywordInput}
                      onChange={(event) => setFormData((prev) => ({ ...prev, keywordInput: event.target.value }))}
                      onKeyDown={handleKeywordKeyDown}
                      onBlur={addKeyword}
                      placeholder="Type a keyword and press Enter or comma"
                      className="w-full rounded-xl border border-transparent bg-transparent px-2 py-2 text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {formData.keywords.map((keyword) => (
                        <button
                          key={keyword}
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-slate-800 transition hover:bg-primary/20"
                        >
                          {keyword}
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Add skills, tools, or domain terms relevant to the opening.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Salary Budget (Monthly CTC in INR)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={formData.salaryBudget}
                      onChange={(event) => { setFormData((prev) => ({ ...prev, salaryBudget: event.target.value })); setErrors((prev) => ({ ...prev, salaryBudget: '' })); }}
                      placeholder="1200000"
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <span title="This is kept confidential from candidates" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-slate-500">
                      <Info className="h-4 w-4" />
                    </span>
                  </div>
                  {errors.salaryBudget ? <p className="text-sm text-red-600">{errors.salaryBudget}</p> : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Minimum Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.experience}
                    onChange={(event) => { setFormData((prev) => ({ ...prev, experience: event.target.value })); setErrors((prev) => ({ ...prev, experience: '' })); }}
                    placeholder="3"
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {errors.experience ? <p className="text-sm text-red-600">{errors.experience}</p> : null}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-6">
                <div className="space-y-4 rounded-3xl border border-border/80 bg-muted/60 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Custom Interview Questions</h3>
                      <p className="text-sm text-slate-600">Add up to 6 tailored questions for your screening call.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addQuestion}
                      disabled={formData.questions.length >= 6}
                      className="rounded-full border-primary/40 bg-white text-slate-800 hover:bg-primary/10"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Question
                    </Button>
                  </div>

                  {formData.questions.map((question, index) => (
                    <div key={`q-${index}`} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-slate-700">Question {index + 1}</label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuestion(index)}
                          disabled={formData.questions.length === 1}
                          className="h-8 rounded-full text-slate-600 hover:bg-muted"
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Remove
                        </Button>
                      </div>
                      <input
                        type="text"
                        value={question}
                        onChange={(event) => updateQuestion(index, event.target.value)}
                        placeholder="What would make this candidate a strong fit?"
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      {errors[`question-${index}`] ? <p className="mt-2 text-sm text-red-600">{errors[`question-${index}`]}</p> : null}
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Preferred Call Window Start Time</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(event) => { setFormData((prev) => ({ ...prev, startTime: event.target.value })); setErrors((prev) => ({ ...prev, startTime: '' })); }}
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.startTime ? <p className="text-sm text-red-600">{errors.startTime}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Preferred Call Window End Time</label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(event) => { setFormData((prev) => ({ ...prev, endTime: event.target.value })); setErrors((prev) => ({ ...prev, endTime: '' })); }}
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.endTime ? <p className="text-sm text-red-600">{errors.endTime}</p> : null}
                  </div>
                </div>

                <div className="space-y-3 rounded-3xl border border-border/80 bg-white p-5 shadow-sm">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Call Days</h3>
                    <p className="text-sm text-slate-600">Choose the days you prefer for screening calls.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => {
                      const isChecked = formData.callDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`rounded-full border px-3 py-2 text-sm transition ${isChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted text-slate-700 hover:bg-primary/10'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  {errors.callDays ? <p className="text-sm text-red-600">{errors.callDays}</p> : null}
                </div>
              </section>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-border/80 pt-6 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={step === 1}
                className="rounded-full border-border bg-white text-slate-800 hover:bg-muted"
              >
                Back
              </Button>

              {step < 3 ? (
                <Button
                  type="button"
                  onClick={goNext}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {loading ? 'Posting job…' : 'Submit Job Posting'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
