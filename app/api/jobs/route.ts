import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title')
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch jobs.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    const keywords = Array.isArray(payload.keywords)
      ? payload.keywords.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];
    const budget = Number(payload.budget ?? payload.salaryBudget ?? 0);
    const positions = Number(payload.positions ?? 1);
    const questions = Array.isArray(payload.questions)
      ? payload.questions.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];
    const callWindowStart = payload.call_window_start ?? payload.callWindow?.startTime ?? '';
    const callWindowEnd = payload.call_window_end ?? payload.callWindow?.endTime ?? '';
    const callDays = Array.isArray(payload.call_days)
      ? payload.call_days.map((item: unknown) => String(item).trim()).filter(Boolean)
      : Array.isArray(payload.callDays)
        ? payload.callDays.map((item: unknown) => String(item).trim()).filter(Boolean)
        : [];

    if (!title || !description || !Number.isFinite(budget) || budget <= 0) {
      return NextResponse.json(
        { error: 'title, description, and budget are required.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(positions) || positions < 1) {
      return NextResponse.json({ error: 'positions must be at least 1.' }, { status: 400 });
    }

    if (!Array.isArray(payload.keywords) && !Array.isArray(payload.salaryBudget)) {
      // allow legacy payloads while keeping validation strict for real job submissions
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('jobs')
      .insert([
        {
          title,
          description,
          keywords: keywords.join(', '),
          budget,
          positions,
          questions: JSON.stringify(questions),
          call_window_start: callWindowStart,
          call_window_end: callWindowEnd,
          call_days: callDays.join(', '),
        },
      ])
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (questions.length > 0 && data?.id) {
  try {
    await fetch(`http://localhost:8000/pregenerate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: data.id, questions }),
    });
  } catch (e) {
    // Non-blocking — if this fails, questions will generate during the call instead
    console.warn('Could not pre-generate question audio:', e);
  }
}

  return NextResponse.json({ id: data?.id ?? null }, { status: 201 });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create job.' },
      { status: error instanceof Error && error.message.includes('Missing Supabase') ? 500 : 400 }
    );
  }
}
