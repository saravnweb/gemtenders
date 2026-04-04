# Tender Enrichment Research — GeM Leaf Page Strategy

Date: 2026-03-31 | Status: In Progress

---

## Current State (108,591 tenders)

| Field | Coverage | Source |
| --- | --- | --- |
| state | 8% (8,996) | AI from PDF |
| city | 3% (3,505) | AI from PDF |
| ai_summary | 0.03% (30) | AI from PDF |
| emd_amount | 0.03% (30) | AI from PDF |
| ministry/dept | partial | SOLR API |

**Root problem:** 108,561 tenders have no PDF downloaded. Without PDF, AI has nothing to work with. The SOLR API gives structural fields for free — no PDF, no browser.

---

## Two-Track Enrichment Strategy

### Track 1: SOLR API — No PDF needed, works for all 108K

GeM SOLR endpoint (`/all-bids-data`) returns structured fields directly — no PDF, no browser, no AI.

| SOLR Field | DB Column | Status |
| --- | --- | --- |
| `ba_official_details_minName` | `ministry_name` | ✅ Mapped |
| `ba_official_details_deptName` | `department_name` | ✅ Mapped |
| `b_total_quantity` | `quantity` | ✅ Mapped |
| `b_bid_type` | `bid_type` | ✅ Mapped |
| `b_category_name` | `gem_category` | ⚠️ Column added, not populated |
| `is_high_value` | — | ❌ No column yet |
| `final_start_date_sort` | `start_date` | partial |
| `final_end_date_sort` | `end_date` | partial |

**Key gap:** `b_category_name` is the **official GeM catalog category** (e.g., "Desktop Computers", "Manpower Outsourcing Services") — far more precise than our 20-bucket internal system. BidAssist shows this prominently. Column `gem_category` was added to schema — needs population via SOLR pass.

**TODO:** Run `probe-solr-fields.ts` with `fl=*` to discover ALL available SOLR fields — GeM may expose consignee state, seller type flags, or estimated value.

---

### Track 2: PDF / Leaf Page HTML — Deep enrichment

**What a GeM bid PDF/HTML contains (10 extractable sections):**

| Section | Fields | Current Extraction |
| --- | --- | --- |
| Bid Details | Estimated Bid Value, Bid Opening Date, Pre-bid Meeting Date, Bid Type (Single/Two-Packet/QCBS/BOQ) | Partial (dates yes, value only in JSON blob) |
| EMD Detail | EMD Amount, MSME exemption | ✅ `emd_amount`, `eligibility_msme` |
| ePBG Detail | ePBG %, ePBG threshold | ❌ Only in `ai_summary` blob |
| MII Compliance | Class I/II local content %, non-local exclusion | ✅ `eligibility_mii` (boolean only) |
| MSE Preference | MSE purchase preference % | ✅ boolean |
| Eligibility | Min turnover (Rs), experience years, MSE/startup exemptions | ✅ Relaxation text, ❌ Not numeric columns |
| Consignee Table | Delivery city/state, quantity per location, delivery period | ✅ city/state, ❌ num_consignees, delivery_period |
| Item Details | Full untruncated title, specs, UoM | ✅ tender_title |
| Documents Required | List of mandatory docs | ✅ `documents_required[]` |
| Buyer ATC | Custom terms | ❌ Not extracted |

---

## What BidAssist Has vs. What We Have

### BidAssist Gaps (They Have, We Don't)

| Feature | BidAssist | Us | Gap |
| --- | --- | --- | --- |
| EMD as filter | ✅ Range filter | ✅ Stored, not filterable | Make it a query param |
| State/City filter | ✅ | 8%/3% coverage | Scale with SOLR+AI |
| **Official GeM category** | ✅ Shows `b_category_name` | ⚠️ Column added, not populated | Populate via SOLR |
| **Estimated bid value** | ✅ | In JSON blob only | Promote to `estimated_value` column |
| Tender results/winners | ✅ | ❌ Not built | Requires separate scrape |
| Corrigendum tracking | ✅ | ❌ Not built | Separate scrape |

### Our Advantages (They Don't Have)

| Feature | Us | BidAssist |
| --- | --- | --- |
| **AI summaries** (insight field) | ✅ | ❌ |
| **MSME/startup relaxation text** | ✅ | ❌ |
| **Documents required list** | ✅ | ❌ |
| **Startup eligibility flag** | ✅ | ❌ |
| **Category keywords** | ✅ | ❌ |

---

## Recommended Enrichment Innovations — Prioritized

### Priority 1: SOLR-first mass enrichment (all 108K, zero AI cost)

> [!WARNING]
> GeM's SOLR endpoint (`/all-bids-data`) ignores string matching for specific single bid references (`searchbid: "GEM/XYZ"`). As a result, 1-by-1 searches return zero matches. To map mass fields efficiently, **we must piggy-back on `fast-api-scraper` pagination**, mapping the fields natively as the crawler pulls down batches of 10.

Add `gem_category` column ✅ (done), plus High Value, Packet config, and Bunch status.
Covers: `gem_category`, `ministry_name`, `department_name`, `quantity`, `bid_type`, `is_high_value`, `is_single_packet`, `is_bunch`

**~Cost: 0 API calls outside of standard sync operations.**

### Priority 2: Promote JSON blob fields to indexed columns

