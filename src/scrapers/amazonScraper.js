// src/scrapers/amazonScraper.js
const { getBrowser } = require('./chat/connection');
const logger = require('../utils/logger');

const randomSleep = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

async function searchAmazon(query, pageNum = 1) {
    const browser = await getBrowser();
    if (!browser) return [];
    
    let page = null;
    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(`https://www.amazon.de/s?k=${encodeURIComponent(query)}&page=${pageNum}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        try { 
            const cookieBtn = await page.waitForSelector('#sp-cc-accept', {timeout: 2000}); 
            if(cookieBtn) await cookieBtn.click();
        } catch(e){}

        await randomSleep(500, 1500); 

        const results = await page.evaluate(() => {
            const items = document.querySelectorAll('div[data-component-type="s-search-result"]');
            const data = [];
            
            items.forEach(item => {
                const titleEl = item.querySelector('h2 span');
                const linkEl = item.querySelector('div[data-cy="title-recipe"] a') || item.querySelector('h2 a');
                const imgEl = item.querySelector('img.s-image');
                
                let price = "0,00 €";
                
                const whole = item.querySelector('.a-price-whole');
                const fraction = item.querySelector('.a-price-fraction');
                
                if (whole && fraction) {
                    let w = whole.innerText.trim().replace(/[^0-9.]/g, ''); 
                    if(w.endsWith('.')) w = w.slice(0, -1);
                    const f = fraction.innerText.trim();
                    price = `${w},${f} €`;
                } else {
                    const offscreen = item.querySelector('.a-price .a-offscreen');
                    if (offscreen) price = offscreen.innerText.trim();
                }

                if(!price.includes('€') && !price.includes('EUR')) price += ' €';

                if (titleEl && linkEl) {
                    let link = linkEl.href;
                    if(!link.startsWith('http')) link = 'https://www.amazon.de' + link;
                    
                    data.push({
                        title: titleEl.innerText.trim(),
                        price: price,
                        img: imgEl ? imgEl.src : '',
                        url: link,
                        source: 'Amazon'
                    });
                }
            });
            return data;
        });
        
        return results;

    } catch(e) { 
        logger.log('error', `[Amazon Search] Fehler: ${e.message}`);
        return []; 
    } finally {
        if(page) await page.close().catch(() => {});
    }
}

async function scrapeAmazonDetails(url) {
    const browser = await getBrowser();
    let page = null;
    
    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await randomSleep(1500, 3000); 

        // ENERGIELABEL
        let energyLabelUrl = "Unbekannt";
        try {
            energyLabelUrl = await page.evaluate(() => {
                const img = document.querySelector('.s-energy-efficiency-badge-standard img') || 
                            document.querySelector('#energyEfficiencyLabel_feature_div img');
                return img ? img.src : null;
            });

            if(!energyLabelUrl) {
                const badge = await page.$('.s-energy-efficiency-badge-standard, a[href*="energy_efficiency"]');
                if(badge) {
                    await badge.click();
                    await randomSleep(1000, 2000);
                    energyLabelUrl = await page.evaluate(() => {
                        const img = document.querySelector('.a-popover-content img') || document.querySelector('#energy-label-popover img');
                        return img ? img.src : "Unbekannt";
                    });
                }
            }
        } catch(e) {}

        const details = await page.evaluate((eLabel) => {
            const title = document.querySelector('#productTitle')?.innerText.trim();
            if (!title) return null;
            
            let price = '0,00 €';
            const whole = document.querySelector('.a-price-whole');
            const fraction = document.querySelector('.a-price-fraction');
            
            if (whole && fraction) {
                let w = whole.innerText.trim().replace(/[^0-9.]/g, '');
                if(w.endsWith('.')) w = w.slice(0, -1);
                const f = fraction.innerText.trim();
                price = `${w},${f} €`;
            } else {
                const pEl = document.querySelector('.a-price .a-offscreen') || 
                            document.querySelector('#price_inside_buybox');
                if(pEl) price = pEl.innerText.trim();
            }

            const bullets = Array.from(document.querySelectorAll('#feature-bullets li span')).map(el => el.innerText.trim()).join('\n');
            
            const images = [];
            const imgContainer = document.querySelector('#imgTagWrapperId img') || document.querySelector('#landingImage');
            if(imgContainer) {
                const dyn = imgContainer.getAttribute('data-a-dynamic-image');
                if(dyn) {
                    try {
                        const urls = JSON.parse(dyn);
                        Object.keys(urls).forEach(u => images.push(u));
                    } catch(e) { images.push(imgContainer.src); }
                } else {
                    images.push(imgContainer.src);
                }
            }

            const techData = [];
            document.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_db_sections tr').forEach(r => {
                const k = r.querySelector('th')?.innerText.trim();
                const v = r.querySelector('td')?.innerText.trim();
                if(k && v) techData.push(`${k}: ${v}`);
            });

            return { 
                title, price, description: bullets, techData, 
                images: images.slice(0, 15), 
                energyLabel: eLabel, 
                url: document.location.href 
            };
        }, energyLabelUrl);

        if (details && energyLabelUrl && energyLabelUrl !== "Unbekannt") {
            if (!details.images.includes(energyLabelUrl)) {
                if (details.images.length > 0) details.images.splice(1, 0, energyLabelUrl);
                else details.images.push(energyLabelUrl);
            }
        }

        return details;

    } catch(e) { 
        logger.log('error', `[Amazon Detail] Fehler: ${e.message}`);
        return null; 
    } finally {
        if(page) await page.close().catch(() => {});
    }
}

module.exports = { searchAmazon, scrapeAmazonDetails };