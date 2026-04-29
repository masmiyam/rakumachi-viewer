const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DAILY_DIR = path.join(__dirname, "../data/daily");
const LATEST_PATH = path.join(__dirname, "../data/latest.json");
const BASE_URL = process.env.BASE_URL || "https://www.rakumachi.jp/syuuekibukken/area/prefecture/dimAll/";
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "50", 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || "8000", 10);

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

function jstDateStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function buildPageUrl(base, pageNum) {
  const u = new URL(base);
  u.searchParams.set("page", String(pageNum));
  if (!u.searchParams.has("sort")) u.searchParams.set("sort", "property_created_at");
  if (!u.searchParams.has("sort_type")) u.searchParams.set("sort_type", "desc");
  return u.toString();
}

function categorizeStructure(raw) {
  if (!raw) return null;
  const s = raw.replace(/\s/g, "");
  if (/SRC造/.test(s)) return "SRC造";
  if (/RC造|鉄筋コンクリート/.test(s)) return "RC造";
  if (/軽量鉄骨/.test(s)) return "軽量鉄骨造";
  if (/S造|鉄骨造|重量鉄骨/.test(s)) return "S造";
  if (/木造/.test(s)) return "木造";
  if (/鉄骨/.test(s)) return "S造";
  return "その他";
}

function parsePriceMan(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, "");
  const okuMatch = t.match(/([\d,]+)億/);
  const manMatch = t.match(/([\d,]+)万/);
  let total = 0;
  if (okuMatch) total += parseInt(okuMatch[1].replace(/,/g, ""), 10) * 10000;
  if (manMatch) total += parseInt(manMatch[1].replace(/,/g, ""), 10);
  return total > 0 ? total : null;
}

