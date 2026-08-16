const crypto = require('crypto');
const { adminPassword, adminSecret, adminTokenTtl } = require('../config/env');

// Firma un token de sesión admin: <payload base64url>.<hmac-sha256>
function firmarToken() {
  const payload = { exp: Math.floor(Date.now() / 1000) + adminTokenTtl };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', adminSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verificarToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const esperada = crypto.createHmac('sha256', adminSecret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!Number.isInteger(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Protege las rutas /api/admin/* (menos /login)
function adminAuth(req, res, next) {
  if (!adminPassword || !adminSecret) {
    return res.status(503).json({ error: 'Panel admin no configurado (falta ADMIN_PASSWORD / ADMIN_SECRET)' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !verificarToken(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

module.exports = { firmarToken, verificarToken, adminAuth };
