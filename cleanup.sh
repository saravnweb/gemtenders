#!/bin/bash
# Step 1: Remove all debug/log/temp files from git tracking
git rm --cached *.log *.txt *.html tmp*.json temp*.json all-bids-pg1.json \
  runs.json models.txt diff.txt db-output.txt out.txt err.txt \
  lighthouse-report.json lighthouse-report.json lighthouse-report2.json \
  lighthouse-summary.txt lighthouse-summary2.txt lighthouse-summary.js \
  lighthouse-summary.py lighthouse-summary2.js lighthouse-summary2.py \
  build.log build_output.log build_output.txt enrich.log enrich_output.log \
  clean_log.txt clean_log_2.txt clean_log_utf8.txt next_dev_error.log \
  eslint_error.log eslint_error2.log eslint_final.json lint.log \
  lint_output.json lint_output.txt lint_utf8.log eslint.txt eslint.json \
  nextlint.txt output.log tmp.html tmp.json allbids.html err.html \
  tmp-bad-tenders.json temp_tenders.json temp_tenders.txt \
  2>/dev/null || true

# Step 2: Remove test PDFs from git tracking
git rm --cached "test.pdf" "test9015597_ra.pdf" "test9028183.pdf" \
  "test_8749166.pdf" "test_download.pdf" 2>/dev/null || true

# Step 3: Remove root-level debug scripts (keep them locally but untrack)
git rm --cached check-db.ts query.ts test-scrape.js test-scrape.ts \
  test-stealth.ts test_db.js test_db.ts script.js 2>/dev/null || true

# Add .gitignore updates
git add .gitignore

# Step 4: Commit the cleanup
git commit -m "chore: remove debug artifacts, logs, and temp files from repo"
