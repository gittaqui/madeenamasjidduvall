const fs = require('fs');
const path = require('path');
const EVENTS_PATH = path.join(__dirname, '..', '..', 'events.json');

function validateEventId(id){ return /^[a-z0-9\-]{4,120}$/.test(id); }
async function loadEvents(){
  try {
    const raw = await fs.promises.readFile(EVENTS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch { return []; }
}

module.exports = { validateEventId, loadEvents };
