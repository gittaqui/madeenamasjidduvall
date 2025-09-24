// Lightweight logic tests (run with: node tools/schedule_logic_test.js)
const fs = require('fs');
const path = require('path');

// Inline a minimal subset of functions from schedule.js for testability
function parseTimeFlexible(str){
  if(!str) return null;
  const cleaned = str.trim().replace(/\u00A0/g,' ').replace(/\s+/g,' ');
  let m = cleaned.match(/(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?/);
  if(m){
    let hh = parseInt(m[1],10); const mm = parseInt(m[2],10); const ap = m[3].toUpperCase();
    if(ap==='P' && hh!==12) hh+=12; if(ap==='A' && hh===12) hh=0; return { hh, mm };
  }
  m = cleaned.match(/(\d{1,2}):(\d{2})/);
  if(m){
    let hh = parseInt(m[1],10); const mm = parseInt(m[2],10);
    if(hh>=0 && hh<=23 && mm>=0 && mm<=59) return { hh, mm };
  }
  return null;
}

function assert(name, cond){
  if(!cond){ console.error('FAIL', name); process.exitCode = 1; } else { console.log('PASS', name); }
}

// Tests for parseTimeFlexible
assert('parse 1:05 PM', JSON.stringify(parseTimeFlexible('1:05 PM')) === JSON.stringify({hh:13,mm:5}));
assert('parse 12:00 AM', JSON.stringify(parseTimeFlexible('12:00 AM')) === JSON.stringify({hh:0,mm:0}));
assert('parse 12:00 PM', JSON.stringify(parseTimeFlexible('12:00 pm')) === JSON.stringify({hh:12,mm:0}));
assert('parse 05:45', JSON.stringify(parseTimeFlexible('05:45')) === JSON.stringify({hh:5,mm:45}));
assert('reject garbage', parseTimeFlexible('abc') === null);

// Smoke test reading prayer-times.json
const p = path.join(__dirname, '..', 'prayer-times.json');
if(fs.existsSync(p)){
  const data = JSON.parse(fs.readFileSync(p,'utf8'));
  console.log('Loaded prayer-times keys:', Object.keys(data));
} else {
  console.log('prayer-times.json not present for smoke test');
}

if(process.exitCode){
  console.error('Some tests failed');
  process.exit(1);
} else {
  console.log('All basic schedule logic tests passed');
}
