// src/scrapers/db/index.js
const { getDbPage } = require('../chat/connection');
const logger = require('../../utils/logger');
const { parseListInBrowser } = require('./parsers');

// Module
const nav = require('./navigation');
const merger = require('./merger');
const worker = require('./worker');
const config = require('./config');

async function scrapeMyAds(existingAds = [], progressCallback) {
    const mainPage = await getDbPage();
    
    // SAFETY 1: Browser-Check
    if (!mainPage) {
        logger.log('error', '❌ Scan Fehler: Kein Browser Page vorhanden.');
        return null;
    }

    logger.log('info', `🚀 Scan Start (Auto-Retry aktiv)...`);

    // Init & Login Check
    const isReady = await nav.initPage(mainPage);
    if (!isReady) return null;

    let finalAdsList = []; 
    let pageNum = 1;
    let hasNextPage = true;
    
    // GHOST PROTOCOL INIT: Wir merken uns alle IDs, die wir online finden
    const foundOnlineIds = new Set();

    while (hasNextPage) {
        logger.log('info', `📄 Scanne Seite ${pageNum}...`);
        await nav.forceVisibility(mainPage);

        // A) Liste lesen
        let liveAds = [];
        try {
            liveAds = await mainPage.evaluate(parseListInBrowser);
        } catch(e) {
            logger.log('warn', 'Fehler beim Lesen, versuche Reload...');
            await mainPage.reload({ waitUntil: 'domcontentloaded' });
            liveAds = await mainPage.evaluate(parseListInBrowser);
        }

        // IDs tracken (für den Abgleich später)
        liveAds.forEach(ad => {
            if(ad.id) foundOnlineIds.add(ad.id);
        });

        // B) Mergen & Queue
        const mergedAds = merger.mergeData(liveAds, existingAds);
        const deepScanQueue = merger.identifyMissingDetails(mergedAds);

        // C) Deep Scan (Details nachladen)
        if (deepScanQueue.length > 0) {
            await worker.processQueue(mainPage.browser(), deepScanQueue);
        }

        finalAdsList = finalAdsList.concat(mergedAds);

        // D) Nächste Seite
        hasNextPage = await nav.goToNextPage(mainPage);
        if (hasNextPage) pageNum++;
        
        if(progressCallback) progressCallback(finalAdsList.length, "unbekannt");
    }

    // SAFETY 3: Plausibilitäts-Check bei 0 Treffern
    if (finalAdsList.length === 0 && pageNum === 1) {
         try {
             const noAdsText = await mainPage.evaluate(() => document.body.innerText.includes("Keine Anzeigen"));
             if (!noAdsText) {
                 logger.log('warning', '⚠️ Scan ergab 0 Treffer, aber "Keine Anzeigen" Text fehlt. Sicherheitshalber Abbruch, um DB nicht zu löschen.');
                 return null;
             }
         } catch(e) {}
    }

    // --- GHOST PROTOCOL: Rettung gelöschter Anzeigen ---
    // Hier verhindern wir Datenverlust bei gelöschten Anzeigen
    let rescuedCount = 0;
    
    if (existingAds && Array.isArray(existingAds)) {
        existingAds.forEach(localAd => {
            // Wenn die lokale ID NICHT online gefunden wurde...
            if (localAd.id && !foundOnlineIds.has(localAd.id)) {
                
                // 1. DRAFT-Schutz: Entwürfe sind nie online, also behalten wir sie einfach so
                if (String(localAd.id).startsWith('DRAFT')) {
                    finalAdsList.push(localAd);
                }
                // 2. Ex-Online Anzeigen: Wurden auf der Plattform gelöscht -> Wir behalten sie als DELETED
                else {
                    const preservedAd = { ...localAd };
                    
                    // Status Update nur loggen, wenn es vorher aktiv war
                    if (preservedAd.status === 'ACTIVE' || preservedAd.status === 'PAUSED') {
                        preservedAd.status = 'DELETED'; 
                        logger.log('info', `👻 Anzeige ${preservedAd.id} ist offline -> Lokal gesichert (DELETED).`);
                        rescuedCount++;
                    } else {
                        // War schon deleted oder archiviert -> Status beibehalten
                        preservedAd.status = 'DELETED';
                    }
                    
                    finalAdsList.push(preservedAd);
                }
            }
        });
    }

    if (rescuedCount > 0) {
        logger.log('success', `📦 ${rescuedCount} gelöschte Anzeigen erfolgreich im System gehalten.`);
    }

    logger.log('success', `✅ Fertig! Gesamt ${finalAdsList.length} (Davon Online: ${foundOnlineIds.size})`);
    
    // Aufräumen: Zurück zur Übersicht
    try { await mainPage.goto(config.URL_MY_ADS); } catch(e){}
    
    return finalAdsList;
}

module.exports = { scrapeMyAds };