# Implementation Plan: Razorpay Subscription Model

## Overview
Moving from a one-time "Order" model to a recurring "Subscription" model using Razorpay.

## 1. Database Schema Updates (`lib/schema.sql`)
The `profiles` table needs to track subscription details to handle lifecycle events (renewals, cancellations).
- Add `razorpay_subscription_id` (TEXT)
- Add `razorpay_plan_id` (TEXT)
- Add `subscription_status` (TEXT)
- Add `next_billing_date` (TIMESTAMPTZ)
- Add `cancel_at_period_end` (BOOLEAN)

## 2. Environment Variables
Plan IDs created in Razorpay Dashboard:
- `RAZORPAY_PLAN_STARTER_MONTHLY`
- `RAZORPAY_PLAN_STARTER_YEARLY`
- `RAZORPAY_PLAN_PRO_MONTHLY`
- `RAZORPAY_PLAN_PRO_YEARLY`

## 3. Server Actions (`app/actions/razorpay.ts`)
Refactor `createRazorpayOrder` to `createRazorpaySubscription`:
- Calculate which Plan ID to use based on the selection.
- Call `instance.subscriptions.create({ plan_id, total_count: 120, ... })`.

## 4. Frontend Subscription Page (`app/dashboard/subscriptions/page.tsx`)
- Update `handleCheckout` to use the `subscription_id` returned from the server action.
- Razorpay Checkout options use `subscription_id` instead of `order_id`.
- Add a "Cancel Subscription" button that calls a new server action.

## 5. Billing Verification (`app/api/billing/verify/route.ts`)
- Verify the signature of the subscription.
- Update the profile with the subscription ID and initial status.

## 6. Webhooks (`app/api/webhooks/razorpay/route.ts`)
Crucial for recurring payments:
- `subscription.charged`: Extend the user's access and update `next_billing_date`.
- `subscription.cancelled`: Update status, but allow access until `next_billing_date`.
- `subscription.expired`: Revoke access (set plan back to 'free').
