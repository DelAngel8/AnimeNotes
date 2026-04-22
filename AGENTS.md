# AnimeNotes - Coding Standards

## Arquitectura y Tecnología
- HTML5 Semántico
- Tailwind CSS (vía CDN)
- JavaScript Vanilla (ES6+)
- Sin frameworks de frontend pesados (React, Vue, etc.)
- Python `http.server` para el backend local minimalista.

## Interfaz de Usuario (UI/UX)
- Diseño estilo "Netflix Dark Theme"
- Color principal de acento: Índigo (`#4338CA`) y Púrpura oscuro.
- Background principal: `#0F0F23`.
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
     "type": "TV | ONA | OVA | Película",
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