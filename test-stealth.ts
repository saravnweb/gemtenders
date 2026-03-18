import { chromium } from "playwright-extra";
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
console.log(stealthPlugin);
console.log(typeof stealthPlugin);
try {
  chromium.use(stealthPlugin());
  console.log("Success");
} catch (e) {
  console.error("Error:", e);
}
