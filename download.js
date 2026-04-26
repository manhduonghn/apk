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

        // 👉 redirect
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          console.log("➡️ Redirect:", res.headers.location);
          return resolve(downloadFile(res.headers.location, fileName));
        }

        // 👉 file trực tiếp
        if (res.statusCode === 200) {
          console.log("📥 Downloading...");

          const file = fs.createWriteStream(fileName);
          res.pipe(file);

          file.on("finish", () => {
            file.close();
            console.log("✅ Download done:", fileName);
            resolve();
          });

          return;
        }

        reject(new Error(`❌ HTTP ${res.statusCode}`));
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

  // 🧠 bypass bot + kill cookie popup
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

  console.log("➡️ Open versions page");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  // 🍪 fallback accept cookie
  try {
    const btn = page.locator(
      'button:has-text("Accept"), button:has-text("Accept all")'
    );
    if (await btn.isVisible({ timeout: 5000 })) {
      console.log("🍪 Accept cookies...");
      await btn.click();
    }
  } catch {}

  // 🔎 tìm version + click more
  while (true) {
    const item = page.locator(
      `div:has(span.version:has-text("${TARGET_VERSION}"))`
    );

    if ((await item.count()) > 0) {
      console.log("✅ Found version");

      await item.first().click({ force: true }); // fix cookie overlay
      break;
    }

    const more = page.locator("#button-list-more .more");

    if (await more.isVisible()) {
      console.log("➡️ Click See more...");
      await more.click();
      await page.waitForTimeout(1200);
    } else {
      throw new Error("❌ Không tìm thấy version");
    }
  }

  // 👉 vào trang download/{id}
  await page.waitForLoadState("domcontentloaded");

  console.log("⏳ Waiting download button...");

  const btn = page.locator("#detail-download-button");

  await btn.waitFor({
    state: "attached",
    timeout: 30000,
  });

  console.log("✅ Button ready");

  // 🔥 lấy token
  const token = await btn.getAttribute("data-url");

  if (!token
