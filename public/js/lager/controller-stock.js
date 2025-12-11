// public/js/lager/controller-stock.js
console.log("🛠️ Controller Stock Loaded (V14 - All-in-One)");

// Globale Variablen für das Modal
window.tempCompetitors = [];
window.currentEditId = null;

// --- 1. PREIS & KALKULATION (45% Regel) ---
window.autoCalcEK = function() {
    const marketInp = document.getElementById('inp-market-price');
    const ekInp = document.getElementById('inp-price');
    
    if (marketInp && ekInp) {
        // Komma zu Punkt konvertieren für Berechnung
        let valStr = marketInp.value.replace(',', '.');
        const marketVal = parseFloat(valStr) || 0;
        
        if (marketVal > 0) {
            const ek = marketVal * 0.45;
            ekInp.value = ek.toFixed(2);
            
            // Optional: Profit Badge aktualisieren
            updateProfitBadge(marketVal, ek);
        }
    }
};

function updateProfitBadge(market, ek) {
    const badge = document.getElementById('profit-badge');
    if(badge) {
        const win = market - ek; // Vereinfacht (ohne Gebühren/Steuer)
        const margin = (win / market) * 100;
        badge.style.display = 'block';
        badge.innerHTML = `Gewinn: ${win.toFixed(2)} € (${margin.toFixed(0)}%) <small>*Brutto</small>`;
        badge.style.borderColor = margin > 30 ? '#10b981' : '#f59e0b';
        badge.style.color = margin > 30 ? '#10b981' : '#f59e0b';
    }
}

// --- 2. PREIS SUCHE & BEOBACHTEN ---
window.startPriceSearch = function() {
    const title = document.getElementById('inp-title').value;
    const sku = document.getElementById('inp-sku').value;
    const query = title || sku;

    if (!query) {
        if(window.showToast) window.showToast("Bitte Titel oder SKU eingeben.", "error");
        return;
    }

    const resDiv = document.getElementById('modal-price-results');
    if(resDiv) {
        resDiv.style.display = 'block';
        resDiv.innerHTML = '<div style="padding:10px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Suche Preise...</div>';
    }

    console.log("🔍 Starte Suche für:", query);
    if(window.socket) {
        window.socket.emit('search-product-prices', { query: query });
    }
};

