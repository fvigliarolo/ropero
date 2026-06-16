# Wardrobe Viewer

Viewer web para la ropa que Fede fue guardando en Notion.

## Fuente actual de datos

La fuente principal ahora es una database dedicada de Notion para la wishlist de ropa:
- `Wardrobe Items`
- database id: `371dded7-4e1e-810c-ae33-e59e6ef1dbc4`

Se creó para separar esta app de los recuerdos generales y cumplir el criterio de privacidad del producto.

La app:
- lee la database estructurada de ropa
- lee la database `Outfits` para mostrar combinaciones guardadas con carrusel de fotos
- usa título, tienda, categoría, color, talle, estado y link del producto
- si una prenda no tiene imagen guardada en Notion, visita el producto y toma su `og:image` / `twitter:image`
- cuando encuentra esas imágenes externas, las guarda en la propiedad de archivos de Notion para acelerar cargas futuras
- arma una galería única con filtros por tienda y búsqueda
- cachea la lista de prendas en memoria para no consultar Notion en cada visita

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
- `NOTION_OUTFITS_DB_ID` para fijar la database de outfits. Si no se configura, la app busca una database llamada `Outfits`
- `NOTION_OUTFITS_DB_NAME` para cambiar el nombre usado en la búsqueda automática. Por defecto: `Outfits`
- `NOTION_CLOTHES_PAGE_ID` para cambiar la página legacy de fallback
- `PORT` para cambiar el puerto
- `ITEMS_CACHE_TTL_MS` para ajustar la duración del cache de prendas. Por defecto: 10 minutos
- `PRODUCT_FETCH_TIMEOUT_MS` para limitar cuánto espera al extraer imagen de sitios externos. Por defecto: 6 segundos
- `NOTION_IMAGE_PROPERTY` para indicar la propiedad de archivos donde guardar imágenes. Si no se configura, usa la primera propiedad tipo `files`, prefiriendo nombres como `Images`, `Image`, `Fotos` o `Foto`
- `PERSIST_ENRICHED_IMAGES_TO_NOTION=false` para desactivar la escritura automática de imágenes encontradas

## Performance

La app usa cache en memoria para `/api/items`. La primera carga después de iniciar el servidor puede tardar porque consulta Notion y, si faltan imágenes, algunos sitios externos. Cuando encuentra una imagen externa, intenta guardarla en la propiedad de archivos del item en Notion. Las visitas siguientes responden desde cache y, después de la primera persistencia, Notion ya trae la imagen junto con el resto de los datos.

Si querés forzar una recarga manual, podés abrir:

```bash
/api/items?refresh=1
```

Render usa `/healthz` como health check para no llamar Notion solamente para verificar que el proceso está vivo.

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
   - health check: `/healthz`
3. Configurar variables de entorno:
   - `NOTION_TOKEN`
   - `NOTION_WARDROBE_DB_ID=371dded7-4e1e-810c-ae33-e59e6ef1dbc4`
   - `NOTION_OUTFITS_DB_ID` si querés evitar la búsqueda automática por nombre
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
