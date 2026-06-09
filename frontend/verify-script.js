const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  // Screenshot of initial empty state
  await page.screenshot({ path: 'verify-empty-state.png', fullPage: false });
  
  // Check sidebar nav items
  const navItems = await page.$$eval('nav button, nav a', els => els.map(el => el.textContent.trim()));
  console.log('NAV_ITEMS:', JSON.stringify(navItems));
  
  // Check for History item
  const hasHistory = navItems.some(t => t.includes('History'));
  console.log('HAS_HISTORY:', hasHistory);
  
  // Check welcome cards exist and their dimensions
  const cards = await page.$$eval('button', buttons => {
    return buttons
      .filter(b => b.style.minHeight === '64px' || b.offsetHeight >= 60)
      .filter(b => b.textContent.includes('trainings') || b.textContent.includes('consumables') || b.textContent.includes('Waste') || b.textContent.includes('IT support'))
      .map(b => ({ text: b.textContent.trim().substring(0, 50), height: b.offsetHeight }));
  });
  console.log('WELCOME_CARDS:', JSON.stringify(cards));
  
  // Check for quick shortcuts below input (chips)
  const allButtons = await page.$$eval('button', els => els.map(el => el.textContent.trim()));
  const chipLabels = ['Order consumables', 'New employee guide', 'Return materials', 'Broken device', 'Waste disposal'];
  const hasChips = chipLabels.some(label => allButtons.includes(label));
  console.log('HAS_CHIPS:', hasChips);
  
  // Check the background color of main area
  const mainBg = await page.$eval('main', el => window.getComputedStyle(el).backgroundColor);
  console.log('MAIN_BG:', mainBg);
  
  // Check input bar background
  const inputBg = await page.$eval('input[placeholder]', el => {
    const container = el.closest('div[style*="border"]');
    return container ? window.getComputedStyle(container).backgroundColor : 'not found';
  });
  console.log('INPUT_BG:', inputBg);
  
  // Check title font size
  const titleStyle = await page.$eval('div', el => {
    if (el.textContent.trim() === 'Lab Assistant' && el.style.fontSize === '18px') {
      return { fontSize: el.style.fontSize, fontWeight: el.style.fontWeight };
    }
    return null;
  });
  console.log('TITLE_STYLE:', JSON.stringify(titleStyle));
  
  // Check subtitle color
  const subtitleColor = await page.$eval('div', el => {
    if (el.textContent.includes('Ask anything about lab procedures') && el.style.color) {
      return el.style.color;
    }
    return null;
  });
  console.log('SUBTITLE_COLOR:', subtitleColor);
  
  // Check mic button size
  const micBtn = await page.$('button[title="Voice input"]');
  if (micBtn) {
    const micSize = await micBtn.boundingBox();
    console.log('MIC_SIZE:', JSON.stringify(micSize));
  }
  
  // Hover over first card and take screenshot
  const firstCard = await page.$('button[style*="minHeight"]');
  if (firstCard) {
    await firstCard.hover();
    await page.screenshot({ path: 'verify-card-hover.png', fullPage: false });
    console.log('HOVER_SCREENSHOT: done');
  }
  
  await browser.close();
})();
