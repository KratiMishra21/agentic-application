import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  return createClient(supabaseUrl, supabaseKey);
}

function sanitizeName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gi, '')
    .slice(0, 40);
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('candidates')
      .select('id, name, email, phone, status, match_score, created_at, resume_path, job_id, call_summary, jobs(title)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const candidates = (data ?? []).map((candidate: {
      id: string;
      name: string;
      email: string;
      phone: string;
      status: string;
      created_at: string;
      resume_path: string | null;
      job_id: string;
      match_score: number | null;
      jobs?: { title?: string | null } | null;
    }) => ({
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      status: candidate.status,
      created_at: candidate.created_at,
      resume_path: candidate.resume_path,
      job_id: candidate.job_id,
      match_score: candidate.match_score ?? null,
      call_summary: candidate.call_summary ?? null,
      job_title: candidate.jobs?.title ?? null,
    }));

    return NextResponse.json(candidates);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch candidates.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const uploadsDir = join(process.cwd(), 'public/uploads/resumes');
    mkdirSync(uploadsDir, { recursive: true });

    const formData = await request.formData();

    const name = String(formData.get('name') ?? formData.get('fullName') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const jobId = String(formData.get('job_id') ?? formData.get('jobId') ?? '').trim();
    const preferredCallDate = String(formData.get('preferred_call_date') ?? '').trim();
    const preferredCallTime = String(formData.get('preferred_call_time') ?? '').trim();
    const resumeFile = formData.get('resume');

    if (!name || !email || !phone || !jobId) {
      return NextResponse.json({ error: 'name, email, phone, and job_id are required.' }, { status: 400 });
    }

    if (!(resumeFile instanceof File)) {
      return NextResponse.json({ error: 'A PDF resume file is required.' }, { status: 400 });
    }

    if (resumeFile.type !== 'application/pdf' && !resumeFile.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Resume file must be a PDF.' }, { status: 400 });
    }

    if (resumeFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Resume file must be under 5MB.' }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = sanitizeName(name);
    const fileName = `${timestamp}_${safeName || 'candidate'}.pdf`;
    const destinationPath = join(uploadsDir, fileName);
    const publicPath = `/uploads/resumes/${fileName}`;

    const bytes = Buffer.from(await resumeFile.arrayBuffer());
    writeFileSync(destinationPath, bytes);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('candidates')
      .insert([
        {
          name,
          email,
          phone,
          job_id: jobId,
          resume_path: publicPath,
          status: 'pending',
          preferred_call_date: preferredCallDate || null,
          preferred_call_time: preferredCallTime || null,
        },
      ])
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, candidate_id: data?.id ?? null }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit candidate.' },
      { status: 500 }
    );
  }
}
