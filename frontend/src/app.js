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
  const modal = $('#producto-modal');
  const modalOverlay = $('#modal-overlay');
  const modalImg = $('#modal-image');
  const modalCat = $('#modal-cat');
  const modalName = $('#modal-name');
  const modalDesc = $('#modal-desc');
  const modalIng = $('#modal-ing');
  const modalPrice = $('#modal-price');
  const modalAdd = $('#modal-add');
  const configModal = $('#config-modal');
  const configOverlay = $('#config-overlay');
  const configBody = $('#config-body');
  const configSteps = $('#config-steps');
  const configResumen = $('#config-resumen');
  const configPrev = $('#config-prev');
  const configNext = $('#config-next');
  const configAdd = $('#config-add');

  let productos = [];
  let categoriaActiva = 'todas';
  let productoActivo = null;

  // Estado del configurador de tartas
  const PASOS = ['tamano', 'altura', 'bizcocho', 'relleno', 'decoracion', 'extra'];
  const PASOS_TITULO = {
    tamano: 'Elige el tamaño',
    altura: 'Elige la altura',
    bizcocho: 'Elige el bizcocho',
    relleno: 'Elige el relleno',
    decoracion: 'Elige la decoración',
    extra: 'Añade extras (opcional)',
  };
  const PASOS_HINT = {
    tamano: 'Primero elige el diámetro de tu tarta. Cada tamaño tiene un precio base.',
    altura: 'Ahora decide la altura de la tarta.',
    bizcocho: 'El sabor del bizcocho. Algunos tienen un pequeño suplemento.',
    relleno: 'El relleno de tu tarta.',
    decoracion: 'El estilo y la decoración. Puedes enviar tu foto de referencia al hacer el encargo.',
    extra: 'Trozos, fruta fresca... selecciona todos los que quieras.',
  };
  let catalogo = null;   // { tarta_base, grupos }
  let configSel = {};    // { tamano: id, altura: id, bizcocho: id, relleno: id, decoracion: id, extra: [ids] }
  let configPaso = 0;

  const formatEUR = (n) =>
    n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  const toastContainer = $('#toast-container');

  function notify(mensaje, tipo = 'error', duracion = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    const icono = tipo === 'success' ? '✓' : tipo === 'info' ? 'ℹ' : '✕';
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icono}</span>
      <div class="toast-body"></div>
      <button type="button" class="toast-close" aria-label="Cerrar aviso">&times;</button>
    `;
    toast.querySelector('.toast-body').textContent = mensaje;
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 250);
    });
    toastContainer.appendChild(toast);
    if (duracion > 0) {
      setTimeout(() => {
        if (toast.isConnected) {
          toast.classList.add('leaving');
          setTimeout(() => toast.remove(), 250);
        }
      }, duracion);
    }
  }

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

    for (let i = 0; i < filtrados.length; i++) {
      const p = filtrados[i];
      const card = document.createElement('article');
      card.className = 'card card-in' + (p.disponible === false ? ' card-soldout' : '');
      card.style.animationDelay = `${i * 0.06}s`;
      card.innerHTML = `
        <div class="card-body">
          <span class="card-cat">${escapeHtml(p.categoria) || 'Dulce'}</span>
          <h3 class="card-name">${escapeHtml(p.nombre)}</h3>
          <p class="card-desc">${escapeHtml(p.descripcion)}</p>
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

      card.querySelector('.btn-add').addEventListener('click', (e) => {
        e.stopPropagation();
        if (esTartaBase(p)) { abrirConfig(); return; }
        CartStore.add(p);
        actualizarContador();
        abrirDrawer();
      });

      card.addEventListener('click', () => {
        if (esTartaBase(p)) { abrirConfig(); return; }
        abrirModal(p);
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
        const itemKey = encodeURIComponent(item.key ?? String(item.producto_id));
        div.innerHTML = `
          <div class="di-thumb" data-thumb="${itemKey}"></div>
          <div class="di-info">
            <div class="di-name">${escapeHtml(item.nombre)}</div>
            <div class="di-price">${formatEUR(item.precio)}</div>
          </div>
          <div class="di-qty">
            <button type="button" data-action="decr" data-id="${itemKey}">−</button>
            <span class="qty">${item.cantidad}</span>
            <button type="button" data-action="incr" data-id="${itemKey}">+</button>
          </div>
          <button type="button" class="di-remove" data-action="remove" data-id="${itemKey}">✕</button>
        `;

        if (item.slug) {
          fetch(`/img/${item.slug}.jpg`, { method: 'HEAD' })
            .then((res) => {
              if (res.ok) {
                const t = div.querySelector(`[data-thumb="${itemKey}"]`);
                if (t) t.style.background = `url('/img/${item.slug}.jpg') center/cover no-repeat`;
              }
            })
            .catch(() => {});
        }

        div.querySelectorAll('[data-action]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const key = decodeURIComponent(btn.dataset.id);
            const action = btn.dataset.action;
            if (action === 'incr') {
              CartStore.setQty(key, CartStore.load().find((i) => (i.key ?? String(i.producto_id)) === key).cantidad + 1);
            } else if (action === 'decr') {
              const item = CartStore.load().find((i) => (i.key ?? String(i.producto_id)) === key);
              CartStore.setQty(key, item.cantidad - 1);
            } else {
              CartStore.remove(key);
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

  function renderIngredientes(lista) {
    if (!lista) return;
    const items = lista.split(',').map((s) => s.trim()).filter(Boolean);
    modalIng.innerHTML = items.map((i) => `<li>${escapeHtml(i)}</li>`).join('');
  }

  async function abrirModal(p) {
    productoActivo = p;

    modalCat.textContent = p.categoria || 'Dulce';
    modalName.textContent = p.nombre;
    modalDesc.textContent = p.descripcion || '';
    modalPrice.textContent = formatEUR(p.precio);
    renderIngredientes(p.ingredientes);

    modalImg.innerHTML = '';
    const img = await getImagen(p);
    if (img.url) {
      const el = document.createElement('img');
      el.src = img.url;
      el.alt = p.nombre;
      modalImg.appendChild(el);
    } else {
      modalImg.style.cssText = img.style;
    }

    modalAdd.disabled = p.stock <= 0;
    modalAdd.textContent = p.stock <= 0 ? 'Agotado' : 'Añadir al carrito';

    modal.classList.add('open');
    modalOverlay.classList.add('open');
    modalOverlay.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }

  function cerrarModal() {
    modal.classList.remove('open');
    modalOverlay.classList.remove('open');
    modalOverlay.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    productoActivo = null;
  }

  // ---------- Configurador de tarta personalizada ----------

  const opcionPorId = (id) => {
    if (!catalogo) return null;
    for (const grupo of Object.values(catalogo.grupos)) {
      const op = grupo.find((o) => String(o.id) === String(id));
      if (op) return op;
    }
    return null;
  };

  function esTartaBase(p) {
    return p && (String(p.slug) === 'tarta-encargo' ||
      (catalogo && catalogo.tarta_base && String(p.id) === String(catalogo.tarta_base.id)));
  }

  function calcularPrecioConfig() {
    if (!configSel.tamano) return 0;
    let total = Number(opcionPorId(configSel.tamano)?.precio || 0);
    for (const campo of ['altura', 'bizcocho', 'relleno', 'decoracion']) {
      if (configSel[campo]) total += Number(opcionPorId(configSel[campo])?.precio || 0);
    }
    for (const id of configSel.extra || []) {
      total += Number(opcionPorId(id)?.precio || 0);
    }
    return total;
  }

  function renderConfigSteps() {
    configSteps.innerHTML = PASOS.map((paso, i) => {
      const alcanzable = PASOS.slice(0, i).every(configValidoPaso);
      const sel = i < configPaso || (i === configPaso && configValidoPaso(paso)) ? 'done' : '';
      const active = i === configPaso ? 'active' : '';
      return `<button type="button" class="config-step ${active} ${sel}" data-paso="${i}" ${alcanzable ? '' : 'disabled'}>
        <span class="num">${i + 1}</span>${PASOS_TITULO[paso].replace('Elige el ', '').replace(' (opcional)', '')}
      </button>`;
    }).join('');
    configSteps.querySelectorAll('[data-paso]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        configPaso = Number(btn.dataset.paso);
        renderConfig();
      });
    });
  }

  function configValidoPaso(paso) {
    const valor = configSel[paso];
    return paso === 'extra' ? true : !!valor;
  }

  function renderConfigPaso(paso) {
    const opciones = catalogo.grupos[paso] || [];
    const titulo = PASOS_TITULO[paso];
    const hint = PASOS_HINT[paso];
    const multiple = paso === 'extra';

    let html = `<h3 class="config-step-title">${titulo}</h3>
                <p class="config-step-hint">${hint}</p>
                <div class="config-options">`;

    for (const op of opciones) {
      const precio = Number(op.precio);
      const marcado = multiple
        ? (configSel.extra || []).some((id) => String(id) === String(op.id))
        : configSel[paso] && String(configSel[paso]) === String(op.id);
      html += `<button type="button" class="config-option ${marcado ? 'selected' : ''}" data-id="${op.id}">
        <span class="opt-name">${escapeHtml(op.nombre)}</span>
        ${op.descripcion ? `<span class="opt-desc">${escapeHtml(op.descripcion)}</span>` : ''}
        <span class="opt-price ${precio === 0 ? 'gratis' : ''}">${precio === 0 ? 'Incluido' : `+ ${formatEUR(precio)}`}</span>
      </button>`;
    }
    html += '</div>';
    configBody.innerHTML = html;

    configBody.querySelectorAll('.config-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (multiple) {
          configSel.extra = configSel.extra || [];
          const idx = configSel.extra.findIndex((e) => String(e) === String(id));
          if (idx >= 0) configSel.extra.splice(idx, 1);
          else configSel.extra.push(id);
        } else {
          configSel[paso] = (String(configSel[paso]) === String(id)) ? null : id;
        }
        renderConfig();
      });
    });
  }

  function renderConfigResumen() {
    const total = calcularPrecioConfig();
    const partes = [];
    for (const paso of PASOS) {
      const ids = paso === 'extra' ? configSel.extra || [] : [configSel[paso]];
      for (const id of ids) {
        const op = opcionPorId(id);
        if (op) partes.push(op.nombre);
      }
    }
    configResumen.innerHTML = partes.length
      ? `${escapeHtml(partes.join(' · '))} — <strong>${formatEUR(total)}</strong>`
      : `Elige el tamaño para ver el precio — <strong>${formatEUR(0)}</strong>`;
    return total;
  }

  function renderConfig() {
    renderConfigSteps();
    renderConfigPaso(PASOS[configPaso]);
    renderConfigResumen();

    const esUltimo = configPaso === PASOS.length - 1;
    configPrev.hidden = configPaso === 0;
    configNext.hidden = esUltimo;
    configAdd.hidden = !esUltimo;
    configPrev.disabled = false;
    configNext.disabled = !configValidoPaso(PASOS[configPaso]);
    configAdd.disabled = !['tamano', 'altura', 'bizcocho', 'relleno', 'decoracion'].every((p) => configValidoPaso(p));
  }

  async function abrirConfig() {
    if (!catalogo) {
      try {
        catalogo = await Api.getOpciones();
      } catch (err) {
        notify('No se pudo cargar el configurador de tartas. Inténtalo de nuevo más tarde.');
        return;
      }
    }
    configSel = {};
    configPaso = 0;
    configModal.classList.add('open');
    configOverlay.classList.add('open');
    configOverlay.hidden = false;
    configModal.setAttribute('aria-hidden', 'false');
    renderConfig();
  }

  function cerrarConfig() {
    configModal.classList.remove('open');
    configOverlay.classList.remove('open');
    configOverlay.hidden = true;
    configModal.setAttribute('aria-hidden', 'true');
  }

  function añadirTartaAlCarrito() {
    if (!['tamano', 'altura', 'bizcocho', 'relleno', 'decoracion'].every((p) => configSel[p])) {
      notify('Faltan opciones por elegir. Completa todos los pasos antes de añadir la tarta.');
      return;
    }
    const total = calcularPrecioConfig();
    const partes = [];
    for (const paso of PASOS) {
      const ids = paso === 'extra' ? configSel.extra || [] : [configSel[paso]];
      for (const id of ids) {
        const op = opcionPorId(id);
        if (op) partes.push(op.nombre);
      }
    }
    const nombre = `Tarta personalizada (${partes.join(', ')})`;

    CartStore.add(
      {
        producto_id: catalogo.tarta_base.id,
        nombre,
        precio: total,
        configuracion: {
          tamano: configSel.tamano,
          altura: configSel.altura,
          bizcocho: configSel.bizcocho,
          relleno: configSel.relleno || null,
          decoracion: configSel.decoracion || null,
          extras: configSel.extra || [],
        },
      },
      1
    );
    actualizarContador();
    cerrarConfig();
    abrirDrawer();
  }

  // Pinta el contenido de la portada desde /api/contenido (con fallback al HTML)
  function pintarContenido(contenido) {
    const aplicar = (sel, valor) => {
      const el = document.querySelector(sel);
      if (!el || valor == null) return;
      if (el.dataset.lines === '1') {
        const lineas = String(valor).split('\n');
        el.replaceChildren();
        lineas.forEach((linea, i) => {
          if (i > 0) el.appendChild(document.createElement('br'));
          el.appendChild(document.createTextNode(linea));
        });
      } else {
        el.textContent = valor;
      }
    };
    aplicar('#contenido-announcement', contenido.announcement);
    aplicar('#hero-eyebrow', contenido.hero_eyebrow);
    aplicar('#hero-titulo', contenido.hero_titulo);
    aplicar('#hero-sub', contenido.hero_sub);
    aplicar('#hero-cta', contenido.hero_cta);
    aplicar('#nosotros-titulo', contenido.nosotros_titulo);
    aplicar('#nosotros-texto', contenido.nosotros_texto);
    aplicar('#contacto-texto', contenido.contacto_texto);
    aplicar('#footer-texto', contenido.footer_texto);
  }

  async function cargarContenido() {
    try {
      const data = await Api.getContenido();
      pintarContenido(data.contenido);
    } catch {
      // Sin contenido configurado: se mantienen los textos por defecto del HTML
    }
  }

  async function init() {
    actualizarContador();
    cargarContenido();

    try {
      const data = await Api.getProductos();
      productos = data.productos;
      renderCategorias();
      renderGrid();
    } catch (err) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--vino)">No se pudieron cargar los productos: ${escapeHtml(err.message)}</p>`;
      notify('No se pudieron cargar los productos. Inténtalo de nuevo más tarde.');
    }

    $('#cart-btn').addEventListener('click', abrirDrawer);
    $('#drawer-close').addEventListener('click', cerrarDrawer);
    overlay.addEventListener('click', cerrarDrawer);

    $('#modal-close').addEventListener('click', cerrarModal);
    modalOverlay.addEventListener('click', cerrarModal);
    modalAdd.addEventListener('click', () => {
      if (!productoActivo) {
        notify('No hay ningún producto seleccionado.');
        return;
      }
      CartStore.add(productoActivo);
      actualizarContador();
      cerrarModal();
      abrirDrawer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cerrarModal();
        cerrarConfig();
        cerrarDrawer();
      }
    });

    $('#config-close').addEventListener('click', cerrarConfig);
    configOverlay.addEventListener('click', cerrarConfig);
    configPrev.addEventListener('click', () => {
      if (configPaso > 0) { configPaso--; renderConfig(); }
    });
    configNext.addEventListener('click', () => {
      if (configPaso < PASOS.length - 1 && configValidoPaso(PASOS[configPaso])) { configPaso++; renderConfig(); }
    });
    configAdd.addEventListener('click', añadirTartaAlCarrito);

    btnCheckout.addEventListener('click', () => {
      checkoutForm.hidden = !checkoutForm.hidden;
    });

    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = $('#checkout-nombre').value.trim();
      const email = $('#checkout-email').value.trim();
      const items = CartStore.load().map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        ...(i.configuracion ? { configuracion: i.configuracion } : {}),
      }));

      if (items.length === 0) {
        notify('Tu carrito está vacío. Añade algún producto antes de finalizar el pedido.');
        return;
      }

      try {
        const res = await Api.crearPedido({ cliente: { nombre, email }, items });
        drawerMsg.textContent = `¡Pedido confirmado! (ref. #${res.pedido_id})`;
        drawerMsg.classList.remove('error');
        CartStore.clear();
        checkoutForm.hidden = true;
        checkoutForm.reset();
        renderDrawer();
        actualizarContador();
        notify(`¡Pedido confirmado! (ref. #${res.pedido_id})`, 'success');
      } catch (err) {
        drawerMsg.textContent = err.message;
        drawerMsg.classList.add('error');
        notify(err.message || 'No se pudo realizar el pedido. Inténtalo de nuevo.');
      }
    });

    $('#contact-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = $('#contact-nombre').value.trim();
      const email = $('#contact-email').value.trim();
      const mensaje = $('#contact-mensaje').value.trim();
      const btn = $('#contact-submit');
      btn.disabled = true;
      try {
        await Api.enviarContacto({ nombre, email, mensaje });
        notify('¡Consulta enviada! Te responderemos muy pronto.', 'success');
        e.target.reset();
      } catch (err) {
        notify(err.message || 'No se pudo enviar tu consulta. Inténtalo de nuevo.');
      } finally {
        btn.disabled = false;
      }
    });
  }

  window.addEventListener('error', (e) => {
    if (e && e.message) notify(e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (e && e.reason) notify(e.reason.message || String(e.reason));
  });

  document.addEventListener('DOMContentLoaded', init);
})();