// Wird von Main.js aufgerufen, wenn Ergebnisse kommen
window.renderModalSearchResults = function(results) {
    const container = document.getElementById('modal-price-results');
    if(!container) return;
    
    container.style.display = 'block';
    container.innerHTML = "";

    if(!results || results.length === 0) {
        container.innerHTML = '<div style="padding:10px; text-align:center;">Keine Treffer.</div>';
        return;
    }

    // Header mit Schließen Button
    const header = document.createElement('div');
    header.style.cssText = "display:flex; justify-content:space-between; margin-bottom:10px; font-size:0.8rem; color:#94a3b8;";
    header.innerHTML = `<span>${results.length} Ergebnisse</span> <span onclick="document.getElementById('modal-price-results').style.display='none'" style="cursor:pointer;">Schließen [x]</span>`;
    container.appendChild(header);

    results.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:8px; margin-bottom:5px; border-radius:6px; border:1px solid #334155;";
        
        const price = parseFloat(item.price || 0).toFixed(2);
        
        row.innerHTML = `
            <div style="flex:1; overflow:hidden;">
                <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
                <div style="font-size:0.8rem; color:#94a3b8;">${item.source || 'Idealo'} • <span style="color:#10b981;">${price} €</span></div>
            </div>
            <div style="display:flex; gap:5px;">
                <button class="btn-mini" style="background:#3b82f6; padding:5px 10px;" title="Preis übernehmen">
                    <i class="fas fa-check"></i>
                </button>
                <button class="btn-mini" style="background:#f59e0b; padding:5px 10px;" title="Beobachten">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;

        // Event Listeners
        // A) Preis übernehmen
        row.querySelector('.btn-mini[title="Preis übernehmen"]').onclick = () => {
            document.getElementById('inp-market-price').value = price;
            window.autoCalcEK(); // Automatisch 45% berechnen
            window.showToast("Marktpreis übernommen!", "success");
        };

        // B) Beobachten (Konkurrent hinzufügen)
        row.querySelector('.btn-mini[title="Beobachten"]').onclick = () => {
            addCompetitor({
                name: item.source || 'Online',
                price: parseFloat(item.price),
                url: item.link || '#'
            });
            window.showToast("Zu Konkurrenten hinzugefügt", "success");
        };

        container.appendChild(row);
    });
};

function addCompetitor(comp) {
    // Prüfen ob schon da
    const exists = window.tempCompetitors.some(c => c.url === comp.url && c.price === comp.price);
    if(!exists) {
        window.tempCompetitors.push(comp);
        renderCompetitorList(window.tempCompetitors);
    }
}

function renderCompetitorList(list) {
    const el = document.getElementById('competitor-list');
    if(!el) return;

    el.innerHTML = "";
    if(!list || list.length === 0) {
        el.innerHTML = '<div style="color:#64748b; font-size:0.9rem; text-align:center;">Keine Konkurrenten beobachtet.</div>';
        return;
    }

    list.forEach((c, index) => {
        const div = document.createElement('div');
        div.style.cssText = "display:flex; justify-content:space-between; font-size:0.9rem; border-bottom:1px solid #334155; padding:5px 0;";
        div.innerHTML = `
            <span>${c.name}: <b>${parseFloat(c.price).toFixed(2)} €</b></span>
            <span style="cursor:pointer; color:#ef4444;" onclick="window.removeCompetitor(${index})">&times;</span>
        `;
        el.appendChild(div);
    });
}

// Global verfügbar machen
window.removeCompetitor = (index) => {
    window.tempCompetitors.splice(index, 1);
    renderCompetitorList(window.tempCompetitors);
};


// --- 3. MODAL ÖFFNEN / SCHLIEẞEN ---
window.openCreateModal = function(id = null) {
    console.log("📝 Öffne Modal. ID:", id);

    // Reset UI
    const fields = ['edit-id', 'inp-title', 'inp-sku', 'inp-market-price', 'inp-price', 'inp-location', 'inp-image'];
    fields.forEach(f => {
        const el = document.getElementById(f);
        if(el) el.value = "";
    });
    
    // Reset Lists & Results
    window.tempCompetitors = [];
    renderCompetitorList([]);
    const resDiv = document.getElementById('modal-price-results');
    if(resDiv) { resDiv.innerHTML = ''; resDiv.style.display = 'none'; }
    if(document.getElementById('profit-badge')) document.getElementById('profit-badge').style.display = 'none';

    // Falls Editieren: Daten laden
    if (id) {
        window.currentEditId = id;
        // Wir holen die Daten aus dem DOM oder Cache (Voraussetzung: view.js speichert window.currentStockItems)
        const items = window.currentStockItems || [];
        const item = items.find(i => i.id === id);
        
        if (item) {
            document.getElementById('edit-id').value = item.id;
            document.getElementById('inp-title').value = item.title || "";
            document.getElementById('inp-sku').value = item.sku || "";
            document.getElementById('inp-location').value = item.location || "";
            
            // Preise
            const market = parseFloat(item.marketPrice) || 0;
            const ek = parseFloat(item.price) || 0;
            
            document.getElementById('inp-market-price').value = market > 0 ? market.toFixed(2) : "";
            document.getElementById('inp-price').value = ek > 0 ? ek.toFixed(2) : "";
            
            if(market > 0 && ek > 0) updateProfitBadge(market, ek);

            // Menge
            const qty = item.qty || item.quantity || 1;
            if(document.getElementById('inp-qty')) document.getElementById('inp-qty').value = qty;

            // Konkurrenten laden
            if(item.competitors && Array.isArray(item.competitors)) {
                window.tempCompetitors = JSON.parse(JSON.stringify(item.competitors));
                renderCompetitorList(window.tempCompetitors);
            }
        }
    } else {
        window.currentEditId = null;
        if(document.getElementById('inp-qty')) document.getElementById('inp-qty').value = "1";
    }

    const modal = document.getElementById('item-modal');
    if(modal) {
        modal.classList.add('active');
        setTimeout(() => document.getElementById('inp-title').focus(), 100);
    }
};

window.closeAllModals = function() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
    // Stop Scanner
    if(window.ScannerModule && window.ScannerModule.stopCamera) window.ScannerModule.stopCamera();
};


// --- 4. SPEICHERN ---
window.saveItem = function() {
    const id = document.getElementById('edit-id').value;
    const title = document.getElementById('inp-title').value;

    if (!title) {
        window.showToast("Titel fehlt!", "error");
        return;
    }

    const data = {
        id: id,
        title: title,
        sku: document.getElementById('inp-sku').value,
        marketPrice: parseFloat(document.getElementById('inp-market-price').value) || 0,
        price: parseFloat(document.getElementById('inp-price').value) || 0,
        location: document.getElementById('inp-location').value,
        qty: parseInt(document.getElementById('inp-qty').value) || 1,
        image: document.getElementById('inp-image') ? document.getElementById('inp-image').value : "",
        competitors: window.tempCompetitors
    };

    if (window.socket) {
        if (id) {
            window.socket.emit('update-stock-details', data);
            window.showToast("Aktualisiert", "success");
        } else {
            window.socket.emit('create-new-stock', data);
            window.showToast("Erstellt", "success");
        }
        window.closeAllModals();
        if(window.StockCtrl && window.StockCtrl.loadStock) window.StockCtrl.loadStock();
    } else {
        alert("Keine Verbindung!");
    }
};

window.deleteItemWithId = function(id) {
    if(confirm("Wirklich löschen?")) {
        if(window.socket) window.socket.emit('delete-stock-item', id);
        window.closeAllModals();
    }
};