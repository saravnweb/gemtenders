import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { scrapeGeMBids } = await import('../lib/scraper/gem-scraper');

async function run() {
  const args = process.argv.slice(2);
  const lightMode = args.includes('--light');
  
  // Find numeric argument for pages or default to unlimited
  const pagesArg = args.find(a => a.startsWith('--pages='));
  let maxPages = Infinity;
  if (pagesArg) {
    const val = pagesArg.split('=')[1];
    maxPages = (val.toLowerCase() === 'unlimited' || val.toLowerCase() === 'all') ? Infinity : parseInt(val, 10);
  }

  const startArg = args.find(a => a.startsWith('--start='));
  const startPage = startArg ? parseInt(startArg.split('=')[1], 10) : 1;

  console.log(`Starting Scrape cycle: Mode=${lightMode ? 'LIGHT' : 'FULL'}, Pages=${maxPages}, StartPage=${startPage}`);
  
  try {
    await scrapeGeMBids({ lightMode, maxPages, startPage });
    console.log("Scrape cycle finished successfully.");
  } catch (err) {
    console.error("Scrape cycle failed:", err);
    process.exit(1);
  }
}

run();
