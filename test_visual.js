const puppeteer = require('puppeteer');
const path = require('path');

const artifactDir = '/Users/m-kamata/.gemini/antigravity/brain/58578107-27f1-47eb-b07d-b1020189800b';
const indexPath = path.join(__dirname, 'index.html');
const fileUrl = `file://${indexPath}`;

async function runTests() {
  console.log('Starting visual validation with console logs...');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Catch browser-side console logs and errors
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));

    console.log('Capturing Screenshot 1: Desktop Initial view...');
    await page.screenshot({ path: path.join(artifactDir, 'screenshot_1_dark.png') });

    // Print theme status before toggle
    const themeBefore = await page.evaluate(() => {
      return {
        dataTheme: document.documentElement.getAttribute('data-theme'),
        colorScheme: document.documentElement.style.colorScheme
      };
    });
    console.log('Theme before toggle:', themeBefore);

    console.log('Toggling theme to light mode...');
    await page.click('#theme-toggle');
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));

    // Print theme status after toggle
    const themeAfter = await page.evaluate(() => {
      return {
        dataTheme: document.documentElement.getAttribute('data-theme'),
        colorScheme: document.documentElement.style.colorScheme
      };
    });
    console.log('Theme after toggle:', themeAfter);

    console.log('Capturing Screenshot 2: Desktop Light theme...');
    await page.screenshot({ path: path.join(artifactDir, 'screenshot_2_light.png') });

    // Test text editing
    await page.focus('#markdown-textarea');
    await page.keyboard.down('Meta');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Meta');
    await page.keyboard.press('Backspace');
    await page.type('#markdown-textarea', '# Edited Content\n- item 1\n- item 2');
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 800)));

    console.log('Capturing Screenshot 3...');
    await page.screenshot({ path: path.join(artifactDir, 'screenshot_3_edit.png') });

    // Mobile view
    await page.setViewport({ width: 375, height: 667 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
    await page.click('#tab-preview');
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    console.log('Capturing Screenshot 4...');
    await page.screenshot({ path: path.join(artifactDir, 'screenshot_4_mobile.png') });

  } catch (err) {
    console.error('Visual test failed:', err);
  } finally {
    await browser.close();
    console.log('Visual test process completed.');
  }
}

runTests();
