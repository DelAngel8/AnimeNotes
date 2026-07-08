import http.server
import socketserver
import json
import os
import webbrowser
import threading
from threading import Timer
import urllib.request
import urllib.parse
import urllib.error
import ssl

MAX_PAYLOAD_BYTES = 1 * 1024 * 1024  # 1 MB
file_lock = threading.Lock()

# Mapa de normalización para campos de texto sin acento -> con acento
TYPE_MAP = {
    'Pelicula': 'Película',
    'pelicula': 'Película',
    'película': 'Película',
    'tv': 'TV',
    'ova': 'OVA',
    'ona': 'ONA',
    'especial': 'Especial',
    'Serie': 'Serie',
    'serie': 'Serie',
    'movie': 'Película',
    'Movie': 'Película',
}

STATUS_MAP = {
    'Finalizado': 'Finalizado',
    'finalizado': 'Finalizado',
    'En emision': 'En emisión',
    'en emision': 'En emisión',
    'En emisión': 'En emisión',
    'Proximamente': 'Próximamente',
    'proximamente': 'Próximamente',
    'Próximamente': 'Próximamente',
    'Pausado': 'Pausado',
}

def normalize_anime(anime):
    """Normaliza campos críticos para evitar duplicados por encoding."""
    # Normalizar type
    t = anime.get('type', '')
    anime['type'] = TYPE_MAP.get(t, t)

    # Normalizar status
    s = anime.get('status', '')
    anime['status'] = STATUS_MAP.get(s, s)

    # Asegurar category
    if 'category' not in anime:
        anime['category'] = 'anime'

    # Asegurar updatedAt
    if 'updatedAt' not in anime:
        import time
        anime['updatedAt'] = int(time.time() * 1000)

    return anime

def validate_anime(data):
    """Valida tipos y longitudes del item. Retorna (cleaned, error)."""
    if not isinstance(data, dict):
        return None, "Request body must be a JSON object"

    # Required fields
    for field in ('id', 'title'):
        val = data.get(field)
        if not isinstance(val, str) or not val.strip():
            return None, f"'{field}' must be a non-empty string"
        if len(val) > 500:
            return None, f"'{field}' exceeds max length of 500"

    # Required category
    category = data.get('category')
    if category not in ('anime', 'general'):
        return None, "'category' must be 'anime' or 'general'"

    # String fields
    str_fields = {
        'image': 2000,
        'type': 50,
        'studio': 200,
        'status': 50,
        'season': 50,
        'synopsis': 5000,
        'review': 5000,
        'director': 200,
        'network': 200,
    }
    for field, max_len in str_fields.items():
        val = data.get(field)
        if val is not None:
            if not isinstance(val, str):
                return None, f"'{field}' must be a string"
            if len(val) > max_len:
                return None, f"'{field}' exceeds max length of {max_len}"

    # Numeric fields
    int_fields = ('episodes', 'seasons', 'runtime', 'releaseYear')
    for field in int_fields:
        val = data.get(field)
        if val is not None and val != '' and val != 0:
            if not isinstance(val, (int, float)):
                return None, f"'{field}' must be a number"
            if val < 0:
                return None, f"'{field}' must be non-negative"

    # rating
    rating = data.get('rating')
    if rating is not None and rating != '':
        if not isinstance(rating, (int, float)):
            return None, "'rating' must be a number"
        if not (0 <= float(rating) <= 10):
            return None, "'rating' must be between 0 and 10"

    # genres must be array of strings
    genres = data.get('genres')
    if genres is not None:
        if not isinstance(genres, list):
            return None, "'genres' must be an array"
        if len(genres) > 20:
            return None, "'genres' exceeds max count of 20"
        for g in genres:
            if not isinstance(g, str) or not g.strip():
                return None, "Each genre must be a non-empty string"
            if len(g) > 100:
                return None, "Each genre must be under 100 characters"

    return data, None

TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '326c1e40ed24f0abf016921542efceca')
TMDB_BASE_URL = 'https://api.themoviedb.org/3'
TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original'
SSL_CTX = ssl.create_default_context()

PORT = 8000
DATA_FILE = 'datos.json'

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/data':
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            with file_lock:
                if os.path.exists(DATA_FILE):
                    with open(DATA_FILE, 'rb') as f:
                        self.wfile.write(f.read())
                else:
                    self.wfile.write(b'[]')

        elif self.path.startswith('/api/search'):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == '/api/search':
                self.handle_search()
            else:
                self._send_json(404, '{"error": "Not found"}')

        else:
            # Sirve los archivos estáticos normales (index.html, app.js, etc.)
            if self.path == '/':
                self.path = '/index.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def handle_search(self):
        """Busca películas/series en TMDB."""
        try:
            parsed_url = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed_url.query)
            query = params.get('q', [None])[0]
            media_type = params.get('type', ['multi'])[0]  # multi, movie, tv

            if not query or not query.strip():
                self.send_response(400)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing query parameter q"}')
                return

            if len(query) > 500:
                self._send_json(400, '{"error": "Query too long (max 500 chars)"}')
                return

            # Construir URL de TMDB
            if media_type == 'movie':
                tmdb_url = f"{TMDB_BASE_URL}/search/movie?query={urllib.parse.quote(query)}&api_key={TMDB_API_KEY}&language=es-ES"
            elif media_type == 'tv':
                tmdb_url = f"{TMDB_BASE_URL}/search/tv?query={urllib.parse.quote(query)}&api_key={TMDB_API_KEY}&language=es-ES"
            else:
                tmdb_url = f"{TMDB_BASE_URL}/search/multi?query={urllib.parse.quote(query)}&api_key={TMDB_API_KEY}&language=es-ES"

            # Llamar a TMDB
            req = urllib.request.Request(tmdb_url, headers={'User-Agent': 'MediaNotes/1.0'})
            with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as response:
                raw = response.read()
                data = json.loads(raw.decode('utf-8'))

            print(f"[SEARCH] OK query='{query}' type='{media_type}' results={len(data.get('results', []))}")

            # Formatear resultados
            results = []
            for item in data.get('results', [])[:10]:  # Max 10 resultados
                media = item.get('media_type', media_type)
                if media == 'person':
                    continue

                title = item.get('title') or item.get('name', 'Sin título')
                poster = item.get('poster_path')
                image = f"{TMDB_IMAGE_BASE}{poster}" if poster else ''
                overview = item.get('overview', '')

                genre_ids = item.get('genre_ids', [])

                if media == 'movie':
                    item_type = 'Película'
                    release_date = item.get('release_date', '')
                    year = release_date[:4] if release_date else None
                else:
                    item_type = 'Serie'
                    first_air = item.get('first_air_date', '')
                    year = first_air[:4] if first_air else None

                results.append({
                    'tmdb_id': item.get('id'),
                    'title': title,
                    'image': image,
                    'type': item_type,
                    'synopsis': overview,
                    'year': year,
                    'genre_ids': genre_ids,
                    'media_type': media,
                    'vote_average': item.get('vote_average', 0),
                })

            payload = json.dumps({'results': results}, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        except urllib.error.URLError as e:
            print(f"[ERROR] TMDB request failed: {e}")
            self._send_json(502, '{"error": "Failed to connect to TMDB"}')
        except Exception as e:
            print(f"[ERROR] Search handler: {e}")
            self._send_json(500, '{"error": "Internal server error"}')

    def _send_json(self, code, body):
        """Helper para enviar JSON de forma segura."""
        try:
            payload = body.encode('utf-8') if isinstance(body, str) else body
            self.send_response(code)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            print(f"[WARN] _send_json failed: {e}")

    def do_POST(self):
        try:
            content_length_header = self.headers.get('Content-Length')
            if content_length_header is None:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing Content-Length header"}')
                return

            content_length = int(content_length_header)
            if content_length > MAX_PAYLOAD_BYTES:
                self.send_response(413)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Payload too large (max 1MB)"}')
                return

            post_data = self.rfile.read(content_length)

            if self.path == '/api/data':
                parsed = json.loads(post_data.decode('utf-8'))
                if not isinstance(parsed, list):
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "Request body must be a JSON array"}')
                    return

                # Validate each element before writing
                cleaned_list = []
                for i, item in enumerate(parsed):
                    cleaned, error = validate_anime(item)
                    if error or cleaned is None:
                        self.send_response(400)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        msg = f"Element at index {i} is invalid: {error or 'Validation failed'}"
                        self.wfile.write(json.dumps({"error": msg}).encode('utf-8'))
                        return
                    cleaned_list.append(normalize_anime(cleaned))

                with file_lock:
                    with open(DATA_FILE, 'w', encoding='utf-8') as f:
                        json.dump(cleaned_list, f, ensure_ascii=False, indent=2)

                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')

            elif self.path == '/api/anime':
                try:
                    new_anime = json.loads(post_data.decode('utf-8'))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "Invalid JSON in request body"}')
                    return

                cleaned, error = validate_anime(new_anime)
                if error or cleaned is None:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": error or "Validation failed"}).encode('utf-8'))
                    return

                with file_lock:
                    animes = []
                    if os.path.exists(DATA_FILE):
                        with open(DATA_FILE, 'r', encoding='utf-8') as f:
                            animes = json.load(f)

                    # Verificar duplicado por id
                    existing_ids = [a.get('id') for a in animes]
                    if cleaned['id'] in existing_ids:
                        self.send_response(409)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": f"Anime with id '{cleaned['id']}' already exists"}).encode('utf-8'))
                        return

                    animes.append(normalize_anime(cleaned))

                    with open(DATA_FILE, 'w', encoding='utf-8') as f:
                        json.dump(animes, f, ensure_ascii=False, indent=2)

                self.send_response(201)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"status": "created"}')

            else:
                self.send_response(404)
                self.end_headers()

        except Exception as e:
            print(f"[ERROR] POST handler: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error": "Internal server error"}')

    def do_PUT(self):
        try:
            content_length_header = self.headers.get('Content-Length')
            if content_length_header is None:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Missing Content-Length header"}')
                return

            content_length = int(content_length_header)
            if content_length > MAX_PAYLOAD_BYTES:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Payload too large (max 1MB)"}')
                return

            post_data = self.rfile.read(content_length)

            if self.path == '/api/anime':
                try:
                    update_data = json.loads(post_data.decode('utf-8'))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "Invalid JSON in request body"}')
                    return

                if 'id' not in update_data or not isinstance(update_data['id'], str) or not update_data['id'].strip():
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "PUT requires a non-empty string id"}')
                    return

                with file_lock:
                    animes = []
                    if os.path.exists(DATA_FILE):
                        with open(DATA_FILE, 'r', encoding='utf-8') as f:
                            animes = json.load(f)

                    found = False
                    for i, a in enumerate(animes):
                        if a.get('id') == update_data['id']:
                            animes[i] = normalize_anime({**a, **update_data})
                            found = True
                            break

                    if not found:
                        self.send_response(404)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": f"Item with id '{update_data['id']}' not found"}).encode('utf-8'))
                        return

                    with open(DATA_FILE, 'w', encoding='utf-8') as f:
                        json.dump(animes, f, ensure_ascii=False, indent=2)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"status": "updated"}')

            else:
                self.send_response(404)
                self.end_headers()

        except Exception as e:
            print(f"[ERROR] PUT handler: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error": "Internal server error"}')

def open_browser():
    webbrowser.open(f'http://localhost:{PORT}')

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
        print(f"Servidor iniciado. Tus datos se guardarán en la carpeta del proyecto.")
        print(f"Abre tu navegador en: http://localhost:{PORT}")
        Timer(1, open_browser).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor cerrado.")