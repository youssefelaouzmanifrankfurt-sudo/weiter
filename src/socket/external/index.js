// src/socket/external/index.js
const search = require('./search');
const details = require('./details');
const imp = require('./import'); // "import" ist reserviert, daher "imp"
const upload = require('./upload');

module.exports = (io, socket) => {
    // WICHTIG: Hier KEIN 'stock' importieren! Das ist der Grund für den Crash.
    
    if(search) search(io, socket);
    if(details) details(io, socket);
    if(imp) imp(io, socket);
    if(upload) upload(io, socket);
};