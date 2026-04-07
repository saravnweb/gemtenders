/**
 * Sample computed colors from live Google Search (browser: prefers dark).
 * Run: npx tsx scripts/verify-google-dark-colors.ts
 */
import { chromium } from "playwright";

const UA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return rgb;
  const nums = m.slice(1, 4).map((x) => Number(x));
  return (
    "#" +
    nums
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase()
  );
}

async function tryConsent(page: import("playwright").Page) {
  const selectors = [
    "button#L2AGLb",
    'button[aria-label="Accept all"]',
    "form[action*='consent'] button",
    "text=Accept all",
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    try {
      if (await loc.isVisible({ timeout: 2500 })) {
        await loc.click();
        await page.waitForTimeout(2000);
        return true;
      }
    } catch {
      /* continue */
    }
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    colorScheme: "dark",
    locale: "en-US",
    userAgent: UA_CHROME,
    viewport: { width: 1365, height: 900 },
  });
  const page = await context.newPage();

  await page.goto("https://www.google.com/search?q=test&hl=en&pws=0", {
    waitUntil: "load",
    timeout: 60000,
  });
  await tryConsent(page);

  await page.goto("https://www.google.com/search?q=test&hl=en&pws=0", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await tryConsent(page);
  await page.waitForTimeout(2500);

  const out = await page.evaluate(`(() => {
    function read(el) {
      if (!el) return null;
      var s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color };
    }
    var main =
      document.querySelector('[role="main"]') ||
      document.querySelector("#center_col") ||
      document.querySelector("#rso");
    var firstTitle = document.querySelector("#rso h3") || document.querySelector("h3");
    var firstSnippet =
      document.querySelector("#rso .VwiC3b") ||
      document.querySelector(".VwiC3b");
    var firstCite =
      document.querySelector("#rso cite") || document.querySelector("cite");
    var searchBox =
      document.querySelector('textarea[name="q"]') ||
      document.querySelector('input[name="q"]');
    return {
      url: location.href,
      title: document.title,
      hasRso: !!document.querySelector("#rso"),
      prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      html: read(document.documentElement),
      body: read(document.body),
      main: main ? read(main) : null,
      searchBox: searchBox ? read(searchBox) : null,
      firstH3: firstTitle ? { color: getComputedStyle(firstTitle).color } : null,
      snippet: firstSnippet
        ? { color: getComputedStyle(firstSnippet).color }
        : null,
      cite: firstCite ? { color: getComputedStyle(firstCite).color } : null,
    };
  })()`);

  if (String(out.url).includes("/sorry/")) {
    console.warn(
      "\n[blocked] Google served the bot-check / sorry page — computed SERP colors are not available in headless automation.\n" +
        "To measure real colors: open google.com in Chrome (dark theme), DevTools → pick element → Computed.\n"
    );
  }
  console.log("Live Google Search — UA: Chrome / colorScheme: dark\n");
  console.log(JSON.stringify(out, null, 2));
  console.log("\n--- rgb → hex ---");
  const report: Record<string, string | null> = {
    bodyBg: out.body?.bg ? rgbToHex(out.body.bg) : null,
    mainBg: out.main?.bg ? rgbToHex(out.main.bg) : null,
    searchBg: out.searchBox?.bg ? rgbToHex(out.searchBox.bg) : null,
    title: out.firstH3?.color ? rgbToHex(out.firstH3.color) : null,
    snippet: out.snippet?.color ? rgbToHex(out.snippet.color) : null,
    cite: out.cite?.color ? rgbToHex(out.cite.color) : null,
  };
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
