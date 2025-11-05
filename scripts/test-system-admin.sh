#!/bin/bash

# Script para probar el módulo System Admin
# Asegúrate de tener el servidor corriendo: npm run start:dev

BASE_URL="http://localhost:3000/api/v1"

# Color para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test: System Admin Module${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Nota: Debes obtener un token JWT válido primero
# Puedes usar: POST /auth/login con credenciales de admin

# Reemplaza con tu token JWT real
TOKEN="YOUR_JWT_TOKEN_HERE"

if [ "$TOKEN" = "YOUR_JWT_TOKEN_HERE" ]; then
  echo -e "${RED}⚠️  ERROR: Debes configurar un TOKEN JWT válido en el script${NC}"
  echo ""
  echo "1. Haz login para obtener un token:"
  echo "   curl -X POST $BASE_URL/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"your_password\"}'"
  echo ""
  echo "2. Copia el token y reemplaza la variable TOKEN en este script"
  echo ""
  exit 1
fi

echo -e "${YELLOW}📊 Test 1: Obtener estadísticas del sistema${NC}"
echo ""
curl -X GET "$BASE_URL/system-admin/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

echo -e "${YELLOW}🧪 Test 2: Simulación de reseteo (dry run)${NC}"
echo ""
curl -X POST "$BASE_URL/system-admin/reset" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "confirm": true,
    "dryRun": true
  }' | jq '.'
echo ""
echo ""

echo -e "${YELLOW}❌ Test 3: Intentar resetear sin confirmación${NC}"
echo ""
curl -X POST "$BASE_URL/system-admin/reset" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "confirm": false,
    "dryRun": true
  }' | jq '.'
echo ""
echo ""

echo -e "${RED}⚠️  ADVERTENCIA: El siguiente test ELIMINARÁ datos reales${NC}"
echo -e "${RED}⚠️  Comentado por seguridad. Descomenta para ejecutar.${NC}"
echo ""

# Descomenta las siguientes líneas solo si REALMENTE quieres resetear el sistema
# echo -e "${RED}🗑️  Test 4: Reseteo REAL del sistema${NC}"
# echo ""
# read -p "¿Estás SEGURO de que quieres resetear el sistema? (escribe 'SI'): " confirmation
# if [ "$confirmation" = "SI" ]; then
#   curl -X POST "$BASE_URL/system-admin/reset" \
#     -H "Authorization: Bearer $TOKEN" \
#     -H "Content-Type: application/json" \
#     -d '{
#       "confirm": true,
#       "dryRun": false
#     }' | jq '.'
#   echo ""
#   echo ""
#   
#   echo -e "${GREEN}✅ Verificando estadísticas después del reseteo${NC}"
#   echo ""
#   curl -X GET "$BASE_URL/system-admin/stats" \
#     -H "Authorization: Bearer $TOKEN" \
#     -H "Content-Type: application/json" | jq '.'
#   echo ""
# else
#   echo -e "${YELLOW}Operación cancelada${NC}"
# fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Tests completados${NC}"
echo -e "${GREEN}========================================${NC}"
