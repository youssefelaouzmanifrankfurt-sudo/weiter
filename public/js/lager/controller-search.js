// public/js/lager/controller-search.js
console.log("🔎 CONTROLLER-SEARCH GELADEN (V13 - Price Fix)");

// --- SUCHE STARTEN (Aus dem Modal) ---
window.startPriceSearch = function() {
    const socket = window.socket;
    if (!socket) return window.showToast ? window.showToast("Keine Verbindung!", "error") : alert("Kein Socket!");
    
    const query = document.getElementById('inp-title').value;
    if(!query || query.length < 2) {
        if(window.showToast) window.showToast("Bitte Titel eingeben", "warning");
        return; 
    }

    const list = document.getElementById('modal-price-results');
    if(list) {
        list.style.display = 'block';
        list.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8;"><div class="spinner"></div><br>Durchsuche Händler nach "${query}"...</div>`;
    }
    
    console.log("🔍 Sende Suchanfrage:", query);
    socket.emit('search-external', { query: query, source: 'All' });
};

window.findSets = function() {
     const query = document.getElementById('inp-title').value;
     if(query) {
         document.getElementById('inp-title').value = query + " Set";
         window.startPriceSearch();
     }
};

// --- ERGEBNISSE RENDERN ---
window.renderSearchResultsFromSocket = function(results) {
    console.log("💰 Search Render. Ergebnisse:", results ? results.length : 0);

    let list = null;
    const modal = document.getElementById('item-modal');
    
    // Ziel-Container wählen
    if (modal && modal.classList.contains('active')) {
        list = document.getElementById('modal-price-results');
    } else {
        list = document.getElementById('price-results');
    }

    if(!list) return;
    list.style.display = 'block';

    if(!results || results.length === 0) {
        list.innerHTML = '<div style="padding:10px; text-align:center; color:#94a3b8;">Nichts gefunden.</div>';
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
    
    results.forEach(res => {
        // SICHERHEIT: Alle Strings escapen, damit das Onclick nicht bricht
        const safeTitle = (res.title || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeUrl = (res.link || res.url || "#").replace(/'/g, "\\'");
        const safeImg = (res.image || res.img || "").replace(/'/g, "\\'");
        
        // PREIS: Wir säubern den Preis hier noch nicht visuell, aber für die Übergabe
        let displayPrice = res.price || "0,00 €";
        // SafePrice für JS-Funktion (nur einfache Anführungszeichen escapen)
        const safePriceArg = displayPrice.replace(/'/g, "\\'"); 
        
        const sourceName = res.source || "Web";

        html += `
        <div class="search-result-card" style="display:flex; align-items:center; background:#0f172a; padding:10px; border-radius:6px; border:1px solid #334155;">
            <img src="${res.image || '/img/placeholder.png'}" 
                 onerror="this.style.display='none'"
                 style="width:40px; height:40px; object-fit:cover; border-radius:4px; margin-right:10px; background:#1e293b;">
            
            <div style="flex:1; overflow:hidden;">
                <a href="${safeUrl}" target="_blank" style="font-weight:bold; color:white; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; text-decoration:none;">
                    ${res.title} 🔗
                </a>
                <div style="color:#94a3b8; font-size:0.75rem;">${sourceName}</div>
            </div>

            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                <div style="font-weight:bold; color:#f59e0b;">${displayPrice}</div>
                
                <div style="display:flex; gap:5px;">
                    <button type="button" onclick="window.watchResult('${sourceName}', '${safePriceArg}', '${safeUrl}')" 
                        title="Nur beobachten"
                        style="background:#334155; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                        👁
                    </button>

                    <button type="button" onclick="window.adoptResult('${safeTitle}', '${safePriceArg}', '${safeUrl}', '${sourceName}', '${safeImg}')"
                        title="Übernehmen (Auto 45% EK)"
                        style="background:#3b82f6; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                        Übernehmen
                    </button>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    list.innerHTML = html;
};

// --- LOGIK: BEOBACHTEN & ÜBERNEHMEN ---

window.watchResult = function(source, priceStr, url) {
    let val = parsePrice(priceStr);
    addCompetitorToWatchlist(source, val, url);
    if(window.showToast) window.showToast(`"${source}" beobachtet`, 'success');
};

window.adoptResult = function(title, priceStr, url, source, img) {
    // Debugging, falls es wieder klemmt
    console.log("Adopt Result:", {title, priceStr});

    if(title) document.getElementById('inp-title').value = title;
    
    // Preis parsen mit verbesserter Logik
    let marketPrice = parsePrice(priceStr);
    
    if(marketPrice > 0) {
        document.getElementById('inp-market-price').value = marketPrice.toFixed(2);
        
        // Falls wir den Kalkulator-Fix haben, diesen triggern
        if(window.updateCalculatorBase) {
            window.updateCalculatorBase();
        } else {
            // Fallback: Manuell rechnen
            const ek = marketPrice * 0.45;
            document.getElementById('inp-price').value = ek.toFixed(2);
        }
    } else {
        console.warn("⚠️ Konnte Preis nicht parsen:", priceStr);
        window.showToast("Preisformat nicht erkannt: " + priceStr, "warning");
    }

    if(img) document.getElementById('inp-image').value = img;
    document.getElementById('inp-source-url').value = url;
    document.getElementById('inp-source-name').value = source;

    addCompetitorToWatchlist(source, marketPrice, url);
    
    // Ergebnisse ausblenden
    const list1 = document.getElementById('modal-price-results');
    const list2 = document.getElementById('price-results');
    if(list1) list1.style.display = 'none';
    if(list2) list2.style.display = 'none';
    
    if(window.showToast) window.showToast("Daten übernommen", "success");
};

// --- HELPER ---

function parsePrice(priceStr) {
    if (typeof priceStr === 'number') return priceStr;
    if (!priceStr) return 0;

    // 1. Strings wie "1.299,00 €" -> "1299,00"
    // Wir entfernen ALLES außer Zahlen und Komma, ABER wir müssen auf Tausender-Punkte achten.
    // Beste Strategie für DE Format:
    // a) Entferne alles was kein Digit, Punkt oder Komma ist
    // b) Ersetze Punkte (Tausender) durch nichts
    // c) Ersetze Komma durch Punkt
    
    // Hack: Manchmal kommt "12.99" (US) oder "12,99" (DE).
    // Wir gehen davon aus: Wenn ein Komma da ist, ist es das Dezimaltrennzeichen.
    
    let clean = priceStr.toString().replace(/[^0-9.,]/g, '').trim(); 
    
    if(clean.includes(',')) {
        // DE Format: Punkte weg, Komma zu Punkt
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
        // US Format oder reine Zahl: Lassen wie es ist (Zahl oder zB 1299)
        // Aber Achtung: "1.299" könnte Tausend sein.
        // Wir raten: Wenn nur EIN Punkt und danach 2 Stellen sind, ist es Preis (12.99).
        // Wenn 3 Stellen danach sind, ist es Tausender (1.299). 
        // Sicherheitshalber: Im deutschen Kontext sind Punkte meist Tausender, außer es ist klar US.
        // Wir nehmen an: Punkte sind Tausender, außer es gibt kein Komma.
        // Besserer Fix: Regex für Preis am Ende des Strings suchen.
    }

    // Robusterer Regex-Ansatz: Suche nach Zahl am Ende
    const match = priceStr.match(/([\d.]+,\d{2})|(\d+\.\d{2})/);
    if(match) {
        // Wenn wir X,XX gefunden haben
        if(match[0].includes(',')) {
             return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
        }
        return parseFloat(match[0]);
    }
    
    // Fallback auf die einfache Methode
    return parseFloat(clean) || 0;
}

function addCompetitorToWatchlist(name, price, url) {
    if(!window.tempCompetitors) window.tempCompetitors = [];
    // Duplikate vermeiden
    const exists = window.tempCompetitors.find(c => c.url === url);
    if(!exists) {
        window.tempCompetitors.push({ name, price, url, lastCheck: new Date() });
    }
    if(window.renderCompetitorList) window.renderCompetitorList(window.tempCompetitors);
}

window.renderPriceResults = window.renderSearchResultsFromSocket;