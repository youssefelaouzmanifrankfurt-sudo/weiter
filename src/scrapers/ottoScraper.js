// src/scrapers/ottoScraper.js
const { getBrowser } = require('./chat/connection');
const logger = require('../utils/logger');

async function searchOtto(query, pageNum = 1) {
    const browser = await getBrowser();
    if (!browser) return [];
    let page = null;

    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        const offset = (pageNum - 1) * 20;
        let searchUrl = `https://www.otto.de/suche/${encodeURIComponent(query)}`;
        if (pageNum > 1) searchUrl += `?o=${offset}`;
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Cookie Accept Versuch
        try {
            const cookieBtn = await page.waitForSelector('#onetrust-accept-btn-handler', {timeout: 2000});
            if(cookieBtn) await cookieBtn.click();
        } catch(e){}
        
        await autoScroll(page);

        const results = await page.evaluate(() => {
            const items = document.querySelectorAll('article.product, .product-tile'); 
            const data = [];
            items.forEach((item) => {
                const titleEl = item.querySelector('.find_tile__name');
                const priceEl = item.querySelector('.find_tile__priceValue') || item.querySelector('.price__value');
                const imgEl = item.querySelector('img.find_tile__productImage');
                const linkEl = item.querySelector('a.find_tile__productLink');
                
                if (titleEl && linkEl) {
                    let imgSrc = '';
                    if (imgEl) {
                        imgSrc = imgEl.src || imgEl.dataset.src || '';
                    }
                    
                    let priceRaw = priceEl ? priceEl.innerText.trim() : '0,00 €';
                    // Bereinigung direkt im Browser-Kontext oder später
                    
                    data.push({
                        title: titleEl.innerText.trim(),
                        price: priceRaw,
                        img: imgSrc,
                        url: linkEl.href,
                        source: 'Otto'
                    });
                }
            });
            return data;
        });

        // Nachbearbeitung (Cleaning) im Node-Kontext
        return results.map(r => {
            // Preis säubern: Alles weg außer Zahlen und Komma, dann Format "X,XX €"
            const match = r.price.match(/[\d.,]+/);
            if(match) {
                // Stelle sicher, dass es wie ein Preis aussieht
                r.price = match[0] + " €";
            }
            return r;
        });

    } catch (e) {
        logger.log('error', '[Otto Search] ' + e.message);
        return [];
    } finally {
        if(page) await page.close().catch(() => {});
    }
}

async function scrapeOttoDetails(url) {
    // Hier hat sich nichts geändert, dein Details-Scraper war okay.
    // Ich übernehme ihn der Vollständigkeit halber, damit die Datei komplett ist.
    const browser = await getBrowser();
    let page = null;
    
    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 }); 
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        try {
            const cookieBtn = await page.waitForSelector('#onetrust-accept-btn-handler', {timeout: 3000});
            if(cookieBtn) await cookieBtn.click();
        } catch(e){}

        const data = await page.evaluate(() => {
            const getText = (sel) => document.querySelector(sel)?.innerText.trim() || '';
            const title = getText('h1'); 
            let price = getText('.p_price__regular') || getText('.js_pdp_price__retail-price__value_') || getText('[data-qa="price"]');
            
            // Description extraction
            let descBuffer = [];
            const listItems = document.querySelectorAll('.js_pdp_selling-points li');
            if(listItems.length > 0) descBuffer.push(Array.from(listItems).map(li => "• " + li.innerText.trim()).join('\n'));
            
            const descContainer = document.querySelector('.js_pdp_description');
            if (descContainer) {
                const paragraphs = descContainer.querySelectorAll('p');
                const fullDesc = Array.from(paragraphs).map(p => p.innerText.trim()).filter(t => t.length > 0).join('\n\n');
                if (fullDesc) descBuffer.push(fullDesc);
            }
            
            // Images
            const foundImages = [];
            document.querySelectorAll('.pdp_main-image__image').forEach(img => {
                if(img.src) foundImages.push(img.src.split('?')[0]);
            });

            return { title, price, description: descBuffer.join('\n\n'), images: foundImages };
        });

        return { ...data, url };

    } catch(e) {
        logger.log('error', `[Otto Detail] Fehler: ${e.message}`);
        return null;
    } finally {
        if(page) await page.close().catch(() => {});
    }
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 200;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if(totalHeight >= scrollHeight || totalHeight > 2000){ 
                    clearInterval(timer); resolve();
                }
            }, 50);
        });
    });
}

module.exports = { searchOtto, scrapeOttoDetails };