const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                  // 10 intentos
  message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minuto
  max: 30,                   // 30 peticiones
  message: { error: 'Demasiadas peticiones. Espera un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, mutationLimiter };
