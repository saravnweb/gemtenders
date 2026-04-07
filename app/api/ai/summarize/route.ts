import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const FREE_DAILY_LIMIT = 20;

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Rate limit (free plan only) ───────────────────────────────────────────
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('membership_plan, ai_summary_calls, ai_summary_date')
    .eq('id', user.id)
    .single();

  const plan: string = profile?.membership_plan ?? 'free';

  if (plan === 'free') {
    return NextResponse.json(
      { error: 'AI summaries require a Starter or Pro plan.', requiresUpgrade: true },
      { status: 402 }
    );
  }

  // ── Summarize ─────────────────────────────────────────────────────────────
  try {
    const body = await req.json();
    const text = body.text || '';

    if (!text || text.length < 50) {
      return NextResponse.json({ error: 'Text too short to summarize' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('Server missing expected GEMINI_API_KEY environment variable.');
      return NextResponse.json({ error: 'AI processing is temporarily unconfigured' }, { status: 503 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Please provide a simple, bulleted summary (3-5 points) of the following government tender details:\n\n${text.substring(0, 3000)}`;
    const result = await model.generateContent(prompt);

    return NextResponse.json({ summary: result.response.text() });
  } catch (e: any) {
    console.error('Summarize API Error:', e.message);
    const msg = e.message || '';
    if (msg.includes('429') || msg.includes('quota')) {
      return NextResponse.json(
        { error: 'The AI summarization service has temporarily exceeded its daily capacity limits. Please try again tomorrow.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: 'Failed to generate AI summary safely.' }, { status: 500 });
  }
}
