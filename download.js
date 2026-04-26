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

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  // 🔎 tìm version (giữ nguyên logic)
  while (true) {
    const item = page.locator(
      `div:has(span.version:has-text("${TARGET_VERSION}"))`
    );

    if ((await item.count()) > 0) {
      await item.first().click();
      break;
    }

    const more = page.locator("#button-list-more .more");
    if (await more.isVisible()) {
      await more.click();
      await page.waitForTimeout(1500);
    } else {
      throw new Error("Không tìm thấy version");
    }
  }

  // 👉 trang /download/{id}
  await page.waitForLoadState("domcontentloaded");
  console.log("➡️ Waiting download button...");

  // 🔥 WAIT THÔNG MINH (tối đa 30s)
  const downloadBtn = page.locator("a.button.download");

  await downloadBtn.waitFor({
    state: "visible",
    timeout: 30000,
  });

  console.log("✅ Download button appeared");

  // ⚡ click + bắt response cùng lúc
  const [response] = await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes(".apk") && resp.status() === 200,
      { timeout: 30000 }
    ),
    downloadBtn.click(),
  ]);

  const apkUrl = response.url();
  console.log("📥 APK URL:", apkUrl);

  // 👉 tải file
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
