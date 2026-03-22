import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { supabase } from '@/lib/supabase';

// Initialize Razorpay
// Note: We use dummy default values for build process if env vars are missing
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret',
});

export async function POST(req: Request) {
  try {
    const { planId, isAnnual } = await req.json();

    // In a real application, you would:
    // 1. Verify the user is authenticated
    // 2. Fetch the actual price from a database or secure config based on planId and isAnnual
    // 3. Create a Razorpay order

    let amount = 0;
    let currency = 'INR';

    // Mock pricing logic
    if (planId === 'pro') {
      amount = isAnnual ? 599 * 12 * 0.8 : 599; // 20% discount for annual
    } else {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Razorpay requires amount in paise (smallest currency unit)
    const options = {
      amount: amount * 100, 
      currency,
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1, // Auto capture
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      id: order.id,
      currency: order.currency,
      amount: order.amount,
    });
  } catch (e: any) {
    console.error('Error creating Razorpay order:', e);
    return NextResponse.json(
      { error: 'Could not initialize payment' },
      { status: 500 }
    );
  }
}
