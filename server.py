import http.server
import socketserver
import json
import os
import webbrowser
from threading import Timer

MAX_PAYLOAD_BYTES = 1 * 1024 * 1024  # 1 MB

# Mapa de normalización para campos de texto sin acento -> con acento
TYPE_MAP = {
    'Pelicula': 'Película',
    'pelicula': 'Película',
    'película': 'Película',
    'tv': 'TV',
    'ova': 'OVA',
    'ona': 'ONA',
    'especial': 'Especial',
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

    return anime

def validate_anime(data):
    """Valida tipos y longitudes de campos del anime. Retorna (cleaned, error)."""
    if not isinstance(data, dict):
        return None, "Request body must be a JSON object"

    # Required fields
    for field in ('id', 'title'):
        val = data.get(field)
        if not isinstance(val, str) or not val.strip():
            return None, f"'{field}' must be a non-empty string"
        if len(val) > 500:
            return None, f"'{field}' exceeds max length of 500"

    # String fields
    str_fields = {
        'image': 2000,
        'type': 50,
        'studio': 200,
        'status': 50,
        'season': 50,
        'synopsis': 5000,
        'review': 5000,
    }
    for field, max_len in str_fields.items():
        val = data.get(field)
        if val is not None:
            if not isinstance(val, str):
                return None, f"'{field}' must be a string"
            if len(val) > max_len:
                return None, f"'{field}' exceeds max length of {max_len}"

    # Numeric fields
    int_fields = ('episodes', 'seasons')
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
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b'[]')
        else:
            # Sirve los archivos estáticos normales (index.html, app.js, etc.)
            if self.path == '/':
                self.path = '/index.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

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

                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(cleaned_list, f, ensure_ascii=False, indent=2)

                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')

            elif self.path == '/api/anime':
                try:
                    new_anime = json.loads(post_data.decode('utf-8'))
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": f"Invalid JSON: {e}"}).encode('utf-8'))
                    return

                cleaned, error = validate_anime(new_anime)
                if error or cleaned is None:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": error or "Validation failed"}).encode('utf-8'))
                    return

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
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Internal server error: {e}"}).encode('utf-8'))

def open_browser():
    webbrowser.open(f'http://localhost:{PORT}')

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Servidor iniciado. Tus datos se guardarán en la carpeta del proyecto.")
        print(f"Abre tu navegador en: http://localhost:{PORT}")
        # Abre el navegador automáticamente después de 1 segundo
        Timer(1, open_browser).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor cerrado.")