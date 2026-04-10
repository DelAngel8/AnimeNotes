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