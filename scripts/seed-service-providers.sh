#!/bin/bash

# Script para crear proveedores de servicios públicos
# Uso: ./seed-service-providers.sh

set -e

API_URL="${API_URL:-http://localhost:4000/api}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROVIDERS_FILE="$SCRIPT_DIR/seed-service-providers.json"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  Seed de Proveedores de Servicios${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Verificar que existe el archivo JSON
if [ ! -f "$PROVIDERS_FILE" ]; then
  echo -e "${RED}Error: No se encontró el archivo $PROVIDERS_FILE${NC}"
  exit 1
fi

# Leer el archivo JSON y crear cada proveedor
echo -e "${GREEN}Leyendo proveedores desde: $PROVIDERS_FILE${NC}"
echo ""

# Usar jq para parsear el JSON
providers_count=$(jq '. | length' "$PROVIDERS_FILE")
echo -e "${YELLOW}Total de proveedores a crear: $providers_count${NC}"
echo ""

for i in $(seq 0 $((providers_count - 1))); do
  provider=$(jq ".[$i]" "$PROVIDERS_FILE")
  nombre=$(echo "$provider" | jq -r '.nombre')
  cuit=$(echo "$provider" | jq -r '.cuit')
  
  echo -e "${YELLOW}[$((i + 1))/$providers_count] Creando: $nombre (CUIT: $cuit)${NC}"
  
  # Preparar payload completo
  payload=$(echo "$provider" | jq '. + {
    "identificador_fiscal": .cuit,
    "nombre_razon_social": .nombre,
    "direccion_fiscal": {
      "calle": "Av. Principal",
      "numero": "1000",
      "provincia_id": "633c5e9b1e9b7c2b6c8f2d32",
      "localidad_id": "633c5e9b1e9b7c2b6c8f2d33",
      "codigo_postal": "Q8300"
    }
  } | del(.nombre) | del(.cuit)')
  
  # Intentar crear el proveedor
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/agents" \
    -H "Content-Type: application/json" \
    -d "$payload")
  
  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -eq 201 ]; then
    echo -e "${GREEN}  ✓ Proveedor creado exitosamente${NC}"
    agent_id=$(echo "$body" | jq -r '._id // .id // "unknown"')
    echo -e "${GREEN}    ID: $agent_id${NC}"
  elif [ "$http_code" -eq 409 ] || [ "$http_code" -eq 400 ]; then
    # Probablemente ya existe
    error_msg=$(echo "$body" | jq -r '.message // "Error desconocido"')
    if [[ "$error_msg" == *"duplicate"* ]] || [[ "$error_msg" == *"ya existe"* ]]; then
      echo -e "${YELLOW}  ⚠ Ya existe (omitido)${NC}"
    else
      echo -e "${RED}  ✗ Error: $error_msg${NC}"
    fi
  else
    echo -e "${RED}  ✗ Error HTTP $http_code${NC}"
    echo -e "${RED}    Response: $body${NC}"
  fi
  
  echo ""
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Proceso completado${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Para verificar los proveedores creados:${NC}"
echo -e "  curl $API_URL/service-sync/providers | jq"
echo ""
