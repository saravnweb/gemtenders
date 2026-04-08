import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in environment.');
  }
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

function formatINR(amount: number | null) {
  if (!amount) return '—';
  if (amount >= 10_00_000) return `₹${(amount / 10_00_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(0)}K`;
  return `₹${amount}`;
}

function buildEmailHtml(userName: string, tenders: any[], siteUrl: string) {
  const count = tenders.length;
  const tenderRows = tenders.slice(0, 10).map(t => {
    const closeDate = t.end_date ? new Date(t.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
    const location = [t.city, t.state].filter(Boolean).join(', ') || '—';
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <a href="${siteUrl}/bids/${t.slug}" style="font-size:14px;font-weight:600;color:#0f172a;text-decoration:none;line-height:1.4;">${t.title}</a>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">
            ${t.organisation_name || t.department || ''}
            ${location !== '—' ? ` &bull; ${location}` : ''}
            &bull; Closes ${closeDate}
            ${t.emd_amount ? ` &bull; EMD: ${formatINR(t.emd_amount)}` : ''}
          </div>
          ${t.ai_summary ? `<div style="font-size:12px;color:#475569;margin-top:4px;font-style:italic;">"${String(t.ai_summary).replace(/<[^>]*>/g, '').slice(0, 120)}…"</div>` : ''}
        </td>
        <td style="padding:12px 0 12px 16px;border-bottom:1px solid #f1f5f9;vertical-align:top;white-space:nowrap;">
          <a href="${siteUrl}/bids/${t.slug}" style="display:inline-block;padding:6px 12px;background:#f97316;color:#fff;font-size:12px;font-weight:700;border-radius:6px;text-decoration:none;">View</a>
        </td>
      </tr>`;
  }).join('');

  const more = count > 10 ? `<p style="text-align:center;font-size:13px;color:#64748b;">+ ${count - 10} more tenders matching your keywords</p>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <h1 style="margin:0;font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">GeMTenders.org</h1>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Your daily tender digest</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 6px;font-size:15px;color:#0f172a;">Hi ${userName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;">
              <strong>${count} new tender${count !== 1 ? 's' : ''}</strong> matching your saved keywords were added in the last 24 hours.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${tenderRows}
            </table>
            ${more}
            <div style="text-align:center;margin-top:28px;">
              <a href="${siteUrl}/?tab=foryou" style="display:inline-block;padding:12px 28px;background:#0f172a;color:#fff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;">See All Matching Tenders →</a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f1f5f9;background:#f8fafc;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              You're receiving this because you have keyword alerts enabled on GeMTenders.org.<br>
              <a href="${siteUrl}/dashboard/keywords" style="color:#64748b;">Manage alerts</a> &nbsp;&bull;&nbsp;
              <a href="${siteUrl}/dashboard/subscriptions" style="color:#64748b;">Manage subscription</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gemtenders.org';
  const fromAddress = process.env.EMAIL_FROM || `GeMTenders.org <alerts@gemtenders.org>`;

  let transporter: nodemailer.Transporter;
  try {
    transporter = getTransporter();
    await transporter.verify();
  } catch (err: any) {
    return NextResponse.json({ error: `SMTP error: ${err.message}` }, { status: 500 });
  }

  // 1. Fetch paid users with active keyword alerts
  const { data: paidSearches } = await admin
    .from('saved_searches')
    .select(`
      user_id,
      query_params,
      profiles!inner(full_name, email, membership_plan)
    `)
    .eq('is_alert_enabled', true)
    .in('profiles.membership_plan', ['starter', 'pro']);

  if (!paidSearches?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No paid users with active alerts.' });
  }

  // 2. Fetch new tenders from last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: newTenders } = await admin
    .from('tenders')
    .select('id, bid_number, slug, title, department, ministry_name, organisation_name, state, city, ai_summary, emd_amount, end_date, relevant_categories')
    .gte('created_at', since)
    .gte('end_date', new Date().toISOString())
    .not('ai_summary', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (!newTenders?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No new tenders in last 24h.' });
  }

  // 3. Match tenders to each user's keywords
  let sent = 0;
  const errors: string[] = [];

  for (const search of paidSearches) {
    const profile = Array.isArray((search as any).profiles) ? (search as any).profiles[0] : (search as any).profiles;
    if (!profile?.email) continue;

    const params = search.query_params || {};
    const keywords: string[] = params.q
      ? params.q.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
      : [];

    if (keywords.length === 0) continue;

    const matchedTenders = newTenders.filter(tender => {
      const text = [
        tender.title,
        tender.ai_summary,
        tender.relevant_categories,
        tender.department,
        tender.ministry_name,
        tender.organisation_name,
      ].filter(Boolean).join(' ').toLowerCase();

      const keywordMatch = keywords.some(kw => text.includes(kw));
      if (!keywordMatch) return false;

      if (params.states?.length > 0) {
        if (!tender.state || !params.states.some((st: string) => st.toLowerCase() === tender.state.toLowerCase())) return false;
      }
      if (params.cities?.length > 0) {
        if (!tender.city || !params.cities.some((ct: string) => tender.city?.toLowerCase().includes(ct.toLowerCase()))) return false;
      }
      return true;
    });

    if (matchedTenders.length === 0) continue;

    try {
      const userName = profile.full_name?.split(' ')[0] || 'there';
      await transporter.sendMail({
        from: fromAddress,
        to: profile.email,
        subject: `${matchedTenders.length} new GeM tender${matchedTenders.length !== 1 ? 's' : ''} match your keywords`,
        html: buildEmailHtml(userName, matchedTenders, siteUrl),
      });
      sent++;
    } catch (err: any) {
      errors.push(`${profile.email}: ${err.message}`);
    }
  }

  console.log(`[EMAIL DIGEST] Sent: ${sent} | Errors: ${errors.length}`);
  return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined });
}
