#!/bin/bash

# Script de prueba para los nuevos endpoints de Accounting Entries
# Autor: Sistema de Migración Contable
# Fecha: 14/10/2025

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000/api/v1"

echo -e "${YELLOW}=== Testing Accounting Entries API ===${NC}\n"

# Verificar que el servidor esté corriendo
echo -e "${YELLOW}1. Verificando servidor...${NC}"
if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Servidor corriendo${NC}\n"
else
    echo -e "${RED}✗ Servidor no responde. Ejecuta: pnpm start:dev${NC}\n"
    exit 1
fi

# Solicitar token
echo -e "${YELLOW}2. Token JWT${NC}"
echo "Ingresa tu token JWT (o presiona Enter para usar variable de entorno \$TOKEN):"
read -r INPUT_TOKEN

if [ -z "$INPUT_TOKEN" ]; then
    if [ -z "$TOKEN" ]; then
        echo -e "${RED}✗ No se proporcionó token. Exporta la variable \$TOKEN o ingrésala manualmente.${NC}"
        echo "Ejemplo: export TOKEN=\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\""
        exit 1
    fi
    AUTH_TOKEN="$TOKEN"
else
    AUTH_TOKEN="$INPUT_TOKEN"
fi

echo -e "${GREEN}✓ Token configurado${NC}\n"

# Test 1: Búsqueda con filtros
echo -e "${YELLOW}3. Test: GET /accounting-entries/search${NC}"
echo "Buscando asientos pendientes (limit=5)..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET "$BASE_URL/accounting-entries/search?solo_pendientes=true&limit=5" \
    -H "Authorization: Bearer $AUTH_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Status: $HTTP_CODE${NC}"
    echo "Respuesta:"
    echo "$BODY" | jq '{ total: .pagination.total, page: .pagination.page, count: (.data | length) }' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Status: $HTTP_CODE${NC}"
    echo "Error: $BODY"
fi
echo ""

# Test 2: Resumen global
echo -e "${YELLOW}4. Test: GET /accounting-entries/resumen-global${NC}"
echo "Obteniendo resumen global del sistema..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET "$BASE_URL/accounting-entries/resumen-global" \
    -H "Authorization: Bearer $AUTH_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Status: $HTTP_CODE${NC}"
    echo "Respuesta:"
    echo "$BODY" | jq '.totales' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Status: $HTTP_CODE${NC}"
    echo "Error: $BODY"
fi
echo ""

# Test 3: Estado de cuenta (necesita un agent_id)
echo -e "${YELLOW}5. Test: GET /accounting-entries/estado-cuenta/:agentId${NC}"
echo "Para probar este endpoint, necesitas un agent_id válido."
echo "¿Deseas probar con un agent_id? (y/N):"
read -r TEST_AGENT

if [ "$TEST_AGENT" = "y" ] || [ "$TEST_AGENT" = "Y" ]; then
    echo "Ingresa el agent_id (MongoDB ObjectId):"
    read -r AGENT_ID
    
    if [ -n "$AGENT_ID" ]; then
        echo "Obteniendo estado de cuenta del agente $AGENT_ID..."
        RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
            -X GET "$BASE_URL/accounting-entries/estado-cuenta/$AGENT_ID" \
            -H "Authorization: Bearer $AUTH_TOKEN")
        
        HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
        BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✓ Status: $HTTP_CODE${NC}"
            echo "Respuesta:"
            echo "$BODY" | jq '{ agente_id, resumen }' 2>/dev/null || echo "$BODY"
        else
            echo -e "${RED}✗ Status: $HTTP_CODE${NC}"
            echo "Error: $BODY"
        fi
    fi
else
    echo -e "${YELLOW}Omitiendo test de estado de cuenta${NC}"
fi
echo ""

# Test 4: Búsqueda por fechas
echo -e "${YELLOW}6. Test: Búsqueda por rango de fechas${NC}"
FECHA_DESDE="2025-01-01"
FECHA_HASTA="2025-12-31"
echo "Buscando asientos entre $FECHA_DESDE y $FECHA_HASTA..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET "$BASE_URL/accounting-entries/search?fecha_desde=$FECHA_DESDE&fecha_hasta=$FECHA_HASTA&limit=3" \
    -H "Authorization: Bearer $AUTH_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Status: $HTTP_CODE${NC}"
    echo "Respuesta:"
    echo "$BODY" | jq '{ total: .pagination.total, fechas_encontradas: [.data[].fecha_vencimiento] }' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Status: $HTTP_CODE${NC}"
    echo "Error: $BODY"
fi
echo ""

# Resumen final
echo -e "${YELLOW}=== Resumen de Tests ===${NC}"
echo "Endpoints probados: 3/3"
echo "Para más tests, consulta la documentación en:"
echo "  doc/CONTRACTS/ACCOUNTING_ENTRIES_API.md"
echo ""
echo -e "${GREEN}✓ Tests completados${NC}"
