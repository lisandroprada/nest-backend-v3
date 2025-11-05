#!/bin/bash

# Script para probar el endpoint de estado de cuenta con la nueva lógica

API_URL="http://localhost:3050/api/v1"

echo "=========================================="
echo "TEST: Endpoint Estado de Cuenta Corregido"
echo "=========================================="
echo ""

# Obtener un agente de ejemplo (locador)
echo "1. Obteniendo agente locador de ejemplo..."
AGENTE_ID=$(mongosh nest-propietasV3 --quiet --eval "
  db.agents.findOne({role: 'LOCADOR'})
" | jq -r '._id.$oid')

if [ -z "$AGENTE_ID" ] || [ "$AGENTE_ID" == "null" ]; then
  echo "❌ No se encontró un agente locador. Buscando cualquier agente con partidas HABER..."
  
  AGENTE_ID=$(mongosh nest-propietasV3 --quiet --eval "
    db.accountingentries.findOne({'partidas.haber': {\$gt: 0}})
  " | jq -r '.partidas[] | select(.haber > 0 and .agente_id != null) | .agente_id.$oid' | head -1)
fi

if [ -z "$AGENTE_ID" ] || [ "$AGENTE_ID" == "null" ]; then
  echo "❌ No se encontró ningún agente con partidas HABER"
  exit 1
fi

echo "✅ Agente encontrado: $AGENTE_ID"
echo ""

# Llamar al endpoint de estado de cuenta
echo "2. Consultando estado de cuenta para el agente..."
ESTADO_CUENTA=$(curl -s "${API_URL}/accounting-entries/estado-cuenta/${AGENTE_ID}")

echo ""
echo "=========================================="
echo "RESPUESTA DEL ENDPOINT:"
echo "=========================================="
echo ""

# Mostrar resumen
echo "📊 RESUMEN:"
echo "$ESTADO_CUENTA" | jq '.resumen'
echo ""

# Mostrar movimientos
echo "📋 MOVIMIENTOS:"
echo "$ESTADO_CUENTA" | jq '.movimientos[] | {
  fecha: .fecha_imputacion,
  descripcion,
  tipo_partida,
  monto_original,
  debe,
  haber,
  monto_pagado,
  saldo_pendiente,
  monto_recaudado_disponible,
  estado
}'
echo ""

# Validaciones
echo "=========================================="
echo "VALIDACIONES:"
echo "=========================================="
echo ""

# Verificar que las partidas DEBE tienen saldo_pendiente
PARTIDAS_DEBE=$(echo "$ESTADO_CUENTA" | jq '[.movimientos[] | select(.tipo_partida == "DEBE")]')
DEBE_COUNT=$(echo "$PARTIDAS_DEBE" | jq 'length')

if [ "$DEBE_COUNT" -gt 0 ]; then
  echo "✓ Partidas DEBE encontradas: $DEBE_COUNT"
  echo "  Verificando que tienen 'saldo_pendiente'..."
  
  DEBE_CON_SALDO=$(echo "$PARTIDAS_DEBE" | jq '[.[] | select(.saldo_pendiente != null)] | length')
  
  if [ "$DEBE_CON_SALDO" -eq "$DEBE_COUNT" ]; then
    echo "  ✅ CORRECTO: Todas las partidas DEBE tienen 'saldo_pendiente'"
  else
    echo "  ❌ ERROR: Faltan 'saldo_pendiente' en algunas partidas DEBE"
  fi
else
  echo "ℹ️  No hay partidas DEBE para este agente"
fi
echo ""

# Verificar que las partidas HABER tienen monto_recaudado_disponible
PARTIDAS_HABER=$(echo "$ESTADO_CUENTA" | jq '[.movimientos[] | select(.tipo_partida == "HABER")]')
HABER_COUNT=$(echo "$PARTIDAS_HABER" | jq 'length')

if [ "$HABER_COUNT" -gt 0 ]; then
  echo "✓ Partidas HABER encontradas: $HABER_COUNT"
  echo "  Verificando que tienen 'monto_recaudado_disponible'..."
  
  HABER_CON_RECAUDADO=$(echo "$PARTIDAS_HABER" | jq '[.[] | select(.monto_recaudado_disponible != null)] | length')
  
  if [ "$HABER_CON_RECAUDADO" -eq "$HABER_COUNT" ]; then
    echo "  ✅ CORRECTO: Todas las partidas HABER tienen 'monto_recaudado_disponible'"
    
    # Mostrar detalle de cálculo proporcional
    echo ""
    echo "  📊 Detalle de cálculo proporcional:"
    echo "$PARTIDAS_HABER" | jq '.[] | {
      descripcion,
      monto_original: .haber,
      monto_cobrado_inquilino,
      proporcion: (.proporcion | tostring + "%"),
      monto_liquidable,
      monto_ya_liquidado,
      monto_recaudado_disponible
    }'
  else
    echo "  ❌ ERROR: Faltan 'monto_recaudado_disponible' en algunas partidas HABER"
  fi
else
  echo "ℹ️  No hay partidas HABER para este agente"
fi
echo ""

echo "=========================================="
echo "TEST COMPLETADO"
echo "=========================================="
