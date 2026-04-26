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

  // 🧠 bypass webdriver + hide cookie overlay
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

  // 🍪 backup: click accept nếu có
  try {
    const acceptBtn = page.locator(
      'button:has-text("Accept"), button:has-text("Accept all")'
    );
    if (await acceptBtn.isVisible({ timeout: 5000 })) {
      console.log("🍪 Accept cookies...");
      await acceptBtn.click();
    }
  } catch {}

  // 🔎 tìm version + click more
  let found = false;

  while (!found) {
    const item = page.locator(
      `div:has(span.version:has-text("${TARGET_VERSION}"))`
    );

    if ((await item.count()) > 0) {
      console.log("✅ Found version");

      await item.first().click({ force: true }); // 🔥 fix bị overlay block
      found = true;
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

  if (!token) throw new Error("❌ Không lấy được token");

  const downloadUrl = `https://dw.uptodown.com/dwn/${token}`;
  console.log("🔗 Token URL:", downloadUrl);

  // 👉 follow redirect → APK
  https.get(downloadUrl, (res) => {
    let finalUrl = res.headers.location;

    // ⚡ handle multi redirect
    if (!finalUrl) {
      throw new Error("❌ Không có redirect");
    }

    console.log("➡️ Redirect 1:", finalUrl);

    https.get(finalUrl, (res2) => {
      if (res2.headers.location) {
        finalUrl = res2.headers.location;
        console.log("➡️ Redirect 2:", finalUrl);
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
  });
})();
