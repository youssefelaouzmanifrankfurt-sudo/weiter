// src/services/priceService.js
const logger = require('../utils/logger');

// Scraper Module sicher importieren
let scrapers = {};
const scraperList = ['idealo', 'amazon', 'otto', 'baur', 'expert'];

scraperList.forEach(name => {
    try {
        // Name capitalize für require (z.B. otto -> ottoScraper)
        scrapers[name] = require(`../scrapers/${name}Scraper`);
    } catch (e) {
        logger.log('warn', `⚠️ [PriceService] Scraper '${name}' nicht geladen: ${e.message}`);
    }
});

/**
 * Führt die Suche auf den konfigurierten Marktplätzen aus.
 * @param {string} query - Der Suchbegriff
 * @param {string} source - 'All', 'Otto', 'Amazon', etc.
 */
const searchMarketPrices = async (query, source = 'All') => {
    logger.log('info', `🛒 [PriceService] Suche: "${query}" | Quelle: ${source}`);
    
    let allResults = [];
    const scraperPromises = [];

    // Helper: Promise Wrapper für Fehlerbehandlung pro Scraper
    const runScraper = (scraperObj, method, name) => {
        if (scraperObj && typeof scraperObj[method] === 'function') {
            return scraperObj[method](query).catch(err => {
                logger.log('error', `[${name}] Such-Fehler: ${err.message}`);
                return [];
            });
        }
        return Promise.resolve([]);
    };

    // --- 1. QUELLEN AUSWÄHLEN ---
    
    // IDEALO
    if (source === 'All' || source === 'Idealo') {
        scraperPromises.push(runScraper(scrapers.idealo, 'searchIdealo', 'Idealo')); // Achtung: Methode heißt searchIdealo oder search? Prüfen wir gleich.
        // Falls im idealoScraper die Funktion nur 'search' heißt (wie im alten Code), passen wir das an:
        if(scrapers.idealo && !scrapers.idealo.searchIdealo && scrapers.idealo.searchIdealo) {
             // Fallback falls naming anders
        } else if (scrapers.idealo && scrapers.idealo.search) {
             scraperPromises.push(runScraper(scrapers.idealo, 'search', 'Idealo'));
        } else if (scrapers.idealo && scrapers.idealo.searchIdealo) {
             scraperPromises.push(runScraper(scrapers.idealo, 'searchIdealo', 'Idealo'));
        }
    }

    // AMAZON
    if (source === 'All' || source === 'Amazon') {
        // Im amazonScraper heißt es 'searchAmazon' laut deinem Upload
        scraperPromises.push(runScraper(scrapers.amazon, 'searchAmazon', 'Amazon'));
    }

    // OTTO
    if (source === 'All' || source === 'Otto') {
        // Im ottoScraper heißt es 'searchOtto'
        scraperPromises.push(runScraper(scrapers.otto, 'searchOtto', 'Otto'));
    }

    // BAUR
    if (source === 'All' || source === 'Baur') {
        // Im baurScraper heißt es 'searchBaur'
        scraperPromises.push(runScraper(scrapers.baur, 'searchBaur', 'Baur'));
    }

    // EXPERT
    if (source === 'All' || source === 'Expert') {
        // Im expertScraper heißt es 'searchExpert'
        scraperPromises.push(runScraper(scrapers.expert, 'searchExpert', 'Expert'));
    }

    // --- 2. PARALLELE AUSFÜHRUNG ---
    if (scraperPromises.length > 0) {
        try {
            const results = await Promise.all(scraperPromises);
            allResults = results.flat();
        } catch (err) {
            logger.log('error', `[PriceService] Kritischer Fehler im Promise.all: ${err.message}`);
        }
    }

    // --- 3. FALLBACK / SIMULATION (Nur wenn gar nichts gefunden wurde) ---
    if (allResults.length === 0) {
        logger.log('warn', "⚠️ [PriceService] Keine Live-Daten. Sende Simulation (Dev-Mode).");
        allResults = [
            {
                title: `[DEMO] ${query} (Keine Ergebnisse gefunden)`,
                price: "0,00 €",
                source: "System",
                link: "#",
                image: "https://via.placeholder.com/150?text=No+Result"
            }
        ];
    } else {
        // Sortieren nach Preis (optional, aber user-freundlich)
        // allResults.sort((a, b) => parseFloat(a.price.replace(',', '.')) - parseFloat(b.price.replace(',', '.')));
    }

    logger.log('success', `✅ [PriceService] ${allResults.length} Ergebnisse gefunden.`);
    return allResults;
};

module.exports = {
    searchMarketPrices
};