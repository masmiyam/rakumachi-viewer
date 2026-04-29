const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL = process.argv[2];
if (!URL) {
  console.error("usage: node probe.js <url>");
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "ja-JP",
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

  console.log(`fetching: ${URL}`);
  const resp = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  console.log(`status: ${resp ? resp.status() : "no-response"}`);
  await page.waitForTimeout(3000);

  const title = await page.title();
  console.log(`title: ${title}`);

  const summary = await page.evaluate(() => {
    const candidates = [
      ".prop_block",
      ".propertyList",
      ".property_item",
      ".bukken",
      ".bukkenList",
      "[class*='Property']",
      "[class*='property']",
      "[class*='bukken']",
      "[data-bukken-id]",
      "article",
    ];
    const counts = {};
    for (const sel of candidates) {
      try {
        counts[sel] = document.querySelectorAll(sel).length;
      } catch {}
    }
    const linkSamples = Array.from(document.querySelectorAll("a[href*='/syuueki/']"))
      .slice(0, 5)
      .map((a) => a.href);
    return { counts, linkSamples, htmlLen: document.documentElement.outerHTML.length };
  });
  console.log("selectorCounts:", summary.counts);
  console.log("sampleLinks:", summary.linkSamples);
  console.log("htmlLen:", summary.htmlLen);

  const dump = path.join(__dirname, "_probe_dump.html");
  fs.writeFileSync(dump, await page.content(), "utf8");
  console.log(`dumped: ${dump}`);

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
