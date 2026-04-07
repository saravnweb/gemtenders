import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenderId } = await request.json();
    if (!tenderId) {
      return NextResponse.json({ error: "Missing tenderId" }, { status: 400 });
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check user's membership plan
    const { data: profile } = await admin
      .from("profiles")
      .select("membership_plan")
      .eq("id", user.id)
      .single();

    if (profile?.membership_plan === "free") {
      // Count bid reveals this month (calendar month)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartISO = monthStart.toISOString();

      const { data: reveals, error: countError } = await admin
        .from("bid_reveals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("revealed_at", monthStartISO);

      const revealCount = reveals?.length || 0;
      if (revealCount >= 5) {
        return NextResponse.json(
          { error: "Monthly bid reveal limit (5/month) reached. Upgrade to Starter for unlimited reveals." },
          { status: 429 }
        );
      }
    }

    // Track the bid reveal
    await admin.from("bid_reveals").insert({
      user_id: user.id,
      tender_id: tenderId,
    }).catch(() => {}); // Ignore errors (e.g., duplicate key)

    return NextResponse.json({ success: true, allowed: true });

  } catch (error: any) {
    console.error("Bid reveal error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