function parseAccess(raw) {
  if (!raw) return { line: "", station: "", walkMin: null, busMin: null };
  const walkMatch = raw.match(/徒歩\s*(\d+)\s*分/);
  const busMatch = raw.match(/バス\s*(\d+)\s*分/);
  const walkMin = walkMatch ? parseInt(walkMatch[1], 10) : null;
  const busMin = busMatch ? parseInt(busMatch[1], 10) : null;
  const cleaned = raw.replace(/(徒歩|バス|車)\s*\d+\s*分.*$/, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const stationIdx = parts.findIndex((s) => /駅$/.test(s));
  let line = "";
  let station = "";
  if (stationIdx >= 0) {
    station = parts[stationIdx];
    line = parts.slice(0, stationIdx).join(" ");
  } else {
    line = parts.join(" ");
  }
  return { line, station, walkMin, busMin };
}

function parseBuilt(text) {
  if (!text) return { year: null, month: null, ageYears: null };
  const ymMatch = text.match(/(\d+)\s*年\s*(\d+)\s*月/);
  const yMatch = text.match(/(\d+)\s*年/);
  const ageMatch = text.match(/築\s*(\d+)\s*年/);
  let year = null;
  let month = null;
  if (ymMatch) {
    year = parseInt(ymMatch[1], 10);
    month = parseInt(ymMatch[2], 10);
  } else if (yMatch) {
    year = parseInt(yMatch[1], 10);
  }
  let ageYears = null;
  if (ageMatch) ageYears = parseInt(ageMatch[1], 10);
  else if (year) ageYears = new Date().getFullYear() - year;
  return { year, month, ageYears };
}

function parseAreas(text) {
  if (!text) return { buildingM2: null, landM2: null, exclusiveM2: null };
  const buildingMatch = text.match(/建物\s*([\d,.]+)/);
  const landMatch = text.match(/土地\s*([\d,.]+)/);
  const exclusiveMatch = text.match(/専有\s*([\d,.]+)/);
  return {
    buildingM2: buildingMatch ? parseFloat(buildingMatch[1].replace(/,/g, "")) : null,
    landM2: landMatch ? parseFloat(landMatch[1].replace(/,/g, "")) : null,
    exclusiveM2: exclusiveMatch ? parseFloat(exclusiveMatch[1].replace(/,/g, "")) : null,
  };
}

function postProcess(p) {
  let prefecture = "";
  for (const pref of PREFECTURES) {
    if (p.address && p.address.startsWith(pref)) {
      prefecture = pref;
      break;
    }
  }
  const access = parseAccess(p.accessRaw);
  const built = parseBuilt(p.builtRaw);
  const areas = parseAreas(p.areaRaw);
  const priceMan = parsePriceMan(p.priceLabel);
  const yieldMatch = (p.yieldLabel || "").match(/([\d.]+)/);
  const yieldPct = yieldMatch ? parseFloat(yieldMatch[1]) : null;
  const unitsMatch = (p.unitsRaw || "").match(/(\d+)/);
  const unitsCount = unitsMatch ? parseInt(unitsMatch[1], 10) : null;
  const url = p.href.startsWith("http") ? p.href : "https://www.rakumachi.jp" + p.href;

  return {
    id: p.id,
    name: p.name,
    type: p.type,
    prefecture,
    address: p.address,
    accessRaw: p.accessRaw,
    trafficLine: access.line,
    trafficStation: access.station,
    trafficWalkMin: access.walkMin,
    trafficBusMin: access.busMin,
    priceLabel: p.priceLabel,
    priceMan,
    yieldLabel: p.yieldLabel,
    yieldPct,
    builtRaw: p.builtRaw,
    builtYear: built.year,
    builtMonth: built.month,
    buildingAgeYears: built.ageYears,
    structureRaw: p.structureRaw,
    structure: categorizeStructure(p.structureRaw),
    floorsLabel: p.floorsLabel,
    areaRaw: p.areaRaw,
    buildingAreaM2: areas.buildingM2,
    landAreaM2: areas.landM2,
    exclusiveAreaM2: areas.exclusiveM2,
    unitsRaw: p.unitsRaw,
    unitsCount,
    broker: p.broker,
    updateLabel: p.updateLabel,
    isNew: p.isNew,
    photoUrl: p.photoUrl,
    url,
    crawledAt: new Date().toISOString(),
  };
}

async function extractBlocks(page) {
  return page.evaluate(() => {
    const out = [];
    const blocks = document.querySelectorAll(".propertyBlock");
    blocks.forEach((block) => {
      const main = block.querySelector(".propertyBlock__mainArea");
      if (main && main.classList.contains("ad-propertyListInfeedAd")) return;
      const a = block.querySelector("a.propertyBlock__content");
      const href = a ? (a.getAttribute("href") || "") : "";
      if (!href) return;
      const idMatch = href.match(/\/(\d+)\/show\.html/);
      const id = idMatch ? idMatch[1] : "";
      const text = (sel) => {
        const el = block.querySelector(sel);
        return el ? el.textContent.trim().replace(/\s+/g, " ") : "";
      };
      const name = text(".propertyBlock__name");
      const type = text(".propertyBlock__dimension");
      const priceLabel = text(".propertyBlock__contents b.price");
      const yieldLabel = text(".propertyBlock__contents b.gross");
      const address = text(".propertyBlock__address");
      const accessRaw = text(".propertyBlock__access");
      const updateLabel = text(".propertyBlock__update");
      const isNew = !!block.querySelector(".propertyBlock__update .ut-icon__new");
      const broker = text(".propertyBlock__realtorName");

      const photoImg = block.querySelector(".propertyBlock__photo img");
      const photoUrl = photoImg ? (photoImg.getAttribute("data-original") || photoImg.getAttribute("src") || "") : "";

      const labelMap = {};
      const contents = block.querySelector(".propertyBlock__contents");
      if (contents) {
        const spans = Array.from(contents.children).filter((c) => c.tagName === "SPAN");
        for (let i = 0; i < spans.length; i++) {
          const el = spans[i];
          const b = el.querySelector("b");
          if (b && el.children.length === 1) {
            const label = b.textContent.trim();
            const valEl = spans[i + 1];
            if (valEl) {
              labelMap[label] = valEl.textContent.trim().replace(/\s+/g, " ");
              i++;
            }
          }
        }
      }
      const builtRaw = labelMap["築年月"] || "";
      const unitsRaw = labelMap["総戸数"] || "";
      const structureRaw = labelMap["建物構造"] || "";
      const areaRaw = labelMap["面積"] || "";
      const floorsLabel = labelMap["階数"] || "";

      if (id || name) {
        out.push({
          id, name, type, href,
          address, accessRaw,
          priceLabel, yieldLabel,
          builtRaw, unitsRaw, structureRaw, areaRaw, floorsLabel,
          broker, updateLabel, isNew, photoUrl,
        });
      }
    });
    return out;
  });
}

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "1", 10);
const RETRY_BASE_MS = parseInt(process.env.RETRY_BASE_MS || "20000", 10);

