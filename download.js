const { chromium } = require("playwright");
const fs = require("fs");
const https = require("https");

const TARGET_VERSION = "20.21.37";
const BASE_URL = "https://youtube.en.uptodown.com/android/versions";

(async () => {
  const browser = await chromium.launch({
    headless: true, // đổi false nếu muốn xem browser
  });

  const page = await browser.newPage();

  console.log("➡️ Opening versions page...");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  let found = false;
  let versionElement;

  console.log(`🔍 Searching for version ${TARGET_VERSION}...`);

  while (!found) {
    // tìm version trong DOM
    versionElement = await page.locator(
      `div:has(span.version:has-text("${TARGET_VERSION}"))`
    );

    if ((await versionElement.count()) > 0) {
      found = true;
      break;
    }

    // nếu chưa có -> click "See more"
    const seeMoreBtn = page.locator("#button-list-more .more");

    if (await seeMoreBtn.isVisible()) {
      console.log("➡️ Clicking 'See more'...");
      await seeMoreBtn.click();

      // chờ load thêm
      await page.waitForTimeout(1500);
    } else {
      throw new Error("❌ Không tìm thấy version và không còn nút 'See more'");
    }
  }

  console.log("✅ Found version!");

  // click vào item version
  await versionElement.first().click();

  // chờ sang trang download
  await page.waitForLoadState("domcontentloaded");

  console.log("➡️ Opening download page...");

  // nút download chính
  const downloadBtn = page.locator('a[href*="download"]');

  await downloadBtn.first().click();

  // chờ redirect tới link APK thật
  await page.waitForEvent("download").catch(() => {});

  // fallback: lấy link trực tiếp
  const apkUrl = await page.locator("a.button.download").getAttribute("href");

  if (!apkUrl) {
    throw new Error("❌ Không lấy được link APK");
  }

  console.log("📥 APK URL:", apkUrl);

  // tải file
  const fileName = `youtube-${TARGET_VERSION}.apk`;
  const file = fs.createWriteStream(fileName);

  https.get(apkUrl, (response) => {
    response.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("✅ Download completed:", fileName);
      browser.close();
    });
  });

})();
