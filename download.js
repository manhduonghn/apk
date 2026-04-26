const { chromium } = require("playwright");
const fs = require("fs");

const TARGET_VERSION = "20.21.37";
const BASE_URL = "https://youtube.en.uptodown.com/android/versions";

// 🔥 download bằng browser context (fix 404)
async function downloadWithContext(context, url, fileName) {
  console.log("📥 Download via browser context...");

  const response = await context.request.get(url, {
    headers: {
      referer: "https://youtube.en.uptodown.com/",
    },
  });

  if (!response.ok()) {
    throw new Error(`❌ HTTP ${response.status()}`);
  }

  const buffer = await response.body();
  fs.writeFileSync(fileName, buffer);

  console.log("✅ Download done:", fileName);
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

  // 🧠 bypass bot + remove cookie popup
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
      await item.first().click({ force: true });
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

  if (!token) {
    throw new Error("❌ Không lấy được token");
  }

  const downloadUrl = `https://dw.uptodown.com/dwn/${token}`;

  console.log("🔗 Token URL:", downloadUrl);

  // 📥 tải APK (fix 404 bằng context)
  const fileName = `youtube-${TARGET_VERSION}.apk`;

  await downloadWithContext(context, downloadUrl, fileName);

  await browser.close();
})();
