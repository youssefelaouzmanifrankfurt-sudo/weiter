// src/socket/external/details.js
const { URL } = require('url');

// Scraper Module importieren
const ottoScraper = require('../../scrapers/ottoScraper');
const idealoScraper = require('../../scrapers/idealoScraper');
const amazonScraper = require('../../scrapers/amazonScraper');
const baurScraper = require('../../scrapers/baurScraper');
const expertScraper = require('../../scrapers/expertScraper');

// Services für den Datenbank-Abgleich
const inventoryService = require('../../services/inventoryService');
const { findBestMatch } = require('../../utils/similarity');

// Helper: Welcher Shop ist das?
function detectSource(urlStr) {
    try {
        const hostname = new URL(urlStr).hostname.toLowerCase();
        if(hostname.includes('otto.de')) return 'Otto';
        if(hostname.includes('idealo.de')) return 'Idealo';
        if(hostname.includes('amazon.de') || hostname.includes('amzn.to')) return 'Amazon';
        if(hostname.includes('baur.de')) return 'Baur';
        if(hostname.includes('expert.de')) return 'Expert';
    } catch(e) {
        return null;
    }
    return null;
}

module.exports = (io, socket) => {
    
    // Event: User klickt auf "Vergleichen" (Lupe)
    socket.on('select-external-product', async (url) => {
        console.log(`[Details] Analysiere URL: ${url}`);
        
        try {
            // 1. Quelle erkennen
            const source = detectSource(url);
            
            if (!source) {
                socket.emit('scrape-error', 'Shop konnte nicht erkannt werden (Unbekannte URL).');
                return;
            }

            // 2. Produktdetails live scrapen
            let externalProduct = null;
            
            // WICHTIG: Hier nutzen wir die korrekten Funktionsnamen
            switch(source) {
                case 'Otto':
                    externalProduct = await ottoScraper.scrapeOttoDetails(url); 
                    break;
                case 'Idealo':
                    externalProduct = await idealoScraper.scrapeIdealoDetails(url);
                    break;
                case 'Amazon':
                    externalProduct = await amazonScraper.scrapeAmazonDetails(url);
                    break;
                case 'Baur':
                    externalProduct = await baurScraper.scrapeBaurDetails(url);
                    break;
                case 'Expert':
                    externalProduct = await expertScraper.scrapeExpertDetails(url);
                    break;
            }

            if (!externalProduct) {
                socket.emit('scrape-error', 'Konnte Produktdetails nicht laden (Seite evtl. blockiert oder leer).');
                return;
            }
            
            // Metadaten ergänzen
            externalProduct.source = source;
            externalProduct.url = url; 

            // 3. Mit lokaler Datenbank vergleichen (Match Score berechnen)
            // Wir holen alle Produkte aus dem Lager
            const allInventory = inventoryService.getAll();
            // Wir suchen das ähnlichste Produkt
            const matchResult = findBestMatch(externalProduct.title, allInventory);
            
            const responseData = {
                external: externalProduct,     // Das frisch gescrapte Produkt
                localMatch: matchResult.item,  // Das beste lokale Produkt (oder null)
                score: matchResult.score       // Übereinstimmung in % (0.0 bis 1.0)
            };

            // 4. Ergebnis an Frontend senden (Modal öffnet sich)
            socket.emit('comparison-result', responseData);

        } catch (error) {
            console.error("[Details] Fehler beim Scrapen:", error);
            socket.emit('scrape-error', 'Fehler bei der Analyse: ' + error.message);
        }
    });
};