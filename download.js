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

  await page.waitForLoadState("domcontentloaded");

  // 🔥 lấy data-url
  const token = await page.locator("#detail-download-button")
    .getAttribute("data-url");

  if (!token) throw new Error("Không lấy được token");

  const downloadUrl = `https://dw.uptodown.com/dwn/${token}`;

  console.log("🔗 Generated URL:", downloadUrl);

  // 👉 follow redirect để lấy APK
  https.get(downloadUrl, (res) => {
    const finalUrl = res.headers.location;

    if (!finalUrl) {
      throw new Error("Không có redirect");
    }

    console.log("📥 Final APK:", finalUrl);

    const file = fs.createWriteStream(`youtube-${TARGET_VERSION}.apk`);

    https.get(finalUrl, (apkRes) => {
      apkRes.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log("✅ Done");
        browser.close();
      });
    });
  });

})();
