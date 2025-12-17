// src/socket/index.js
const chatHandler = require('./chatHandler');
const taskHandler = require('./taskHandler');
const trackingHandler = require('./trackingHandler');
const settingsHandler = require('./settingsHandler');
const externalHandler = require('./external');
const stockHandler = require('./stock');
const inventoryHandler = require('./inventory'); 
const logger = require('../utils/logger');
// WICHTIG: Wir laden jetzt direkt den Store für die Archiv-Funktion
const inventoryService = require('../services/inventoryService'); 
const store = require('../services/inventory/store'); 

let dbScraper = null;
let poster = null;
try {
    dbScraper = require('../scrapers/dbScraper');
    poster = require('../scrapers/poster');
} catch (e) { 
    console.log("⚠️ Scraper-Module optional."); 
}

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log("🔌 Client verbunden:", socket.id);

        try {
            if(chatHandler) chatHandler(io, socket);
            if(taskHandler) taskHandler(io, socket);
            if(trackingHandler) trackingHandler(io, socket);
            if(settingsHandler) settingsHandler(io, socket);
            if(externalHandler) externalHandler(io, socket);
            if(stockHandler) stockHandler(io, socket);
            if(inventoryHandler) inventoryHandler(io, socket);
        } catch (err) { console.error("❌ Handler Fehler:", err.message); }

        // --- DATENBANK EVENTS ---

        socket.on('get-db-products', () => {
            if(inventoryService) socket.emit('update-db-list', inventoryService.getAll());
        });

        // Delete Item (Jetzt SMART über store.js)
        socket.on('delete-db-item', (id) => {
             if(store) {
                 store.deleteItem(id); 
                 io.emit('update-db-list', store.getAll());
                 logger.log('info', `🗑 Item Status geändert/gelöscht: ${id}`);
             }
        });

        // Inaktive löschen (Jetzt SICHER mit Archivierung)
        socket.on('delete-inactive-ads', () => {
            if(!store) return;
            logger.log('info', '🧹 Aufräum-Aktion gestartet...');
            
            const allItems = store.getAll();
            const itemsTrash = allItems.filter(item => 
                item.status !== 'ACTIVE' && 
                item.status !== 'PAUSED' && 
                item.inStock !== true
            );

            if (itemsTrash.length > 0) {
                store.archiveAndRemove(itemsTrash); // <-- Die sichere Funktion
                io.emit('update-db-list', store.getAll());
                logger.log('success', `🧹 Aufgeräumt: ${itemsTrash.length} Items ins Archiv verschoben.`);
            } else {
                logger.log('info', '🧹 Nichts zum Aufräumen gefunden.');
            }
        });

        socket.on('update-item-details', (data) => {
            if(!store || !data.id) return;
            const db = store.getAll();
            const index = db.findIndex(i => i.id === data.id);
            if(index !== -1) {
                db[index].title = data.title || db[index].title;
                db[index].price = data.price || db[index].price;
                db[index].internalNote = data.internalNote || "";
                store.saveAll(db);
                io.emit('update-db-list', db);
                logger.log('info', `✏️ Item aktualisiert: ${data.id}`);
            }
        });

        socket.on('start-db-scrape', async () => {
            if(!dbScraper) return socket.emit('scrape-progress', { error: 'Scraper Modul fehlt' });
            
            logger.log('info', '🔄 DB Scan angefordert.');
            const currentDb = store.getAll(); 
            
            const onProgress = (current, total) => {
                socket.emit('scrape-progress', { current, total: total || (current + 10) });
            };

            try {
                const newAds = await dbScraper.scrapeMyAds(currentDb, onProgress);
                if(newAds) {
                    store.saveAll(newAds);
                    io.emit('update-db-list', newAds);
                    logger.log('success', '✅ DB Scan fertig.');
                }
            } catch (err) {
                logger.log('error', '❌ Scan Fehler: ' + err.message);
                socket.emit('scrape-progress', { error: true });
            }
        });

        // Re-Up mit Archiv-Suche
        socket.on('re-up-item', ({ id }) => {
            if(!poster) return;
            logger.log('info', `🚀 Re-Up Request für ID: ${id}`);
            
            let db = store.getAll();
            let originalItem = db.find(i => i.id === id);

            // FALLBACK: Im Archiv suchen!
            if (!originalItem) {
                const archive = require('../utils/storage').loadArchive();
                originalItem = archive.find(i => i.id === id);
                if(originalItem) logger.log('info', '📦 Aus Archiv wiederhergestellt!');
            }

            if (originalItem) {
                const newId = 'DRAFT-' + Date.now();
                const newItem = { ...originalItem, id: newId, status: 'DRAFT', views: 0 };
                db.push(newItem);
                store.saveAll(db);
                io.emit('update-db-list', db);
                poster.fillAdForm(newItem); 
            }
        });

        socket.on('disconnect', () => {});
    });
};