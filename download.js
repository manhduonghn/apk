const { chromium } = require("playwright");
const fs = require("fs");
const https = require("https");

const TARGET_VERSION = "20.21.37";
const BASE_URL = "https://youtube.en.uptodown.com/android/versions";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("➡️ Open versions page");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  // 🔎 tìm version + click more
  while (true) {
    const item = page.locator(
      `div:has(span.version:has-text("${TARGET_VERSION}"))`
    );

    if ((await item.count()) > 0) {
      console.log("✅ Found version");
      await item.first().click();
      break;
    }

    const more = page.locator("#button-list-more .more");

    if (await more.isVisible()) {
      console.log("➡️ Click See more...");
      await more.click();
      await page.waitForTimeout(1500);
    } else {
      throw new Error("❌ Không tìm thấy version");
    }
  }

  // 👉 trang download/{id}
  await page.waitForLoadState("domcontentloaded");

  console.log("⏳ Wait button...");

  // ⚡ đợi button attach (không cần visible)
  const btn = page.locator("#detail-download-button");
  await btn.waitFor({ state: "attached", timeout: 30000 });

  // 🔥 lấy token
  const token = await btn.getAttribute("data-url");

  if (!token) throw new Error("❌ Không có token");

  const downloadUrl = `https://dw.uptodown.com/dwn/${token}`;
  console.log("🔗 Token URL:", downloadUrl);

  // 👉 follow redirect → APK thật
  https.get(downloadUrl, (res) => {
    const finalUrl = res.headers.location;

    if (!finalUrl) {
      throw new Error("❌ Không redirect ra APK");
    }

    console.log("📥 Final APK:", finalUrl);

    const file = fs.createWriteStream(
      `youtube-${TARGET_VERSION}.apk`
    );

    https.get(finalUrl, (apkRes) => {
      apkRes.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log("✅ Download done");
        browser.close();
      });
    });
  });

})();
