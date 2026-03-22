import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple in-memory rate limiting counter
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  
  const limitInfo = rateLimitMap.get(ip);
  if (limitInfo) {
    if (now - limitInfo.timestamp < 60000) {
      if (limitInfo.count >= 10) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute.' }, { status: 429 });
      }
      limitInfo.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, timestamp: now });
    }
  } else {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
  }

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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `Please provide a simple, bulleted summary (3-5 points) of the following government tender details:\n\n${text.substring(0, 3000)}`;
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ summary: result.response.text() });
  } catch (e: any) {
    console.error('Summarize API Error:', e.message);
    const msg = e.message || '';
    if (msg.includes('429') || msg.includes('quota')) {
      return NextResponse.json({ error: 'The AI summarization service has temporarily exceeded its daily capacity limits. Please try again tomorrow.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Failed to generate AI summary safely.' }, { status: 500 });
  }
}
