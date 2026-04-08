import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('membership_plan')
    .eq('id', user.id)
    .single();

  if (profile?.membership_plan !== 'pro') {
    return NextResponse.json({ error: 'Deep AI analysis requires a Pro plan.', requiresUpgrade: true }, { status: 402 });
  }

  const body = await req.json();
  const { title, ai_summary, emd_amount, end_date, eligibility_msme, eligibility_mii, ministry_name, organisation_name, state } = body;

  if (!title) return NextResponse.json({ error: 'Missing tender data' }, { status: 400 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  const closingDate = end_date ? new Date(end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown';
  const emdDisplay = emd_amount === 0 ? 'No EMD required' : emd_amount ? `₹${emd_amount.toLocaleString('en-IN')}` : 'Not specified';

  const prompt = `You are an expert GeM portal tender consultant helping an Indian SMB decide whether to bid on a government tender. Analyze the following tender and provide a structured, practical breakdown.

TENDER DETAILS:
Title: ${title}
Ministry/Org: ${[ministry_name, organisation_name].filter(Boolean).join(' — ')}
State: ${state || 'Pan India'}
EMD: ${emdDisplay}
Closing Date: ${closingDate}
MSE Eligible: ${eligibility_msme ? 'Yes' : 'No'}
MII Preference: ${eligibility_mii ? 'Yes' : 'No'}
AI Summary: ${ai_summary || 'Not available'}

Provide your analysis in this exact JSON format (no markdown, pure JSON):
{
  "bid_worthiness": "High / Medium / Low",
  "bid_worthiness_reason": "1-2 sentence explanation",
  "key_requirements": ["requirement 1", "requirement 2", "requirement 3"],
  "eligibility_checklist": [
    { "item": "MSE registration", "required": true/false },
    { "item": "EMD deposit of ${emdDisplay}", "required": true/false },
    { "item": "MII compliance", "required": true/false }
  ],
  "winning_tips": ["tip 1", "tip 2", "tip 3"],
  "watch_out": "One key risk or gotcha to be aware of",
  "time_to_prepare": "Estimated days needed to prepare a competitive bid"
}`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const json = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(json);
    return NextResponse.json({ analysis: parsed });
  } catch (e: any) {
    console.error('AI Analyze error:', e.message);
    return NextResponse.json({ error: 'Failed to generate analysis. Please try again.' }, { status: 500 });
  }
}
