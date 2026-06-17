import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const ENV_FILE = path.join(process.cwd(), '.env');

function loadLocalEnv() {
  if (!fs.existsSync(ENV_FILE)) return;

  const lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnv();

const PORT = process.env.PORT || 4782;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = '2022-06-28';
const WARDROBE_DB_ID = process.env.NOTION_WARDROBE_DB_ID || '371dded7-4e1e-810c-ae33-e59e6ef1dbc4';
const OUTFITS_DB_ID = process.env.NOTION_OUTFITS_DB_ID || '';
const OUTFITS_DB_NAME = process.env.NOTION_OUTFITS_DB_NAME || 'Outfits';
const STORES_DB_ID = process.env.NOTION_STORES_DB_ID || '';
const STORES_DB_NAME = process.env.NOTION_STORES_DB_NAME || 'Stores';
const LEGACY_CLOTHES_PAGE_ID = process.env.NOTION_CLOTHES_PAGE_ID || '344dded7-4e1e-8137-87a1-fbe4ff41076e';
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const ITEMS_CACHE_TTL_MS = Number(process.env.ITEMS_CACHE_TTL_MS || 10 * 60 * 1000);
const PRODUCT_FETCH_TIMEOUT_MS = Number(process.env.PRODUCT_FETCH_TIMEOUT_MS || 6000);
const NOTION_IMAGE_PROPERTY = process.env.NOTION_IMAGE_PROPERTY || '';
const PERSIST_ENRICHED_IMAGES_TO_NOTION = process.env.PERSIST_ENRICHED_IMAGES_TO_NOTION !== 'false';

let itemsCache = {
  items: null,
  fetchedAt: 0,
  refreshing: null
};

let outfitsCache = {
  items: null,
  fetchedAt: 0,
  refreshing: null
};

let storesCache = {
  items: null,
  fetchedAt: 0,
  refreshing: null
};

let resolvedOutfitsDatabaseId = OUTFITS_DB_ID;
let resolvedStoresDatabaseId = STORES_DB_ID;

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath, contentType = 'text/html; charset=utf-8') {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

async function notionRequest(endpoint, payload, method = 'POST') {
  const response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion ${response.status}: ${text}`);
  }

  return response.json();
}

function notionPatch(endpoint, payload) {
  return notionRequest(endpoint, payload, 'PATCH');
}

function isNotionObjectNotFound(error) {
  return /\bNotion 404\b/.test(error.message) && /object_not_found/.test(error.message);
}

function plainText(arr = []) {
  return arr.map(x => x.plain_text || '').join('');
}

function pickTitle(properties) {
  for (const [, prop] of Object.entries(properties)) {
    if (prop.type === 'title') return plainText(prop.title);
  }
  return 'Sin nombre';
}

function pickText(properties, names) {
  for (const name of names) {
    const prop = properties[name];
    if (!prop) continue;
    if (prop.type === 'rich_text') return plainText(prop.rich_text);
    if (prop.type === 'select') return prop.select?.name || '';
    if (prop.type === 'multi_select') return (prop.multi_select || []).map(x => x.name).join(', ');
  }
  return '';
}

function pickNumber(properties, names) {
  for (const name of names) {
    const prop = properties[name];
    if (prop?.type === 'number' && prop.number != null) return prop.number;
  }
  return null;
}

function pickUrl(properties, names) {
  for (const name of names) {
    const prop = properties[name];
    if (!prop) continue;
    if (prop.type === 'url') return prop.url || '';
    if (prop.type === 'rich_text') {
      const linked = (prop.rich_text || []).find(chunk => chunk.href || chunk.text?.link?.url);
      if (linked) return linked.href || linked.text.link.url;
      const text = plainText(prop.rich_text).trim();
      if (/^https?:\/\//i.test(text)) return text;
    }
  }
  return '';
}

function pickDate(properties, names) {
  for (const name of names) {
    const prop = properties[name];
    if (prop?.type === 'date') return prop.date?.start || '';
  }
  return '';
}

function pickTags(properties, names) {
  for (const name of names) {
    const prop = properties[name];
    if (!prop) continue;
    if (prop.type === 'multi_select') return (prop.multi_select || []).map(x => x.name);
    if (prop.type === 'select' && prop.select?.name) return [prop.select.name];
  }
  return [];
}

function collectTags(properties, names) {
  const values = [];
  for (const name of names) {
    values.push(...pickTags(properties, [name]));
  }
  return [...new Set(values)];
}

function extractFilesFromProperty(prop) {
  if (!prop) return [];
  if (prop.type === 'files') {
    return (prop.files || []).map(file => ({
      name: file.name,
      url: file.file?.url || file.external?.url || null,
      type: file.type
    })).filter(x => x.url);
  }
  return [];
}

function extractFiles(page) {
  const fromCover = page.cover?.file?.url || page.cover?.external?.url;
  const files = [];
  if (fromCover) files.push({ name: 'cover', url: fromCover, type: page.cover.type });
  for (const [, prop] of Object.entries(page.properties || {})) {
    files.push(...extractFilesFromProperty(prop));
  }
  const seen = new Set();
  return files.filter(file => {
    if (seen.has(file.url)) return false;
    seen.add(file.url);
    return true;
  });
}

function pickFilesPropertyName(properties) {
  if (NOTION_IMAGE_PROPERTY) return NOTION_IMAGE_PROPERTY;

  const filesProperties = Object.entries(properties || {})
    .filter(([, prop]) => prop.type === 'files')
    .map(([name]) => name);
  if (filesProperties.length === 0) return '';

  const preferredNames = ['Images', 'Image', 'Fotos', 'Foto', 'Photos', 'Photo'];
  return preferredNames.find(name => filesProperties.includes(name)) || filesProperties[0];
}

async function findDatabaseByName(name, { allowPartial = false } = {}) {
  const data = await notionRequest('search', {
    query: name,
    page_size: 10,
    filter: {
      property: 'object',
      value: 'database'
    }
  });

  const normalized = name.trim().toLowerCase();
  const matches = data.results || [];
  return matches.find(database => plainText(database.title).trim().toLowerCase() === normalized)
    || (allowPartial
      ? matches.find(database => plainText(database.title).trim().toLowerCase().includes(normalized))
      : null);
}

async function resolveDatabaseId({ currentId, name, alternativeNames = [], excludeIds = [] }) {
  if (currentId) return currentId;

  const excluded = new Set(excludeIds.filter(Boolean).map(id => id.replace(/-/g, '')));
  const names = [name, ...alternativeNames].filter(Boolean);
  for (const candidateName of names) {
    try {
      const childDatabase = await findChildDatabaseByName(WARDROBE_DB_ID, candidateName);
      if (childDatabase?.id && !excluded.has(childDatabase.id.replace(/-/g, ''))) return childDatabase.id;
    } catch (error) {
      console.warn(`No pude buscar "${candidateName}" como database hija:`, error.message);
    }
  }

  for (const candidateName of names) {
    const database = await findDatabaseByName(candidateName);
    if (database?.id && !excluded.has(database.id.replace(/-/g, ''))) return database.id;
  }

  throw new Error(`No encontré una database válida para "${name}". Configurá su ID para fijarla.`);
}

async function fetchWardrobeDatabaseItems() {
  const data = await notionRequest(`databases/${WARDROBE_DB_ID}/query`, {
    page_size: 100,
    sorts: [{ property: 'Added At', direction: 'descending' }]
  });

  const baseItems = (data.results || []).map(page => {
    const properties = page.properties || {};
    return {
      id: page.id,
      notionUrl: page.url,
      title: pickTitle(properties),
      description: pickText(properties, ['Notes', 'Description', 'Details']),
      category: pickText(properties, ['Category', 'Tipo', 'Type']),
      brand: pickText(properties, ['Store', 'Brand', 'Marca']),
      color: pickText(properties, ['Color', 'Colour']),
      size: pickText(properties, ['Size', 'Talle']),
      price: pickNumber(properties, ['Price', 'Precio']),
      status: pickText(properties, ['Status', 'Estado']) || 'guardado',
      productUrl: properties['Product URL']?.url || '',
      imagePropertyName: pickFilesPropertyName(properties),
      images: extractFiles(page)
    };
  });

  const enriched = await Promise.all(baseItems.map(async item => {
    if (item.images.length > 0 || !item.productUrl) return item;
    return enrichItemFromUrl(item, { persistToNotion: true });
  }));

  return enriched
    .filter(item => item.images.length > 0)
    .map(({ imagePropertyName, ...item }) => item);
}

function normalizeGroupKey(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mergeUniqueImages(items) {
  const seen = new Set();
  return items.flatMap(item => item.images || []).filter(image => {
    if (!image.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}

function groupOutfits(outfits) {
  const groups = new Map();

  for (const outfit of outfits) {
    const normalizedTitle = normalizeGroupKey(outfit.title || '');
    const key = normalizedTitle && normalizedTitle !== 'sin nombre' ? normalizedTitle : outfit.id;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(outfit);
  }

  return [...groups.values()].map(group => {
    const first = group[0];
    const tags = [...new Set(group.flatMap(outfit => outfit.tags || []))];
    return {
      ...first,
      ids: group.map(outfit => outfit.id),
      images: mergeUniqueImages(group),
      tags,
      photoCount: mergeUniqueImages(group).length
    };
  });
}

async function resolveOutfitsDatabaseId() {
  if (resolvedOutfitsDatabaseId) return resolvedOutfitsDatabaseId;

  resolvedOutfitsDatabaseId = await resolveDatabaseId({
    currentId: resolvedOutfitsDatabaseId,
    name: OUTFITS_DB_NAME,
    excludeIds: [WARDROBE_DB_ID]
  });
  return resolvedOutfitsDatabaseId;
}

async function discoverOutfitsDatabaseId() {
  resolvedOutfitsDatabaseId = '';
  resolvedOutfitsDatabaseId = await resolveDatabaseId({
    currentId: '',
    name: OUTFITS_DB_NAME,
    excludeIds: [WARDROBE_DB_ID]
  });
  return resolvedOutfitsDatabaseId;
}

async function fetchOutfitsDatabaseItems() {
  const databaseId = await resolveOutfitsDatabaseId();
  let data;
  try {
    data = await notionRequest(`databases/${databaseId}/query`, {
      page_size: 100
    });
  } catch (error) {
    if (!OUTFITS_DB_ID || !isNotionObjectNotFound(error)) throw error;

    const discoveredDatabaseId = await discoverOutfitsDatabaseId();
    data = await notionRequest(`databases/${discoveredDatabaseId}/query`, {
      page_size: 100
    });
  }

  const outfits = (data.results || []).map(page => {
    const properties = page.properties || {};
    const tags = collectTags(properties, ['Tags', 'Etiquetas', 'Season', 'Temporada', 'Occasion', 'Ocasión']);
    return {
      id: page.id,
      notionUrl: page.url,
      title: pickTitle(properties),
      description: pickText(properties, ['Notes', 'Description', 'Details', 'Notas', 'Descripción']),
      status: pickText(properties, ['Status', 'Estado']),
      season: pickText(properties, ['Season', 'Temporada']),
      occasion: pickText(properties, ['Occasion', 'Ocasión', 'Uso']),
      date: pickDate(properties, ['Date', 'Fecha', 'Added At']),
      tags,
      images: extractFiles(page)
    };
  });

  return groupOutfits(outfits).filter(outfit => outfit.images.length > 0);
}

async function resolveStoresDatabaseId() {
  if (resolvedStoresDatabaseId) return resolvedStoresDatabaseId;

  resolvedStoresDatabaseId = await resolveDatabaseId({
    currentId: resolvedStoresDatabaseId,
    name: STORES_DB_NAME,
    alternativeNames: ['Tiendas', 'Shops'],
    excludeIds: [WARDROBE_DB_ID]
  });
  return resolvedStoresDatabaseId;
}

async function fetchStoresDatabaseItems() {
  const databaseId = await resolveStoresDatabaseId();
  const data = await notionRequest(`databases/${databaseId}/query`, {
    page_size: 100
  });

  return (data.results || []).map(page => {
    const properties = page.properties || {};
    const category = pickText(properties, ['Category', 'Tipo', 'Type', 'Style', 'Estilo']);
    const tags = collectTags(properties, ['Tags', 'Etiquetas', 'Category', 'Tipo', 'Style', 'Estilo']);
    return {
      id: page.id,
      notionUrl: page.url,
      title: pickTitle(properties),
      description: pickText(properties, ['Notes', 'Description', 'Details', 'Notas', 'Descripción']),
      category,
      status: pickText(properties, ['Status', 'Estado']),
      location: pickText(properties, ['Location', 'Ubicación', 'Country', 'País']),
      websiteUrl: pickUrl(properties, ['Website', 'Web', 'URL', 'Site', 'Sitio']),
      instagramUrl: pickUrl(properties, ['Instagram', 'IG']),
      tags,
      images: extractFiles(page)
    };
  });
}

async function getBlockChildren(blockId) {
  const response = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, {
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion ${response.status}: ${text}`);
  }
  return response.json();
}

