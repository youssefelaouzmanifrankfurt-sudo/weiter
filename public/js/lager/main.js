// public/js/lager/main.js

document.addEventListener("DOMContentLoaded", () => {
    console.log("🏰 LAGER MAIN.JS (V10 - Routed)");

    const socket = window.socket || (typeof io !== 'undefined' ? io() : null);
    if(socket) window.socket = socket;

    // Tabs Init
    if(window.initTabs) window.initTabs(); // Falls view.js das bereitstellt
    else if(typeof initTabs === 'function') initTabs(); // Lokaler Fallback

    // SOCKET EVENTS
    if(socket) {
        // SUCHERGEBNISSE
        socket.on('price-search-results', (results) => {
            console.log("🔍 Ergebnisse empfangen:", results.length);

            // FALL 1: MODAL IST OFFEN (User klickt "Preis"-Button im Modal)
            const modal = document.getElementById('item-modal');
            if(modal && modal.classList.contains('active')) {
                if(window.renderModalSearchResults) {
                    window.renderModalSearchResults(results);
                    return; // Stoppen, damit es nicht im Hintergrund-Terminal auftaucht
                }
            }

            // FALL 2: TERMINAL / SCANNER TAB
            // (Falls du im Scanner suchst)
            if(window.ScanCtrl && typeof window.ScanCtrl.handleScanResponse === 'function') {
                window.ScanCtrl.handleScanResponse(results);
            }
        });

        socket.on('stock-update', () => {
             // Wenn vorhanden, Liste neu laden
             if(window.StockCtrl && window.StockCtrl.loadStock) window.StockCtrl.loadStock();
        });

        socket.on('scan-error', (msg) => {
            window.showToast(msg, 'error');
        });

        socket.on('scan-success', (item) => {
            window.showToast(`✅ Gefunden: ${item.title}`, 'success');
        });
    }
});

// Toast Helper
window.showToast = function(msg, type='info') {
    const d = document.createElement('div');
    d.className = `toast-msg ${type}`;
    d.innerText = msg;
    d.style.cssText = "position:fixed; bottom:20px; right:20px; padding:15px; background:#333; color:white; border-radius:8px; z-index:9999; font-weight:bold;";
    if(type==='error') d.style.background = '#ef4444';
    if(type==='success') d.style.background = '#10b981';
    document.body.appendChild(d);
    setTimeout(()=>d.remove(), 3000);
};

// Simple Tab Switcher Fallback
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const t = document.getElementById(tabId);
    if(t) t.style.display = 'block';
    
    // Active Class logic
    const btn = document.querySelector(`button[onclick*="'${tabId}'"]`);
    if(btn) btn.classList.add('active');

    // Trigger Controller Hooks
    if(tabId === 'tab-scan' && window.ScanCtrl) window.ScanCtrl.onTabShow();
    if(tabId !== 'tab-scan' && window.ScanCtrl) window.ScanCtrl.onTabHide();
};