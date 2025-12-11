// src/socket/stock/reader.js
const stockService = require('../../services/stockService');

module.exports = (io, socket) => {

    // 1. Initialer Daten-Load
    socket.on('request-stock-list', () => {
        const data = stockService.getAll();
        socket.emit('stock-list-data', data);
    });

    // 2. SCAN CHECK (Der wichtige Teil für dich)
    socket.on('check-scan-match', (query) => {
        console.log(`🔎 Scan-Check für: "${query}"`);
        
        if(!query) return;

        // Nutzt die verbesserte Suchlogik aus dem stockService
        const match = stockService.checkScanMatch(query);

        if (match) {
            console.log(`✅ Treffer: ${match.title} (${match.id})`);
            socket.emit('scan-success', match);
        } else {
            console.log("⚠️ Kein Treffer im Lager.");
            // Wir senden den Query zurück, damit das Frontend ihn evtl. als Titel nutzen kann
            socket.emit('scan-error', `Artikel "${query}" nicht im Bestand gefunden.`);
        }
    });

    // 3. Suche (Manuelles Tippen)
    socket.on('search-stock', (query) => {
        const all = stockService.getAll();
        if (!query) {
            socket.emit('stock-search-results', all);
            return;
        }
        
        const lower = query.toLowerCase();
        const results = all.filter(item => 
            (item.title && item.title.toLowerCase().includes(lower)) ||
            (item.sku && item.sku.toLowerCase().includes(lower)) ||
            (item.location && item.location.toLowerCase().includes(lower))
        );
        
        socket.emit('stock-search-results', results);
    });
};