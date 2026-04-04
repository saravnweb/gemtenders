import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import https from "https";
import axios from "axios";

const BUCKET = "tender-documents";
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const GEM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

async function getGemSession(): Promise<string> {
  const res = await axios.get("https://bidplus.gem.gov.in/all-bids", {
    httpsAgent,
    headers: GEM_HEADERS,
    timeout: 20000,
  });
  return res.headers["set-cookie"]?.map((c: string) => c.split(";")[0]).join("; ") || "";
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    if (!slug) return new NextResponse("Missing slug", { status: 400 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Fetch tender ──────────────────────────────────────────────────────────
    const { data: tenderRows } = await admin
      .from("tenders")
      .select("id, pdf_url, details_url, bid_number")
      .eq("slug", slug)
      .limit(1);

    const tender = tenderRows?.[0];
    if (!tender) return new NextResponse("Tender not found", { status: 404 });

    // ── If PDF already cached in storage, return signed URL ───────────────────
    if (tender.pdf_url && !tender.pdf_url.includes("gem.gov.in")) {
      const storagePath = tender.pdf_url.split(`/${BUCKET}/`)[1];
      if (storagePath) {
        const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
        if (signed?.signedUrl) return NextResponse.json({ signedUrl: signed.signedUrl });
      }
      // Bucket is public — return the URL directly
      return NextResponse.json({ signedUrl: tender.pdf_url });
    }

    // ── On-demand: fetch from GeM, cache, return URL ──────────────────────────
    const bId = tender.details_url?.split("/").pop();
    if (!bId) return NextResponse.json({ error: "PDF not available for this tender" }, { status: 404 });

    const cookies = await getGemSession();
    const pdfRes = await axios.get(
      `https://bidplus.gem.gov.in/showbidDocument/${bId}`,
      {
        httpsAgent,
        headers: { ...GEM_HEADERS, Referer: "https://bidplus.gem.gov.in/all-bids", Cookie: cookies },
        responseType: "arraybuffer",
        timeout: 30000,
      }
    );

    const buffer = Buffer.from(pdfRes.data);
    if (buffer.length < 1000) {
      return NextResponse.json({ error: "PDF not available from GeM" }, { status: 404 });
    }

    const fileName = `${tender.bid_number.replace(/\//g, "-")}.pdf`;
    const { data: uploadData } = await admin.storage
      .from(BUCKET)
      .upload(fileName, buffer, { contentType: "application/pdf", upsert: true });

    if (uploadData) {
      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(uploadData.path);
      await admin.from("tenders").update({ pdf_url: urlData.publicUrl }).eq("id", tender.id);
      return NextResponse.json({ signedUrl: urlData.publicUrl });
    }

    return NextResponse.json({ error: "Failed to retrieve PDF" }, { status: 500 });

  } catch (error: any) {
    console.error("PDF download error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
