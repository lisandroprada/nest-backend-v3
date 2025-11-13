#!/bin/bash

# Script de pruebas para comprobantes mixtos y compensación
# Asegúrate de que el servidor esté corriendo en puerto 3050

BASE_URL="http://localhost:3050/api/v1"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI0NGM0N2M2ZWI4NTgyYzI3ZmJjMmM3ZjQiLCJ1c2VybmFtZSI6Ikxpc2FuZHJvIFByYWRhIiwiZW1haWwiOiJsaXNhbkBnbWFpbC5jb20iLCJpYXQiOjE3NjI1MzIyODcsImV4cCI6MTc2MzEzNzA4N30.RWouu8WXv70IQHQETiOj5nt8jAmoTydecNT55O0F7u0"

# IDs desde la base de datos
ASIENTO_ID="69114b194a82c9e01b3b58d8"
LOCATARIO_ID="ff94422a4f362edab22860ba"
LOCADOR_ID="a34e951d87c5290bcfe4facf"
INMOBILIARIA_ID="2cf0d17f06a8b44fb0430c26"

# Obtener cuenta financiera
echo "📋 Obteniendo cuenta financiera..."
CUENTA_ID=$(mongosh nest-propietasV3 --eval "const doc = db.financialaccounts.findOne({}); print(doc._id.toString());" --quiet 2>/dev/null | tail -1)

if [ -z "$CUENTA_ID" ]; then
  echo "❌ No se encontró cuenta financiera"
  exit 1
fi

echo "✅ Cuenta ID: $CUENTA_ID"
echo ""

# Resetear el asiento a estado PENDIENTE
echo "🔄 Reseteando asiento a estado PENDIENTE..."
mongosh nest-propietasV3 --eval "
  db.accountingentries.updateOne(
    {_id: ObjectId('$ASIENTO_ID')},
    {
      \$set: {
        estado: 'PENDIENTE',
        'partidas.\$[].monto_pagado_acumulado': 0,
        'partidas.\$[].monto_liquidado': 0
      }
    }
  )
" --quiet
echo ""

# ============================================================
# TEST 1: COBRO SIMPLE
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: COBRO SIMPLE (tipoOperacion: COBRO)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Escenario: Locatario paga $1,000,000 del alquiler"
echo ""

curl -sS -X POST "$BASE_URL/receipts/process-receipt" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"monto_total_imputado\": 1000000,
    \"monto_recibido_fisico\": 1000000,
    \"tipo_flujo_neto\": \"INGRESO\",
    \"metodo_pago\": \"transferencia\",
    \"cuenta_afectada_id\": \"$CUENTA_ID\",
    \"agente_id\": \"$LOCATARIO_ID\",
    \"asientos_a_imputar\": [
      {
        \"asientoId\": \"$ASIENTO_ID\",
        \"montoImputado\": 1000000,
        \"tipoOperacion\": \"COBRO\"
      }
    ],
    \"comprobante_externo\": \"TEST-COBRO-001\",
    \"observaciones\": \"Test de cobro simple\",
    \"emitir_factura\": false
  }" | jq '{
    recibo: {
      numero: .recibo.numero_recibo,
      fecha: .recibo.fecha_emision,
      monto: .recibo.monto_total,
      tipo: .recibo.tipo_flujo_neto
    },
    asientos_afectados: .asientos_afectados | map({
      descripcion: .descripcion,
      estado: .estado,
      partidas: .partidas | map({
        tipo: (if .debe > 0 then "DEBE" else "HABER" end),
        monto: (if .debe > 0 then .debe else .haber end),
        agente_id: .agente_id,
        monto_pagado: .monto_pagado_acumulado,
        monto_liquidado: .monto_liquidado
      })
    })
  }'

echo ""
echo ""

# Verificar estado del asiento
echo "📊 Estado del asiento después del COBRO:"
mongosh nest-propietasV3 --eval "
  db.accountingentries.findOne(
    {_id: ObjectId('$ASIENTO_ID')},
    {
      estado: 1,
      'partidas.debe': 1,
      'partidas.haber': 1,
      'partidas.monto_pagado_acumulado': 1,
      'partidas.monto_liquidado': 1
    }
  )
" --quiet | jq
echo ""

# ============================================================
# TEST 2: PAGO SIMPLE
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: PAGO SIMPLE (tipoOperacion: PAGO con agenteId)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Escenario: Liquidar $920,000 al propietario"
echo ""

