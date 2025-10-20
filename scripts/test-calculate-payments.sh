#!/bin/bash

# Script de test para el endpoint calculate-initial-payments
# Asegúrate de tener un token JWT válido y ObjectIds reales

echo "================================================"
echo "TEST: Calculate Initial Payments Endpoint"
echo "================================================"
echo ""

# Configuración
API_URL="http://localhost:3000"
TOKEN="YOUR_JWT_TOKEN_HERE"

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}NOTA: Antes de ejecutar, reemplaza:${NC}"
echo "1. TOKEN con tu JWT válido"
echo "2. propiedad_id con ObjectId real"
echo "3. agente_id con ObjectIds reales de locador y locatario"
echo ""

# Test 1: Contrato básico sin honorarios ni depósito
echo -e "${YELLOW}Test 1: Contrato básico (solo alquileres)${NC}"
echo "POST ${API_URL}/contracts/calculate-initial-payments"
echo ""

curl -X POST "${API_URL}/contracts/calculate-initial-payments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {"agente_id": "6789abcd1234567890abc001", "rol": "LOCADOR"},
      {"agente_id": "6789abcd1234567890abc002", "rol": "LOCATARIO"}
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2028-11-01",
    "ajuste_programado": "2026-11-01",
    "tipo_contrato": "VIVIENDA_UNICA",
    "terminos_financieros": {
      "monto_base_vigente": 100000,
      "indice_tipo": "ICL"
    }
  }' | jq '.resumen'

echo ""
echo ""

# Test 2: Contrato completo con todo
echo -e "${YELLOW}Test 2: Contrato completo (alquileres + depósito + honorarios)${NC}"
echo "POST ${API_URL}/contracts/calculate-initial-payments"
echo ""

curl -X POST "${API_URL}/contracts/calculate-initial-payments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {"agente_id": "6789abcd1234567890abc001", "rol": "LOCADOR"},
      {"agente_id": "6789abcd1234567890abc002", "rol": "LOCATARIO"}
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2028-11-01",
    "ajuste_programado": "2026-11-01",
    "tipo_contrato": "VIVIENDA_UNICA",
    "terminos_financieros": {
      "monto_base_vigente": 100000,
      "indice_tipo": "ICL",
      "comision_administracion_porcentaje": 7,
      "honorarios_locador_porcentaje": 2,
      "honorarios_locador_cuotas": 1,
      "honorarios_locatario_porcentaje": 5,
      "honorarios_locatario_cuotas": 2
    },
    "deposito_monto": 100000,
    "deposito_tipo_ajuste": "AL_ULTIMO_ALQUILER"
  }' | jq '.'

echo ""
echo ""

# Test 3: Contrato FIJO (proyecta hasta fecha_final)
echo -e "${YELLOW}Test 3: Contrato FIJO (6 meses temporario)${NC}"
echo "POST ${API_URL}/contracts/calculate-initial-payments"
echo ""

curl -X POST "${API_URL}/contracts/calculate-initial-payments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {"agente_id": "6789abcd1234567890abc001", "rol": "LOCADOR"},
      {"agente_id": "6789abcd1234567890abc002", "rol": "LOCATARIO"}
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2026-05-01",
    "ajuste_programado": "2026-05-01",
    "tipo_contrato": "TEMPORARIO",
    "terminos_financieros": {
      "monto_base_vigente": 150000,
      "indice_tipo": "FIJO",
      "comision_administracion_porcentaje": 8
    },
    "deposito_monto": 150000
  }' | jq '.resumen'

echo ""
echo ""

# Test 4: Error - Sin locador
echo -e "${YELLOW}Test 4: Error esperado (falta locador)${NC}"
echo "POST ${API_URL}/contracts/calculate-initial-payments"
echo ""

curl -X POST "${API_URL}/contracts/calculate-initial-payments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {"agente_id": "6789abcd1234567890abc002", "rol": "LOCATARIO"}
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2028-11-01",
    "ajuste_programado": "2026-11-01",
    "terminos_financieros": {
      "monto_base_vigente": 100000,
      "indice_tipo": "ICL"
    }
  }' | jq '.'

echo ""
echo ""

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Tests completados${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Para usar este script:"
echo "1. chmod +x scripts/test-calculate-payments.sh"
echo "2. Editar TOKEN, propiedad_id y agente_id con valores reales"
echo "3. ./scripts/test-calculate-payments.sh"
echo ""
