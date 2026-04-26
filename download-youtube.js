const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const targetVersion = process.env.TARGET_VERSION || '20.21.37';
  const baseUrl = 'https://youtube.en.uptodown.com/android/versions';
  
  // Tạo thư mục downloads nếu chưa tồn tại
  const downloadDir = path.join(process.cwd(), 'downloads');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
  
  console.log(`[INFO] Target version: ${targetVersion}`);
  console.log(`[INFO] Download directory: ${downloadDir}`);
  
  let browser;
  try {
    // Launch browser với cấu hình đúng cho headless environment
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });
    
    const context = await browser.newContext({
      acceptDownloads: true,
      downloadsPath: downloadDir,
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    console.log(`[INFO] Đang truy cập: ${baseUrl}`);
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
    
    let foundVersion = false;
    let loadMoreAttempts = 0;
    const maxLoadMoreAttempts = 50;
    
    while (!foundVersion && loadMoreAttempts < maxLoadMoreAttempts) {
      // Đợi content load
      await page.waitForTimeout(3000);
      
      // Tìm tất cả các div chứa thông tin version
      const versionDivs = await page.$$('div[data-version-id]');
      console.log(`[INFO] Tìm thấy ${versionDivs.length} phiên bản trên trang (lần nhấn ${loadMoreAttempts})`);
      
      // Lấy tất cả version text
      const versions = [];
      for (const div of versionDivs) {
        const versionEl = await div.$('.version');
        if (versionEl) {
          const versionText = await versionEl.textContent();
          const cleanVersion = versionText.trim();
          versions.push(cleanVersion);
          
          if (cleanVersion === targetVersion) {
            console.log(`[SUCCESS] Tìm thấy phiên bản ${targetVersion}!`);
            foundVersion = true;
            
            // Lấy data-url và data-extra-url
            const dataUrl = await div.getAttribute('data-url');
            const extraUrl = await div.getAttribute('data-extra-url');
            
            if (dataUrl && extraUrl) {
              const downloadPageUrl = `${dataUrl}/${extraUrl}`;
              console.log(`[INFO] Download page URL: ${downloadPageUrl}`);
              
              await page.goto(downloadPageUrl, { waitUntil: 'networkidle', timeout: 30000 });
              await page.waitForTimeout(5000);
              
              // Thử nhiều cách để tìm nút download
              let downloadStarted = false;
              
              // Cách 1: Tìm bằng ID
              const downloadBtn = await page.$('#download-button, #download-link');
              if (downloadBtn) {
                console.log('[INFO] Tìm thấy nút download bằng ID');
                const [download] = await Promise.all([
                  page.waitForEvent('download', { timeout: 30000 }),
                  downloadBtn.click()
                ]);
                const fileName = `YouTube_${targetVersion}.apk`;
                const filePath = path.join(downloadDir, fileName);
                await download.saveAs(filePath);
                console.log(`[SUCCESS] Đã tải: ${filePath}`);
                downloadStarted = true;
              }
              
              // Cách 2: Tìm bằng text
              if (!downloadStarted) {
                const downloadByText = await page.$('button:has-text("Download"), a:has-text("Download")');
                if (downloadByText) {
                  console.log('[INFO] Tìm thấy nút download bằng text');
                  const [download] = await Promise.all([
                    page.waitForEvent('download', { timeout: 30000 }),
                    downloadByText.click()
                  ]);
                  const fileName = `YouTube_${targetVersion}.apk`;
                  const filePath = path.join(downloadDir, fileName);
                  await download.saveAs(filePath);
                  console.log(`[SUCCESS] Đã tải: ${filePath}`);
                  downloadStarted = true;
                }
              }
              
              // Cách 3: Tìm URL trực tiếp trong trang
              if (!downloadStarted) {
                console.log('[INFO] Tìm URL tải trực tiếp...');
                const content = await page.content();
                const urlMatches = content.match(/https:\/\/[^"'\s]*\.apk[^"'\s]*/gi);
                
                if (urlMatches && urlMatches.length > 0) {
                  const apkUrl = urlMatches[0];
                  console.log(`[INFO] Tìm thấy URL: ${apkUrl}`);
                  
                  const response = await page.goto(apkUrl, { waitUntil: 'networkidle' });
                  const buffer = await response.body();
                  const fileName = `YouTube_${targetVersion}.apk`;
                  const filePath = path.join(downloadDir, fileName);
                  fs.writeFileSync(filePath, buffer);
                  console.log(`[SUCCESS] Đã tải từ URL: ${filePath}`);
                  downloadStarted = true;
                }
              }
              
              if (!downloadStarted) {
                console.error('[ERROR] Không thể tìm thấy cách tải file');
              }
            }
            break;
          }
        }
      }
      
      console.log(`[INFO] Các version có trên trang: ${versions.slice(0, 10).join(', ')}...`);
      
      if (!foundVersion) {
        // Tìm và click nút "See more"
        const seeMoreSelectors = [
          '#button-list-more .more',
          '.more:has-text("See more")',
          'div.more',
          'button:has-text("See more")',
          '.see-more'
        ];
        
        let clicked = false;
        for (const selector of seeMoreSelectors) {
          const seeMoreButton = await page.$(selector);
          if (seeMoreButton) {
            const isVisible = await seeMoreButton.isVisible();
            if (isVisible) {
              console.log(`[INFO] Nhấn "See more" lần ${loadMoreAttempts + 1}`);
              await seeMoreButton.click();
              await page.waitForTimeout(3000);
              clicked = true;
              break;
            }
          }
        }
        
        if (!clicked) {
          console.log('[INFO] Không còn nút "See more"');
          break;
        }
        
        loadMoreAttempts++;
      }
    }
    
    if (!foundVersion) {
      console.error(`[ERROR] Không tìm thấy phiên bản ${targetVersion}`);
      process.exit(1);
    }
    
    // Kiểm tra file đã tải
    const files = fs.readdirSync(downloadDir);
    if (files.length === 0) {
      console.error('[ERROR] Không có file nào được tải');
      process.exit(1);
    }
    
    console.log('[SUCCESS] Các file đã tải:');
    files.forEach(file => {
      const stats = fs.statSync(path.join(downloadDir, file));
      console.log(`  - ${file} (${stats.size} bytes)`);
    });
    
  } catch (error) {
    console.error('[ERROR]', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
