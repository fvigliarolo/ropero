const grid = document.getElementById('grid');
const summary = document.getElementById('summary');
const tpl = document.getElementById('cardTpl');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const categoryFilter = document.getElementById('categoryFilter');
const reloadBtn = document.getElementById('reloadBtn');

let allItems = [];

function uniqueValues(items, key) {
  return [...new Set(items.map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
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

function render(items) {
  grid.innerHTML = '';
  summary.textContent = `${items.length} prendas visibles`;

  if (!items.length) {
    grid.innerHTML = '<p class="empty">No encontré prendas con esos filtros.</p>';
    return;
  }

  for (const item of items) {
    const node = tpl.content.firstElementChild.cloneNode(true);
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

    if (item.productUrl) {
      actions.innerHTML = `<a href="${item.productUrl}" target="_blank" rel="noreferrer">Abrir producto</a>`;
    }

    const entries = [
      ['Estado', item.status],
      ['Tienda', item.brand],
      ['Categoría', item.category],
      ['Color', item.color],
      ['Talle', item.size],
      ['Precio', item.price != null ? `$${item.price}` : '']
    ].filter(([, value]) => value);

    for (const [label, value] of entries) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      meta.append(dt, dd);
    }

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

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const category = categoryFilter.value;

  const filtered = allItems.filter(item => {
    const haystack = [item.title, item.description, item.brand, item.color, item.size, item.category, item.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (status && item.status !== status) return false;
    if (category && item.brand !== category) return false;
    return true;
  });

  render(filtered);
}

async function loadItems() {
  summary.textContent = 'Cargando prendas...';
  const res = await fetch('/api/items');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No pude cargar la base');

  allItems = data.items;
  fillSelect(statusFilter, uniqueValues(allItems, 'status'), 'Todos los estados');
  fillSelect(categoryFilter, uniqueValues(allItems, 'brand'), 'Todas las tiendas');
  applyFilters();
}

[searchInput, statusFilter, categoryFilter].forEach(el => el.addEventListener('input', applyFilters));
reloadBtn.addEventListener('click', loadItems);

loadItems().catch(error => {
  summary.textContent = error.message;
});
