const app = require('./app');
const { port } = require('./config/env');

app.listen(port, () => {
  console.log(`BakeryCloud API escuchando en http://localhost:${port}`);
});
