const { chromium } = require("playwright");
const fs = require("fs");
const https = require("https");

const TARGET_VERSION = "20.21.37";
const BASE_URL = "https://youtube.en.uptodown.com/android/versions";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
  });

  const page = await context.newPage();

  console.log("➡️ Opening versions page...");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  let found = false;

  console.log(`🔍 Searching version ${TARGET_VERSION}...`);

  while (!found) {
    const versionItem = page.locator(
      `div:has(span.version:has-text("${TARGET_VERSION}"))`
    );

    if ((await versionItem.count()) > 0) {
      console.log("✅ Found version!");
      await versionItem.first().click();
      found = true;
      break;
    }

    const seeMore = page.locator("#button-list-more .more");

    if (await seeMore.isVisible()) {
      console.log("➡️ Click See more...");
      await seeMore.click();
      await page.waitForTimeout(1500);
    } else {
      throw new Error("❌ Không tìm thấy version");
    }
  }

  // 👉 đang ở trang /download/{id}
  await page.waitForLoadState("domcontentloaded");
  console.log("➡️ On download info page");

  // ⚡ click nút DOWNLOAD thật
  // Uptodown thường có nút dạng:
  // a.button.download hoặc a[data-url*="download"]
  const realDownloadBtn = page.locator(
    'a.button.download, a[href*="/download/"]'
  );

  await realDownloadBtn.first().waitFor({ timeout: 10000 });
  console.log("➡️ Click download button...");
  await realDownloadBtn.first().click();

  // ⚡ bắt request file APK
  console.log("⏳ Waiting APK response...");

  const response = await page.waitForResponse((resp) => {
    const url = resp.url();
    return url.includes(".apk") && resp.status() === 200;
  }, { timeout: 20000 });

  const apkUrl = response.url();

  console.log("📥 APK URL:", apkUrl);

  // 👉 tải file
  const fileName = `youtube-${TARGET_VERSION}.apk`;
  const file = fs.createWriteStream(fileName);

  https.get(apkUrl, (res) => {
    res.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("✅ Download done:", fileName);
      browser.close();
    });
  });

})();
