import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import axios from "axios";

const BUCKET = "tender-documents";
const GEM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

function pdfFileName(bidNumber: string) {
  return `${bidNumber.replace(/\//g, "-")}.pdf`;
}

function pdfResponse(buffer: Buffer, fileName: string) {
  const encoded = encodeURIComponent(fileName);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function trackAndRespondPdf(
  admin: any,
  userId: string,
  tenderId: string,
  buffer: Buffer,
  fileName: string
) {
  // Track the download
  await admin.from("pdf_downloads").insert({
    user_id: userId,
    tender_id: tenderId,
  }).catch(() => {}); // Ignore errors (e.g., duplicate key)

  return pdfResponse(buffer, fileName);
}

async function getGemSession(): Promise<string> {
  const res = await axios.get("https://bidplus.gem.gov.in/all-bids", {
    headers: GEM_HEADERS,
    timeout: 20000,
  });
  return res.headers["set-cookie"]?.map((c: string) => c.split(";")[0]).join("; ") || "";
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const { slug } = await context.params;
    if (!slug) return new NextResponse("Missing slug", { status: 400 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: tenderRows } = await admin
      .from("tenders")
      .select("id, pdf_url, details_url, bid_number")
      .eq("slug", slug)
      .limit(1);

    const tender = tenderRows?.[0];
    if (!tender) return new NextResponse("Tender not found", { status: 404 });

    // ── Check PDF daily limit for free users ──
    const { data: profile } = await admin
      .from("profiles")
      .select("membership_plan")
      .eq("id", user.id)
      .single();

    if (!profile || profile.membership_plan === "free") {
      // Free users get 5 PDF downloads per calendar day
      const FREE_DAILY_LIMIT = 5;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await admin
        .from("pdf_downloads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", todayStart.toISOString());
      if ((count ?? 0) >= FREE_DAILY_LIMIT) {
        return NextResponse.json(
          { error: `Free plan includes ${FREE_DAILY_LIMIT} PDF downloads per day. Upgrade to Starter for unlimited downloads.`, requiresUpgrade: true, dailyLimit: FREE_DAILY_LIMIT, used: count },
          { status: 402 }
        );
      }
    }

    const fileName = pdfFileName(tender.bid_number);

    // ── Cached in our storage: stream bytes (never expose storage URL to client) ──
    if (tender.pdf_url && !tender.pdf_url.includes("gem.gov.in")) {
      const storagePath = tender.pdf_url.split(`/${BUCKET}/`)[1];
      if (storagePath) {
        const { data: fileData, error } = await admin.storage.from(BUCKET).download(storagePath);
        if (!error && fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          return await trackAndRespondPdf(admin, user.id, tender.id, buffer, fileName);
        }
      }
      const pdfRes = await axios.get(tender.pdf_url, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      const buffer = Buffer.from(pdfRes.data);
      if (buffer.length >= 100) {
        return await trackAndRespondPdf(admin, user.id, tender.id, buffer, fileName);
      }
    }

    // ── On-demand: fetch from GeM, cache in storage, stream to client ───────────
    const bId = tender.details_url?.split("/").pop();
    if (!bId) return NextResponse.json({ error: "PDF not available for this tender" }, { status: 404 });

    const cookies = await getGemSession();
    const pdfRes = await axios.get(
      `https://bidplus.gem.gov.in/showbidDocument/${bId}`,
      {
        headers: { ...GEM_HEADERS, Referer: "https://bidplus.gem.gov.in/all-bids", Cookie: cookies },
        responseType: "arraybuffer",
        timeout: 30000,
      }
    );

    const buffer = Buffer.from(pdfRes.data);
    if (buffer.length < 1000) {
      return NextResponse.json({ error: "PDF not available from GeM" }, { status: 404 });
    }

    const { data: uploadData } = await admin.storage
      .from(BUCKET)
      .upload(fileName, buffer, { contentType: "application/pdf", upsert: true });

    if (uploadData) {
      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(uploadData.path);
      await admin.from("tenders").update({ pdf_url: urlData.publicUrl }).eq("id", tender.id);
    }

    return await trackAndRespondPdf(admin, user.id, tender.id, buffer, fileName);

  } catch (error: any) {
    console.error("PDF download error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
