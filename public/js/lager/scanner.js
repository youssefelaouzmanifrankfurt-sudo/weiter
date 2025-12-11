// public/js/lager/scanner.js
console.log("📷 Scanner Module Loaded (V-Fix)");

window.ScannerModule = (function() {
    let html5QrCode = null;
    let isScanning = false;
    let lastResult = "";
    let lastTime = 0;

    function startCamera(elementId, onScanSuccess) {
        // Sicherheits-Check: Element vorhanden?
        if (!document.getElementById(elementId)) {
            console.error(`❌ Scanner-Element #${elementId} nicht gefunden!`);
            return;
        }

        // Falls schon läuft -> Neustart
        if (isScanning) {
            stopCamera().then(() => startCamera(elementId, onScanSuccess));
            return;
        }

        // Instanz erstellen
        html5QrCode = new Html5Qrcode(elementId);

        const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0 
        };

        html5QrCode.start(
            { facingMode: "environment" }, // Rückkamera bevorzugen
            config,
            (decodedText, decodedResult) => {
                // --- DEBOUNCE LOGIK (Verhindert Doppel-Scans) ---
                const now = Date.now();
                if (decodedText === lastResult && now - lastTime < 2500) {
                    return; // Gleicher Code innerhalb 2.5 Sekunden ignorieren
                }
                
                lastResult = decodedText;
                lastTime = now;
                
                console.log(`📷 Scan erkannt: ${decodedText}`);
                
                // Audio Feedback (optional)
                playSound();

                // Callback an Controller
                if (onScanSuccess) onScanSuccess(decodedText);
            },
            (errorMessage) => {
                // Parsing Fehler ignorieren wir (passiert ständig beim Scannen)
            }
        ).then(() => {
            isScanning = true;
            console.log("✅ Kamera gestartet.");
            document.getElementById(elementId).style.display = "block";
        }).catch(err => {
            console.error("❌ Kamera Start Fehler:", err);
            alert("Kamera konnte nicht gestartet werden. Berechtigung?");
        });
    }

    function stopCamera() {
        return new Promise((resolve) => {
            if (html5QrCode && isScanning) {
                html5QrCode.stop().then(() => {
                    html5QrCode.clear();
                    isScanning = false;
                    console.log("🛑 Kamera gestoppt.");
                    resolve();
                }).catch(err => {
                    console.error("Fehler beim Stoppen:", err);
                    isScanning = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    function playSound() {
        const audio = new Audio('/sounds/notification.mp3'); 
        // Pfad muss existieren, sonst Fehler ignorieren
        audio.play().catch(e => {}); 
    }

    return {
        startCamera,
        stopCamera
    };
})();