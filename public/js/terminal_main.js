// public/js/terminal_main.js
document.addEventListener("DOMContentLoaded", () => {
    console.log("📱 TERMINAL SCANNER STARTED");

    const socket = window.socket || (typeof io !== 'undefined' ? io() : null);
    if(socket) window.socket = socket;

    // 1. Scanner aktivieren
    if(window.ScanCtrl) {
        // Wir simulieren den "Tab Show" Event, den die alte Logik erwartete
        window.ScanCtrl.onTabShow(); 
        window.ScanCtrl.setMode('search');
    } else {
        console.error("❌ ScanCtrl fehlt! Imports in EJS prüfen.");
    }

    // 2. Eigene Render-Funktion für Scanner-Ergebnisse
    window.renderPriceResults = function(results) {
        const container = document.getElementById('price-results');
        if(!container) return;
        
        container.innerHTML = "";
        
        if(!results || results.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b;">Nichts gefunden.</div>`;
            return;
        }

        results.forEach(item => {
            const div = document.createElement('div');
            div.className = 'result-card';
            div.innerHTML = `
                <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">${item.name || item.title || 'Artikel'}</div>
                <div style="display:flex; justify-content:space-between; color:#ccc; font-size:0.9rem;">
                    <span>Bestand: ${item.quantity || 0}</span>
                    <span>Lagerort: ${item.location || '-'}</span>
                </div>
                <div style="margin-top:5px; color:#3b82f6;">${item.price || item.sellPrice || '0.00'} €</div>
            `;
            // Klick macht das Item zum "aktiven" Item für Aktionen
            div.onclick = () => {
                if(window.ScanCtrl) window.ScanCtrl.handleScanResponse([item]);
            };
            container.appendChild(div);
        });
    };

    // 3. Socket Events
    if(socket) {
        socket.on('price-search-results', (results) => {
            if(window.ScanCtrl) window.ScanCtrl.handleScanResponse(results);
        });

        socket.on('scan-error', (msg) => {
            window.showToast(msg, 'error');
            // Reset Scanner bei Fehler, damit man weiter scannen kann
            if(window.ScanCtrl) window.ScanCtrl.handleNotFound();
        });

        socket.on('scan-success', (item) => {
            window.showToast("Gefunden!", 'success');
            if(window.ScanCtrl) window.ScanCtrl.handleScanResponse([item]);
        });
    }
});