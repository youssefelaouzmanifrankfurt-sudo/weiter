// src/socket/inventory.js
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Pfad zur Inventardatei
const inventoryFilePath = path.join(__dirname, '../../data/inventory.json');

// Hilfsfunktionen
const loadInventory = () => {
    try {
        if (fs.existsSync(inventoryFilePath)) {
            const data = fs.readFileSync(inventoryFilePath, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        logger.log('error', `Fehler beim Laden des Inventars: ${error.message}`);
        return [];
    }
};

const saveInventory = (inventory) => {
    try {
        fs.writeFileSync(inventoryFilePath, JSON.stringify(inventory, null, 2));
        return true;
    } catch (error) {
        logger.log('error', `Fehler beim Speichern des Inventars: ${error.message}`);
        return false;
    }
};

module.exports = (io, socket) => {
    // Lade aktuelles Inventar
    socket.on('get-inventory-items', () => {
        const inventory = loadInventory();
        socket.emit('inventory-items', inventory);
    });

    // Füge neuen Artikel hinzu
    socket.on('add-inventory-item', (itemData) => {
        try {
            const inventory = loadInventory();
            
            // Erstelle neuen Artikel mit ID und Zeitstempel
            const newItem = {
                id: 'INV-' + Date.now(),
                ...itemData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            inventory.push(newItem);
            
            if (saveInventory(inventory)) {
                // Sende das neue Item an alle verbundenen Clients
                io.emit('inventory-items', inventory);
                socket.emit('inventory-item-added', newItem);
                logger.log('success', `Artikel hinzugefügt: ${newItem.title}`);
            } else {
                socket.emit('error', 'Fehler beim Speichern des Artikels');
            }
        } catch (error) {
            logger.log('error', `Fehler beim Hinzufügen des Artikels: ${error.message}`);
            socket.emit('error', 'Fehler beim Hinzufügen des Artikels');
        }
    });

    // Lösche Artikel
    socket.on('delete-inventory-item', (id) => {
        try {
            const inventory = loadInventory();
            const itemIndex = inventory.findIndex(item => item.id === id);
            
            if (itemIndex !== -1) {
                inventory.splice(itemIndex, 1);
                
                if (saveInventory(inventory)) {
                    // Sende aktualisiertes Inventar an alle Clients
                    io.emit('inventory-items', inventory);
                    socket.emit('inventory-item-deleted', id);
                    logger.log('success', `Artikel gelöscht: ${id}`);
                } else {
                    socket.emit('error', 'Fehler beim Löschen des Artikels');
                }
            } else {
                socket.emit('error', 'Artikel nicht gefunden');
            }
        } catch (error) {
            logger.log('error', `Fehler beim Löschen des Artikels: ${error.message}`);
            socket.emit('error', 'Fehler beim Löschen des Artikels');
        }
    });

    // Aktualisiere Artikel
    socket.on('update-inventory-item', (itemData) => {
        try {
            const inventory = loadInventory();
            const itemIndex = inventory.findIndex(item => item.id === itemData.id);
            
            if (itemIndex !== -1) {
                // Aktualisiere nur die geänderten Felder
                inventory[itemIndex] = {
                    ...inventory[itemIndex],
                    ...itemData,
                    updatedAt: new Date().toISOString()
                };
                
                if (saveInventory(inventory)) {
                    io.emit('inventory-items', inventory);
                    socket.emit('inventory-item-updated', inventory[itemIndex]);
                    logger.log('success', `Artikel aktualisiert: ${itemData.id}`);
                } else {
                    socket.emit('error', 'Fehler beim Aktualisieren des Artikels');
                }
            } else {
                socket.emit('error', 'Artikel nicht gefunden');
            }
        } catch (error) {
            logger.log('error', `Fehler beim Aktualisieren des Artikels: ${error.message}`);
            socket.emit('error', 'Fehler beim Aktualisieren des Artikels');
        }
    });
};