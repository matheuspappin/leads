const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.google.com/maps/search/estetica+porto+alegre');
    await page.waitForSelector('div[role="feed"]');
    
    const results = await page.$$eval('div[role="feed"] > div > div > a', nodes => nodes.map(n => ({name: n.getAttribute('aria-label'), url: n.href})));
    console.log('Found leads:', results.length);
    
    if(results.length > 0) {
        await page.goto(results[0].url);
        await page.waitForTimeout(3000);
        
        const data = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('button[aria-label]'));
            return els.map(el => el.getAttribute('aria-label')).filter(l => l.toLowerCase().includes('avaliaç') || l.toLowerCase().includes('comentár'));
        });
        console.log('Button labels:', data);
    }
    
    await browser.close();
})();