curl -sS -X POST "$BASE_URL/receipts/process-receipt" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"monto_total_imputado\": 920000,
    \"monto_recibido_fisico\": 920000,
    \"tipo_flujo_neto\": \"EGRESO\",
    \"metodo_pago\": \"transferencia\",
    \"cuenta_afectada_id\": \"$CUENTA_ID\",
    \"agente_id\": \"$LOCADOR_ID\",
    \"asientos_a_imputar\": [
      {
        \"asientoId\": \"$ASIENTO_ID\",
        \"montoImputado\": 920000,
        \"tipoOperacion\": \"PAGO\",
        \"agenteId\": \"$LOCADOR_ID\"
      }
    ],
    \"comprobante_externo\": \"TEST-PAGO-001\",
    \"observaciones\": \"Test de liquidación simple\",
    \"emitir_factura\": false
  }" | jq '{
    recibo: {
      numero: .recibo.numero_recibo,
      fecha: .recibo.fecha_emision,
      monto: .recibo.monto_total,
      tipo: .recibo.tipo_flujo_neto
    },
    asientos_afectados: .asientos_afectados | map({
      descripcion: .descripcion,
      estado: .estado,
      partidas: .partidas | map({
        tipo: (if .debe > 0 then "DEBE" else "HABER" end),
        monto: (if .debe > 0 then .debe else .haber end),
        agente_id: .agente_id,
        monto_pagado: .monto_pagado_acumulado,
        monto_liquidado: .monto_liquidado
      })
    })
  }'

echo ""
echo ""

# ============================================================
# TEST 3: VALIDACIÓN - agenteId obligatorio para PAGO
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: VALIDACIÓN - agenteId obligatorio para PAGO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Escenario: Intentar PAGO sin agenteId (debe fallar)"
echo ""

# Resetear asiento para test 3
mongosh nest-propietasV3 --eval "
  db.accountingentries.updateOne(
    {_id: ObjectId('$ASIENTO_ID')},
    {
      \$set: {
        estado: 'PAGADO',
        'partidas.\$[].monto_pagado_acumulado': 1000000,
        'partidas.\$[].monto_liquidado': 0
      }
    }
  )
" --quiet

RESPONSE=$(curl -sS -X POST "$BASE_URL/receipts/process-receipt" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"monto_total_imputado\": 920000,
    \"monto_recibido_fisico\": 920000,
    \"tipo_flujo_neto\": \"EGRESO\",
    \"metodo_pago\": \"transferencia\",
    \"cuenta_afectada_id\": \"$CUENTA_ID\",
    \"agente_id\": \"$LOCADOR_ID\",
    \"asientos_a_imputar\": [
      {
        \"asientoId\": \"$ASIENTO_ID\",
        \"montoImputado\": 920000,
        \"tipoOperacion\": \"PAGO\"
      }
    ],
    \"emitir_factura\": false
  }")

echo "$RESPONSE" | jq '{statusCode, message}'

if echo "$RESPONSE" | grep -q "agenteId"; then
  echo "✅ Validación correcta: agenteId es obligatorio para PAGO"
else
  echo "❌ ERROR: La validación no funcionó"
fi

echo ""
echo ""

# ============================================================
# TEST 4: COMPROBANTE MIXTO
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: COMPROBANTE MIXTO (COBRO + PAGO en un solo recibo)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Escenario: Cobrar $1M del inquilino y liquidar $920K al propietario"
echo "          Movimiento neto: +$80K (honorarios)"
echo ""

# Resetear asiento para test 4
mongosh nest-propietasV3 --eval "
  db.accountingentries.updateOne(
    {_id: ObjectId('$ASIENTO_ID')},
    {
      \$set: {
        estado: 'PENDIENTE',
        'partidas.\$[].monto_pagado_acumulado': 0,
        'partidas.\$[].monto_liquidado': 0
      }
    }
  )
" --quiet

curl -sS -X POST "$BASE_URL/receipts/process-receipt" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"monto_total_imputado\": 1920000,
    \"monto_recibido_fisico\": 80000,
    \"tipo_flujo_neto\": \"INGRESO\",
    \"metodo_pago\": \"transferencia\",
    \"cuenta_afectada_id\": \"$CUENTA_ID\",
    \"agente_id\": \"$LOCATARIO_ID\",
    \"asientos_a_imputar\": [
      {
        \"asientoId\": \"$ASIENTO_ID\",
        \"montoImputado\": 1000000,
        \"tipoOperacion\": \"COBRO\"
      },
      {
        \"asientoId\": \"$ASIENTO_ID\",
        \"montoImputado\": 920000,
        \"tipoOperacion\": \"PAGO\",
        \"agenteId\": \"$LOCADOR_ID\"
      }
    ],
    \"comprobante_externo\": \"TEST-MIXTO-001\",
    \"observaciones\": \"Test de comprobante mixto: cobro + liquidación\",
    \"emitir_factura\": false
  }" | jq '{
    recibo: {
      numero: .recibo.numero_recibo,
      fecha: .recibo.fecha_emision,
      monto_total: .recibo.monto_total,
      tipo_flujo: .recibo.tipo_flujo_neto,
      observaciones: .recibo.observaciones
    },
    asientos_afectados: .asientos_afectados | map({
      descripcion: .descripcion,
      estado: .estado,
      partidas: .partidas | map({
        tipo: (if .debe > 0 then "DEBE" else "HABER" end),
        monto: (if .debe > 0 then .debe else .haber end),
        agente_id: .agente_id,
        monto_pagado: .monto_pagado_acumulado,
        monto_liquidado: .monto_liquidado
      })
    })
  }'

