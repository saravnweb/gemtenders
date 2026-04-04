# 🛠️ Tender Pipeline Guide

This directory contains the scripts used to scrape, enrich, and notify about new GeM Tenders. We have simplified the process into 4 core steps.

## 🚀 Daily Pipeline (Recommended)
The easiest way to run everything is to use the combined pipeline command:
```bash
npm run pipeline
```
This runs the 4 steps below in sequence.

---

## 🔍 The 4 Core Steps

### 1. Scrape (`npm run scrape`)
**File**: `scripts/run-scraper.ts`
Scrapes the GeM portal for new tender listings. 
- It automatically stops when it sees a page of tenders you already have.
- To scrape more pages manually: `npm run scrape -- --pages=50`

### 2. Enrich (`npm run enrich`)
**File**: `scripts/solr-enrich.ts`
Uses the GeM SOLR API and Groq AI to extract structured data (Ministry, Dept, AI Summary, Keywords) **without needing to download PDFs**.
- This is the modern, fast, and storage-friendly way to enrich.

### 3. Fix Locations (`npm run fix-locations`)
**File**: `scripts/maintenance/fix-locations.ts`
Cleans up and standardizes the State and City names using AI and lookup tables. This ensures your Search and Filters work correctly.

### 4. Notify (`npm run notify`)
**File**: `scripts/notify.ts`
Sends automated emails to users based on their keyword preferences and location filters.

---

## 🧹 Maintenance & Utils
- `npm run stats`: Shows database statistics (how many enriched, missing, etc.)
- `npm run cleanup`: Removes tenders that have expired (past their end date).
- `npm run db-check`: Checks the health of the database connection.

## 📦 Archive
All older scripts, one-off experiments, and previous PDF-based enrichers have been moved to:
- `scripts/archive/`: Legacy scripts.
- `scripts/tests/`: Unit tests and file captures.

> [!NOTE]
> If a script fails, check your `.env.local` file to ensure `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` are territory-correct.
