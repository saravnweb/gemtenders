import 'server-only';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';

// Simple in-memory rate limiting counter
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  
  const limitInfo = rateLimitMap.get(ip);
  if (limitInfo) {
    if (now - limitInfo.timestamp < 60000) {
      if (limitInfo.count >= 10) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }
      limitInfo.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, timestamp: now });
    }
  } else {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
  }

  try {
    const { text } = await req.json();
    
    // Example GenAI Usage
    // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    // const result = await model.generateContent(`Summarize this tender: ${text}`);

    return NextResponse.json({ summary: "AI summary placeholder" });
  } catch (err) {
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
