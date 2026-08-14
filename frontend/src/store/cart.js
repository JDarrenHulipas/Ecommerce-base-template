const CartStore = (() => {
  const KEY = 'bakerycloud_cart';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  }

  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function add(producto, cantidad = 1) {
    const items = load();
    const existing = items.find((i) => String(i.producto_id) === String(producto.id));
    if (existing) {
      existing.cantidad += cantidad;
    } else {
      items.push({ producto_id: producto.id, cantidad, nombre: producto.nombre, precio: producto.precio, slug: producto.slug });
    }
    save(items);
    return items;
  }

  function setQty(producto_id, cantidad) {
    let items = load();
    if (cantidad <= 0) {
      items = items.filter((i) => String(i.producto_id) !== String(producto_id));
    } else {
      const item = items.find((i) => String(i.producto_id) === String(producto_id));
      if (item) item.cantidad = cantidad;
    }
    save(items);
    return items;
  }

  function remove(producto_id) {
    const items = load().filter((i) => String(i.producto_id) !== String(producto_id));
    save(items);
    return items;
  }

  function count() {
    return load().reduce((sum, i) => sum + i.cantidad, 0);
  }

  function total() {
    return load().reduce((sum, i) => sum + i.precio * i.cantidad, 0);
  }

  function clear() {
    save([]);
  }

  return { load, add, setQty, remove, count, total, clear };
})();
