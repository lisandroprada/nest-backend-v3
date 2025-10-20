#!/bin/bash

# Script de prueba para endpoints de Rescisión Anticipada
# Uso: ./test-rescision.sh <CONTRACT_ID> <AUTH_TOKEN>

API_URL="http://localhost:3000"
CONTRACT_ID="${1:-67af123456789abcdef01234}"
TOKEN="${2:-YOUR_TOKEN_HERE}"

echo "🧪 Test de Rescisión Anticipada de Contratos"
echo "=============================================="
echo ""
echo "Contrato ID: $CONTRACT_ID"
echo "API URL: $API_URL"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Calcular Rescisión (Simulación)
echo -e "${YELLOW}Test 1: POST /contracts/:id/calcular-rescision${NC}"
echo "Simulando rescisión con 30 días de preaviso..."
echo ""

RESPONSE=$(curl -s -X POST "${API_URL}/contracts/${CONTRACT_ID}/calcular-rescision" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha_notificacion_rescision": "2026-10-06",
    "fecha_recision_efectiva": "2026-11-05"
  }')

echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""

# Extraer monto de penalidad
PENALIDAD=$(echo "$RESPONSE" | jq -r '.monto_penalidad')
APLICA=$(echo "$RESPONSE" | jq -r '.aplica_penalidad')

if [ "$APLICA" == "true" ]; then
  echo -e "${GREEN}✅ Penalidad calculada: \$$PENALIDAD${NC}"
else
  echo -e "${GREEN}✅ No aplica penalidad (exención por plazo extendido)${NC}"
fi
echo ""
echo "---"
echo ""

# Test 2: Calcular Rescisión sin penalidad (>= 90 días)
echo -e "${YELLOW}Test 2: POST /contracts/:id/calcular-rescision (sin penalidad)${NC}"
echo "Simulando rescisión con 100 días de preaviso..."
echo ""

RESPONSE2=$(curl -s -X POST "${API_URL}/contracts/${CONTRACT_ID}/calcular-rescision" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha_notificacion_rescision": "2027-06-27",
    "fecha_recision_efectiva": "2027-07-27"
  }')

echo "Response:"
echo "$RESPONSE2" | jq '.'
echo ""

APLICA2=$(echo "$RESPONSE2" | jq -r '.aplica_penalidad')
MENSAJE2=$(echo "$RESPONSE2" | jq -r '.mensaje')

if [ "$APLICA2" == "false" ]; then
  echo -e "${GREEN}✅ Exención aplicada correctamente${NC}"
  echo -e "${GREEN}   Mensaje: $MENSAJE2${NC}"
else
  echo -e "${RED}❌ ERROR: Debería haber exención${NC}"
fi
echo ""
echo "---"
echo ""

# Test 3: Registrar Rescisión (COMENTADO por defecto para evitar modificar datos)
echo -e "${YELLOW}Test 3: POST /contracts/:id/registrar-rescision${NC}"
echo -e "${RED}⚠️  SKIP: Este test modifica datos (descomentá para ejecutar)${NC}"
echo ""

# Descomentá las siguientes líneas para probar el registro real
# echo "Registrando rescisión..."
# RESPONSE3=$(curl -s -X POST "${API_URL}/contracts/${CONTRACT_ID}/registrar-rescision" \
#   -H "Authorization: Bearer ${TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d "{
#     \"fecha_notificacion_rescision\": \"2026-10-06\",
#     \"fecha_recision_anticipada\": \"2026-11-05\",
#     \"penalidad_monto\": ${PENALIDAD},
#     \"motivo\": \"Test de rescisión desde script\"
#   }")
# 
# echo "Response:"
# echo "$RESPONSE3" | jq '.'
# echo ""
# 
# STATUS=$(echo "$RESPONSE3" | jq -r '.status')
# if [ "$STATUS" == "RESCINDIDO" ]; then
#   echo -e "${GREEN}✅ Rescisión registrada exitosamente${NC}"
# else
#   echo -e "${RED}❌ ERROR al registrar rescisión${NC}"
# fi

echo "---"
echo ""

# Test 4: Verificar contrato (GET)
echo -e "${YELLOW}Test 4: GET /contracts/:id${NC}"
echo "Obteniendo datos del contrato..."
echo ""

CONTRATO=$(curl -s -X GET "${API_URL}/contracts/${CONTRACT_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Datos del contrato:"
echo "$CONTRATO" | jq '{
  _id,
  status,
  fecha_inicio,
  fecha_final,
  fecha_recision_anticipada,
  fecha_notificacion_rescision,
  penalidad_rescision_monto,
  penalidad_rescision_motivo,
  rescision_dias_sin_penalidad,
  rescision_porcentaje_penalidad,
  terminos_financieros: {
    monto_base_vigente
  }
}'
echo ""

echo -e "${GREEN}✅ Tests completados${NC}"
echo ""
echo "Notas:"
echo "- Test 1 y 2: Simulación (no modifica datos)"
echo "- Test 3: SKIP por defecto (descomentá para ejecutar)"
echo "- Test 4: Verificación de datos"
