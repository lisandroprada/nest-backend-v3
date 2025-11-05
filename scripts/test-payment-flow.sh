#!/bin/bash

# Script para probar el flujo completo de cobro y liquidación con cálculo proporcional

API_URL="http://localhost:3050/api/v1"

echo "=========================================="
echo "TEST: Flujo de Cobro y Liquidación Proporcional"
echo "=========================================="
echo ""

# Primero, obtener un asiento PENDIENTE de ejemplo
echo "1. Obteniendo asientos PENDIENTES..."
ASIENTOS=$(curl -s "${API_URL}/accounting-entries?estado=PENDIENTE&limit=1")
ASIENTO_ID=$(echo $ASIENTOS | jq -r '.data[0]._id // empty')

if [ -z "$ASIENTO_ID" ]; then
  echo "❌ No hay asientos PENDIENTES. Creando uno de ejemplo..."
  # Aquí podrías crear un contrato y asiento de ejemplo
  exit 1
fi

echo "✅ Asiento encontrado: $ASIENTO_ID"
echo ""

# Obtener detalles del asiento
echo "2. Detalles del asiento:"
ASIENTO_DETAILS=$(curl -s "${API_URL}/accounting-entries/${ASIENTO_ID}")
echo $ASIENTO_DETAILS | jq '{
  _id,
  descripcion,
  monto_original,
  monto_actual,
  estado,
  partidas: .partidas | map({
    descripcion,
    debe,
    haber,
    agente_id,
    monto_pagado_acumulado,
    monto_liquidado
  })
}'
echo ""

# Extraer monto total DEBE
MONTO_TOTAL=$(echo $ASIENTO_DETAILS | jq -r '.monto_original')
echo "Monto total del asiento: $MONTO_TOTAL"
echo ""

# Registrar un cobro parcial (por ejemplo, 10% del total)
MONTO_COBRO=$(echo "$MONTO_TOTAL * 0.01" | bc)
echo "3. Registrando cobro parcial de: $MONTO_COBRO (1% del total)..."

# Necesitamos el ID de una cuenta financiera (por ejemplo, Caja Principal)
CUENTA_ID=$(mongosh nest-propietasV3 --quiet --eval "db.financialaccounts.findOne({nombre: 'Caja Principal'})" | jq -r '._id.$oid')

if [ -z "$CUENTA_ID" ]; then
  echo "❌ No se encontró cuenta financiera 'Caja Principal'"
  exit 1
fi

PAYMENT_RESPONSE=$(curl -s -X POST "${API_URL}/accounting-entries/${ASIENTO_ID}/register-payment" \
  -H "Content-Type: application/json" \
  -d "{
    \"monto_cobrado\": ${MONTO_COBRO},
    \"fecha_pago\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\",
    \"metodo_pago\": \"TRANSFERENCIA\",
    \"cuenta_financiera_id\": \"${CUENTA_ID}\",
    \"comprobante\": \"TEST-001\",
    \"observaciones\": \"Prueba de cobro parcial con cálculo proporcional\"
  }")

echo "Respuesta del registro de pago:"
echo $PAYMENT_RESPONSE | jq '{
  estado,
  monto_actual,
  partidas: .partidas | map({
    descripcion,
    debe,
    haber,
    monto_pagado_acumulado,
    monto_liquidado
  })
}'
echo ""

# Verificar que solo las partidas DEBE tienen monto_pagado_acumulado actualizado
echo "4. Verificando actualización solo en partidas DEBE..."
DEBE_UPDATED=$(echo $PAYMENT_RESPONSE | jq '[.partidas[] | select(.debe > 0 and .monto_pagado_acumulado > 0)] | length')
HABER_UPDATED=$(echo $PAYMENT_RESPONSE | jq '[.partidas[] | select(.haber > 0 and .monto_pagado_acumulado > 0)] | length')

echo "   - Partidas DEBE con monto_pagado_acumulado: $DEBE_UPDATED"
echo "   - Partidas HABER con monto_pagado_acumulado: $HABER_UPDATED"

if [ "$HABER_UPDATED" -eq "0" ]; then
  echo "   ✅ Correcto: Las partidas HABER NO tienen monto_pagado_acumulado"
else
  echo "   ❌ Error: Las partidas HABER tienen monto_pagado_acumulado (no deberían)"
fi
echo ""

# Consultar liquidaciones pendientes para el agente locador
echo "5. Consultando liquidaciones pendientes..."
# Necesitamos el ID del agente locador del contrato
AGENTE_ID=$(echo $ASIENTO_DETAILS | jq -r '.partidas[] | select(.haber > 0 and .agente_id != null) | .agente_id' | head -1)

if [ -z "$AGENTE_ID" ]; then
  echo "❌ No se encontró agente en las partidas HABER"
  exit 1
fi

PENDING_LIQ=$(curl -s "${API_URL}/accounting-entries/agent/${AGENTE_ID}/pending-liquidation")
echo "Liquidaciones pendientes para agente $AGENTE_ID:"
echo $PENDING_LIQ | jq '.[] | {
  descripcion,
  monto_original,
  monto_cobrado,
  proporcion,
  monto_liquidable,
  monto_ya_liquidado,
  monto_disponible
}'
echo ""

# Verificar el cálculo proporcional
echo "6. Verificando cálculo proporcional..."
MONTO_DISPONIBLE=$(echo $PENDING_LIQ | jq -r '.[0].monto_disponible // 0')
PROPORCION=$(echo $PENDING_LIQ | jq -r '.[0].proporcion // 0')

echo "   - Monto cobrado del inquilino: $MONTO_COBRO"
echo "   - Proporción del locador: $PROPORCION"
echo "   - Monto disponible para liquidar: $MONTO_DISPONIBLE"

# Calcular el monto esperado (cobro * proporción)
MONTO_ESPERADO=$(echo "$MONTO_COBRO * $PROPORCION" | bc -l)
echo "   - Monto esperado (cobro × proporción): $MONTO_ESPERADO"

# Comparar (con tolerancia de 0.01 por redondeo)
DIFF=$(echo "$MONTO_DISPONIBLE - $MONTO_ESPERADO" | bc -l | awk '{printf "%.2f", ($1<0)?-$1:$1}')
if (( $(echo "$DIFF < 0.01" | bc -l) )); then
  echo "   ✅ Correcto: El monto disponible coincide con el cálculo proporcional"
else
  echo "   ❌ Error: El monto disponible NO coincide (diferencia: $DIFF)"
fi
echo ""

echo "=========================================="
echo "TEST COMPLETADO"
echo "=========================================="
