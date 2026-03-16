import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS to update user profile
);

export async function POST(req: Request) {
  try {
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
      // Get the metadata we sent carefully from Notes
      const plan = order.notes?.plan || "free";
      const userId = order.notes?.userId;

      if (userId) {
        // Update profile using Admin role
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            membership_plan: plan,
            subscription_status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (error) {
           console.error("Supabase Admin Error:", error);
           return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Razorpay webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
