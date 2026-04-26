const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // Đặt headless: true nếu không muốn thấy browser
  const page = await browser.newPage();
  
  const targetVersion = '20.21.37';
  const baseUrl = 'https://youtube.en.uptodown.com/android/versions';
  
  try {
    console.log(`Đang tìm phiên bản ${targetVersion}...`);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    
    let foundVersion = false;
    let loadMoreAttempts = 0;
    const maxLoadMoreAttempts = 20;
    
    while (!foundVersion && loadMoreAttempts < maxLoadMoreAttempts) {
      // Tìm tất cả các div chứa thông tin version
      const versionDivs = await page.$$('div[data-version-id]');
      
      for (const div of versionDivs) {
        const versionText = await div.$eval('.version', el => el.textContent.trim()).catch(() => null);
        
        if (versionText === targetVersion) {
          console.log(`Tìm thấy phiên bản ${targetVersion}!`);
          foundVersion = true;
          
          // Lấy data-url và data-extra-url
          const dataUrl = await div.getAttribute('data-url');
          const extraUrl = await div.getAttribute('data-extra-url');
          
          if (dataUrl && extraUrl) {
            // Xây dựng URL download
            const downloadPageUrl = `${dataUrl}/${extraUrl}`;
            console.log(`Đang truy cập trang download: ${downloadPageUrl}`);
            
            await page.goto(downloadPageUrl, { waitUntil: 'networkidle' });
            
            // Tìm và click vào nút download
            // Thử nhiều selector khác nhau
            const downloadButtonSelectors = [
              'button#download-button',
              'a#download-link',
              '.download-button',
              'a[data-url*="download"]',
              'button:has-text("Download")',
              'a:has-text("Download")'
            ];
            
            let downloadClicked = false;
            for (const selector of downloadButtonSelectors) {
              const button = await page.$(selector);
              if (button) {
                console.log(`Tìm thấy nút download với selector: ${selector}`);
                
                // Đợi sự kiện download
                const downloadPromise = page.waitForEvent('download');
                await button.click();
                const download = await downloadPromise;
                
                // Lưu file
                const fileName = `YouTube_${targetVersion}.apk`;
                await download.saveAs(fileName);
                console.log(`Đã tải xuống thành công: ${fileName}`);
                downloadClicked = true;
                break;
              }
            }
            
            if (!downloadClicked) {
              console.log('Không tìm thấy nút download, thử lấy URL download trực tiếp...');
              
              // Tìm URL download trong các thẻ script hoặc meta
              const pageContent = await page.content();
              const downloadUrlMatch = pageContent.match(/https:[^"]*\.apk[^"]*/i);
              if (downloadUrlMatch) {
                console.log(`Tìm thấy URL download: ${downloadUrlMatch[0]}`);
                // Có thể dùng cách khác để tải file
              }
            }
          }
          break;
        }
      }
      
      if (!foundVersion) {
        // Kiểm tra và click nút "See more" nếu có
        const seeMoreButton = await page.$('#button-list-more .more, .see-more, button:has-text("See more")');
        if (seeMoreButton && loadMoreAttempts < maxLoadMoreAttempts) {
          console.log(`Nhấn "See more" lần ${loadMoreAttempts + 1}...`);
          await seeMoreButton.click();
          await page.waitForTimeout(2000); // Đợi nội dung tải
          await page.waitForLoadState('networkidle');
          loadMoreAttempts++;
        } else {
          console.log('Không còn nút "See more" hoặc đã đạt giới hạn số lần nhấn');
          break;
        }
      }
    }
    
    if (!foundVersion) {
      console.log(`Không tìm thấy phiên bản ${targetVersion} sau khi tìm kiếm.`);
    }
    
  } catch (error) {
    console.error('Có lỗi xảy ra:', error);
  } finally {
    await browser.close();
  }
})();
