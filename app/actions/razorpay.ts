"use server";
import 'server-only';

import Razorpay from "razorpay";
import { createClient } from "@/lib/supabase/server";

// Using dummy keys if not set in environment yet so it doesn't crash
const instance = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_dummy_key",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret",
});

export async function createRazorpayOrder(plan: "starter" | "pro", isAnnual: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to create an order");
  }

  // Calculate amount (in paise)
  let amount = 0;
  if (plan === "starter") {
    amount = isAnnual ? 79 * 12 : 99;
  } else if (plan === "pro") {
    amount = isAnnual ? 239 * 12 : 299;
  }

  amount = Math.round(amount * 100); // Convert to paise and ensure it's an integer

  const options = {
    amount,
    currency: "INR",
    receipt: `rcpt_${user.id.substring(0, 8)}_${Date.now()}`,
    notes: {
      userId: user.id,
      plan,
      isAnnual: isAnnual ? "true" : "false",
    },
  };

  try {
    const order = await instance.orders.create(options);
    return JSON.parse(JSON.stringify(order));
  } catch (error) {
    console.error("Razorpay error:", error);
    throw new Error("Could not create Razorpay order");
  }
}
