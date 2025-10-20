#!/bin/bash

# ============================================================
# Test Contract Settings API
# Script para probar el módulo de configuración de contratos
# ============================================================

BASE_URL="http://localhost:3000"
TOKEN="YOUR_JWT_TOKEN_HERE"

echo "╔════════════════════════════════════════════════════════╗"
echo "║     Test Contract Settings API                         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# TEST 1: Obtener configuración general
# ============================================================
echo -e "${BLUE}TEST 1: GET /contract-settings${NC}"
echo "Obteniendo configuración general..."
echo ""

curl -X GET "${BASE_URL}/contract-settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.' 2>/dev/null || echo "Error: Verifica que el servidor esté corriendo y que tengas jq instalado"

echo ""
echo "-----------------------------------------------------------"
echo ""

# ============================================================
# TEST 2: Obtener configuración por tipo - VIVIENDA_UNICA
# ============================================================
echo -e "${BLUE}TEST 2: GET /contract-settings/tipo/VIVIENDA_UNICA${NC}"
echo "Obteniendo configuración específica para vivienda única..."
echo ""

curl -X GET "${BASE_URL}/contract-settings/tipo/VIVIENDA_UNICA" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.tipo_contrato_seleccionado' 2>/dev/null || echo "Error: No se pudo obtener"

echo ""
echo "-----------------------------------------------------------"
echo ""

# ============================================================
# TEST 3: Obtener configuración por tipo - COMERCIAL
# ============================================================
echo -e "${BLUE}TEST 3: GET /contract-settings/tipo/COMERCIAL${NC}"
echo "Obteniendo configuración específica para contrato comercial..."
echo ""

curl -X GET "${BASE_URL}/contract-settings/tipo/COMERCIAL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.tipo_contrato_seleccionado' 2>/dev/null || echo "Error: No se pudo obtener"

echo ""
echo "-----------------------------------------------------------"
echo ""

# ============================================================
# TEST 4: Actualizar configuración
# ============================================================
echo -e "${BLUE}TEST 4: PATCH /contract-settings${NC}"
echo "Actualizando comisión de administración a 8%..."
echo ""

curl -X PATCH "${BASE_URL}/contract-settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "comision_administracion_default": 8,
    "dias_aviso_vencimiento": 90
  }' \
  | jq '{
      comision_administracion_default,
      dias_aviso_vencimiento,
      updatedAt
    }' 2>/dev/null || echo "Error: No se pudo actualizar"

echo ""
echo "-----------------------------------------------------------"
echo ""

# ============================================================
# TEST 5: Verificar cambios
# ============================================================
echo -e "${BLUE}TEST 5: Verificar cambios realizados${NC}"
echo "Obteniendo configuración actualizada..."
echo ""

curl -X GET "${BASE_URL}/contract-settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '{
      comision_administracion_default,
      dias_aviso_vencimiento,
      updatedAt
    }' 2>/dev/null || echo "Error: No se pudo verificar"

echo ""
echo "-----------------------------------------------------------"
echo ""

# ============================================================
# TEST 6: Resetear a valores de fábrica
# ============================================================
echo -e "${BLUE}TEST 6: PATCH /contract-settings/reset${NC}"
echo "Reseteando configuración a valores por defecto..."
echo ""

curl -X PATCH "${BASE_URL}/contract-settings/reset" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '{
      comision_administracion_default,
      dias_aviso_vencimiento,
      updatedAt
    }' 2>/dev/null || echo "Error: No se pudo resetear"

echo ""
echo "-----------------------------------------------------------"
echo ""

# ============================================================
# TEST 7: Obtener todos los tipos de contrato
# ============================================================
echo -e "${BLUE}TEST 7: Tipos de contrato disponibles${NC}"
echo "Listando todos los tipos de contrato con sus configuraciones..."
echo ""

curl -X GET "${BASE_URL}/contract-settings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.tipos_contrato[] | {
      tipo: .tipo_contrato,
      duracion: .duracion_meses_default,
      indice: .indice_tipo_default,
      ajuste_cada: .ajuste_periodicidad_meses_default,
      descripcion: .descripcion
    }' 2>/dev/null || echo "Error: No se pudo listar"

echo ""
echo "-----------------------------------------------------------"
echo ""

# ============================================================
# Resumen final
# ============================================================
echo -e "${GREEN}✅ Tests completados${NC}"
echo ""
echo "Notas:"
echo "1. Reemplaza YOUR_JWT_TOKEN_HERE con un token válido"
echo "2. Verifica que el servidor esté corriendo en puerto 3000"
echo "3. Solo usuarios admin/superUser pueden modificar la configuración"
echo "4. Todos los usuarios autenticados pueden consultar"
echo ""
echo -e "${YELLOW}Documentación completa: doc/CONTRACTS/CONTRACT_SETTINGS_API.md${NC}"
echo ""
