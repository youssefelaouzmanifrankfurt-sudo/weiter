// public/js/lager/controller-scan.js
console.log("🧠 Scan Controller Loaded (V-Fix)");

window.ScanCtrl = {
    init: function() {
        // Socket Listener registrieren (falls noch nicht geschehen)
        if (window.socket) {
            window.socket.off('scan-success'); // Alte Listener entfernen
            window.socket.off('scan-error');

            window.socket.on('scan-success', (item) => {
                console.log("✅ Backend meldet Treffer:", item.title);
                window.showToast(`Gefunden: ${item.title}`, 'success');
                
                // Automatisch das Edit-Modal öffnen
                if(window.openCreateModal) {
                    window.openCreateModal(item.id);
                }
            });

            window.socket.on('scan-error', (msg) => {
                console.warn("⚠️ Backend meldet:", msg);
                window.showToast(msg, 'error');
                
                // Optional: Frage User ob er neu anlegen will
                if(confirm(`${msg}\nAls neuen Artikel anlegen?`)) {
                    if(window.openCreateModal) window.openCreateModal();
                    // Titel vorbefüllen mit dem Scan-Code?
                    setTimeout(() => {
                        const titleInp = document.getElementById('inp-title');
                        // Wir haben den Code hier nicht direkt griffbereit im Scope, 
                        // könnte man über eine Variable lösen.
                        if(titleInp) titleInp.focus();
                    }, 500);
                }
            });
        }
    },

    onTabShow: function() {
        console.log("👁️ Scan Tab aktiv -> Starte Kamera");
        // Startet Kamera im Div mit ID 'reader'
        // Callback Funktion: Was tun mit dem Code?
        window.ScannerModule.startCamera('reader', (code) => {
            this.processScan(code);
        });
    },

    onTabHide: function() {
        console.log("zzz Scan Tab inaktiv -> Stoppe Kamera");
        window.ScannerModule.stopCamera();
    },
    
    stopQR: function() {
        window.ScannerModule.stopCamera();
    },

    processScan: function(code) {
        if (!code) return;
        
        console.log("📡 Sende Scan an Backend:", code);
        if (window.socket) {
            window.socket.emit('check-scan-match', code);
        } else {
            alert("Keine Server-Verbindung!");
        }
    },
    
    // Legacy Support falls main.js alte Methode ruft
    handleScanResponse: function(results) {
        // Wird jetzt meist direkt über socket.on('scan-success') oben gelöst
        console.log("Legacy Response Handler:", results);
    },
    
    handleNotFound: function() {
        window.showToast("Kein Treffer.", "error");
    }
};

// Initialisierung bei Load
document.addEventListener("DOMContentLoaded", () => {
    window.ScanCtrl.init();
});