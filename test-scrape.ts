
import "dotenv/config"; // Imports and executes config immediately
import { scrapeGeMBids } from "./lib/scraper/gem-scraper";

async function run() {
    console.log(">>> [TEST] Starting scrape for first page only...");
    try {
        await scrapeGeMBids();
        console.log(">>> [TEST] Scrape cycle complete.");
    } catch (err) {
        console.error(">>> [TEST] Scrape failed:", err);
    }
}

run();
