#!/bin/bash
clear
echo "========================================================"
echo " Iniciando AnimeNotes - Guardado Local en datos.json"
echo "========================================================"
echo ""
echo " Tu navegador se abrirá automáticamente en unos segundos..."
echo " IMPORTANTE: No cierres esta ventana mientras uses la app."
echo ""

# Ir al directorio donde está el script (necesario si se abre desde Finder)
cd "$(dirname "$0")"

# Detectar python3 o python
if command -v python3 &>/dev/null; then
    python3 server.py
elif command -v python &>/dev/null; then
    python server.py
else
    echo "ERROR: Python no está instalado."
    echo "Descárgalo desde: https://www.python.org/downloads/"
    read -p "Presiona Enter para cerrar..."
    exit 1
fi
