# Daily Operations Guide — Tender Track

This guide covers the commands staff run every day to keep the tender database fresh, enriched, and notifications sent.

---

## Quick Reference

| Task | Command | When |
| :--- | :--- | :--- |
| Full pipeline (recommended) | `npm run pipeline` | Every morning |
| Check database health | `npm run stats` | After pipeline or anytime |
| Clean up expired tenders | `npm run cleanup` | Once daily |
| Fix missing locations | `npm run fix-locations` | If pipeline is skipped |

---

## Option A — Run Everything at Once (Recommended)

Open a terminal in `D:\websites\Tenders` and run:

```bash
npm run pipeline
```

This runs all four steps automatically in sequence:

1. Scrapes today's new tenders from GeM
2. Enriches them with AI summaries and SOLR data
3. Enriches detail fields from each tender's leaf page
4. Fixes any missing state/city values
5. Sends keyword-based email notifications to subscribers

Wait for it to finish before closing the window. It can take **20–60 minutes** depending on how many new tenders were published.

---

## Option B — Run Steps Manually

Use this when you need to re-run just one part, or if the pipeline was interrupted.

### Step 1 — Scrape new tenders

```bash
npm run fast-scrape
```

Fetches all active tenders from GeM via API. Stops automatically when it reaches already-scraped pages.

Optional flags:

- `npm run fast-scrape -- --pages=500` — limit to first 500 pages
- `npm run fast-scrape -- --start=200` — resume from page 200 if interrupted

### Step 2 — Enrich with AI and SOLR data

```bash
npm run enrich
```

Populates AI summary, category, ministry, department, keywords, and location for newly scraped tenders.

Optional flags:

- `npm run enrich -- --limit=500` — process only 500 tenders (useful for testing)
- `npm run enrich -- --solr-only` — skip AI (no Groq API cost), just fill SOLR fields

### Step 3 — Enrich detail fields from leaf pages

```bash
npm run leaf-enrich
```

Fetches each tender's detail page from GeM to extract EMD amount, estimated value, eligibility, delivery days, etc.

Optional flags:

- `npm run leaf-enrich -- --limit=200` — process only 200 tenders
- `npm run leaf-enrich -- --no-groq` — skip AI parsing (faster, lower cost)

### Step 4 — Fix missing locations

```bash
npm run fix-locations
```

Uses AI to infer the state and city for tenders that are still missing location data.

### Step 5 — Send notifications

```bash
npm run notify
```

Sends email alerts to subscribers whose keyword watchlists match newly added tenders.

---

## Daily Database Maintenance

### Check database health

```bash
npm run stats
```

Shows a report including:

- Total tenders in the database
- How many have AI summaries, PDF links, state/city
- How many need enrichment

Run this after the pipeline to confirm everything looks right.

### Clean up expired tenders

```bash
npm run cleanup
```

- Archives tenders whose end date has passed
- Permanently deletes tenders that were archived more than **15 days ago**

Run this once a day, ideally after the pipeline.

---

## Common Situations

### Pipeline was interrupted mid-way

The scraper and enricher save checkpoints automatically. Re-run the same command and it will resume from where it left off.

To force a fresh restart (ignore checkpoint):

```bash
npm run enrich -- --reset
npm run leaf-enrich -- --reset
```

### Many tenders are missing locations

```bash
npm run fix-locations
```

If the problem is large-scale, run with a higher batch:

```bash
npx tsx scripts/maintenance/fix-locations.ts --batch=500
```

### Quick database count check

```bash
npm run db-check
```

Shows total tenders, how many are enriched, and the 8 most recently added.

---

## Web App

To start the website locally for testing:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Notes

- All commands must be run from `D:\websites\Tenders`
- Requires `.env.local` with valid Supabase and Groq API keys
- GeM PDF downloads are blocked server-side — this is a known limitation, not a bug
- The pipeline uses the **Groq AI API** for enrichment — if it fails with rate limit errors, wait a few minutes and re-run `npm run enrich`
