const https = require("https");
const fs = require("fs");

const TARGET_VERSION = "20.21.37";
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
              body: Buffer.concat(data).toString(),
            });
          });
        }
      )
      .on("error", reject);
  });
}

(async () => {
  console.log("➡️ Fetch first page...");

  // 👉 1. load trang versions
  let html = (await fetch(`${BASE}/versions`)).body;

  let versionId = null;

  // 👉 2. loop tìm version + load more
  while (true) {
    // tìm block có version
    const regex =
      /data-version-id="(\d+)"[\s\S]*?<span class="version">([^<]+)<\/span>/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
      const id = match[1];
      const ver = match[2].trim();

      if (ver === TARGET_VERSION) {
        versionId = id;
        console.log("✅ Found versionId:", versionId);
        break;
      }
    }

    if (versionId) break;

    // 👉 tìm "See more"
    const moreMatch = html.match(/id="button-list-more"[^>]*data-url="([^"]*)"/);

    if (!moreMatch || !moreMatch[1]) {
      throw new Error("❌ Không tìm thấy version");
    }

    const moreUrl = moreMatch[1];
    console.log("➡️ Load more:", moreUrl);

    const moreRes = await fetch(moreUrl, {
      referer: `${BASE}/versions`,
    });

    html += moreRes.body; // append thêm dữ liệu
  }

  // 👉 3. vào trang download
  const pageUrl = `${BASE}/download/${versionId}`;

  console.log("➡️ Fetch download page...");
  const page = await fetch(pageUrl, {
    referer: `${BASE}/versions`,
  });

  // 👉 4. lấy token
  const tokenMatch = page.body.match(/data-url="([^"]+)"/);

  if (!tokenMatch) throw new Error("❌ Không lấy được token");

  const token = tokenMatch[1];

  const dwnUrl = `https://dw.uptodown.com/dwn/${token}`;

  console.log("🔗 Token URL:", dwnUrl);

  // 👉 5. tải file
  const res = await fetch(dwnUrl, {
    referer: pageUrl,
  });

  // redirect
  if (res.status >= 300 && res.status < 400 && res.headers.location) {
    console.log("➡️ Redirect:", res.headers.location);

    const final = await fetch(res.headers.location);
    const fileName = `youtube-${TARGET_VERSION}.apk`;

    fs.writeFileSync(fileName, final.body);
    console.log("✅ Done:", fileName);
    return;
  }

  // direct
  if (res.status === 200) {
    const fileName = `youtube-${TARGET_VERSION}.apk`;

    fs.writeFileSync(fileName, res.body);
    console.log("✅ Done:", fileName);
    return;
  }

  throw new Error(`❌ HTTP ${res.status}`);
})();
