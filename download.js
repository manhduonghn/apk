const https = require("https");
const fs = require("fs");

const TARGET_VERSION = "20.21.37";
const APP_CODE = "16906";
const BASE = "https://youtube.en.uptodown.com/android";

// helper request
function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9",
            ...headers,
          },
        },
        (res) => {
          let data = [];
          res.on("data", (c) => data.push(c));
          res.on("end", () => {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(data),
            });
          });
        }
      )
      .on("error", reject);
  });
}

(async () => {
  let page = 1;
  let versionId = null;

  console.log("➡️ Find versionId via API...");

  // 🔎 loop pages
  while (true) {
    const apiUrl = `${BASE}/apps/${APP_CODE}/versions/${page}`;

    console.log("➡️ Page", page);

    const res = await fetch(apiUrl);
    const json = JSON.parse(res.body.toString());

    if (!json.data || json.data.length === 0) {
      throw new Error("❌ Không tìm thấy version");
    }

    for (const item of json.data) {
      if (item.version === TARGET_VERSION && item.kindFile === "apk") {
        versionId = item.versionURL.versionID;
        console.log("✅ Found versionId:", versionId);
        break;
      }
    }

    if (versionId) break;

    page++;
  }

  // 👉 load trang download
  const pageUrl = `${BASE}/download/${versionId}`;
  console.log("➡️ Fetch download page...");

  const pageRes = await fetch(pageUrl, {
    referer: `${BASE}/versions`,
  });

  const html = pageRes.body.toString();

  // 👉 lấy token
  const match = html.match(/data-url="([^"]+)"/);
  if (!match) throw new Error("❌ Không lấy được token");

  const token = match[1];

  const dwnUrl = `https://dw.uptodown.com/dwn/${token}`;
  console.log("🔗 Token URL:", dwnUrl);

  // 👉 tải file
  const fileName = `youtube-${TARGET_VERSION.replace(/\./g, "-")}.apk`;

  const res = await fetch(dwnUrl, {
    referer: pageUrl,
  });

  // redirect
  if (res.status >= 300 && res.status < 400 && res.headers.location) {
    console.log("➡️ Redirect:", res.headers.location);

    const final = await fetch(res.headers.location);
    fs.writeFileSync(fileName, final.body);
    console.log("✅ Done:", fileName);
    return;
  }

  // direct
  if (res.status === 200) {
    fs.writeFileSync(fileName, res.body);
    console.log("✅ Done:", fileName);
    return;
  }

  throw new Error(`❌ HTTP ${res.status}`);
})();
