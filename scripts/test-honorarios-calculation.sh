#!/bin/bash

# Script de prueba para el endpoint de calculate-initial-payments
# Con los nuevos cálculos de honorarios (v1.1)

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test: Calculate Initial Payments v1.1${NC}"
echo -e "${BLUE}Verificando cálculo de honorarios${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Configuración
BASE_URL="http://localhost:3000"
TOKEN="YOUR_JWT_TOKEN_HERE"

# Test 1: Contrato de 36 meses con honorarios
echo -e "${YELLOW}Test 1: Contrato 36 meses - Verificando nuevo cálculo${NC}"
echo "Esperado:"
echo "  - Monto total contrato: 36 × $100,000 = $3,600,000"
echo "  - Honorarios locador (2%): $72,000"
echo "  - Honorarios locatario (5%): $180,000 ($90,000 × 2 cuotas)"
echo ""

curl -X POST "${BASE_URL}/contracts/calculate-initial-payments" \
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
    "terminos_financieros": {
      "monto_base_vigente": 100000,
      "indice_tipo": "ICL",
      "honorarios_locador_porcentaje": 2,
      "honorarios_locador_cuotas": 1,
      "honorarios_locatario_porcentaje": 5,
      "honorarios_locatario_cuotas": 2
    }
  }' 2>/dev/null | jq '{
    honorarios_inmobiliaria,
    resumen: {
      monto_total_honorarios_locador: .resumen.monto_total_honorarios_locador,
      monto_total_honorarios_locatario: .resumen.monto_total_honorarios_locatario
    }
  }'

echo -e "\n${GREEN}✓ Test 1 completado${NC}\n"

# Test 2: Contrato FIJO de 12 meses
echo -e "${YELLOW}Test 2: Contrato FIJO 12 meses${NC}"
echo "Esperado:"
echo "  - Monto total contrato: 12 × $200,000 = $2,400,000"
echo "  - Honorarios locador (1.5%): $36,000"
echo "  - Honorarios locatario (4%): $96,000 ($32,000 × 3 cuotas)"
echo ""

curl -X POST "${BASE_URL}/contracts/calculate-initial-payments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {"agente_id": "6789abcd1234567890abc001", "rol": "LOCADOR"},
      {"agente_id": "6789abcd1234567890abc002", "rol": "LOCATARIO"}
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2026-11-01",
    "ajuste_programado": "2026-11-01",
    "terminos_financieros": {
      "monto_base_vigente": 200000,
      "indice_tipo": "FIJO",
      "honorarios_locador_porcentaje": 1.5,
      "honorarios_locador_cuotas": 1,
      "honorarios_locatario_porcentaje": 4,
      "honorarios_locatario_cuotas": 3
    }
  }' 2>/dev/null | jq '{
    honorarios_inmobiliaria,
    resumen: {
      monto_total_honorarios_locador: .resumen.monto_total_honorarios_locador,
      monto_total_honorarios_locatario: .resumen.monto_total_honorarios_locatario
    }
  }'

echo -e "\n${GREEN}✓ Test 2 completado${NC}\n"

# Test 3: Sin honorarios (verificar que no se generan asientos)
echo -e "${YELLOW}Test 3: Contrato sin honorarios${NC}"
echo "Esperado:"
echo "  - asientos_honorarios_locador: []"
echo "  - asientos_honorarios_locatario: []"
echo "  - monto_total_honorarios_locador: 0"
echo "  - monto_total_honorarios_locatario: 0"
echo ""

curl -X POST "${BASE_URL}/contracts/calculate-initial-payments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {"agente_id": "6789abcd1234567890abc001", "rol": "LOCADOR"},
      {"agente_id": "6789abcd1234567890abc002", "rol": "LOCATARIO"}
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2026-11-01",
    "ajuste_programado": "2026-11-01",
    "terminos_financieros": {
      "monto_base_vigente": 150000,
      "indice_tipo": "ICL"
    }
  }' 2>/dev/null | jq '{
    asientos_honorarios_locador: (.asientos_honorarios_locador | length),
    asientos_honorarios_locatario: (.asientos_honorarios_locatario | length),
    honorarios: {
      locador: .resumen.monto_total_honorarios_locador,
      locatario: .resumen.monto_total_honorarios_locatario
    }
  }'

echo -e "\n${GREEN}✓ Test 3 completado${NC}\n"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Todos los tests completados${NC}"
echo -e "${BLUE}========================================${NC}"