async function gotoWithRetry(page, url, referer) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
        referer: referer || undefined,
      });
      const status = resp ? resp.status() : 0;
      if (status === 403 || status === 429) {
        if (attempt === MAX_RETRIES) {
          console.error(`  HTTP ${status} after ${MAX_RETRIES + 1} attempts, giving up on this page`);
          return { ok: false, status };
        }
        const wait = RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 3000);
        console.error(`  HTTP ${status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), backoff ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return { ok: true, status };
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        console.error(`  navigation failed after retries: ${e.message}`);
        return { ok: false, status: 0, error: e.message };
      }
      const wait = RETRY_BASE_MS * Math.pow(2, attempt);
      console.error(`  navigation error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${e.message}, backoff ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return { ok: false, status: 0 };
}

async function main() {
  console.log(`[${new Date().toISOString()}] Crawler started (MAX_PAGES=${MAX_PAGES}, DELAY_MS=${DELAY_MS})`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"macOS"',
      "Upgrade-Insecure-Requests": "1",
    },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["ja", "en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });
  const page = await context.newPage();
  const all = [];
  const seen = new Set();

  console.log(`Warming up: visiting top page`);
  await gotoWithRetry(page, "https://www.rakumachi.jp/", null);
  await page.waitForTimeout(2500);

  let prevUrl = "https://www.rakumachi.jp/";
  let blocked403 = 0;

  try {
    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
      const url = buildPageUrl(BASE_URL, pageNum);
      console.log(`Fetching page ${pageNum}: ${url}`);
      const result = await gotoWithRetry(page, url, prevUrl);
      if (!result.ok) {
        if (result.status === 403 || result.status === 429) {
          console.error(`  Blocked (HTTP ${result.status}), aborting to avoid IP reputation damage`);
          break;
        }
        continue;
      }
      blocked403 = 0;
      prevUrl = url;
      await page.waitForTimeout(2000 + Math.floor(Math.random() * 1500));

      const items = await extractBlocks(page);
      const fresh = items.filter((p) => p.id && !seen.has(p.id));
      fresh.forEach((p) => seen.add(p.id));
      console.log(`  Found ${items.length} (new: ${fresh.length})`);
      if (items.length === 0 || fresh.length === 0) break;
      all.push(...fresh.map(postProcess));
      if (pageNum < MAX_PAGES) {
        const jitter = Math.floor(Math.random() * 2000);
        await new Promise((r) => setTimeout(r, DELAY_MS + jitter));
      }
    }
  } catch (err) {
    console.error("Crawl error:", err.message);
  }

  await browser.close();

  const dateStr = jstDateStr();
  const properties = all.filter((p) => p && p.id).map((p, i) => ({ no: i + 1, ...p }));
  const output = {
    date: dateStr,
    lastUpdated: new Date().toISOString(),
    totalCount: properties.length,
    source: "rakumachi.jp",
    baseUrl: BASE_URL,
    properties,
  };
  fs.mkdirSync(DAILY_DIR, { recursive: true });
  const json = JSON.stringify(output, null, 2);
  fs.writeFileSync(path.join(DAILY_DIR, `${dateStr}.json`), json, "utf8");
  fs.writeFileSync(LATEST_PATH, json, "utf8");
  console.log(`Saved ${properties.length} properties to ${LATEST_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
