const express = require('express');
const path = require('path');
const cors = require('cors');
const resolveTenant = require('./middleware/tenant');
const { uploadDir, allowedOrigins, defaultTenantSlug } = require('./config/env');
const { servirImagen } = require('./storage');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
}));
app.use(express.json());

// Headers de seguridad en todas las respuestas
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; " +
      "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; " +
      "object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

// Frontend estático (plantilla visible) en la raíz
app.use(
  express.static(path.join(__dirname, '..', '..', 'frontend'))
);

// Contenido público (imágenes de la tienda) servido desde /img, /favicon, etc.
app.use(
  express.static(path.join(__dirname, '..', '..', 'frontend', 'public'))
);

// Imágenes subidas por el panel admin (sirve /api/imagenes/<archivo>).
// Se monta ANTES del middleware de tenant: son archivos públicos y no deben
// depender de la resolución de tienda (p. ej. en img src del navegador).
// En local las sirve express.static; con S3 configurado, el proxy las trae del bucket.
app.use('/api/imagenes', express.static(uploadDir, { maxAge: '7d', immutable: true }));
app.use('/api/imagenes', servirImagen);

// Health check publico: se resuelve ANTES del middleware de tenant porque
// Fly.io lo llama con Host interno (p.ej. bakerycloud-kokoro.fly.dev) que no
// debe interpretarse como slug de tienda.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', tienda: defaultTenantSlug });
});

// El middleware de tenant se ejecuta para todas las rutas de la API
app.use('/api', resolveTenant);

app.use('/api/productos', require('./routes/productos'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/opciones', require('./routes/opciones'));
app.use('/api/contactos', require('./routes/contactos'));
app.use('/api/contenido', require('./routes/contenido'));
app.use('/api/admin', require('./routes/admin'));

// Manejo de errores centralizado
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
    return res.status(status).json({ error: 'Error interno del servidor' });
  }
  res.status(status).json({ error: err.message || 'Error de cliente' });
});

module.exports = app;
