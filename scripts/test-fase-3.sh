#!/bin/bash

# Script de prueba para Fase 3: Acciones sobre Asientos Contables
# Uso: ./scripts/test-fase-3.sh

BASE_URL="http://localhost:3000/api/v1"

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test de Fase 3: Acciones sobre Asientos${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Obtener un ID de asiento para pruebas
echo -e "${YELLOW}Obteniendo un asiento de prueba...${NC}"
ASIENTO_ID=$(curl -s "${BASE_URL}/accounting-entries?limit=1" | jq -r '.data[0]._id')

if [ -z "$ASIENTO_ID" ] || [ "$ASIENTO_ID" == "null" ]; then
  echo -e "${RED}Error: No se pudo obtener un asiento de prueba${NC}"
  exit 1
fi

echo -e "${GREEN}Asiento ID para pruebas: ${ASIENTO_ID}${NC}\n"

# 1. Obtener historial de cambios (antes de realizar acciones)
echo -e "${YELLOW}1. Obteniendo historial de cambios inicial...${NC}"
curl -s "${BASE_URL}/accounting-entries/${ASIENTO_ID}/historial" | jq '.'
echo -e "\n"

# 2. Registrar pago parcial
echo -e "${YELLOW}2. Registrando pago parcial de 100,000...${NC}"
curl -X POST "${BASE_URL}/accounting-entries/${ASIENTO_ID}/pago-parcial" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha_pago": "2025-10-14",
    "monto_pagado": 100000,
    "metodo_pago": "transferencia",
    "comprobante": "TEST-PARCIAL-001",
    "observaciones": "Pago parcial de prueba",
    "usuario_id": "507f1f77bcf86cd799439011"
  }' | jq '.'
echo -e "\n"

# 3. Registrar otro pago parcial
echo -e "${YELLOW}3. Registrando segundo pago parcial de 150,000...${NC}"
curl -X POST "${BASE_URL}/accounting-entries/${ASIENTO_ID}/pago-parcial" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha_pago": "2025-10-15",
    "monto_pagado": 150000,
    "metodo_pago": "efectivo",
    "comprobante": "TEST-PARCIAL-002",
    "observaciones": "Segundo pago parcial de prueba",
    "usuario_id": "507f1f77bcf86cd799439011"
  }' | jq '.'
echo -e "\n"

# 4. Ver historial actualizado
echo -e "${YELLOW}4. Obteniendo historial de cambios actualizado...${NC}"
curl -s "${BASE_URL}/accounting-entries/${ASIENTO_ID}/historial" | jq '.'
echo -e "\n"

# 5. Intentar anular (debería fallar si está pagado)
echo -e "${YELLOW}5. Intentando anular asiento (puede fallar si está pagado)...${NC}"
curl -X POST "${BASE_URL}/accounting-entries/${ASIENTO_ID}/anular" \
  -H "Content-Type: application/json" \
  -d '{
    "motivo": "Asiento de prueba que debe ser anulado por error en la carga",
    "tipo_motivo": "ERROR_CARGA",
    "observaciones": "Test de anulación",
    "usuario_id": "507f1f77bcf86cd799439011"
  }' | jq '.'
echo -e "\n"

# 6. Obtener un nuevo asiento para probar anulación
echo -e "${YELLOW}6. Obteniendo otro asiento PENDIENTE para probar anulación...${NC}"
ASIENTO_PENDIENTE=$(curl -s "${BASE_URL}/accounting-entries?estado=PENDIENTE&limit=1" | jq -r '.data[0]._id')

if [ "$ASIENTO_PENDIENTE" != "null" ] && [ -n "$ASIENTO_PENDIENTE" ]; then
  echo -e "${GREEN}Asiento PENDIENTE encontrado: ${ASIENTO_PENDIENTE}${NC}"
  
  echo -e "${YELLOW}Anulando asiento...${NC}"
  curl -X POST "${BASE_URL}/accounting-entries/${ASIENTO_PENDIENTE}/anular" \
    -H "Content-Type: application/json" \
    -d '{
      "motivo": "Asiento duplicado detectado en el sistema",
      "tipo_motivo": "DUPLICADO",
      "observaciones": "Test de anulación en asiento pendiente",
      "usuario_id": "507f1f77bcf86cd799439011"
    }' | jq '.'
  echo -e "\n"
fi

# 7. Obtener un asiento PAGADO para liquidar
echo -e "${YELLOW}7. Buscando asiento PAGADO para probar liquidación...${NC}"
ASIENTO_PAGADO=$(curl -s "${BASE_URL}/accounting-entries?estado=PAGADO&limit=1" | jq -r '.data[0]._id')

if [ "$ASIENTO_PAGADO" != "null" ] && [ -n "$ASIENTO_PAGADO" ]; then
  echo -e "${GREEN}Asiento PAGADO encontrado: ${ASIENTO_PAGADO}${NC}"
  
  echo -e "${YELLOW}Liquidando a propietario...${NC}"
  curl -X POST "${BASE_URL}/accounting-entries/${ASIENTO_PAGADO}/liquidar" \
    -H "Content-Type: application/json" \
    -d '{
      "fecha_liquidacion": "2025-10-14",
      "metodo_liquidacion": "transferencia",
      "comprobante": "LIQ-TEST-001",
      "observaciones": "Liquidación de prueba",
      "usuario_id": "507f1f77bcf86cd799439011"
    }' | jq '.'
  echo -e "\n"
fi

# 8. Probar condonación parcial
echo -e "${YELLOW}8. Buscando asiento PENDIENTE para probar condonación...${NC}"
ASIENTO_CONDONAR=$(curl -s "${BASE_URL}/accounting-entries?estado=PENDIENTE&limit=1" | jq -r '.data[0]._id')

if [ "$ASIENTO_CONDONAR" != "null" ] && [ -n "$ASIENTO_CONDONAR" ]; then
  echo -e "${GREEN}Asiento para condonar encontrado: ${ASIENTO_CONDONAR}${NC}"
  
  echo -e "${YELLOW}Condonando deuda parcial de 50,000...${NC}"
  curl -X POST "${BASE_URL}/accounting-entries/${ASIENTO_CONDONAR}/condonar" \
    -H "Content-Type: application/json" \
    -d '{
      "motivo": "Acuerdo comercial con el inquilino por situación económica",
      "tipo_motivo": "ACUERDO_COMERCIAL",
      "monto_condonado": 50000,
      "observaciones": "Test de condonación parcial",
      "usuario_id": "507f1f77bcf86cd799439011",
      "usuario_autorizador_id": "507f1f77bcf86cd799439012"
    }' | jq '.'
  echo -e "\n"
  
  # Ver historial de este asiento
  echo -e "${YELLOW}Historial del asiento condonado:${NC}"
  curl -s "${BASE_URL}/accounting-entries/${ASIENTO_CONDONAR}/historial" | jq '.'
  echo -e "\n"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Tests de Fase 3 completados${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Nota: Algunos tests pueden fallar si los asientos están en estados${NC}"
echo -e "${YELLOW}      incompatibles. Esto es esperado y demuestra las validaciones.${NC}\n"
