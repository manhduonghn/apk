const { chromium } = require("playwright");
const fs = require("fs");
const https = require("https");

const TARGET_VERSION = "20.21.37";
const BASE_URL = "https://youtube.en.uptodown.com/android/versions";

// 🔥 download function (handle redirect + direct stream)
function downloadFile(url, fileName) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        console.log("➡️ Status:", res.statusCode);

        // redirect
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          console.log("➡️ Redirect:", res.headers.location);
          resolve(downloadFile(res.headers.location, fileName));
          return;
        }

        // direct file
        if (res.statusCode === 200) {
          console.log("📥 Downloading...");

          const file = fs.createWriteStream(fileName);
          res.pipe(file);

          file.on("finish", () => {
            file.close();
            console.log("✅ Done:", fileName);
            resolve();
          });

          return;
        }

        reject(new Error(`HTTP ${res.statusCode}`));
      })
      .on("error", reject);
  });
}

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

  // 🧠 bypass + hide cookie
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    const style = document.createElement("style");
    style.innerHTML = `
      #cookiescript_injected_wrapper {
        display: none !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  });

  console.log("➡️ Open page");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

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
      console.log("➡️ Click more...");
      await more.click();
      await page.waitForTimeout(1200);
    } else {
      throw new Error("Không tìm thấy version");
    }
  }

  // 👉 trang download
  await page.waitForLoadState("domcontentloaded");

  const btn = page.locator("#detail-download-button");

  await btn.waitFor({
    state: "attached",
    timeout: 30000,
  });

  console.log("✅ Button ready");

  const token = await btn.getAttribute("data-url");

  if (!token) {
    throw new Error("Không lấy được token");
  }

  const downloadUrl = `https://dw.uptodown.com/dwn/${token}`;
  console.log("🔗", downloadUrl);

  const fileName = `youtube-${TARGET_VERSION}.apk`;

  await downloadFile(downloadUrl, fileName);

  await browser.close();
})();