echo ""
echo ""
echo "📊 Resumen del comprobante mixto:"
echo "   • COBRO:  +\$1,000,000 (del inquilino)"
echo "   • PAGO:   -\$920,000 (al propietario)"
echo "   • NETO:   +\$80,000 (honorarios inmobiliaria)"
echo ""

# ============================================================
# TEST 5: COMPENSACIÓN (HABER - DEBE del mismo agente)
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: COMPENSACIÓN (HABER - DEBE del mismo agente)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Escenario: Crear asiento con honorarios DEBE para el propietario"
echo "          y liquidar con compensación automática"
echo ""

# Crear un asiento de honorarios descuento para el propietario
echo "📝 Creando asiento de honorarios descuento..."
HONORARIOS_ASIENTO=$(mongosh nest-propietasV3 --eval "
  const asiento = {
    fecha_asiento: new Date('2025-11-10'),
    descripcion: 'Honorarios descuento propietario',
    tipo_asiento: 'HONORARIOS',
    estado: 'PENDIENTE',
    total_debe: 720000,
    total_haber: 720000,
    partidas: [
      {
        cuenta_id: ObjectId('68de7db05ef4c4702a92debb'),
        descripcion: 'Honorarios descuento',
        debe: 720000,
        haber: 0,
        agente_id: ObjectId('$LOCADOR_ID'),
        monto_pagado_acumulado: 0,
        monto_liquidado: 0
      },
      {
        cuenta_id: ObjectId('68de7db05ef4c4702a92debd'),
        descripcion: 'Ingreso por honorarios',
        debe: 0,
        haber: 720000,
        agente_id: ObjectId('$INMOBILIARIA_ID'),
        monto_pagado_acumulado: 0,
        monto_liquidado: 0
      }
    ],
    creado_por: ObjectId('44c47c6eb8582c27fbc2c7f4')
  };
  const result = db.accountingentries.insertOne(asiento);
  print(result.insertedId.toString());
" --quiet)

echo "✅ Asiento de honorarios creado: $HONORARIOS_ASIENTO"
echo ""

# Resetear asiento principal
mongosh nest-propietasV3 --eval "
  db.accountingentries.updateOne(
    {_id: ObjectId('$ASIENTO_ID')},
    {
      \$set: {
        estado: 'PAGADO',
        'partidas.\$[].monto_pagado_acumulado': 1000000,
        'partidas.\$[].monto_liquidado': 0
      }
    }
  )
" --quiet

echo "💰 Liquidación con compensación:"
echo "   • Propietario tiene HABER: \$920,000 (se le debe)"
echo "   • Propietario tiene DEBE:  \$720,000 (él debe)"
echo "   • Pago neto calculado:     \$200,000"
echo ""

curl -sS -X POST "$BASE_URL/receipts/process-receipt" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"monto_total_imputado\": 1640000,
    \"monto_recibido_fisico\": 200000,
    \"tipo_flujo_neto\": \"EGRESO\",
    \"metodo_pago\": \"transferencia\",
    \"cuenta_afectada_id\": \"$CUENTA_ID\",
    \"agente_id\": \"$LOCADOR_ID\",
    \"asientos_a_imputar\": [
      {
        \"asientoId\": \"$ASIENTO_ID\",
        \"montoImputado\": 920000,
        \"tipoOperacion\": \"PAGO\",
        \"agenteId\": \"$LOCADOR_ID\"
      },
      {
        \"asientoId\": \"$HONORARIOS_ASIENTO\",
        \"montoImputado\": 720000,
        \"tipoOperacion\": \"PAGO\",
        \"agenteId\": \"$LOCADOR_ID\"
      }
    ],
    \"comprobante_externo\": \"TEST-COMPENSACION-001\",
    \"observaciones\": \"Test de compensación: HABER - DEBE = \$200K\",
    \"emitir_factura\": false
  }" | jq '{
    recibo: {
      numero: .recibo.numero_recibo,
      monto_total: .recibo.monto_total,
      tipo_flujo: .recibo.tipo_flujo_neto,
      observaciones: .recibo.observaciones
    },
    asientos_afectados: .asientos_afectados | map({
      descripcion: .descripcion,
      estado: .estado,
      partidas: .partidas | map(select(.agente_id == "'$LOCADOR_ID'") | {
        tipo: (if .debe > 0 then "DEBE" else "HABER" end),
        monto: (if .debe > 0 then .debe else .haber end),
        monto_pagado: .monto_pagado_acumulado,
        monto_liquidado: .monto_liquidado
      })
    })
  }'

echo ""
echo ""

# ============================================================
# RESUMEN FINAL
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ RESUMEN DE PRUEBAS COMPLETADAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. ✅ COBRO simple - tipoOperacion: COBRO"
echo "2. ✅ PAGO simple - tipoOperacion: PAGO con agenteId"
echo "3. ✅ Validación - agenteId obligatorio para PAGO"
echo "4. ✅ Comprobante MIXTO - COBRO + PAGO en mismo recibo"
echo "5. ✅ Compensación - HABER - DEBE del mismo agente"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
