# MediaNotes - Coding Standards

> Proyecto expandido: Anime + Películas + Series

## Arquitectura y Tecnología
- HTML5 Semántico
- Tailwind CSS (vía CDN)
- JavaScript Vanilla (ES6+)
- Sin frameworks de frontend pesados (React, Vue, etc.)
- Python `http.server` para el backend local minimalista.

## Interfaz de Usuario (UI/UX)
- Diseño estilo "Night Owl" (inspirado en el tema VS Code de Sarah Drasner).
- Paleta de colores Night Owl:
  - Background principal: `#011627` (navy profundo).
  - Cards / Modals: `#0b1929` (navy ligeramente más claro).
  - Bordes / Inputs / Hovers: `#1d3b53` (selección navy).
  - Acento primario: `#82aaff` (azul brillante Night Owl).
  - Acento secundario: `#7e57c2` (lavanda).
  - Hover primario: `#5472b3` (azul más oscuro).
- Modales (Ventanas flotantes) en lugar de múltiples páginas HTML.
- Componentes interactivos usando `box-shadow` e interacciones suaves de `transition-all`.
- Íconos nativos en formato SVG o FontAwesome, sin usar Emojis en la UI (excepto en las reseñas).
- Listados en formato carrusel lateral (`scroll-snap`) con botones superpuestos al hacer hover.

## Convenciones de Código (JavaScript)
- Uso estricto de `async/await` para el manejo de APIs locales (Fetch API).
- Funciones modulares y autodescriptivas (ej. `renderHero`, `renderCatalog`, `applyFilters`).
- Siempre proveer de un Fallback offline (uso de `localStorage`) cuando falle el Fetch al backend local.
- Prevenir bugs de scroll y glitches evitando transiciones de bordes transparentes.

## Convenciones de Git
- Commits Convencionales (feat, fix, docs, refactor, style, chore).
- Mensajes de commit claros y en el mismo idioma que el desarrollo.

## Fuentes de Datos y Contenido (Anime)
- Opciones de búsqueda de información e imágenes para cuando el usuario solicite agregar nuevos animes:
  1. **Opción Primaria:** API de Jikan (MyAnimeList). Endpoint de búsqueda: `https://api.jikan.moe/v4/anime?q={titulo}`. Extraer el título, sinopsis, géneros, estudio, estado y la imagen de alta calidad desde `images.jpg.large_image_url`.
  2. **Opción Secundaria:** TMDB (The Movie Database) o AniList. Utilizar solo si la API de Jikan falla o el anime no se encuentra disponible ahí.

## Fuentes de Datos y Contenido (Películas y Series)
- Opciones de búsqueda de información e imágenes para contenido general (películas, series de acción real, animación occidental):
  1. **Opción Primaria:** TMDB API (The Movie Database). Endpoint de búsqueda: `https://api.jikan.moe/v4/` → NO, usar `https://api.themoviedb.org/3/search/movie?query={titulo}&api_key={key}` o `/search/tv?query={titulo}&api_key={key}`. Extraer: título, sinopsis, géneros, director (películas) o red/creador (series), duración, imagen de alta calidad desde `poster_path` (prefijo: `https://image.tmdb.org/t/p/original` — NO usar `/w500/` que devuelve 404 en algunos paths).
  2. **Opción Secundaria:** OMDb API. Endpoint: `https://www.omdbapi.com/?t={titulo}&apikey={key}`. Utilizar solo si TMDB falla.
- **Nota:** Se necesita una API key de TMDB (gratuita, registro en themoviedb.org) y opcionalmente de OMDb.

## Regla de Extracción de URLs de Imagen (OBLIGATORIO)

> **CAUSA RAÍZ DE IMÁGENES ROTAS**: Las URLs de imagen **siempre** se extraen del **campo JSON** de la respuesta de la API, **NUNCA** de HTML, scraping de páginas web, ni de URLs construidas manualmente.

- **Jikan**: Extraer de `data[0].images.jpg.large_image_url`. Nunca de `<img>` en HTML.
- **TMDB**: Extraer de `results[0].poster_path` y concatenar con `https://image.tmdb.org/t/p/original`. Nunca de meta tags, og:image, ni HTML.
- **OMDb**: Extraer de `Poster` directamente de la respuesta JSON.
- Si la URL viene de scraping web (no de JSON directo), **NO confiar en ella**. Re-verificar contra la respuesta de la API original.

## Flujo para Agregar Animes (OBLIGATORIO)

### Reglas absolutas
- NUNCA editar `datos.json` directamente.
- NUNCA leer `datos.json` (innecesario y consume tokens).
- NUNCA usar herramientas de escritura de archivos para insertar animes.
- SIEMPRE usar el endpoint `POST /api/anime` del servidor local.

