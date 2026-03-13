
import { scrapeGeMBids } from '../lib/scraper/gem-scraper';

async function run() {
  console.log("Starting manual scrape cycle...");
  try {
    await scrapeGeMBids();
    console.log("Scrape cycle finished successfully.");
  } catch (err) {
    console.error("Scrape cycle failed:", err);
    process.exit(1);
  }
}

run();
