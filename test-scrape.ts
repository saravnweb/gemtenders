
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const { scrapeGeMBids } = await import("./lib/scraper/gem-scraper");

async function run() {
    console.log(">>> [TEST] Starting scrape for specific tender...");
    try {
        // I'll manually call it but since scrapeGeMBids scans the page, 
        // I might need to mock the page search or just let it find it.
        // Actually, I can just let it run, it should find it on the first page.
        await scrapeGeMBids();
        console.log(">>> [TEST] Scrape cycle complete.");
    } catch (err) {
        console.error(">>> [TEST] Scrape failed:", err);
    }
}

run();
