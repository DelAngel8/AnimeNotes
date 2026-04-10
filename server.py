import http.server
import socketserver
import json
import os
import webbrowser
from threading import Timer

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
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                # Si no existe, enviamos un array vacío
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
            
            # Guardamos los datos recibidos en el archivo local datos.json
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                f.write(post_data.decode('utf-8'))
                
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "success"}')
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