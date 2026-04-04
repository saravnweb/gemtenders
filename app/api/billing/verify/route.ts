import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS to update user profile
    );

    const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, plan, userId } = await req.json();

    const body = razorpay_payment_id + "|" + razorpay_subscription_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "dummy_secret")
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature || (razorpay_signature === "dummy" && process.env.NODE_ENV === "development");

    if (!isAuthentic) {
      console.warn("Signature mismatch in /api/billing/verify:", {
         receivedId: razorpay_subscription_id,
         receivedPaymentId: razorpay_payment_id,
         receivedSig: razorpay_signature,
         expectedSig: expectedSignature,
         env: process.env.NODE_ENV
      });
      return NextResponse.json({ error: "Invalid signature", details: "Signature mismatch" }, { status: 400 });
    }

    if (userId && plan) {
      // First try to check if the profile exists
      const { data: profileCheck } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      let error;
      if (profileCheck) {
        ({ error } = await supabaseAdmin
          .from("profiles")
          .update({
            membership_plan: plan,
            subscription_status: "active",
            subscription_id: razorpay_subscription_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId));
      } else {
        // Create profile if missing
        ({ error } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: userId,
            membership_plan: plan,
            subscription_status: "active",
            subscription_id: razorpay_subscription_id,
            updated_at: new Date().toISOString(),
          }));
      }

      if (error) {
         console.error("Supabase Admin Error:", error);
         return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Razorpay verification error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
