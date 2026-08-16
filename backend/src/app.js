const express = require('express');
const path = require('path');
const cors = require('cors');
const resolveTenant = require('./middleware/tenant');
const { uploadDir } = require('./config/env');

const app = express();

app.disable('x-powered-by');

app.use(cors());
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
app.use('/api/imagenes', express.static(uploadDir, { maxAge: '7d', immutable: true }));

// El middleware de tenant se ejecuta para todas las rutas de la API
app.use('/api', resolveTenant);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', tienda: req.tenant.slug });
});

app.use('/api/productos', require('./routes/productos'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/opciones', require('./routes/opciones'));
app.use('/api/contactos', require('./routes/contactos'));
app.use('/api/contenido', require('./routes/contenido'));
app.use('/api/admin', require('./routes/admin'));

// Manejo de errores centralizado
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Error interno' });
});

module.exports = app;
