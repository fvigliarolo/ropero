const grid = document.getElementById('grid');
const summary = document.getElementById('summary');
const wardrobeTpl = document.getElementById('cardTpl');
const outfitTpl = document.getElementById('outfitTpl');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const categoryFilter = document.getElementById('categoryFilter');
const reloadBtn = document.getElementById('reloadBtn');
const viewTabs = [...document.querySelectorAll('.view-tab')];

const state = {
  view: 'wardrobe',
  wardrobe: [],
  outfits: [],
  loaded: {
    wardrobe: false,
    outfits: false
  }
};

const viewCopy = {
  wardrobe: {
    loading: 'Cargando prendas...',
    empty: 'No encontré prendas con esos filtros.',
    summary: count => `${count} prendas visibles`,
    search: 'Buscar por nombre, marca, talle, color...',
    status: 'Todos los estados',
    secondary: 'Todas las tiendas'
  },
  outfits: {
    loading: 'Cargando outfits...',
    empty: 'No encontré outfits con esos filtros.',
    summary: count => `${count} outfits visibles`,
    search: 'Buscar por outfit, nota, temporada, ocasión...',
    status: 'Todos los estados',
    secondary: 'Todos los tags'
  }
};

function uniqueValues(items, getter) {
  return [...new Set(items.flatMap(item => getter(item)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function fillSelect(select, values, label) {
  select.innerHTML = `<option value="">${label}</option>`;
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function createLink(href, text) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = text;
  return link;
}

function renderMeta(meta, entries) {
  meta.innerHTML = '';
  for (const [label, value] of entries.filter(([, value]) => value)) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    meta.append(dt, dd);
  }
}

function setEmpty(message) {
  grid.innerHTML = '';
  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = message;
  grid.appendChild(empty);
}

function renderWardrobe(items) {
  grid.className = 'grid wardrobe-grid';
  grid.innerHTML = '';
  summary.textContent = viewCopy.wardrobe.summary(items.length);

  if (!items.length) {
    setEmpty(viewCopy.wardrobe.empty);
    return;
  }

  for (const item of items) {
    const node = wardrobeTpl.content.firstElementChild.cloneNode(true);
    const mainImg = node.querySelector('.card-image');
    const title = node.querySelector('.card-title');
    const link = node.querySelector('.card-link');
    const description = node.querySelector('.card-description');
    const meta = node.querySelector('.meta');
    const thumbs = node.querySelector('.thumbs');
    const actions = node.querySelector('.card-actions');

    mainImg.src = item.images[0].url;
    mainImg.alt = item.title;
    title.textContent = item.title;
    link.href = item.notionUrl;
    description.textContent = item.description || 'Guardado desde Notion';

    actions.innerHTML = '';
    if (item.productUrl) {
      actions.appendChild(createLink(item.productUrl, 'Abrir producto'));
    }

    renderMeta(meta, [
      ['Estado', item.status],
      ['Tienda', item.brand],
      ['Categoría', item.category],
      ['Color', item.color],
      ['Talle', item.size],
      ['Precio', item.price != null ? `$${item.price}` : '']
    ]);

    thumbs.innerHTML = '';
    item.images.forEach((img, index) => {
      const thumb = document.createElement('img');
      thumb.src = img.url;
      thumb.alt = `${item.title} ${index + 1}`;
      thumb.addEventListener('click', () => {
        mainImg.src = img.url;
      });
      thumbs.appendChild(thumb);
    });

    grid.appendChild(node);
  }
}

function renderOutfitCarousel(node, outfit) {
  const image = node.querySelector('.outfit-image');
  const prev = node.querySelector('.carousel-prev');
  const next = node.querySelector('.carousel-next');
  const count = node.querySelector('.photo-count');
  const dots = node.querySelector('.carousel-dots');
  let index = 0;

  function updateCarousel() {
    const current = outfit.images[index];
    image.src = current.url;
    image.alt = `${outfit.title} - foto ${index + 1}`;
    count.textContent = `${index + 1}/${outfit.images.length}`;

    dots.querySelectorAll('button').forEach((dot, dotIndex) => {
      dot.classList.toggle('active', dotIndex === index);
      dot.setAttribute('aria-current', dotIndex === index ? 'true' : 'false');
    });
  }

  prev.addEventListener('click', () => {
    index = (index - 1 + outfit.images.length) % outfit.images.length;
    updateCarousel();
  });

  next.addEventListener('click', () => {
    index = (index + 1) % outfit.images.length;
    updateCarousel();
  });

  dots.innerHTML = '';
  outfit.images.forEach((_, dotIndex) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Ver foto ${dotIndex + 1}`);
    dot.addEventListener('click', () => {
      index = dotIndex;
      updateCarousel();
    });
    dots.appendChild(dot);
  });

  const hasMultiplePhotos = outfit.images.length > 1;
  prev.hidden = !hasMultiplePhotos;
  next.hidden = !hasMultiplePhotos;
  dots.hidden = !hasMultiplePhotos;
  count.hidden = !hasMultiplePhotos;
  updateCarousel();
}

function renderOutfits(outfits) {
  grid.className = 'grid outfits-grid';
  grid.innerHTML = '';
  summary.textContent = viewCopy.outfits.summary(outfits.length);

  if (!outfits.length) {
    setEmpty(viewCopy.outfits.empty);
    return;
  }

  for (const outfit of outfits) {
    const node = outfitTpl.content.firstElementChild.cloneNode(true);
    const title = node.querySelector('.card-title');
    const link = node.querySelector('.card-link');
    const description = node.querySelector('.card-description');
    const tags = node.querySelector('.tag-row');
    const meta = node.querySelector('.meta');

    renderOutfitCarousel(node, outfit);
    title.textContent = outfit.title;
    link.href = outfit.notionUrl;
    description.textContent = outfit.description || 'Outfit guardado en Notion';

    tags.innerHTML = '';
    (outfit.tags || []).forEach(tag => {
      const badge = document.createElement('span');
      badge.className = 'tag';
      badge.textContent = tag;
      tags.appendChild(badge);
    });

    renderMeta(meta, [
      ['Estado', outfit.status],
      ['Temporada', outfit.season],
      ['Ocasión', outfit.occasion],
      ['Fecha', outfit.date],
      ['Fotos', outfit.images.length]
    ]);

    grid.appendChild(node);
  }
}

function updateFilterOptions() {
  const copy = viewCopy[state.view];
  searchInput.placeholder = copy.search;

  if (state.view === 'wardrobe') {
    fillSelect(statusFilter, uniqueValues(state.wardrobe, item => [item.status]), copy.status);
    fillSelect(categoryFilter, uniqueValues(state.wardrobe, item => [item.brand]), copy.secondary);
    return;
  }

  fillSelect(statusFilter, uniqueValues(state.outfits, item => [item.status]), copy.status);
  fillSelect(categoryFilter, uniqueValues(state.outfits, item => item.tags || []), copy.secondary);
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const secondary = categoryFilter.value;

  if (state.view === 'wardrobe') {
    const filtered = state.wardrobe.filter(item => {
      const haystack = [item.title, item.description, item.brand, item.color, item.size, item.category, item.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (status && item.status !== status) return false;
      if (secondary && item.brand !== secondary) return false;
      return true;
    });

    renderWardrobe(filtered);
    return;
  }

  const filtered = state.outfits.filter(outfit => {
    const haystack = [outfit.title, outfit.description, outfit.status, outfit.season, outfit.occasion, ...(outfit.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (status && outfit.status !== status) return false;
    if (secondary && !(outfit.tags || []).includes(secondary)) return false;
    return true;
  });

  renderOutfits(filtered);
}

async function loadView({ force = false } = {}) {
  const copy = viewCopy[state.view];
  summary.textContent = copy.loading;
  grid.innerHTML = '';

  const endpoint = state.view === 'wardrobe' ? '/api/items' : '/api/outfits';
  const res = await fetch(`${endpoint}${force ? '?refresh=1' : ''}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No pude cargar la base');

  if (state.view === 'wardrobe') {
    state.wardrobe = data.items;
    state.loaded.wardrobe = true;
  } else {
    state.outfits = data.items;
    state.loaded.outfits = true;
  }

  updateFilterOptions();
  applyFilters();
}

async function setView(view) {
  if (state.view === view) return;
  state.view = view;
  viewTabs.forEach(tab => {
    const isActive = tab.dataset.view === view;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  searchInput.value = '';
  statusFilter.value = '';
  categoryFilter.value = '';

  if (state.loaded[view]) {
    updateFilterOptions();
    applyFilters();
    return;
  }

  await loadView();
}

viewTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    setView(tab.dataset.view).catch(error => {
      summary.textContent = error.message;
    });
  });
});

[searchInput, statusFilter, categoryFilter].forEach(el => el.addEventListener('input', applyFilters));
reloadBtn.addEventListener('click', () => {
  loadView({ force: true }).catch(error => {
    summary.textContent = error.message;
  });
});

loadView().catch(error => {
  summary.textContent = error.message;
});
