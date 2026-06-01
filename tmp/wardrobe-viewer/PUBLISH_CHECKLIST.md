# Publish checklist

## Repo

- [ ] Subir `tmp/wardrobe-viewer` al repo remoto
- [ ] Confirmar que `.env` no esté versionado
- [ ] Revisar que `render.yaml` esté en la raíz del repo que va a usar Render o mantener el blueprint donde corresponda

## Notion

- [ ] Confirmar acceso de la integración a `Wardrobe Items`
- [ ] Database principal: `371dded7-4e1e-810c-ae33-e59e6ef1dbc4`
- [ ] Fallback legacy page: `344dded7-4e1e-8137-87a1-fbe4ff41076e`

## Render

- [ ] Crear Web Service `atila-wardrobe-viewer`
- [ ] Root dir: `tmp/wardrobe-viewer`
- [ ] Build: `npm install`
- [ ] Start: `node server.js`
- [ ] Health check: `/api/items`
- [ ] Variables:
  - [ ] `NOTION_TOKEN`
  - [ ] `NOTION_WARDROBE_DB_ID=371dded7-4e1e-810c-ae33-e59e6ef1dbc4`
  - [ ] `NOTION_CLOTHES_PAGE_ID=344dded7-4e1e-8137-87a1-fbe4ff41076e`
  - [ ] `PORT=10000`
  - [ ] `NODE_VERSION=20`

## Smoke test post deploy

- [ ] Abrir home y verificar que cargue la grilla
- [ ] Probar búsqueda
- [ ] Probar filtro por tienda
- [ ] Abrir una prenda en Notion
- [ ] Abrir un producto externo
- [ ] Verificar `GET /api/items`
