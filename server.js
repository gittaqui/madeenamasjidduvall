/* Simple Express server with protected endpoint to update prayer-times.json */
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';

app.use(express.json({ limit: '1mb' }));
app.use((req,res,next)=>{
  // Basic CORS for admin tool usage from same origin
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if(req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Basic Auth middleware
function requireAuth(req,res,next){
  const hdr = req.headers.authorization || '';
  const m = hdr.match(/^Basic (.+)$/i);
  if(!m){ res.setHeader('WWW-Authenticate','Basic realm="Admin"'); return res.sendStatus(401); }
  const [user,pass] = Buffer.from(m[1],'base64').toString().split(':');
  if(user === ADMIN_USER && pass === ADMIN_PASS) return next();
  return res.sendStatus(403);
}

// Serve static files
app.use(express.static(path.join(__dirname)));

// Save prayer-times.json
app.post('/api/prayer-times', requireAuth, (req,res)=>{
  const data = req.body;
  if(!data || typeof data !== 'object') return res.status(400).json({ error: 'Invalid JSON' });
  try{
    const target = path.join(__dirname, 'prayer-times.json');
    fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8');
    return res.json({ ok: true });
  }catch(err){
    console.error('Write failed:', err);
    return res.status(500).json({ error: 'Write failed' });
  }
});

app.listen(PORT, ()=> console.log(`Server running on http://127.0.0.1:${PORT}`));
