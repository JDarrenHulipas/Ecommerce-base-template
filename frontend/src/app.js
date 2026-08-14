const App = (() => {
  const $ = (sel) => document.querySelector(sel);
  const grid = $('#grid-productos');
  const categoriasEl = $('#categorias');
  const cartCount = $('#cart-count');
  const drawer = $('#drawer');
  const overlay = $('#drawer-overlay');
  const drawerItems = $('#drawer-items');
  const drawerTotal = $('#drawer-total');
  const checkoutForm = $('#checkout-form');
  const btnCheckout = $('#btn-checkout');
  const drawerMsg = $('#drawer-msg');

  let productos = [];
  let categoriaActiva = 'todas';

  const formatEUR = (n) =>
    n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const slugToHue = (slug) => {
    let h = 0;
    for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  };

  const imageStyle = (p) => {
    const h = slugToHue(p.slug || p.nombre);
    return `background: linear-gradient(150deg, hsl(${h} 55% 78%), hsl(${h + 25} 50% 60%));`;
  };

  const localImgUrl = (p) => `/img/${p.slug}.jpg`;

  const getImagen = async (p) => {
    if (p.imagen_s3) return { url: p.imagen_s3, cls: 'card-image-img' };
    const local = localImgUrl(p);
    try {
      const res = await fetch(local, { method: 'HEAD' });
      if (res.ok) return { url: local, cls: 'card-image-img' };
    } catch { /* sin foto local: degradado */ }
    return { url: null, cls: 'card-image-grad', style: imageStyle(p) };
  };

  const categoriasUnicas = () => {
    const cats = [...new Set(productos.map((p) => p.categoria).filter(Boolean))];
    return ['todas', ...cats];
  };

  function renderCategorias() {
    categoriasEl.innerHTML = '';
    for (const cat of categoriasUnicas()) {
      const btn = document.createElement('button');
      btn.className = 'cat-chip' + (cat === categoriaActiva ? ' active' : '');
      btn.textContent = cat === 'todas' ? 'Todas' : cat;
      btn.addEventListener('click', () => {
        categoriaActiva = cat;
        renderCategorias();
        renderGrid();
      });
      categoriasEl.appendChild(btn);
    }
  }

  function renderGrid() {
    const filtrados =
      categoriaActiva === 'todas'
        ? productos
        : productos.filter((p) => p.categoria === categoriaActiva);

    grid.innerHTML = '';
    if (filtrados.length === 0) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--beige)">No hay productos en esta categoría.</p>';
      return;
    }

    for (const p of filtrados) {
      const card = document.createElement('article');
      card.className = 'card' + (p.disponible === false ? ' card-soldout' : '');
      card.innerHTML = `
        <div class="card-body">
          <span class="card-cat">${p.categoria || 'Dulce'}</span>
          <h3 class="card-name">${p.nombre}</h3>
          <p class="card-desc">${p.descripcion || ''}</p>
          <div class="card-foot">
            <span class="card-price">${formatEUR(p.precio)}</span>
            <button class="btn-add" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
              ${p.stock <= 0 ? 'Agotado' : 'Añadir'}
            </button>
          </div>
        </div>
      `;

      const imgSlot = document.createElement('div');
      imgSlot.className = 'card-image';
      imgSlot.dataset.producto = p.id;

      getImagen(p).then((img) => {
        if (img.url) {
          const el = document.createElement('img');
          el.src = img.url;
          el.alt = p.nombre;
          el.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          imgSlot.appendChild(el);
        } else {
          imgSlot.style.cssText = img.style;
        }
      });

      card.prepend(imgSlot);

      card.querySelector('.btn-add').addEventListener('click', () => {
        CartStore.add(p);
        actualizarContador();
        abrirDrawer();
      });

      grid.appendChild(card);
    }
  }

  function actualizarContador() {
    cartCount.textContent = CartStore.count();
  }

  function renderDrawer() {
    const items = CartStore.load();
    drawerItems.innerHTML = '';

    if (items.length === 0) {
      drawerItems.innerHTML = '<p class="drawer-empty">Tu carrito está vacío</p>';
    } else {
      for (const item of items) {
        const div = document.createElement('div');
        div.className = 'drawer-item';
        div.innerHTML = `
          <div class="di-thumb" data-thumb="${item.producto_id}"></div>
          <div class="di-info">
            <div class="di-name">${item.nombre}</div>
            <div class="di-price">${formatEUR(item.precio)}</div>
          </div>
          <div class="di-qty">
            <button data-action="decr" data-id="${item.producto_id}">−</button>
            <span class="qty">${item.cantidad}</span>
            <button data-action="incr" data-id="${item.producto_id}">+</button>
          </div>
          <button class="di-remove" data-action="remove" data-id="${item.producto_id}">✕</button>
        `;

        if (item.slug) {
          fetch(`/img/${item.slug}.jpg`, { method: 'HEAD' })
            .then((res) => {
              if (res.ok) {
                const t = div.querySelector(`[data-thumb="${item.producto_id}"]`);
                if (t) t.style.background = `url('/img/${item.slug}.jpg') center/cover no-repeat`;
              }
            })
            .catch(() => {});
        }

        div.querySelectorAll('[data-action]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === 'incr') {
              CartStore.setQty(id, CartStore.load().find((i) => String(i.producto_id) === id).cantidad + 1);
            } else if (action === 'decr') {
              const item = CartStore.load().find((i) => String(i.producto_id) === id);
              CartStore.setQty(id, item.cantidad - 1);
            } else {
              CartStore.remove(id);
            }
            renderDrawer();
            actualizarContador();
          });
        });

        drawerItems.appendChild(div);
      }
    }

    drawerTotal.textContent = formatEUR(CartStore.total());
  }

  function abrirDrawer() {
    renderDrawer();
    drawer.classList.add('open');
    overlay.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    drawerMsg.textContent = '';
  }

  function cerrarDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  async function init() {
    actualizarContador();

    try {
      const data = await Api.getProductos();
      productos = data.productos;
      renderCategorias();
      renderGrid();
    } catch (err) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--vino)">No se pudieron cargar los productos: ${err.message}</p>`;
    }

    $('#cart-btn').addEventListener('click', abrirDrawer);
    $('#drawer-close').addEventListener('click', cerrarDrawer);
    overlay.addEventListener('click', cerrarDrawer);

    btnCheckout.addEventListener('click', () => {
      checkoutForm.hidden = !checkoutForm.hidden;
    });

    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = $('#checkout-nombre').value.trim();
      const email = $('#checkout-email').value.trim();
      const items = CartStore.load().map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad }));

      if (items.length === 0) return;

      try {
        const res = await Api.crearPedido({ cliente: { nombre, email }, items });
        drawerMsg.textContent = `¡Pedido confirmado! (ref. #${res.pedido_id})`;
        drawerMsg.classList.remove('error');
        CartStore.clear();
        checkoutForm.hidden = true;
        checkoutForm.reset();
        renderDrawer();
        actualizarContador();
      } catch (err) {
        drawerMsg.textContent = err.message;
        drawerMsg.classList.add('error');
      }
    });

    $('#contact-form').addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Gracias por tu consulta. Te responderemos muy pronto.');
      e.target.reset();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
