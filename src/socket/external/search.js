// src/socket/external/search.js
const logger = require('../../utils/logger');
const priceService = require('../../services/priceService');

module.exports = (io, socket) => {

    // V2 Handler (Scraper UI)
    socket.on('search-external', async (data) => {
        const reqId = "S-" + Date.now().toString().slice(-4);
        
        try {
            const query = (typeof data === 'string' ? data : (data?.query || "")).trim();
            // Default auf 'All' setzen, falls undefined
            const source = data?.source || 'All'; 

            if (!query || query.length < 2) {
                socket.emit('scan-error', 'Suchbegriff zu kurz.');
                socket.emit('external-search-results', { results: [] });
                return;
            }

            logger.log('info', `🔍 [${reqId}] Scraper Start: "${query}" @ ${source}`);

            // HIER DAS UPDATE: source mit übergeben!
            const results = await performSearch(query, source);
            
            logger.log('success', `✅ [${reqId}] Sende ${results.length} Ergebnisse.`);
            socket.emit('external-search-results', { results: results });

        } catch (err) {
            console.error(`🔥 [${reqId}] Fehler:`, err);
            socket.emit('scan-error', 'Fehler: ' + err.message);
            socket.emit('external-search-results', { results: [] });
        }
    });

    // ... (restlicher Code wie Pagination bleibt gleich) ...

    // HELPER UPDATE
    async function performSearch(query, source) {
        if (priceService && typeof priceService.searchMarketPrices === 'function') {
            // Parameter source hinzufügen
            const results = await priceService.searchMarketPrices(query, source);
            return Array.isArray(results) ? results : [];
        } else {
            throw new Error("PriceService Error");
        }
    }
};