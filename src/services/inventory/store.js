// src/services/inventory/store.js
const storage = require('../../utils/storage');

const getAll = () => {
    const raw = storage.loadDB();
    if (!Array.isArray(raw)) return [];
    const clean = raw.filter(item => item && item.id);
    if (clean.length !== raw.length) saveAll(clean);
    return clean;
};

const saveAll = (items) => storage.saveDB(items);

// NEU: Erst Papierkorb, dann Archiv
const deleteItem = (id) => {
    let db = getAll();
    const index = db.findIndex(i => i.id === id);
    
    if (index === -1) return db;

    const item = db[index];

    // Wenn bereits als DELETED markiert -> Jetzt wirklich raus und ins Archiv
    if (item.status === 'DELETED') {
        storage.appendToArchive([item]);
        db.splice(index, 1); 
    } else {
        // Sonst nur Status ändern (Soft Delete)
        item.status = 'DELETED';
        item.deletedAt = Date.now();
    }
    
    saveAll(db);
    return db;
};

// NEU: Für den "Aufräumen" Button
const archiveAndRemove = (itemsToRemove) => {
    if(!itemsToRemove || itemsToRemove.length === 0) return;
    
    storage.appendToArchive(itemsToRemove); // Erst sichern
    
    let db = getAll();
    const idsToRemove = new Set(itemsToRemove.map(i => i.id));
    db = db.filter(item => !idsToRemove.has(item.id)); // Dann löschen
    
    saveAll(db);
    return db;
};

const replaceAll = (items) => { saveAll(items); return items; };

module.exports = { getAll, saveAll, deleteItem, replaceAll, archiveAndRemove };