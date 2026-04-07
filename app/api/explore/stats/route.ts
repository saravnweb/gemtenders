import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Cache stats for 2 minutes to prevent constant recalculation
export const revalidate = 120;

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    // Get just the count - this is very fast with a simple query
    const { count: totalCount, error } = await supabase
      .from("tenders")
      .select("id", { count: "exact", head: true })
      .gte("end_date", now);

    if (error) {
      console.error('Error fetching count:', error);
      return NextResponse.json({ 
        totalActive: 0,
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      totalActive: totalCount || 0,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
      }
    });
  } catch (err) {
    console.error('Stats API error:', err);
    return NextResponse.json({ 
      error: 'Failed to fetch stats',
      totalActive: 0 
    }, { status: 500 });
  }
}
