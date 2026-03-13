import { NextResponse } from "next/server";
import { scrapeGeMBids } from "@/lib/scraper/gem-scraper";

export async function POST(request: Request) {
  // Optional: Check for a secret key in headers to prevent unauthorized scraping
  const authHeader = request.headers.get("authorization");
  if (process.env.SCRAPE_SECRET && authHeader !== `Bearer ${process.env.SCRAPE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Manual Scrape Triggered via API...");
    // We don't await this if we want it to run in background, 
    // but for debugging it's better to wait or use a queue.
    await scrapeGeMBids();
    return NextResponse.json({ message: "Scrapping cycle completed successfully" });
  } catch (error: any) {
    console.error("Scrape API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Support for checking status
export async function GET() {
  return NextResponse.json({ message: "Scrape API is active. Use POST to trigger." });
}
