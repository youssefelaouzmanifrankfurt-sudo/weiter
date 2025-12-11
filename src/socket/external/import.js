// src/socket/external/import.js
const storage = require('../../utils/storage');

module.exports = (io, socket) => {

    // ZURÜCK ZUR ABLAGE:
    socket.on('save-external-product', (product) => {
        try {
            // Lade imported.json (NICHT inventory.json)
            const list = storage.loadExternal();
            
            // Prüfen, ob das Produkt (URL) schon in der Liste ist
            const existingItem = list.find(p => p.url === product.url);
            
            if (existingItem) {
                // Update vorhandener Daten (z.B. Preisänderung erkannt durch Scraper)
                Object.assign(existingItem, product);
                existingItem.updatedAt = new Date().toLocaleString();
                console.log(`♻️ [Import] Eintrag in Ablage aktualisiert: ${product.title}`);
            } else {
                // Neu anlegen
                product.importedAt = new Date().toLocaleString();
                if (!product.id) product.id = "IMP-" + Date.now();
                list.push(product);
                console.log(`✅ [Import] In Ablage gespeichert: ${product.title}`);
            }

            storage.saveExternal(list);
            socket.emit('import-success');

        } catch (e) {
            console.error("🔥 [Import] Fehler:", e);
            socket.emit('scrape-error', "Speicherfehler: " + e.message);
        }
    });

    // Liste abrufen (Für die /imported Seite)
    socket.on('get-imported-products', () => {
        try {
            const list = storage.loadExternal();
            socket.emit('update-imported-list', list);
        } catch (e) {
            socket.emit('update-imported-list', []);
        }
    });

    // Eintrag löschen
    socket.on('delete-imported', (idOrUrl) => {
        let list = storage.loadExternal();
        const initialLen = list.length;
        // Löschen nach ID oder URL
        list = list.filter(p => p.id !== idOrUrl && p.url !== idOrUrl);
        
        if (list.length < initialLen) {
            storage.saveExternal(list);
            socket.emit('update-imported-list', list);
        }
    });
};