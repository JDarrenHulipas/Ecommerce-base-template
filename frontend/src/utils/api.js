const Api = (() => {
  const BASE = '/api';

  async function request(path, options = {}) {
    const res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Error ${res.status}`);
    }
    return data;
  }

  return {
    getProductos: () => request('/productos'),
    getProducto: (slug) => request(`/productos/${slug}`),
    getOpciones: () => request('/opciones'),
    getContenido: () => request('/contenido'),
    crearPedido: (pedido) =>
      request('/pedidos', {
        method: 'POST',
        body: JSON.stringify(pedido),
      }),
    enviarContacto: (consulta) =>
      request('/contactos', {
        method: 'POST',
        body: JSON.stringify(consulta),
      }),
  };
})();
