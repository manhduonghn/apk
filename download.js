const { chromium } = require("playwright");
const fs = require("fs");
const https = require("https");

const TARGET_VERSION = "20.21.37";
const BASE_URL = "https://youtube.en.uptodown.com/android/versions";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(BASE_URL);

  // 🔎 tìm version
  while (true) {
    const item = page.locator(
      `div:has(span.version:has-text("${TARGET_VERSION}"))`
    );

    if ((await item.count()) > 0) {
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

  console.log("➡️ Open dwn:", dwnUrl);

  // 🔥 BẮT LINK APK CUỐI
  const [response] = await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes(".apk") && resp.status() === 200,
      { timeout: 60000 }
    ),
    page.goto(dwnUrl), // 👉 KEY CHÍNH
  ]);

  const apkUrl = response.url();

  console.log("📥 Final APK:", apkUrl);

  // 👉 download
  const fileName = `youtube-${TARGET_VERSION}.apk`;
  const file = fs.createWriteStream(fileName);

  https.get(apkUrl, (res) => {
    res.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("✅ Done:", fileName);
      browser.close();
    });
  });
})();