async function findChildDatabaseByName(parentBlockId, name) {
  const data = await getBlockChildren(parentBlockId);
  const normalized = name.trim().toLowerCase();
  return (data.results || []).find(block =>
    block.type === 'child_database' &&
    block.child_database?.title?.trim().toLowerCase() === normalized
  );
}

function normalizeItemName(text) {
  return text.replace(/\s*link\s*$/i, '').trim().replace(/[\s,]+$/g, '');
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PRODUCT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 WardrobeViewer' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractImageUrls(html, baseUrl) {
  const matches = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)/gi)];
  const urls = matches.map(m => {
    try {
      return new URL(m[1], baseUrl).href;
    } catch {
      return m[1];
    }
  });
  return [...new Set(urls)];
}

function imageNameForItem(item, index) {
  const fallback = `image-${index + 1}`;
  return (item.title || fallback)
    .replace(/[<>:"/\\|?*]+/g, '')
    .trim()
    .slice(0, 90) || fallback;
}

async function persistImagesToNotion(item, images) {
  if (!PERSIST_ENRICHED_IMAGES_TO_NOTION || !item.imagePropertyName || images.length === 0) return false;

  const files = images.map((image, index) => ({
    name: imageNameForItem(item, index),
    type: 'external',
    external: { url: image.url }
  }));

  await notionPatch(`pages/${item.id}`, {
    properties: {
      [item.imagePropertyName]: { files }
    }
  });

  return true;
}

async function enrichItemFromUrl(item, { persistToNotion = false } = {}) {
  if (!item.productUrl) return item;
  try {
    const html = await fetchHtml(item.productUrl);
    const images = extractImageUrls(html, item.productUrl).map((url, index) => ({
      name: `image-${index + 1}`,
      url,
      type: 'external'
    }));
    if (persistToNotion) {
      try {
        await persistImagesToNotion(item, images);
      } catch (error) {
        console.warn(`No pude guardar imagen en Notion para "${item.title}":`, error.message);
      }
    }
    return { ...item, images };
  } catch {
    return { ...item, images: [] };
  }
}

async function fetchPageItems() {
  const blocks = await getBlockChildren(LEGACY_CLOTHES_PAGE_ID);
  let currentStore = '';
  const rawItems = [];

  for (const block of blocks.results || []) {
    if (block.type === 'heading_3') {
      currentStore = plainText(block.heading_3.rich_text).trim();
      continue;
    }
    if (block.type !== 'bulleted_list_item') continue;

    const rich = block.bulleted_list_item.rich_text || [];
    let productUrl = '';
    for (const chunk of rich) {
      const url = chunk?.text?.link?.url;
      if (url) productUrl = url;
    }

    rawItems.push({
      id: block.id,
      notionUrl: `https://www.notion.so/${LEGACY_CLOTHES_PAGE_ID.replace(/-/g, '')}`,
      title: normalizeItemName(plainText(rich)),
      description: '',
      category: '',
      brand: currentStore,
      color: '',
      size: '',
      price: null,
      status: 'guardado',
      productUrl,
      images: []
    });
  }

  const enriched = await Promise.all(rawItems.map(enrichItemFromUrl));
  return enriched.filter(item => item.images.length > 0);
}

async function fetchItems() {
  if (!NOTION_TOKEN) throw new Error('Falta NOTION_TOKEN');
  try {
    return await fetchWardrobeDatabaseItems();
  } catch (error) {
    console.warn('Fallo la database de wardrobe, uso fallback legacy:', error.message);
    return fetchPageItems();
  }
}

function isItemsCacheFresh() {
  return itemsCache.items && Date.now() - itemsCache.fetchedAt < ITEMS_CACHE_TTL_MS;
}

function isOutfitsCacheFresh() {
  return outfitsCache.items && Date.now() - outfitsCache.fetchedAt < ITEMS_CACHE_TTL_MS;
}

function isStoresCacheFresh() {
  return storesCache.items && Date.now() - storesCache.fetchedAt < ITEMS_CACHE_TTL_MS;
}

async function refreshItemsCache() {
  if (itemsCache.refreshing) return itemsCache.refreshing;

  itemsCache.refreshing = fetchItems()
    .then(items => {
      itemsCache.items = items;
      itemsCache.fetchedAt = Date.now();
      return items;
    })
    .finally(() => {
      itemsCache.refreshing = null;
    });

  return itemsCache.refreshing;
}

async function getItemsWithCache({ force = false } = {}) {
  if (!force && isItemsCacheFresh()) {
    return { items: itemsCache.items, cache: 'hit' };
  }

  if (!force && itemsCache.items) {
    refreshItemsCache().catch(error => {
      console.warn('No pude refrescar cache de prendas:', error.message);
    });
    return { items: itemsCache.items, cache: 'stale' };
  }

  const items = await refreshItemsCache();
  return { items, cache: 'refresh' };
}

async function refreshOutfitsCache() {
  if (outfitsCache.refreshing) return outfitsCache.refreshing;

  outfitsCache.refreshing = fetchOutfitsDatabaseItems()
    .then(items => {
      outfitsCache.items = items;
      outfitsCache.fetchedAt = Date.now();
      return items;
    })
    .finally(() => {
      outfitsCache.refreshing = null;
    });

  return outfitsCache.refreshing;
}

async function getOutfitsWithCache({ force = false } = {}) {
  if (!force && isOutfitsCacheFresh()) {
    return { items: outfitsCache.items, cache: 'hit' };
  }

  if (!force && outfitsCache.items) {
    refreshOutfitsCache().catch(error => {
      console.warn('No pude refrescar cache de outfits:', error.message);
    });
    return { items: outfitsCache.items, cache: 'stale' };
  }

  const items = await refreshOutfitsCache();
  return { items, cache: 'refresh' };
}

async function refreshStoresCache() {
  if (storesCache.refreshing) return storesCache.refreshing;

  storesCache.refreshing = fetchStoresDatabaseItems()
    .then(items => {
      storesCache.items = items;
      storesCache.fetchedAt = Date.now();
      return items;
    })
    .finally(() => {
      storesCache.refreshing = null;
    });

  return storesCache.refreshing;
}

async function getStoresWithCache({ force = false } = {}) {
  if (!force && isStoresCacheFresh()) {
    return { items: storesCache.items, cache: 'hit' };
  }

  if (!force && storesCache.items) {
    refreshStoresCache().catch(error => {
      console.warn('No pude refrescar cache de tiendas:', error.message);
    });
    return { items: storesCache.items, cache: 'stale' };
  }

  const items = await refreshStoresCache();
  return { items, cache: 'refresh' };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/') {
    return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }
  if (url.pathname === '/styles.css') {
    return sendFile(res, path.join(PUBLIC_DIR, 'styles.css'), 'text/css; charset=utf-8');
  }
  if (url.pathname === '/app.js') {
    return sendFile(res, path.join(PUBLIC_DIR, 'app.js'), 'application/javascript; charset=utf-8');
  }
  if (url.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === '/api/items') {
    try {
      const force = url.searchParams.get('refresh') === '1';
      const { items, cache } = await getItemsWithCache({ force });
      return sendJson(res, 200, {
        databaseId: WARDROBE_DB_ID,
        count: items.length,
        cache,
        cacheTtlMs: ITEMS_CACHE_TTL_MS,
        fetchedAt: new Date(itemsCache.fetchedAt).toISOString(),
        items
      }, {
        'Cache-Control': 'private, max-age=60'
      });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }
  if (url.pathname === '/api/outfits') {
    try {
      const force = url.searchParams.get('refresh') === '1';
      const { items, cache } = await getOutfitsWithCache({ force });
      return sendJson(res, 200, {
        databaseId: resolvedOutfitsDatabaseId,
        databaseName: OUTFITS_DB_NAME,
        count: items.length,
        cache,
        cacheTtlMs: ITEMS_CACHE_TTL_MS,
        fetchedAt: new Date(outfitsCache.fetchedAt).toISOString(),
        items
      }, {
        'Cache-Control': 'private, max-age=60'
      });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }
  if (url.pathname === '/api/stores') {
    try {
      const force = url.searchParams.get('refresh') === '1';
      const { items, cache } = await getStoresWithCache({ force });
      return sendJson(res, 200, {
        databaseId: resolvedStoresDatabaseId,
        databaseName: STORES_DB_NAME,
        count: items.length,
        cache,
        cacheTtlMs: ITEMS_CACHE_TTL_MS,
        fetchedAt: new Date(storesCache.fetchedAt).toISOString(),
        items
      }, {
        'Cache-Control': 'private, max-age=60'
      });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Wardrobe viewer en http://localhost:${PORT}`);
});
