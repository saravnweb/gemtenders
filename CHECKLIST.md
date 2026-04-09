# Tenders App - Implementation Checklist

## WhatsApp Notifications (Meta WhatsApp Cloud API)

### Setup (One-time)
- [ ] Create Meta Business account at business.facebook.com
- [ ] Create a Meta Developer app at developers.facebook.com
- [ ] Add WhatsApp product to the app
- [ ] Get a test phone number + temporary access token
- [ ] Verify a real phone number for production
- [ ] Apply for permanent System User access token (doesn't expire)

### Backend Integration
- [ ] Add env vars: `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`
- [ ] Create `/lib/whatsapp.ts` — helper to send messages via Graph API
- [ ] Create message templates (must be pre-approved by Meta)
  - [ ] "New tender matched your keywords" template
  - [ ] "Daily digest" template
- [ ] Add `whatsapp_number` field to user profile in Supabase
- [ ] Create API route `/api/whatsapp/subscribe` — save user's WhatsApp number

### Frontend
- [ ] Add WhatsApp number input in user settings/onboarding
- [ ] Opt-in checkbox with consent text (required by Meta)
- [ ] Show subscription status

### Notification Triggers
- [ ] Trigger WhatsApp on new tender match (keyword-based)
- [ ] Add WhatsApp send to existing email digest cron job
- [ ] Handle delivery failures gracefully (log, don't crash)

### Testing
- [ ] Test with Sandbox number (opt-in via WhatsApp first)
- [ ] Test template message delivery
- [ ] Test opt-out handling

---

## Other Pending Features

- [ ] Browser Push Notifications (Service Worker)
- [ ] In-app notification bell (Supabase Realtime)
