# Wardrobe Viewer

Viewer web para la ropa que Fede fue guardando en Notion.

## Fuente actual de datos

La fuente principal ahora es una database dedicada de Notion para la wishlist de ropa:
- `Wardrobe Items`
- database id: `371dded7-4e1e-810c-ae33-e59e6ef1dbc4`

Se creó para separar esta app de los recuerdos generales y cumplir el criterio de privacidad del producto.

La app:
- lee la database estructurada de ropa
- usa título, tienda, categoría, color, talle, estado y link del producto
- si una prenda no tiene imagen guardada en Notion, visita el producto y toma su `og:image` / `twitter:image`
- arma una galería única con filtros por tienda y búsqueda

Quedó un fallback legacy a la página original:
- `Compras de ropa`
- page id: `344dded7-4e1e-8137-87a1-fbe4ff41076e`

## Cómo levantarla local

```bash
cd /home/fede/.openclaw/workspace/tmp/wardrobe-viewer
cp .env.example .env
# editar .env con el token real
export $(grep -v '^#' .env | xargs)
node server.js
```

Abrir en navegador:
- `http://localhost:4782`

Chequeo rápido:

```bash
npm run healthcheck
```

## Config opcional

- `NOTION_WARDROBE_DB_ID` para cambiar la database principal
- `NOTION_CLOTHES_PAGE_ID` para cambiar la página legacy de fallback
- `PORT` para cambiar el puerto

## Estado actual

- Funciona con la database `Wardrobe Items`
- Ya se migraron 24 prendas desde la página original a esa database
- Muestra las prendas con foto extraída desde los sitios originales cuando hace falta
- Algunas prendas pueden no aparecer si el link original ya no existe o si la tienda no expone imagen social usable

## Despliegue por internet

La opción preparada en este repo es **Render**.

### Checklist antes de publicar

- el repo remoto debe incluir `tmp/wardrobe-viewer`
- no subir `.env`
- tener a mano el `NOTION_TOKEN`
- confirmar que la integración de Notion siga teniendo acceso a la database `Wardrobe Items`

### Render

1. Crear un nuevo Web Service conectado a este repo.
2. Usar el archivo `render.yaml` o estos valores:
   - runtime: `node`
   - rootDir: `tmp/wardrobe-viewer`
   - buildCommand: `npm install`
   - startCommand: `node server.js`
   - health check: `/api/items`
3. Configurar variables de entorno:
   - `NOTION_TOKEN`
   - `NOTION_WARDROBE_DB_ID=371dded7-4e1e-810c-ae33-e59e6ef1dbc4`
   - `NOTION_CLOTHES_PAGE_ID=344dded7-4e1e-8137-87a1-fbe4ff41076e`
   - `PORT=10000`
   - `NODE_VERSION=20`
4. Deploy inicial.
5. Verificar:
   - que `/api/items` responda 200
   - que la grilla cargue prendas
   - que abrir producto funcione

### Qué queda resuelto

- la app usa una **database separada de ropa**
- ya no depende de exponer recuerdos generales como fuente principal
- si la database falla, existe fallback a la página legacy
- la configuración mínima para Render ya quedó versionada

### Alternativas

- **Cloudflare Tunnel** si querés publicar desde tu máquina sin abrir puertos.
- **Ngrok** quedó descartado por ahora porque la instalación local está vieja para la cuenta actual.

## Próximo paso recomendado

Con la base ya separada, el paso más valioso después de publicar es mejorar el alta de nuevas prendas para que entren directo en `Wardrobe Items` en vez de seguir dependiendo de la página legacy.
