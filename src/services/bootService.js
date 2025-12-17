// src/services/bootService.js
const fs = require('fs');
const path = require('path');
const storage = require('../utils/storage');
const logger = require('../utils/logger');
const systemState = require('../utils/state');
const chatMonitor = require('../scrapers/chat/monitor');
const { connectToBrowser } = require('../scrapers/chat/connection');
const startAutoScan = require('../jobs/scheduler');

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
        sync_interval_minutes: 120,
        max_retries: 3,
        concurrent_scrapes: 5
    };
}

async function startSystem(io, port) {
    const IS_MAIN_SERVER = (String(port) === '3000');

    logger.log('info', '🚀 System-Boot eingeleitet...');

    // 1. Ordner Struktur sicherstellen
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

    if (IS_MAIN_SERVER) {
        // Verwende den konfigurierten Hauptserver-Pfad
        const serverPath = config.main_server_path || './data/';
        if (!fs.existsSync(serverPath)) {
            try { fs.mkdirSync(serverPath, { recursive: true }); } catch(e) {}
        }
    }
    
    // 2. Datenbank Initialisieren
    // Wir nutzen global.adsDB weiter für Kompatibilität
    global.adsDB = storage.loadDB() || [];
    logger.log('success', `📦 Datenbank geladen: ${global.adsDB.length} Einträge.`);

    // 3. Datei-Überwachung (Watcher) starten
    setupFileWatcher(io);

    // 4. Externe Dienste starten
    try { 
        logger.log('info', '🌍 Verbinde mit Browser...');
        await connectToBrowser(); 
    } catch(e) {
        logger.log('warning', 'Browser-Verbindung fehlgeschlagen (nicht kritisch).');
    }
    
    // Chat Monitor
    chatMonitor.startChatMonitor(io);
    logger.log('info', '👀 Chat-Monitor aktiv (Hintergrund-Modus).');

    // 5. System freigeben
    systemState.isReady = true;
    logger.log('success', `✅ SYSTEM BEREIT auf Port ${port}`);

    // 6. Auto-Scan starten (Nur Main Server)
    if (IS_MAIN_SERVER) {
        startAutoScan(io);
    }
}

function setupFileWatcher(io) {
    const dbPath = storage.getDbPath();
    if (dbPath && fs.existsSync(path.dirname(dbPath))) {
        let fsWait = false;
        fs.watch(path.dirname(dbPath), (event, filename) => {
            if (filename === 'inventory.json' && event === 'change') {
                if (fsWait) return;
                fsWait = true;
                setTimeout(() => fsWait = false, 500); // Debounce
                
                const newData = storage.loadDB();
                if(newData) { 
                    global.adsDB = newData; 
                    io.emit('update-db-list', global.adsDB); 
                }
            }
        });
    }
}

module.exports = { startSystem };