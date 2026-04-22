import http.server
import socketserver
import json
import os
import webbrowser
from threading import Timer

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
        if self.path == '/api/data':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            parsed = json.loads(post_data.decode('utf-8'))
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(parsed, f, ensure_ascii=False, indent=2)
                
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(b'{"status": "success"}')

        elif self.path == '/api/anime':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                new_anime = json.loads(post_data.decode('utf-8'))

                if not new_anime.get('id') or not new_anime.get('title'):
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "id and title are required"}')
                    return

                animes = []
                if os.path.exists(DATA_FILE):
                    with open(DATA_FILE, 'r', encoding='utf-8') as f:
                        animes = json.load(f)

                # Verificar duplicado por id
                existing_ids = [a.get('id') for a in animes]
                if new_anime['id'] in existing_ids:
                    self.send_response(409)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": f"Anime with id '{new_anime['id']}' already exists"}).encode('utf-8'))
                    return

                animes.append(normalize_anime(new_anime))

                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(animes, f, ensure_ascii=False, indent=2)

                self.send_response(201)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"status": "created"}')

            except (json.JSONDecodeError, KeyError) as e:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        else:
            self.send_response(404)
            self.end_headers()

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