const https = require("https");
const fs = require("fs");

const TARGET_VERSION = "20.21.37";
const BASE = "https://youtube.en.uptodown.com/android";

// helper
function fetch(url, headers = {}, isBinary = false) {
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
            const buffer = Buffer.concat(data);

            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: isBinary ? buffer : buffer.toString(),
            });
          });
        }
      )
      .on("error", reject);
  });
}

(async () => {
  // 🔥 1. lấy appCode
  console.log("➡️ Fetch versions page...");
  const html = (await fetch(`${BASE}/versions`)).body;

  const codeMatch = html.match(/id="detail-app-name"[^>]*data-code="(\d+)"/);
  if (!codeMatch) throw new Error("❌ Không lấy được appCode");

  const appCode = codeMatch[1];
  console.log("✅ appCode:", appCode);

  // 🔎 2. tìm versionId
  let page = 1;
  let versionId = null;

  while (true) {
    const apiUrl = `${BASE}/apps/${appCode}/versions/${page}`;
    console.log("➡️ API page", page);

    const res = await fetch(apiUrl);
    const json = JSON.parse(res.body);

    if (!json.data || json.data.length === 0) {
      throw new Error("❌ Không tìm thấy version");
    }

    for (const item of json.data) {
      if (item.version === TARGET_VERSION && item.kindFile === "apk") {
        versionId = item.versionURL.versionID;
        console.log("✅ versionId:", versionId);
        break;
      }
    }

    if (versionId) break;
    page++;
  }

  // 🔥 3. lấy token đúng
  const pageUrl = `${BASE}/download/${versionId}`;
  console.log("➡️ Fetch download page...");

  const pageRes = await fetch(pageUrl, {
    referer: `${BASE}/versions`,
  });

  const htmlDownload = pageRes.body;

  // ✅ FIX CHÍNH Ở ĐÂY
  const tokenMatch = htmlDownload.match(
    /id="detail-download-button"[^>]*data-url="([^"]+)"/
  );

  if (!tokenMatch) {
    console.log(htmlDownload.slice(0, 2000)); // debug
    throw new Error("❌ Không lấy được token");
  }

  const token = tokenMatch[1];

  const dwnUrl = `https://dw.uptodown.com/dwn/${token}`;
  console.log("🔗 Token URL:", dwnUrl);

  // 🔥 4. tải file
  const fileName = `youtube-${TARGET_VERSION.replace(/\./g, "-")}.apk`;

  const res = await fetch(
    dwnUrl,
    {
      referer: pageUrl,
      accept: "*/*",
    },
    true // 👈 binary
  );

  // redirect
  if (res.status >= 300 && res.status < 400 && res.headers.location) {
    console.log("➡️ Redirect:", res.headers.location);

    const final = await fetch(res.headers.location, {}, true);
    fs.writeFileSync(fileName, final.body);
    console.log("✅ Done:", fileName);
    return;
  }

  // direct file
  if (res.status === 200) {
    fs.writeFileSync(fileName, res.body);
    console.log("✅ Done:", fileName);
    return;
  }

  throw new Error(`❌ HTTP ${res.status}`);
})();
