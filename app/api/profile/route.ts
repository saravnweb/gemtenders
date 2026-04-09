import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Try cookie-based auth first (server-side session)
  let user: any = null;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {}

  // Fallback: accept Bearer token from Authorization header (client-side session)
  if (!user) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data } = await supabaseAdmin.auth.getUser(token);
      user = data.user;
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[/api/profile] DB error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data) {
    return NextResponse.json({ ...data, email: user.email });
  }

  // No profile row yet — return safe default
  return NextResponse.json({
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name ?? null,
    membership_plan: 'free',
    subscription_status: null,
    subscription_id: null,
  });
}
