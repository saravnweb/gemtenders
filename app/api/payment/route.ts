import 'server-only';
import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'dummy_test',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_test',
    });

    const body = await req.json();
    const { amount, currency = "INR" } = body;

    const order = await razorpay.orders.create({
      amount: amount * 100, // amount in paisa
      currency,
      receipt: 'receipt_' + Math.random().toString(36).substring(7),
    });

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
