const { chromium } = require("playwright");
const fs = require("fs");

const TARGET_VERSION = "20.21.37";
const BASE_URL = "https://youtube.en.uptodown.com/android/versions";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true, // 🔥 QUAN TRỌNG
  });

  const page = await context.newPage();

  await page.goto(BASE_URL);

  // 🔎 tìm version
  while (true) {
    const item = page.locator(
      `div:has(span.version:has-text("${TARGET_VERSION}"))`
    );

    if ((await item.count()) > 0) {
      console.log("✅ Found version");
      await item.first().click({ force: true });
      break;
    }

    const more = page.locator("#button-list-more .more");
    if (await more.isVisible()) {
      await more.click();
      await page.waitForTimeout(1000);
    } else {
      throw new Error("Không tìm thấy version");
    }
  }

  await page.waitForLoadState("domcontentloaded");

  const btn = page.locator("#detail-download-button");
  await btn.waitFor({ state: "attached" });

  const token = await btn.getAttribute("data-url");

  const dwnUrl = `https://dw.uptodown.com/dwn/${token}`;

  console.log("➡️ Trigger download:", dwnUrl);

  // 🔥 KEY FIX: bắt event download
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate((url) => {
      window.location.href = url;
    }, dwnUrl),
  ]);

  const fileName = `youtube-${TARGET_VERSION}.apk`;

  const path = await download.path();
  fs.copyFileSync(path, fileName);

  console.log("✅ Download done:", fileName);

  await browser.close();
})();
