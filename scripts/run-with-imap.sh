#!/usr/bin/env bash
# Script seguro y temporal para ejecutar la API con credenciales IMAP sin guardarlas en .env
# Lee las credenciales en memoria y arranca el servidor pasando las variables al proceso hijo.
# No escribe nada en disco.

set -euo pipefail

echo "Ejecutar API con credenciales IMAP temporales (no se guardan en .env)"
read -p "Email (por ejemplo lisandro.prada@gmail.com): " SERVICE_SYNC_EMAIL
read -s -p "App Password (secreto, no se mostrará): " SERVICE_SYNC_PWD
echo
read -p "Host IMAP [imap.gmail.com]: " HOST_INPUT
SERVICE_SYNC_HOST=${HOST_INPUT:-imap.gmail.com}
read -p "Port IMAP [993]: " PORT_INPUT
SERVICE_SYNC_PORT=${PORT_INPUT:-993}
read -p "Secure TLS? [Y/n]: " SECURE_INPUT
if [[ "$SECURE_INPUT" == "n" || "$SECURE_INPUT" == "N" ]]; then
  SERVICE_SYNC_SECURE=false
else
  SERVICE_SYNC_SECURE=true
fi

echo "Iniciando servidor con variables IMAP en entorno (temporal)..."

# Ejecuta el servidor con las variables de entorno para esta invocación solamente.
SERVICE_SYNC_EMAIL="$SERVICE_SYNC_EMAIL" \
SERVICE_SYNC_PWD="$SERVICE_SYNC_PWD" \
SERVICE_SYNC_HOST="$SERVICE_SYNC_HOST" \
SERVICE_SYNC_PORT="$SERVICE_SYNC_PORT" \
SERVICE_SYNC_SECURE="$SERVICE_SYNC_SECURE" \
pnpm run start:dev

# Al terminar el proceso, las variables no quedan persistidas en archivos.
