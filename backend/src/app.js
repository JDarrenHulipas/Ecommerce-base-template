const express = require('express');
const cors = require('cors');
const resolveTenant = require('./middleware/tenant');

const app = express();

app.use(cors());
app.use(express.json());

// El middleware de tenant se ejecuta para todas las rutas de la API
app.use('/api', resolveTenant);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', tienda: req.tenant.slug });
});

app.use('/api/productos', require('./routes/productos'));
app.use('/api/pedidos', require('./routes/pedidos'));

// Manejo de errores centralizado
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Error interno' });
});

module.exports = app;
