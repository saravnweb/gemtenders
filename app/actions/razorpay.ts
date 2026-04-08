"use server";
import 'server-only';

import Razorpay from "razorpay";
import { createClient } from "@/lib/supabase/server";

// Using dummy keys if not set in environment yet so it doesn't crash
const instance = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_dummy_key",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret",
});

// Prices: Starter = ₹99/mo, Pro = ₹299/mo (monthly recurring only)
// Create these plans in Razorpay Dashboard → Subscriptions → Plans
const PLAN_IDS = {
  starter: process.env.RAZORPAY_PLAN_STARTER_MONTHLY || "plan_dummy_starter_m",
  pro: process.env.RAZORPAY_PLAN_PRO_MONTHLY || "plan_dummy_pro_m",
};

export async function createRazorpaySubscription(plan: "starter" | "pro") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to subscribe");
  }

  try {
    const subscription = await instance.subscriptions.create({
      plan_id: PLAN_IDS[plan],
      total_count: 120, // Up to 120 months (10 years)
      customer_notify: 1,
      quantity: 1,
      addons: [],
      offer_id: process.env[`RAZORPAY_TRIAL_OFFER_${plan.toUpperCase()}`] || undefined,
      notes: {
        userId: user.id,
        plan,
      },
    } as any);

    return JSON.parse(JSON.stringify(subscription));
  } catch (error) {
    console.error("Razorpay Sub error:", error);
    throw new Error("Could not create Razorpay subscription");
  }
}
export async function cancelRazorpaySubscription() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Get user's subscription ID from DB
  const { data: profile } = await supabase.from("profiles").select("subscription_id").eq("id", user.id).single();

  if (!profile?.subscription_id) {
    throw new Error("No active subscription found to cancel");
  }

  try {
    // Cancel at end of cycle: true (don't refund/stop immediately)
    const cancelled = await instance.subscriptions.cancel(profile.subscription_id, false);
    return JSON.parse(JSON.stringify(cancelled));
  } catch (error) {
    console.error("Cancelation Error:", error);
    throw new Error("Could not cancel subscription");
  }
}