### Pasos

1. **Buscar en Jikan** via WebFetch:
   `GET https://api.jikan.moe/v4/anime?q={titulo}&limit=5`

2. **Construir el objeto** con los datos extraídos de la respuesta:
   ```json
   {
     "id": "{titulo_en_snake_case}",
     "title": "Título oficial en inglés o romaji",
     "image": "{images.jpg.large_image_url}",
     "type": "Serie | ONA | OVA | Película",
     "studio": "{studios[0].name}",
     "status": "Finalizado | En emisión | Próximamente",
     "genres": ["{genres[].name}"],
     "rating": {nota_del_usuario},
     "synopsis": "Sinopsis traducida al español",
     "review": "",
      "updatedAt": {timestamp_unix_ms_real},
     "episodes": {episodes},
     "seasons": 1,
     "season": "{año_de_estreno}"
   }
   ```

   > **Convención Pendientes**: Si el usuario pide agregar un anime como "pendiente" (para ver después), usar `"rating": 0`. Los animes con `rating === 0` se muestran exclusivamente en la vista "Pendientes" y NO aparecen en el catálogo principal. Al calificarlos (rating > 0), pasan automáticamente al catálogo.

3. **Enviar via Bash** usando curl — NO usar `Invoke-RestMethod` (corrompe acentos y caracteres especiales):
   ```powershell
   $json = '{...}'
   $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
   [System.IO.File]::WriteAllBytes("$env:TEMP\anime_tmp.json", $bytes)
   curl.exe -s -X POST "http://localhost:8000/api/anime" -H "Content-Type: application/json" --data-binary "@$env:TEMP\anime_tmp.json"
   ```
   > **NUNCA** usar `Invoke-RestMethod` con strings que contengan tildes, eñes u otros caracteres especiales — genera triple encoding UTF-8 que corrompe el archivo.

4. **Verificar la respuesta** del servidor:
   - `201` — agregado correctamente
   - `409` — el `id` ya existe → ajustar el `id` y reintentar
   - `400` — faltan campos `id` o `title`
   - Error de conexión — el servidor no está corriendo, informar al usuario

## Modelo de Datos Unificado

Todos los items (anime, películas, series) comparten un esquema común con campos específicos por tipo:

```json
{
  "id": "{titulo_en_snake_case}",
  "title": "Título oficial",
  "image": "https://...",
  "type": "Serie | ONA | OVA | Película",
  "genres": ["Acción", "Comedia"],
  "rating": 8.5,
  "synopsis": "Sinopsis...",
  "review": "",
  "updatedAt": 1234567890,
  "category": "anime | general",
  "studio": "Estudio (anime) | null",
  "director": "Director (películas) | null",
  "network": "Netflix, Disney+, HBO... (series) | null",
  "episodes": 24,
  "seasons": 3,
  "season": "2024",
  "runtime": 120
}
```

> **Regla de `category`**: Campo obligatorio. `"anime"` para contenido de Jikan, `"general"` para TMDB/OMDb. El filtro de UI usa este campo para separar "Anime" vs "General".

## Flujo para Agregar Películas/Series (OBLIGATORIO)

### Reglas absolutas
- Mismas reglas que anime: NUNCA editar `datos.json`, SIEMPRE usar `POST /api/anime`.

### Pasos

1. **Buscar en TMDB** via WebFetch:
   - Películas: `GET https://api.themoviedb.org/3/search/movie?query={titulo}&api_key={key}`
   - Series: `GET https://api.themoviedb.org/3/search/tv?query={titulo}&api_key={key}`

2. **Construir el objeto** con `category: "general"` y campos específicos:
   ```json
   {
     "id": "{titulo_en_snake_case}",
     "title": "Título oficial en español",
     "image": "https://image.tmdb.org/t/p/w500{poster_path}",
     "type": "Película | Serie",
     "genres": "{genre_ids → nombres}",
     "rating": {nota_del_usuario},
     "synopsis": "Sinopsis traducida al español",
     "review": "",
     "updatedAt": {timestamp_unix_ms_real},
     "category": "general",
     "studio": null,
     "director": "{director_name} | null",
     "network": "{networks[0].name} | null",
     "episodes": {number_of_episodes} | null,
     "seasons": {number_of_seasons} | null,
     "season": "{first_air_date year} | null",
     "runtime": {runtime} | null
   }
   ```

3. **Enviar via Bash** — mismo proceso que anime (curl, NO Invoke-RestMethod).

4. **Verificar respuesta** — mismos códigos que anime.