Fields currently buried inside `ai_summary` JSON that should be queryable:

```sql
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS estimated_value     NUMERIC;   -- from "ESTIMATED BID VALUE"
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS epbg_percentage     NUMERIC;   -- from "EPBG DETAIL"
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS min_turnover_lakhs  NUMERIC;   -- from "MINIMUM AVERAGE ANNUAL TURNOVER"
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS experience_years    NUMERIC;   -- from eligibility section
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS delivery_days       INTEGER;   -- consignee delivery period
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS num_consignees      INTEGER;   -- count of delivery locations
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_high_value       BOOLEAN;   -- SOLR is_high_value flag
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS pre_bid_date        TIMESTAMPTZ;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS raw_text            TEXT;      -- full scraped text (if not already)
```

**Enables filters like:** "MSME tenders under ₹50L estimated value in Maharashtra"

### Priority 3: GeM Leaf Page HTML scraping (TERMINATED)

_Conclusion:_ HTML scraping is effectively dead. We must rely exclusively on the **Priority 2** PDF downloading strategy (`leaf-enrich.ts` which uses a session-bound `page.request.get(pdfUrl)` on the active listing) to feed data to the Groq AI extractor.

### Priority 4: Expand Groq AI prompt

Add to extraction:
- `estimated_value` (numeric Rs, from "Estimated Bid Value")
- `epbg_percentage` (numeric %, from "ePBG Detail")
- `min_turnover_lakhs` (numeric, from "Minimum Average Annual Turnover")
- `experience_years` (numeric, from eligibility)
- `mii_class1_threshold` / `mii_class2_threshold` (local content %)
- `is_two_packet` / `is_qcbs` / `has_boq` (booleans)
- `num_consignees` (count from consignee table)
- `delivery_days` (from consignee table)
- `pre_bid_date` (ISO date)

### Priority 5: Computed/derived fields (zero scraping cost)

Derive from existing data — no new scraping:

| Field | Derivation |
| --- | --- |
| `vendor_tags[]` | `["msme-eligible","startup-eligible","mii-required","epbg-free"]` |
| `emd_exemption_for_msme` | `eligibility_msme=true AND emd_amount > 0` |
| `turnover_band` | `"<25L" \| "25L-1Cr" \| "1Cr-5Cr" \| ">5Cr"` |
| `value_band` | `"<10L" \| "10L-50L" \| "50L-1Cr" \| ">1Cr"` |

### Priority 6 (Frontier): Semantic search + BOQ extraction

- **pgvector embeddings** on `title + gem_category + keywords` → enable "find similar tenders"
- **BOQ item extraction** — extract each line item as structured array (TenderTiger's differentiator)
- **GeM results scraping** — awarded tenders/winner data from `/bidding/bid/results` pages

---

## What Other Sites Do

### BidAssist (bidassist.com)

- Shows GeM category label, state/city, EMD range filter, estimated value
- Does NOT surface: MII class %, MSME relaxation text, startup eligibility, documents list, AI summaries

### TenderTiger

- **BOQ extraction** — item-level rows from Bill of Quantities (unique differentiator)
- Semantic "Tiger Searcher", Google Sheet integration

### TenderDetail.com

- AI/ML-powered insights for bidding strategy
- Day-wise, month-wise, value-wise, state-wise analytics

### TenderStria (global, frontier model)

- Compliance gap assessment, qualification scoring (0-100), Go/No-Go recommendation with reasoning
- Embedding-based semantic search

### Nexizo.ai (India)

- Eligibility extraction: EMD, deadlines, specs, evaluation criteria
- Generates bid templates, suggests historical pricing

---

## Implementation Notes

### Existing Scripts

- `scripts/solr-enrich.ts` — SOLR pagination, already maps ministry/dept/quantity/bid_type
- `scripts/scrape-leaf-pages.ts` — SOLR pagination + raw_text storage
- `scripts/leaf-enrich.ts` — Playwright listing-page PDF download + AI enrichment
- `scripts/bulk-enrich.ts` — AI enrichment from `raw_text`
- `lib/groq-ai.ts` — Groq AI extractor (llama-3.3-70b-versatile)

### Known Constraints

- GeM blocks direct PDF downloads (returns 0-byte file) — must stay on listing page session
- SOLR session requires CSRF token from initial page visit
- PDF enrichment limited to 30 tenders currently (those with valid PDF session downloads)

### Schema Changes Already Done

- `gem_category TEXT` — added, not yet populated
- `enrichment_tried_at TIMESTAMPTZ` — tracks enrichment attempts
- `category TEXT`, `bid_type TEXT`, `procurement_type TEXT`, `keywords TEXT[]` — already live

---

## Next Actions (when resuming)

1. [ ] Run `probe-solr-fields.ts` to discover all available SOLR fields
2. [ ] Update `solr-enrich.ts` to populate `gem_category` from `b_category_name`
3. [ ] Add new DB columns: `estimated_value`, `epbg_percentage`, `min_turnover_lakhs`, `delivery_days`, `num_consignees`, `is_high_value`, `pre_bid_date`
4. [ ] Expand Groq AI prompt to extract those new numeric fields
5. [ ] Build GeM leaf page HTML scraper (structured table extraction, no PDF)
6. [ ] Implement `vendor_tags[]` computed field
7. [ ] Evaluate pgvector for semantic search on enriched tenders
