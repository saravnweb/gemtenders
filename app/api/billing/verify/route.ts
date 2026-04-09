import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Razorpay from "razorpay";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Bypass RLS to update user profile
    );

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("RAZORPAY_KEY_SECRET is not configured");
      return NextResponse.json({ error: "Payment configuration error" }, { status: 500 });
    }

    const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, plan } = await req.json();
    const userId = user.id;

    let verified = false;

    // Case 1: Payment made (charged) — verify HMAC signature
    if (razorpay_payment_id && razorpay_signature) {
      const body = razorpay_payment_id + "|" + razorpay_subscription_id;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body.toString())
        .digest("hex");

      verified = expectedSignature === razorpay_signature;

      if (!verified) {
        console.warn("[billing/verify] Signature mismatch:", {
          subscriptionId: razorpay_subscription_id,
          paymentId: razorpay_payment_id,
        });
        return NextResponse.json({ error: "Invalid signature", details: "Signature mismatch" }, { status: 400 });
      }
    } else {
      // Case 2: Trial/mandate authorization — no payment yet, verify subscription via Razorpay API
      if (!razorpay_subscription_id) {
        return NextResponse.json({ error: "Missing subscription ID" }, { status: 400 });
      }

      try {
        const rzp = new Razorpay({
          key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
          key_secret: secret,
        });
        const sub = await (rzp.subscriptions as any).fetch(razorpay_subscription_id);
        const validStatuses = ["created", "authenticated", "active", "pending"];
        if (!validStatuses.includes(sub.status)) {
          console.warn("[billing/verify] Subscription in unexpected status:", sub.status);
          return NextResponse.json({ error: "Subscription not in a valid state", status: sub.status }, { status: 400 });
        }
        verified = true;
      } catch (err: any) {
        console.error("[billing/verify] Could not fetch subscription from Razorpay:", err.message);
        return NextResponse.json({ error: "Could not verify subscription with Razorpay" }, { status: 400 });
      }
    }

    if (verified && userId && plan) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          membership_plan: plan,
          subscription_status: "active",
          subscription_id: razorpay_subscription_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

      if (error) {
        console.error("[billing/verify] Supabase upsert error:", error);
        return NextResponse.json(
          { error: "Database update failed", details: error.message, code: error.code },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[billing/verify] Unexpected error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
