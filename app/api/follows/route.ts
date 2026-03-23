import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ follows: [] });

  const { data } = await supabase
    .from('topic_follows')
    .select('follow_type, follow_value')
    .eq('user_id', user.id);

  return NextResponse.json({ follows: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, value } = await req.json();
  if (!type || !value) return NextResponse.json({ error: 'Missing type or value' }, { status: 400 });

  const { error } = await supabase
    .from('topic_follows')
    .upsert(
      { user_id: user.id, follow_type: type, follow_value: value },
      { onConflict: 'user_id,follow_type,follow_value' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, value } = await req.json();
  if (!type || !value) return NextResponse.json({ error: 'Missing type or value' }, { status: 400 });

  await supabase
    .from('topic_follows')
    .delete()
    .eq('user_id', user.id)
    .eq('follow_type', type)
    .eq('follow_value', value);

  return NextResponse.json({ success: true });
}
