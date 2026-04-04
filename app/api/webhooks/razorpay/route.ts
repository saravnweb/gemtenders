import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS to update user profile
    );

    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify razorpay signature using secret
    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "dummy_secret");
    shasum.update(rawBody);
    const digest = shasum.digest("hex");

    if (digest !== signature) {
      // In local testing without proper secret this might fail, maybe log it
      console.error("Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const { event, payload } = JSON.parse(rawBody);

    if (event === "order.paid") {
      const order = payload.order.entity;
      const plan = order.notes?.plan;
      const userId = order.notes?.userId;
      if (userId && plan) {
        const { data: profileCheck } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).single();
        if (profileCheck) {
          await supabaseAdmin.from("profiles").update({
            membership_plan: plan,
            subscription_status: "active",
            updated_at: new Date().toISOString(),
          }).eq("id", userId);
        } else {
          await supabaseAdmin.from("profiles").insert({
            id: userId,
            membership_plan: plan,
            subscription_status: "active",
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (event === "subscription.charged") {
      const subscription = payload.subscription.entity;
      const plan = subscription.notes?.plan || "starter";
      const userId = subscription.notes?.userId;
      const nextCharge = subscription.charge_at || subscription.current_end;

      if (userId) {
        const { data: profileCheck } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).single();
        if (profileCheck) {
          await supabaseAdmin.from("profiles").update({
            membership_plan: plan,
            subscription_status: "active",
            next_billing_date: nextCharge ? new Date(nextCharge * 1000).toISOString() : null,
            subscription_id: subscription.id,
            updated_at: new Date().toISOString(),
          }).eq("id", userId);
        } else {
          await supabaseAdmin.from("profiles").insert({
            id: userId,
            membership_plan: plan,
            subscription_status: "active",
            next_billing_date: nextCharge ? new Date(nextCharge * 1000).toISOString() : null,
            subscription_id: subscription.id,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (event === "subscription.cancelled" || event === "subscription.expired") {
      const subscription = payload.subscription.entity;
      const userId = subscription.notes?.userId;

      if (userId) {
        await supabaseAdmin.from("profiles").update({
          subscription_status: event === "subscription.cancelled" ? "cancelled" : "expired",
          // If cancelled, we don't immediately set plan to free, 
          // because they paid for the current month.
          // The middleware/frontend should check next_billing_date.
          membership_plan: event === "subscription.expired" ? "free" : undefined, 
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Razorpay webhook error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
