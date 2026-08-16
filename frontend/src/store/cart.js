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
    const pid = producto.producto_id ?? producto.id;
    const key = producto.configuracion
      ? `${pid}::${JSON.stringify(producto.configuracion)}`
      : String(pid);
    const existing = items.find((i) => i.key === key);
    if (existing) {
      existing.cantidad += cantidad;
    } else {
      items.push({
        key,
        producto_id: pid,
        cantidad,
        nombre: producto.nombre,
        precio: producto.precio,
        slug: producto.slug,
        configuracion: producto.configuracion || undefined,
      });
    }
    save(items);
    return items;
  }

  function setQty(key, cantidad) {
    let items = load();
    if (cantidad <= 0) {
      items = items.filter((i) => i.key !== key);
    } else {
      const item = items.find((i) => i.key === key);
      if (item) item.cantidad = cantidad;
    }
    save(items);
    return items;
  }

  function remove(key) {
    const items = load().filter((i) => i.key !== key);
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
