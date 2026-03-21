@echo off
echo =========================================================
echo Starting Daily Tender Pipeline (Crawl + Enrich)
echo Time: %date% %time%
echo =========================================================

:: Go to your project directory
cd /d "D:\websites\Tenders"

:: Step 1: Run the scraper. We tell it to go up to 200 pages.
:: We added a smart check inside the script to automatically stop turning pages
:: as soon as it sees a full page of already-scraped tenders!
echo [1/2] Running GeM Scraper...
call npx tsx scripts/run-scraper.ts --pages=200

:: Step 2: Run the enricher. By default it processes up to 20,000 unenriched tenders.
:: It will naturally just process the new ones that the scraper just found.
echo [2/2] Running AI Enrichment...
call npx tsx scripts/enrich-tenders.ts

echo =========================================================
echo Pipeline Complete!
echo =========================================================
pause
