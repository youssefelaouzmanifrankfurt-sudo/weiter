// src/scrapers/baurScraper.js
const { getBrowser } = require('./chat/connection');
const logger = require('../utils/logger');

const randomSleep = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

async function searchBaur(query) {
    const browser = await getBrowser();
    if (!browser) return [];
    
    let page = null;
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // FIX: URL-Struktur angepasst (Dein Hinweis: /s/...)
        // Wir ersetzen Leerzeichen durch +, da Baur das so mag (z.B. super+eco)
        const safeQuery = encodeURIComponent(query).replace(/%20/g, '+');
        const searchUrl = `https://www.baur.de/s/${safeQuery}`;
        
        console.log(`[Baur] Navigiere zu: ${searchUrl}`);
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Cookie Banner wegklicken (aggressiver)
        try {
            const btn = await page.waitForSelector('#onetrust-accept-btn-handler', {timeout: 3000});
            if(btn) {
                await btn.click();
                await randomSleep(500, 1000); // Kurz warten bis Banner weg ist
            }
        } catch(e) {
            // Kein Banner ist auch okay
        }

        const results = await page.evaluate(() => {
            const data = [];
            // Wir suchen nach Artikel-Containern
            const items = document.querySelectorAll('article.product-tile, div.product-tile, .product-tile');
            
            items.forEach(item => {
                const titleEl = item.querySelector('.product-tile__name, [data-test="product-title"]');
                const priceEl = item.querySelector('.product-price__regular, .product-price__reduced, .price');
                const imgEl = item.querySelector('img');
                const linkEl = item.querySelector('a');
                
                if (titleEl && linkEl) {
                    let price = "0,00 €";
                    if(priceEl) {
                        price = priceEl.innerText.trim();
                        // Preis säubern: "29,99 €" -> sicherstellen
                        const match = price.match(/[\d.,]+/);
                        if(match) price = match[0] + " €";
                    }

                    // Bildquelle finden (oft lazy loaded in data-src)
                    let imgSrc = "";
                    if(imgEl) imgSrc = imgEl.dataset.src || imgEl.src || "";

                    data.push({
                        title: titleEl.innerText.trim(),
                        price: price,
                        img: imgSrc,
                        url: linkEl.href,
                        source: 'Baur'
                    });
                }
            });
            return data;
        });
        
        console.log(`[Baur] Gefundene Artikel: ${results.length}`);
        return results;

    } catch(e) {
        logger.log('error', `[Baur Search] Fehler: ${e.message}`);
        return [];
    } finally {
        if(page) await page.close().catch(()=>{});
    }
}

async function scrapeBaurDetails(url) {
    const browser = await getBrowser();
    let page = null;
    
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // Cookie Banner
        try {
             const btn = await page.waitForSelector('#onetrust-accept-btn-handler', {timeout: 3000});
             if(btn) await btn.click();
        } catch(e){}

        const details = await page.evaluate(() => {
            const getText = (s) => document.querySelector(s)?.innerText.trim() || '';
            
            const title = getText('h1, [data-test="product-title"]');
            let price = getText('.product-price__regular, .product-price__reduced, .price-wrapper') || "0,00 €";
            
            // Preis säubern
            const pMatch = price.match(/[\d.,]+/);
            if(pMatch) price = pMatch[0] + " €";

            // Bilder sammeln
            const images = [];
            document.querySelectorAll('.gallery__image, .product-gallery img').forEach(img => {
                const src = img.dataset.src || img.src;
                if(src && !src.includes('base64')) images.push(src.split('?')[0]);
            });

            const description = getText('.product-description, [itemprop="description"]');
            
            return { title, price, description, images, url: document.location.href };
        });

        return details;

    } catch(e) {
        logger.log('error', `[Baur Detail] Fehler: ${e.message}`);
        return null;
    } finally {
        if(page) await page.close().catch(()=>{});
    }
}

module.exports = { searchBaur, scrapeBaurDetails };