// src/services/stockService.js
const storage = require('../utils/storage');
const logger = require('../utils/logger');
const { findBestMatch } = require('../utils/similarity');

class StockService {
    constructor() { 
        console.log("[SERVICE] StockService gestartet."); 
        this.cache = null; 
    }
    
    /**
     * Lädt die Daten aus dem Speicher oder Cache
     */
    _load(forceReload = false) { 
        if (!this.cache || forceReload) {
            this.cache = storage.loadStock() || [];
        }
        return this.cache; 
    }

    /**
     * Speichert Daten in Cache und Datei
     */
    _save(data) { 
        this.cache = data; 
        storage.saveStock(data); 
    }

    getAll() { return this._load(); }

    saveAll(data) {
        this._save(data);
    }

    /**
     * Sucht ein Item anhand SKU oder Namen (Fuzzy Search)
     */
    findInStock(name) {
        let stock = this._load();
        if(!name) return null;
        
        // 1. Exakter SKU Match
        const skuMatch = stock.find(i => i.sku && i.sku.toLowerCase() === name.toLowerCase());
        if (skuMatch) return skuMatch;

        // 2. Fuzzy Match auf Titel
        const matchResult = findBestMatch(name, stock);
        if (matchResult.item && matchResult.score > 0.80) {
            return matchResult.item;
        }
        return null;
    }

    checkScanMatch(name) { return this.findInStock(name); }

    /**
     * Aktualisiert die Menge (+/-)
     */
    updateQuantity(id, delta) {
        let stock = this._load();
        const item = stock.find(i => i.id === id);
        
        if (item) {
            // Alte 'qty' Felder migrieren, falls vorhanden
            let currentQty = item.quantity !== undefined ? parseInt(item.quantity) : (parseInt(item.qty) || 0);
            if (isNaN(currentQty)) currentQty = 0;

            let newQty = currentQty + parseInt(delta);
            item.quantity = newQty < 0 ? 0 : newQty;
            
            // Aufräumen: Wir nutzen nur noch 'quantity'
            if(item.qty !== undefined) delete item.qty; 

            this._save(stock);
        }
        return stock;
    }

    incrementQuantity(id) {
        return this.updateQuantity(id, 1);
    }

    /**
     * Hilfsfunktion: Bereinigt Input-Daten (Frontend -> Backend Normalisierung)
     */
    _sanitizeInput(details) {
        return {
            title: details.title || "Unbekannter Artikel",
            // Priorität: quantity -> qty -> 1
            quantity: parseInt(details.quantity) || parseInt(details.qty) || 1,
            location: details.location || "Lager",
            // Priorität: price (EK) -> purchasePrice -> 0
            price: parseFloat(details.price) || parseFloat(details.purchasePrice) || 0,
            marketPrice: parseFloat(details.marketPrice) || 0,
            sku: details.sku || ("SKU-" + Date.now()),
            sourceUrl: details.sourceUrl || "",
            sourceName: details.sourceName || "",
            image: details.image || null,
            competitors: Array.isArray(details.competitors) ? details.competitors : [],
            linkedAdId: details.linkedAdId || null,
            lastPriceCheck: details.lastPriceCheck || null
        };
    }

    createNewItem(name, details = {}) {
        let stock = this._load();
        
        // Input normalisieren
        details.title = name;
        const cleanData = this._sanitizeInput(details);

        const newItem = {
            id: "STOCK-" + Date.now(),
            ...cleanData,
            scannedAt: new Date().toLocaleString()
        };
        
        stock.push(newItem);
        this._save(stock);
        logger.log('info', `Neu im Lager: ${name}`);
        return stock;
    }

    updateDetails(id, data) {
        const stock = this._load();
        const item = stock.find(i => i.id === id);
        
        if (item) {
            // Nur Felder updaten, die im data-Objekt existieren
            if (data.title !== undefined) item.title = data.title;
            if (data.location !== undefined) item.location = data.location;
            if (data.sku !== undefined) item.sku = data.sku;
            if (data.sourceUrl !== undefined) item.sourceUrl = data.sourceUrl;
            if (data.sourceName !== undefined) item.sourceName = data.sourceName;
            if (data.image !== undefined) item.image = data.image;
            if (data.competitors !== undefined) item.competitors = data.competitors;
            if (data.linkedAdId !== undefined) item.linkedAdId = data.linkedAdId;
            
            // Zahlenwerte sicher parsen
            if (data.qty !== undefined) item.quantity = parseInt(data.qty);
            if (data.quantity !== undefined) item.quantity = parseInt(data.quantity);
            
            if (data.price !== undefined) item.price = parseFloat(data.price);
            if (data.marketPrice !== undefined) item.marketPrice = parseFloat(data.marketPrice);

            // Aufräumen alter Felder (Migration on Write)
            if(item.qty !== undefined) delete item.qty;

            this._save(stock);
        }
        return stock;
    }

    delete(id) {
        let stock = this._load();
        const initialLength = stock.length;
        const newStock = stock.filter(i => i.id !== id);
        
        if (newStock.length !== initialLength) {
            this._save(newStock);
            return true;
        }
        return false;
    }
}

module.exports = new StockService();