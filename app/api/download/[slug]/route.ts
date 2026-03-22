import { NextResponse } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;

    if (!slug) {
      return new NextResponse("Missing slug", { status: 400 });
    }

    // Lookup the tender by slug to get the PDF URL
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?slug=eq.${slug}&select=pdf_url&limit=1`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
      },
      cache: 'no-store'
    });

    if (!res.ok) {
        return new NextResponse("Failed to fetch tender info", { status: 500 });
    }

    const data = await res.json();
    const tender = data && data.length > 0 ? data[0] : null;

    if (!tender || !tender.pdf_url) {
      return new NextResponse("PDF not found for this tender", { status: 404 });
    }

    // Fetch the PDF from the Supabase Storage URL
    const pdfRes = await fetch(tender.pdf_url);
    
    if (!pdfRes.ok) {
      return new NextResponse("Error retrieving PDF file", { status: pdfRes.status });
    }

    // Stream the PDF to the client
    return new NextResponse(pdfRes.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tender-${slug}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error downloading PDF:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
