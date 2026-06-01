import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const PORT = process.env.PORT || 4782;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = '2022-06-28';
const WARDROBE_DB_ID = process.env.NOTION_WARDROBE_DB_ID || '371dded7-4e1e-810c-ae33-e59e6ef1dbc4';
const LEGACY_CLOTHES_PAGE_ID = process.env.NOTION_CLOTHES_PAGE_ID || '344dded7-4e1e-8137-87a1-fbe4ff41076e';
const PUBLIC_DIR = path.join(process.cwd(), 'public');

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
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

async function notionRequest(endpoint, payload) {
  const response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
    method: 'POST',
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
      images: extractFiles(page)
    };
  });

  const enriched = await Promise.all(baseItems.map(async item => {
    if (item.images.length > 0 || !item.productUrl) return item;
    return enrichItemFromUrl(item);
  }));

  return enriched.filter(item => item.images.length > 0);
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

function normalizeItemName(text) {
  return text.replace(/\s*link\s*$/i, '').trim().replace(/[\s,]+$/g, '');
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 WardrobeViewer' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function extractImageUrls(html) {
  const matches = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)/gi)];
  const urls = matches.map(m => m[1]);
  return [...new Set(urls)];
}

async function enrichItemFromUrl(item) {
  if (!item.productUrl) return item;
  try {
    const html = await fetchHtml(item.productUrl);
    const images = extractImageUrls(html).map((url, index) => ({
      name: `image-${index + 1}`,
      url,
      type: 'external'
    }));
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
  if (url.pathname === '/api/items') {
    try {
      const items = await fetchItems();
      return sendJson(res, 200, { databaseId: WARDROBE_DB_ID, count: items.length, items });
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
