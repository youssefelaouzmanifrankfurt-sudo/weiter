// src/scrapers/idealoScraper.js
const { getBrowser } = require('./chat/connection');
const logger = require('../utils/logger');

const randomSleep = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

async function searchIdealo(query) {
    const browser = await getBrowser();
    if (!browser) return [];
    
    let page = null;
    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // WICHTIG: Neuerer Chrome User-Agent, um nicht sofort blockiert zu werden
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        console.log(`[Idealo] Starte Suche nach: ${query}`);
        await page.goto(`https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Warten & Scrollen (simuliert Mensch)
        await randomSleep(1000, 2000);
        await page.evaluate(() => window.scrollBy(0, 300));
        await randomSleep(500, 1000);

        // Cookie/Captcha Check (Versuch, simple Overlays zu schließen)
        try {
            const btn = await page.$('#sp-cc-accept'); 
            if(btn) await btn.click();
        } catch(e) {}

        // Wir warten nicht mehr Ewigkeiten auf EINEN Selektor, sondern prüfen, was da ist.
        const results = await page.evaluate(() => {
            const data = [];
            // Sehr breite Auswahl an möglichen Klassen
            const items = document.querySelectorAll('.offerList-item, .product-list-item, [data-wishlist-heart], div[class*="resultList-item"]');
            
            items.forEach(item => {
                // Versuche verschiedene Orte für Titel und Preis zu finden
                const titleEl = item.querySelector('.offerList-item-description-title, span[class*="description"], [class*="title"]');
                const priceEl = item.querySelector('.offerList-item-priceMin, div[class*="price"], span[class*="price"]');
                const linkEl = item.querySelector('a');
                const imgEl = item.querySelector('img');

                if (titleEl && priceEl) {
                    let title = titleEl.innerText.trim();
                    let price = priceEl.innerText.trim();
                    
                    // Preis säubern (entfernt "ab", "Neu", etc.)
                    // Sucht nach Muster "12,99" oder "1.200,00"
                    const pMatch = price.match(/[\d.,]+/);
                    if(pMatch) {
                        price = pMatch[0] + " €";
                    }

                    // Bild
                    let img = "";
                    if(imgEl) img = imgEl.dataset.src || imgEl.src || "";

                    // URL
                    let url = "";
                    if(linkEl) url = linkEl.href;

                    if (title && price && url) {
                        data.push({
                            title: title,
                            price: price,
                            img: img,
                            url: url,
                            source: 'Idealo'
                        });
                    }
                }
            });
            return data;
        });

        console.log(`[Idealo] Ergebnisse: ${results.length}`);
        return results.slice(0, 15);

    } catch (e) {
        logger.log('error', `[Idealo Search] Fehler: ${e.message}`);
        return [];
    } finally {
        if(page) await page.close().catch(() => {});
    }
}

async function scrapeIdealoDetails(url) {
    const browser = await getBrowser();
    let page = null;
    
    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await randomSleep(1000, 2000);

        const details = await page.evaluate(() => {
            const getText = (s) => document.querySelector(s)?.innerText.trim() || '';
            
            const title = getText('h1') || getText('.oop-stage-title');
            
            let price = getText('.productOffers-listItemTitle') || getText('.table-cell-price') || "0,00 €";
            const pMatch = price.match(/[\d.,]+/);
            if(pMatch) price = pMatch[0] + " €";

            const images = [];
            document.querySelectorAll('img').forEach(img => {
                if(img.src && img.src.includes('idealo') && !img.src.includes('base64') && img.width > 200) {
                    images.push(img.src);
                }
            });

            return { title, price, description: "Idealo Vergleich", images: images.slice(0,5), url: document.location.href };
        });

        return details;

    } catch (e) {
        logger.log('error', `[Idealo Detail] Fehler: ${e.message}`);
        return null;
    } finally {
        if(page) await page.close().catch(() => {});
    }
}

module.exports = { searchIdealo, scrapeIdealoDetails };