// src/utils/storage.js
const fs = require('fs');
const path = require('path');

// Dynamische Konfiguration laden
let config = {};
try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config.json'), 'utf8'));
} catch (error) {
    console.error('Fehler beim Laden der Konfigurationsdatei:', error.message);
    // Fallback-Werte
    config = {
        database_path: './data/anzeigen.db',
        ghost_database_path: './data/ghost_anzeigen.db',
        image_storage_path: './data/images/',
        temp_storage_path: './temp/',
        main_server_path: './data/',
        client_data_path: './data/',
        sync_interval_minutes: 120,
        max_retries: 3,
        concurrent_scrapes: 5
    };
}

const PORT = process.env.PORT || 3000;
const IS_MASTER = (String(PORT) === '3000');
const SERVER_DATA_DIR = config.main_server_path || './data/';
const CLIENT_DATA_DIR = config.client_data_path || './data/'; 
const ACTIVE_PATH = IS_MASTER ? SERVER_DATA_DIR : CLIENT_DATA_DIR;

const MODE = IS_MASTER ? "SERVER (Master)" : "CLIENT (Worker)";
console.log(`[STORAGE] Modus: ${MODE} | Pfad: ${ACTIVE_PATH}`);

// Dateinamen
const DB_PATH = path.join(ACTIVE_PATH, 'inventory.json');
const ARCHIVE_PATH = path.join(ACTIVE_PATH, 'archive.json'); // <-- DAS HAT GEFEHLT
const HISTORY_PATH = path.join(ACTIVE_PATH, 'history.json');
const STOCK_PATH = path.join(ACTIVE_PATH, 'stock.json');
const TASKS_PATH = path.join(ACTIVE_PATH, 'tasks.json');
const SETTINGS_PATH = path.join(ACTIVE_PATH, 'settings.json');
const IMPORTS_PATH = path.join(ACTIVE_PATH, 'imported.json');

function ensureFile(filePath, defaultData = []) {
    if (IS_MASTER && !fs.existsSync(ACTIVE_PATH)) {
        try { fs.mkdirSync(ACTIVE_PATH, { recursive: true }); } catch(e) {}
    }
    if (!fs.existsSync(filePath)) {
        if (IS_MASTER) {
            try { fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2)); } catch (e) {}
        } else {
            return defaultData; 
        }
    }
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return data ? JSON.parse(data) : defaultData;
    } catch (e) { return defaultData; }
}

function saveFile(filePath, data) {
    try {
        if (IS_MASTER && Math.random() > 0.95) {
            try { fs.copyFileSync(filePath, filePath + '.bak'); } catch(e){}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        if (e.message.includes("Invalid string length")) console.error(`[STORAGE] ❌ Zu groß: ${filePath}`);
        else console.error("[STORAGE] Schreibfehler: " + filePath, e.message);
        return false;
    }
}

// NEU: Archiv-Funktion
function appendToArchive(items) {
    if (!items || items.length === 0) return;
    try {
        const currentArchive = ensureFile(ARCHIVE_PATH);
        const newArchive = currentArchive.concat(items);
        if(newArchive.length > 5000) saveFile(ARCHIVE_PATH, newArchive.slice(-5000));
        else saveFile(ARCHIVE_PATH, newArchive);
    } catch(e) { console.error("[STORAGE] Archiv-Fehler:", e.message); }
}

module.exports = {
    getDbPath: () => DB_PATH,
    getDataDir: () => ACTIVE_PATH,
    loadDB: () => ensureFile(DB_PATH),
    saveDB: (data) => saveFile(DB_PATH, data),
    loadHistory: () => ensureFile(HISTORY_PATH),
    saveHistory: (data) => {
        if (Array.isArray(data) && data.length > 3000) data = data.slice(-3000);
        return saveFile(HISTORY_PATH, data);
    },
    loadStock: () => ensureFile(STOCK_PATH),
    saveStock: (data) => saveFile(STOCK_PATH, data),
    loadTasks: () => ensureFile(TASKS_PATH),
    saveTasks: (data) => saveFile(TASKS_PATH, data),
    loadSettings: () => ensureFile(SETTINGS_PATH, {}),
    saveSettings: (data) => saveFile(SETTINGS_PATH, data),
    loadExternal: () => ensureFile(IMPORTS_PATH),
    saveExternal: (data) => saveFile(IMPORTS_PATH, data),
    
    // NEU:
    loadArchive: () => ensureFile(ARCHIVE_PATH),
    appendToArchive: (items) => appendToArchive(Array.isArray(items) ? items : [items])
};