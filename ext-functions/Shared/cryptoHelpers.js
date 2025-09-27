const crypto = require('crypto');
function sha256Hex(v){ return crypto.createHash('sha256').update(v,'utf8').digest('hex'); }
function randomToken(bytes=24){ return crypto.randomBytes(bytes).toString('hex'); }
module.exports = { sha256Hex, randomToken };
