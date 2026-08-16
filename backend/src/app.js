const express = require('express');
const path = require('path');
const cors = require('cors');
const resolveTenant = require('./middleware/tenant');

const app = express();

app.use(cors());
app.use(express.json());

// Frontend estático (plantilla visible) en la raíz
app.use(
  express.static(path.join(__dirname, '..', '..', 'frontend'))
);

// Contenido público (imágenes de la tienda) servido desde /img, /favicon, etc.
app.use(
  express.static(path.join(__dirname, '..', '..', 'frontend', 'public'))
);

// El middleware de tenant se ejecuta para todas las rutas de la API
app.use('/api', resolveTenant);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', tienda: req.tenant.slug });
});

app.use('/api/productos', require('./routes/productos'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/opciones', require('./routes/opciones'));
app.use('/api/contactos', require('./routes/contactos'));

// Manejo de errores centralizado
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Error interno' });
});

module.exports = app;
