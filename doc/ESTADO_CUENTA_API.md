# API de Estado de Cuenta y Liquidaciones

## 🆕 Últimos Cambios (Nov 2025)

**✅ Comprobantes Mixtos (IMPLEMENTADO):**

- Un mismo recibo puede incluir **COBROS y PAGOS simultáneamente**
- Cada asiento define su propio `tipoOperacion`: `"COBRO"` o `"PAGO"`
- Ejemplo: Cobrar alquiler del inquilino ($1M) y liquidar al propietario ($920K) en un solo comprobante
- El `tipo_flujo_neto` del recibo determina el movimiento neto de caja (INGRESO/EGRESO)

**✅ Compensación Automática DEBE/HABER (IMPLEMENTADO):**

- El método `liquidarAPropietario` procesa automáticamente partidas HABER y DEBE del mismo agente
- Calcula monto neto: HABER - DEBE
- Ejemplo: Liquidar $920K al propietario y descontar $720K de honorarios → Pago neto: $200K
- Actualiza `monto_liquidado` en partidas HABER y `monto_pagado_acumulado` en partidas DEBE

**✅ Liquidación Adelantada sin Restricciones (IMPLEMENTADO):**

- Permite liquidar aunque el inquilino no haya pagado (`monto_cobrado_inquilino = 0`)
- Permite liquidar después de liquidaciones parciales previas
- Backend retorna `monto_total_liquidable` en `/estado-cuenta/:agentId`
- Resuelve error: "La partida ya está completamente liquidada"

**✅ Recibos con Detalle de Montos (IMPLEMENTADO):**

- Response de `/process-receipt` incluye `asientos_afectados[].monto_imputado`
- PDF muestra monto imputado ($500K) en lugar de monto total del asiento ($1M)
- Resuelve: Recibos de cobros parciales mostraban monto incorrecto

**🎯 Estado: Sistema actualizado para soportar operaciones complejas y comprobantes mixtos**

---

## Índice

1. [Principios de Diseño](#principios-de-diseño)
2. [Arquitectura](#arquitectura)
3. [Estado de Cuenta de un Agente](#1-estado-de-cuenta-de-un-agente)
4. [Liquidación Adelantada](#liquidación-adelantada)
5. [Procesar Recibo (Endpoint Unificado)](#2-procesar-recibo-endpoint-unificado)
6. [Balance de un Agente](#3-balance-de-un-agente)
7. [Ejemplos Completos](#4-ejemplos-completos)
8. [Validación](#5-validación)
9. [Guía Frontend](#6-guía-frontend)
10. [Flujo de Datos Interno](#7-flujo-de-datos-interno)
11. [Casos de Uso Reales](#8-casos-de-uso-reales)
12. [Preguntas Frecuentes](#9-preguntas-frecuentes)
13. [Gestión de Recibos (PDF, Email, WhatsApp)](#10-gestión-de-recibos-pdf-email-whatsapp)

---

## Principios de Diseño

### 1. Imputación Simple (No Doble)

**Problema histórico:** En versiones anteriores, liquidar a un agente podía actualizar TODAS las partidas HABER de un asiento, causando doble imputación cuando había múltiples acreedores (locador + inmobiliaria).

**Solución actual:**

```typescript
// COBRO actualiza SOLO partidas DEBE
for (const partida of asiento.partidas) {
  if (partida.debe > 0) {
    // ← Filtro DEBE
    partida.monto_pagado_acumulado += monto;
  }
}

// PAGO actualiza SOLO partidas HABER del agente especificado
const partidasDelAgente = asiento.partidas.filter(
  (p) => p.haber > 0 && p.agente_id === dto.agente_id, // ← Filtro HABER + agente
);
```

**Garantía:** Cada operación solo toca las partidas que le corresponden. NUNCA hay cruce.

---

### 2. Representación desde la Óptica del Agente

Cada agente ve el asiento desde su perspectiva:

**Locatario (DEBE):**

- Ve: `saldo_pendiente` = cuánto debe
- Campo: `monto_pagado_acumulado` en partidas DEBE
- Operación: COBRO

**Locador/Inmobiliaria (HABER):**

- Ve: `saldo_disponible_haber` = cuánto puede cobrar
- Campo: `monto_liquidado` en partidas HABER
- Operación: PAGO
- **Filtrado por `agente_id`**: Solo ve SUS partidas

**Principio:** Un agente NUNCA modifica partidas de otro agente.

---

### 3. Separación DEBE/HABER

**DEBE (Deuda del Locatario):**

```json
{
  "debe": 1000000,
  "haber": 0,
  "monto_pagado_acumulado": 500000, // ← Solo esto cambia con COBRO
  "agente_id": "locatario_id"
}
```

**HABER (Crédito del Locador):**

```json
{
  "debe": 0,
  "haber": 920000,
  "monto_liquidado": 300000, // ← Solo esto cambia con PAGO
  "agente_id": "locador_id"
}
```

**Garantía:**

- COBRO: Solo modifica `monto_pagado_acumulado` en partidas con `debe > 0`
- PAGO: Solo modifica `monto_liquidado` en partidas con `haber > 0` del agente especificado
- **NUNCA se cruzan**

---

### 4. DEBE No Cambia ante Cambios en HABER

**Escenario:**

1. Locatario debe $1,000,000 (partida DEBE)
2. Locador tiene crédito de $920,000 (partida HABER)
3. Inmobiliaria tiene crédito de $80,000 (partida HABER)

**Si se liquida al locador:**

- ✅ `monto_liquidado` del locador aumenta
- ❌ `monto_pagado_acumulado` del locatario NO cambia
- ❌ `monto_liquidado` de la inmobiliaria NO cambia

**Código que garantiza esto:**

```typescript
// registerPayment: SOLO itera partidas DEBE
if (partida.debe > 0) { ... }

// liquidarAPropietario: SOLO itera partidas HABER del agente
filter(p => p.haber > 0 && p.agente_id === dto.agente_id)
```

**Garantía:** DEBE y HABER son independientes. La liquidación a un acreedor NO afecta la deuda del deudor ni los otros acreedores.

---

### 5. Cálculo Proporcional en Liquidaciones

Cuando el locatario paga parcialmente, la liquidación se distribuye proporcionalmente:

**Ejemplo:**

- Alquiler: $1,000,000 (DEBE)
- Locador: $920,000 (92% HABER)
- Inmobiliaria: $80,000 (8% HABER)
- **Locatario pagó: $500,000** (50% del total)

**Al liquidar al locador:**

```typescript
const montoCobrado = 500000;  // Lo que pagó el locatario
const totalHaber = 1000000;   // Suma de todas las partidas HABER
const proporcion = 920000 / 1000000 = 0.92;  // 92% del locador
const montoLiquidable = 500000 * 0.92 = 460000;  // ← 92% de lo cobrado
```

**Resultado:**

- Locador puede retirar: $460,000 (92% de $500,000)
- Inmobiliaria puede retirar: $40,000 (8% de $500,000)

**Garantía:** La liquidación SIEMPRE es proporcional a lo realmente cobrado del locatario.

---

## Arquitectura

### Endpoint Unificado

**TODO pago y liquidación se procesa mediante `POST /process-receipt`.**

No existen endpoints separados para `/register-payment` o `/liquidar`.

### ¿Por qué un solo endpoint?

✅ **Simplicidad:** Una sola forma de hacer las cosas  
✅ **Flexibilidad:** Soporta 1 o N operaciones  
✅ **Trazabilidad:** Comprobante único por recibo  
✅ **Consistencia:** Siempre calcula movimiento neto de caja  
✅ **Sin lógica condicional:** Frontend siempre usa el mismo endpoint

---

## 1. Estado de Cuenta de un Agente

Consulta el estado de cuenta de cualquier agente (locatario, locador, inmobiliaria).

### Request

```http
GET /api/v1/accounting-entries/estado-cuenta/:agentId
Authorization: Bearer <token>
```

**Query Params (opcionales):**

```
?fecha_corte=2025-11-04
```

### Response

```json
{
  "agente_id": "507f1f77bcf86cd799439011",
  "resumen": {
    "total_debe": 1000000,
    "total_haber": 920000,
    "total_pagado_debe": 1000,
    "saldo_pendiente_debe": 999000,
    "total_recaudado_haber": 920,
    "saldo_disponible_haber": 920,
    "asientos_pendientes": 1,
    "asientos_pagados": 0,
    "asientos_pendientes_liquidacion": 1,
    "asientos_liquidados": 0,
    "total_movimientos": 1
  },
  "movimientos": [...]
}
```

### Campos según tipo_partida

**DEBE (Locatario - Deudor):**

- `saldo_pendiente`: **Cuánto le falta pagar**

**HABER (Locador/Inmobiliaria - Acreedor):**

- `monto_recaudado_disponible`: **Cuánto puede retirar ahora**

---

## Liquidación Adelantada

Permite liquidar pagos al locador/inmobiliaria aunque el inquilino no haya pagado o haya pagado parcialmente.

### Nuevos Campos en Response (solo `tipo_partida: "HABER"`)

```typescript
{
  // Información de cobro al inquilino
  monto_total_debe: number; // Total a cobrar al inquilino
  monto_cobrado_inquilino: number; // Ya cobrado
  monto_pendiente_cobro_agente: number; // Falta cobrar (parte del agente)
  porcentaje_cobrado: number; // 0-100%

  // Información de liquidación
  monto_liquidable_cobrado: number; // Solo de lo cobrado
  monto_total_liquidable: number; // Total liquidable (cobrado + no cobrado)
  porcentaje_liquidado: number; // 0-100%

  // Flags
  puede_liquidar_adelantado: boolean; // Puede liquidar aunque no esté cobrado
  tiene_cobro_pendiente: boolean; // Falta cobrar al inquilino
  liquidado: boolean; // Liquidado 100%
  liquidado_parcial: boolean; // Liquidación parcial
  es_deposito: boolean; // Es devolución de depósito

  // Legacy (sin cambios)
  monto_recaudado_disponible: number; // Disponible de lo cobrado
}
```

### Request de Liquidación

**NO CAMBIA.** Mismo endpoint `POST /receipts/process-receipt`. El backend permite liquidar aunque `monto_cobrado_inquilino = 0`.

---

### Campos Legados (Compatibilidad)

Los siguientes campos se mantienen para **NO romper** el frontend existente:

- `monto_recaudado_disponible` (= `monto_liquidable_cobrado`)
- `monto_liquidable` (deprecated, usar `monto_liquidable_cobrado`)

**✅ GARANTÍA DE COMPATIBILIDAD:**

- Partidas DEBE: **Sin cambios**. Campos: `saldo_pendiente`, `pagado`, `monto_pagado_acumulado`
- Endpoint `/process-receipt`: **Sin cambios**. Misma estructura de request/response
- Filtro `solo_pendientes`: **Funciona igual** pero ahora muestra HABER aunque no estén cobrados
- Resumen: **Sin cambios**. Campos: `total_debe`, `total_haber`, `saldo_pendiente_debe`, etc.

**📌 SOLO CAMBIOS EN PARTIDAS HABER:**

- Campos nuevos agregados (no reemplazan existentes)
- Campos legacy se mantienen por compatibilidad
- Lógica de filtrado cambiada: usa `monto_total_liquidable` en lugar de `monto_recaudado_disponible`

---

## 2. Procesar Recibo (Endpoint Unificado)

**Endpoint único** para todas las operaciones de cobros y pagos.

### Request

```http
POST /api/v1/receipts/process-receipt
Authorization: Bearer <token>
Content-Type: application/json
```

> ⚠️ **IMPORTANTE:** Usar **`/receipts/process-receipt`** en lugar de `/accounting-entries/process-receipt`.  
> El primero crea automáticamente transacciones en la tabla de caja/bancos.

### Body

**Estructura:**

```json
{
  "monto_total_imputado": number,           // Suma de todos los montoImputado
  "monto_recibido_fisico": number,          // Monto real recibido/pagado
  "tipo_flujo_neto": "INGRESO" | "EGRESO", // INGRESO = neto positivo, EGRESO = neto negativo
  "metodo_pago": "transferencia" | "efectivo" | "cheque" | "tarjeta",
  "cuenta_afectada_id": "string",           // ID de la cuenta de caja/banco
  "agente_id": "string",                    // ID del agente principal del recibo
  "asientos_a_imputar": [
    {
      "asientoId": "string",                // ID del asiento contable
      "montoImputado": number,              // Monto a imputar
      "tipoOperacion": "COBRO" | "PAGO",   // COBRO=actualiza DEBE, PAGO=actualiza HABER
      "agenteId": "string (opcional)"       // Requerido si tipoOperacion=PAGO
    }
  ],
  "comprobante_externo": "string (opcional)", // Número de transferencia/cheque
  "observaciones": "string (opcional)",
  "contrato_id": "string (opcional)",
  "emitir_factura": boolean
}
```

**Notas importantes:**

- `tipoOperacion` es **por asiento**, no por recibo completo
- `tipoOperacion: "COBRO"` → Actualiza partidas **DEBE** (cobrar al inquilino)
- `tipoOperacion: "PAGO"` → Actualiza partidas **HABER** del agente especificado (liquidar)
- Si `tipoOperacion: "PAGO"`, el campo `agenteId` es **requerido**
- `tipo_flujo_neto` determina el movimiento neto de caja (puede ser distinto de las operaciones individuales)

### Ejemplos de Body

**1. Cobrar un solo alquiler:**

```json
{
  "monto_total_imputado": 1000000,
  "monto_recibido_fisico": 1000000,
  "tipo_flujo_neto": "INGRESO",
  "metodo_pago": "transferencia",
  "cuenta_afectada_id": "caja_id",
  "agente_id": "locatario_id",
  "asientos_a_imputar": [
    {
      "asientoId": "690a812dbff411728c9e830b",
      "montoImputado": 1000000,
      "tipoOperacion": "COBRO"
    }
  ],
  "comprobante_externo": "TRF-001",
  "emitir_factura": false
}
```

**2. Liquidar a un solo agente:**

```json
{
  "monto_total_imputado": 920000,
  "monto_recibido_fisico": 920000,
  "tipo_flujo_neto": "EGRESO",
  "metodo_pago": "transferencia",
  "cuenta_afectada_id": "caja_id",
  "agente_id": "locador_id",
  "asientos_a_imputar": [
    {
      "asientoId": "690a812dbff411728c9e830b",
      "montoImputado": 920000,
      "tipoOperacion": "PAGO",
      "agenteId": "locador_id"
    }
  ],
  "comprobante_externo": "TRF-002",
  "emitir_factura": false
}
```

**3. Cobrar alquiler + honorarios (múltiples asientos):**

```json
{
  "monto_total_imputado": 1050000,
  "monto_recibido_fisico": 1050000,
  "tipo_flujo_neto": "INGRESO",
  "metodo_pago": "transferencia",
  "cuenta_afectada_id": "caja_id",
  "agente_id": "locatario_id",
  "asientos_a_imputar": [
    {
      "asientoId": "alquiler_id",
      "montoImputado": 1000000,
      "tipoOperacion": "COBRO"
    },
    {
      "asientoId": "honorarios_id",
      "montoImputado": 50000,
      "tipoOperacion": "COBRO"
    }
  ],
  "comprobante_externo": "TRF-003",
  "emitir_factura": false,
  "observaciones": "Alquiler + Honorarios Enero"
}
```

**4. COMPROBANTE MIXTO - Cobrar alquiler y liquidar al propietario:**

```json
{
  "monto_total_imputado": 1920000,
  "monto_recibido_fisico": 80000,
  "tipo_flujo_neto": "INGRESO",
  "metodo_pago": "transferencia",
  "cuenta_afectada_id": "caja_id",
  "agente_id": "locatario_id",
  "asientos_a_imputar": [
    {
      "asientoId": "alquiler_id",
      "montoImputado": 1000000,
      "tipoOperacion": "COBRO"
    },
    {
      "asientoId": "alquiler_id",
      "montoImputado": 920000,
      "tipoOperacion": "PAGO",
      "agenteId": "locador_id"
    }
  ],
  "observaciones": "Cobro de inquilino y liquidación a propietario en un solo comprobante",
  "emitir_factura": false
}
```

**Explicación del comprobante mixto:**

- Se cobra $1M del inquilino (INGRESO +$1M)
- Se liquida $920K al propietario (EGRESO -$920K)
- Movimiento neto de caja: **+$80K** (honorarios de la inmobiliaria)
- `tipo_flujo_neto: "INGRESO"` porque el neto es positivo

**5. COMPENSACIÓN - Liquidar con descuento de honorarios:**

```json
{
  "monto_total_imputado": 1640000,
  "monto_recibido_fisico": 200000,
  "tipo_flujo_neto": "EGRESO",
  "metodo_pago": "transferencia",
  "cuenta_afectada_id": "caja_id",
  "agente_id": "locador_id",
  "asientos_a_imputar": [
    {
      "asientoId": "alquiler_id",
      "montoImputado": 920000,
      "tipoOperacion": "PAGO",
      "agenteId": "locador_id"
    },
    {
      "asientoId": "honorarios_descuento_id",
      "montoImputado": 720000,
      "tipoOperacion": "PAGO",
      "agenteId": "locador_id"
    }
  ],
  "observaciones": "Liquidación con compensación de honorarios",
  "emitir_factura": false
}
```

**Explicación de la compensación:**

- Asiento 1: Propietario tiene HABER $920K (se le debe)
- Asiento 2: Propietario tiene DEBE $720K (él debe por honorarios)
- Sistema calcula automáticamente: $920K - $720K = **$200K** a pagar
- `tipo_flujo_neto: "EGRESO"` porque el neto es negativo (se le paga al propietario)

### Response

```json
{
  "recibo": {
    "fecha": "2025-11-05",
    "metodo": "transferencia",
    "comprobante": "REC-003",
    "observaciones": "...",
    "total_lineas": 3,
    "total_ingreso": 1050000,
    "total_egreso": 920000,
    "movimiento_neto": 130000
  },
  "operaciones": [
    {
      "asiento_id": "...",
      "tipo_operacion": "COBRO",
      "monto": 1000000,
      "estado": "PROCESADO",
      "resultado": { /* asiento actualizado */ }
    },
    ...
  ],
  "resumen": {
    "procesadas": 3,
    "errores": 0
  }
}
```

### Efectos

**Por cada asiento según `tipoOperacion`:**

**COBRO (`tipoOperacion: "COBRO"`):**

- ✅ Actualiza `monto_pagado_acumulado` en partidas DEBE del asiento
- ✅ Cambia estado a PAGADO/PAGADO_PARCIAL según monto cobrado
- ❌ NO afecta partidas HABER
- ❌ NO requiere `agenteId`

**PAGO (`tipoOperacion: "PAGO"`):**

- ✅ Actualiza `monto_liquidado` en partidas HABER del agente especificado
- ✅ Actualiza `monto_pagado_acumulado` en partidas DEBE del agente (si existen - compensación)
- ✅ Calcula monto neto: HABER - DEBE del agente
- ✅ Cambia estado a LIQUIDADO si todas las partidas HABER están liquidadas
- ❌ NO afecta partidas de otros agentes
- ✅ **Requiere `agenteId`** obligatorio

**A nivel de recibo completo:**

- ✅ Actualiza saldo de `cuenta_afectada_id` según `tipo_flujo_neto`
- ✅ INGRESO: Suma al saldo de caja
- ✅ EGRESO: Resta del saldo de caja
- ✅ Genera un único comprobante que incluye todas las operaciones
- ✅ Calcula movimiento neto = suma(COBROS) - suma(PAGOS)

### Errores Comunes

```json
{
  "statusCode": 400,
  "message": "El asiento X con tipoOperacion=PAGO requiere agenteId"
}
```

```json
{
  "statusCode": 400,
  "message": "No se encontraron partidas para el agente X en el asiento Y"
}
```

```json
{
  "statusCode": 400,
  "message": "El monto total imputado calculado no coincide con el monto_total_imputado enviado"
}
```

---

## 3. Balance de un Agente

### Request

```http
GET /api/v1/agents/:agentId/balance
Authorization: Bearer <token>
```

### Response

```json
{
  "balance": -920
}
```

**Interpretación:**

- **Positivo**: El agente debe dinero (deudor)
- **Negativo**: Se le debe dinero al agente (acreedor)

---

## 4. Ejemplos Completos

### Ejemplo 1: Cobro Simple

**Escenario:** Locatario paga $1,000,000 del alquiler.

```bash
curl -X POST 'http://localhost:3050/api/v1/receipts/process-receipt' \
  -H 'Authorization: Bearer eyJ...' \
  -H 'Content-Type: application/json' \
  -d '{
    "monto_total_imputado": 1000000,
    "monto_recibido_fisico": 1000000,
    "tipo_flujo_neto": "INGRESO",
    "metodo_pago": "transferencia",
    "cuenta_afectada_id": "caja_id",
    "agente_id": "locatario_id",
    "asientos_a_imputar": [
      {
        "asientoId": "690a812dbff411728c9e830b",
        "montoImputado": 1000000
      }
    ],
    "emitir_factura": false
  }'
```

**Resultado:**

- Caja: +$1,000,000
- Locatario saldo pendiente: -$1,000,000
- Locador disponible: +$920,000 (si es 92%)
- Inmobiliaria disponible: +$80,000 (si es 8%)

---

### Ejemplo 2: Liquidación

**Escenario:** Liquidar $920,000 al locador.

```bash
curl -X POST 'http://localhost:3050/api/v1/receipts/process-receipt' \
  -H 'Authorization: Bearer eyJ...' \
  -H 'Content-Type: application/json' \
  -d '{
    "monto_total_imputado": 920000,
    "monto_recibido_fisico": 920000,
    "tipo_flujo_neto": "EGRESO",
    "metodo_pago": "transferencia",
    "cuenta_afectada_id": "caja_id",
    "agente_id": "locador_id",
    "asientos_a_imputar": [
      {
        "asientoId": "690a812dbff411728c9e830b",
        "montoImputado": 920000
      }
    ],
    "emitir_factura": false,
    "comprobante_externo": "TRF-001234"
  }'
```

**Resultado:**

- Caja: -$920,000
- Locador disponible: $0 (liquidado)
- Inmobiliaria disponible: +$80,000 (sin cambio)

---

## 5. Validación

### Verificar estado de cuenta

```bash
curl -sS 'http://localhost:3050/api/v1/accounting-entries/estado-cuenta/locador_id' \
  -H 'Authorization: Bearer eyJ...' | jq '.resumen.saldo_disponible_haber'
```

### Verificar saldo de caja

```bash
mongosh nest-propietasV3 --eval "db.financialaccounts.findOne({nombre: 'Caja Principal'}, {saldo_actual: 1})"
```

### Verificar asiento

```bash
mongosh nest-propietasV3 --eval "db.accountingentries.findOne(
  {_id: ObjectId('690a812dbff411728c9e830b')},
  {partidas: 1, estado: 1}
)"
```

---

## 6. Guía Frontend

### Implementación

**Siempre usar el mismo endpoint:**

```typescript
class ReciboService {
  async procesarReciboCobro(
    asientos: { asientoId: string; monto: number }[],
    agenteId: string,
    cuentaId: string,
  ) {
    const monto_total = asientos.reduce((sum, a) => sum + a.monto, 0);

    return this.http.post('/api/v1/receipts/process-receipt', {
      monto_total_imputado: monto_total,
      monto_recibido_fisico: monto_total,
      tipo_flujo_neto: 'INGRESO',
      metodo_pago: 'transferencia',
      cuenta_afectada_id: cuentaId,
      agente_id: agenteId,
      asientos_a_imputar: asientos.map((a) => ({
        asientoId: a.asientoId,
        montoImputado: a.monto,
      })),
      emitir_factura: false,
    });
  }

  async procesarReciboPago(
    asientos: { asientoId: string; monto: number }[],
    agenteId: string,
    cuentaId: string,
  ) {
    const monto_total = asientos.reduce((sum, a) => sum + a.monto, 0);

    return this.http.post('/api/v1/receipts/process-receipt', {
      monto_total_imputado: monto_total,
      monto_recibido_fisico: monto_total,
      tipo_flujo_neto: 'EGRESO',
      metodo_pago: 'transferencia',
      cuenta_afectada_id: cuentaId,
      agente_id: agenteId,
      asientos_a_imputar: asientos.map((a) => ({
        asientoId: a.asientoId,
        montoImputado: a.monto,
      })),
      emitir_factura: false,
    });
  }
}
```

### Ejemplos de uso

**Cobrar 1 alquiler:**

```typescript
await procesarReciboCobro(
  [{ asientoId: alquilerId, monto: 1000000 }],
  locatarioId,
  cajaId,
);
```

**Liquidar 1 agente:**

```typescript
await procesarReciboPago(
  [{ asientoId: alquilerId, monto: 920000 }],
  locadorId,
  cajaId,
);
```

**Cobrar alquiler + honorarios:**

```typescript
await procesarReciboCobro(
  [
    { asientoId: alquilerId, monto: 1000000 },
    { asientoId: honorariosId, monto: 50000 },
  ],
  locatarioId,
  cajaId,
);
```

### Mostrar saldos

**DEBE (Locatario):**

```typescript
const saldo = movimiento.saldo_pendiente; // Cuánto debe
const color = saldo > 0 ? 'red' : 'green';
```

**HABER (Locador/Inmobiliaria):**

```typescript
const saldo = movimiento.monto_recaudado_disponible; // Cuánto puede retirar
const color = saldo > 0 ? 'green' : 'gray';
```

### Ventajas

✅ **Sin lógica condicional:** Frontend no decide qué endpoint llamar  
✅ **Un solo método:** `procesarRecibo(lineas[])`  
✅ **Flexible:** 1 o N operaciones con la misma función  
✅ **Consistente:** Siempre genera comprobante y calcula movimiento neto

---

## 7. Flujo de Datos Interno

### Flujo COBRO (tipo_operacion = "COBRO")

```
Frontend envía:
{
  tipo_operacion: "COBRO",
  asiento_id: "690a...",
  monto: 1000000
}
       ↓
Backend: processReceipt()
       ↓
Llama: registerPayment(asiento_id, monto)
       ↓
Filtra partidas DEBE:
  asiento.partidas.filter(p => p.debe > 0)
       ↓
Actualiza SOLO partidas DEBE:
  partida.monto_pagado_acumulado += monto
       ↓
Actualiza caja:
  caja.saldo_actual += monto (INGRESO)
       ↓
Cambia estado asiento:
  "PAGADO_PARCIAL" o "PAGADO"
       ↓
Retorna asiento actualizado
```

**Campos tocados:**

- ✅ `partidas[].monto_pagado_acumulado` (solo DEBE)
- ✅ `estado`
- ✅ `caja.saldo_actual` (+)
- ❌ `partidas[].monto_liquidado` (NO)

---

### Flujo PAGO (tipo_operacion = "PAGO")

```
Frontend envía:
{
  tipo_operacion: "PAGO",
  asiento_id: "690a...",
  monto: 920000,
  agente_id: "locador_id"
}
       ↓
Backend: processReceipt()
       ↓
Llama: liquidarAPropietario(asiento_id, agente_id)
       ↓
Calcula monto cobrado del locatario:
  montoCobrado = sum(partidas DEBE.monto_pagado_acumulado)
       ↓
Filtra partidas HABER del agente:
  asiento.partidas.filter(
    p => p.haber > 0 && p.agente_id === dto.agente_id
  )
       ↓
Calcula proporcional:
  proporcion = partida.haber / totalHaber
  montoLiquidable = montoCobrado * proporcion
       ↓
Actualiza SOLO partidas HABER del agente:
  partida.monto_liquidado = montoLiquidable
       ↓
Actualiza caja:
  caja.saldo_actual -= montoLiquidable (EGRESO)
       ↓
Cambia estado si todas las HABER liquidadas:
  "LIQUIDADO" (si todas) o sin cambio
       ↓
Retorna asiento actualizado
```

**Campos tocados:**

- ✅ `partidas[].monto_liquidado` (solo HABER del agente)
- ✅ `estado` (si aplica)
- ✅ `caja.saldo_actual` (-)
- ❌ `partidas[].monto_pagado_acumulado` (NO)

---

### Validaciones Críticas

**En COBRO:**

```typescript
// 1. Solo si hay partidas DEBE
const totalDebe = asiento.partidas.reduce((sum, p) => sum + p.debe, 0);
if (totalDebe > 0) {
  // Solo entonces actualiza caja
}

// 2. Solo actualiza partidas DEBE
for (const partida of asiento.partidas) {
  if (partida.debe > 0) {
    // ← Filtro crítico
    partida.monto_pagado_acumulado += monto;
  }
}
```

**En PAGO:**

```typescript
// 1. Requiere agente_id
if (!dto.agente_id) {
  throw new BadRequestException('agente_id requerido para PAGO');
}

// 2. Solo partidas HABER del agente
const partidasDelAgente = asiento.partidas.filter(
  (p) => p.haber > 0 && p.agente_id?.toString() === dto.agente_id,
);

// 3. Evita doble liquidación
const montoYaLiquidado = partida.monto_liquidado || 0;
const montoDisponible = montoProporcionado - montoYaLiquidado;
if (montoDisponible <= 0) {
  throw new BadRequestException('Ya liquidado completamente');
}
```

---

## 8. Casos de Uso Reales

### Caso 1: Pago Parcial del Locatario

**Situación:**

- Alquiler: $1,000,000
- Locatario paga: $300,000 (30%)

**Request:**

```json
{
  "monto_total_imputado": 300000,
  "monto_recibido_fisico": 300000,
  "tipo_flujo_neto": "INGRESO",
  "metodo_pago": "transferencia",
  "cuenta_afectada_id": "caja_id",
  "agente_id": "locatario_id",
  "asientos_a_imputar": [
    {
      "asientoId": "690a...",
      "montoImputado": 300000
    }
  ],
  "emitir_factura": false
}
```

**Resultado:**

- Partida DEBE: `monto_pagado_acumulado = 300000`
- Locatario saldo pendiente: $700,000
- Locador disponible: $276,000 (92% de $300,000)
- Inmobiliaria disponible: $24,000 (8% de $300,000)
- Caja: +$300,000

**Estado asiento:** `PAGADO_PARCIAL`

---

### Caso 2: Liquidación Parcial al Locador

**Situación:**

- Locatario ya pagó $300,000
- Locador disponible: $276,000
- Se liquida solo $100,000 al locador

**Request:**

```json
{
  "monto_total_imputado": 100000,
  "monto_recibido_fisico": 100000,
  "tipo_flujo_neto": "EGRESO",
  "metodo_pago": "transferencia",
  "cuenta_afectada_id": "caja_id",
  "agente_id": "locador_id",
  "asientos_a_imputar": [
    {
      "asientoId": "690a...",
      "montoImputado": 100000
    }
  ],
  "emitir_factura": false
}
```

**Resultado:**

- Partida HABER locador: `monto_liquidado = 100000`
- Locador disponible restante: $176,000
- Inmobiliaria disponible: $24,000 (sin cambio)
- Caja: -$100,000

**Estado asiento:** `PAGADO_PARCIAL` (porque aún falta liquidar al locador completamente)

---

### Caso 3: Cobro de Múltiples Asientos

**Situación:** El locatario paga alquiler + honorarios.

**Request:**

```json
{
  "monto_total_imputado": 1050000,
  "monto_recibido_fisico": 1050000,
  "tipo_flujo_neto": "INGRESO",
  "metodo_pago": "efectivo",
  "cuenta_afectada_id": "caja_id",
  "agente_id": "locatario_id",
  "asientos_a_imputar": [
    {
      "asientoId": "690a...",
      "montoImputado": 1000000
    },
    {
      "asientoId": "honorarios_id",
      "montoImputado": 50000
    }
  ],
  "emitir_factura": false
}
```

**Resultado:**

- Partida DEBE alquiler: `monto_pagado_acumulado = 1000000`
- Partida DEBE honorarios: `monto_pagado_acumulado = 50000`
- Locatario saldo pendiente: $0 (en ambos asientos)
- Caja: **+$1,050,000**

**Estado asientos:** `PAGADO` (ambos)

---

## 9. Preguntas Frecuentes

### ¿Por qué no usar un solo endpoint para cobro Y liquidación?

**Ya lo hacemos.** `POST /process-receipt` maneja ambos. La diferencia es el `tipo_operacion` en cada línea.

### ¿Puedo liquidar antes de cobrar?

**No.** El código valida:

```typescript
if (!['PAGADO', 'PAGADO_PARCIAL'].includes(asiento.estado)) {
  throw new BadRequestException('Solo se pueden liquidar asientos pagados');
}
```

### ¿Puedo liquidar más de lo cobrado?

**No.** El código calcula:

```typescript
const montoCobrado = sum(partidas DEBE.monto_pagado_acumulado);
const montoLiquidable = montoCobrado * proporcion;
// Solo puede liquidar hasta montoLiquidable
```

### ¿Qué pasa si liquido dos veces al mismo agente?

**Error.** El código valida:

```typescript
const montoDisponible = montoProporcionado - montoYaLiquidado;
if (montoDisponible <= 0) {
  throw new BadRequestException('Ya liquidado completamente');
}
```

### ¿Puedo procesar un solo asiento?

**Sí.** Es perfectamente válido:

```json
{
  "monto_total_imputado": 1000000,
  "monto_recibido_fisico": 1000000,
  "tipo_flujo_neto": "INGRESO",
  "metodo_pago": "transferencia",
  "cuenta_afectada_id": "caja_id",
  "agente_id": "locatario_id",
  "asientos_a_imputar": [{ "asientoId": "...", "montoImputado": 1000000 }],
  "emitir_factura": false
}
```

### ¿Cómo sé cuánto puede retirar un agente?

**Consulta su estado de cuenta:**

```http
GET /api/v1/accounting-entries/estado-cuenta/:agentId
```

Busca: `resumen.saldo_disponible_haber`

---

## 10. Gestión de Recibos (PDF, Email, WhatsApp)

Sistema completo de generación, descarga y envío de recibos.

### 10.1. Generar PDF del Recibo

Genera un archivo PDF profesional del recibo y lo almacena.

#### Request

```http
POST /api/v1/receipts/generate-pdf
Authorization: Bearer <token>
Content-Type: application/json
```

#### Body

```json
{
  "receiptId": "673a812dbff411728c9e830b"
}
```

#### Response

```json
{
  "pdfPath": "/Users/.../uploads/receipts/recibo-00000123-1730832000000.pdf",
  "pdfUrl": "/uploads/receipts/recibo-00000123-1730832000000.pdf"
}
```

#### Características del PDF

- **Formato:** A4 profesional
- **Header:** Logo, tipo de comprobante (X), número, fecha
- **Cliente:** Nombre, CUIT, email
- **Pago:** Método, número de comprobante
- **Detalle:** Tabla con todas las operaciones
- **Totales:** Ingresos, egresos, movimiento neto
- **Observaciones:** Si existen
- **Firmas:** Espacio para emisor y receptor

---

### 10.2. Enviar Recibo por Email

Envía el recibo por email con el PDF adjunto.

#### Request

```http
POST /api/v1/receipts/send-email
Authorization: Bearer <token>
Content-Type: application/json
```

#### Body

```json
{
  "receiptId": "673a812dbff411728c9e830b",
  "email": "cliente@ejemplo.com"
}
```

#### Response

```json
{
  "success": true,
  "message": "Email enviado exitosamente a cliente@ejemplo.com"
}
```

#### Configuración Requerida (.env)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-o-app-password
```

#### Características del Email

- **Asunto:** Recibo de Pago N° XXXXXXXX
- **Diseño:** HTML profesional responsive
- **Header:** Verde corporativo con logo
- **Contenido:** Resumen del recibo
- **Adjunto:** PDF del recibo
- **Footer:** Disclaimer automático

---

### 10.3. Enviar Recibo por WhatsApp

Envía el recibo por WhatsApp usando WhatsApp Business API.

#### Request

```http
POST /api/v1/receipts/send-whatsapp
Authorization: Bearer <token>
Content-Type: application/json
```

#### Body

```json
{
  "receiptId": "673a812dbff411728c9e830b",
  "phoneNumber": "5491123456789"
}
```

**Formato de número:** `549` + código de área + número (sin 15)

Ejemplos:

- Buenos Aires: `5491123456789`
- Córdoba: `5493514567890`
- Mendoza: `5492614567890`

#### Response

```json
{
  "success": true,
  "message": "WhatsApp enviado exitosamente a 5491123456789"
}
```

#### Configuración Requerida (.env)

```bash
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_ACCESS_TOKEN=tu-access-token
WHATSAPP_PHONE_NUMBER_ID=tu-phone-number-id
```

#### Características del Mensaje

- **Formato:** Markdown con emojis
- **Contenido:** Resumen profesional del recibo
- **Adjunto:** PDF del recibo
- **Interactivo:** El cliente puede descargar y compartir

---

### 10.4. Listar Recibos por Agente

Permite consultar los recibos (cobros/liquidaciones) asociados a un agente, con paginación y filtros.

#### Request

```http
GET /api/v1/receipts/by-agent/:agentId?tipo_flujo_neto=INGRESO&fecha_from=2025-01-01&fecha_to=2025-12-31&page=0&pageSize=20&order=desc
Authorization: Bearer <token>
```

- `tipo_flujo_neto`: `INGRESO` | `EGRESO` (opcional)
- `fecha_from` / `fecha_to`: rango de fechas por `fecha_emision` (opcional)
- `page`: página (0-based, default 0)
- `pageSize`: tamaño de página (default 10)
- `order`: `asc` | `desc` por `fecha_emision` (default `desc`)
- Compatibilidad: si se envía `limit`, se mapea internamente a `pageSize`.

#### Response

```json
{
  "totalItems": 5,
  "totalPages": 1,
  "page": 0,
  "pageSize": 20,
  "items": [
    {
      "_id": "673a812dbff411728c9e830b",
      "numero_recibo": 123,
      "fecha_emision": "2025-11-07T15:32:10.000Z",
      "monto_total": 1000000,
      "metodo_pago": "transferencia",
      "comprobante_externo": "TRF-001",
      "tipo_flujo_neto": "INGRESO",
      "agente_id": "507f1f77bcf86cd799439011"
    }
  ]
}
```

---

### 10.5. Obtener URL Pública del PDF

Obtiene la URL pública del PDF del recibo (genera el PDF si no existe).

#### Request

```http
GET /api/v1/receipts/:id/pdf-url
Authorization: Bearer <token>
```

#### Response

```json
{
  "pdfUrl": "/uploads/receipts/recibo-00000123-1730832000000.pdf"
}
```

#### Uso

Esta URL puede usarse para:

- Vista previa en el navegador
- Descarga directa
- Integración en iframe
- Compartir link temporal

---

### 10.5. Flujo Completo de Usuario

**Después de procesar un pago:**

```typescript
// 1. Procesar el recibo
const response = await processReceipt(dto);
const receiptId = response.recibo._id;

// 2. Usuario elige acción:

// Opción A: Ver recibo
const pdfUrl = await getPdfUrl(receiptId);
window.open(pdfUrl.pdfUrl, '_blank');

// Opción B: Imprimir recibo
const pdfUrl = await getPdfUrl(receiptId);
// Abrir en nueva ventana y usar window.print()

// Opción C: Enviar por email
await sendEmail({
  receiptId,
  email: 'cliente@ejemplo.com',
});

// Opción D: Enviar por WhatsApp
await sendWhatsApp({
  receiptId,
  phoneNumber: '5491123456789',
});
```

---

### 10.6. Errores Comunes

#### Email no configurado

```json
{
  "statusCode": 500,
  "message": "No se pudo enviar el email: Connection refused"
}
```

**Solución:** Verificar variables SMTP en .env

#### WhatsApp no configurado

```json
{
  "statusCode": 400,
  "message": "WhatsApp no está configurado. Configure las variables de entorno necesarias."
}
```

**Solución:** Configurar WHATSAPP\_\* en .env

#### PDF no se puede generar

```json
{
  "statusCode": 500,
  "message": "Error al generar PDF: ..."
}
```

**Solución:** Verificar permisos de escritura en `/uploads/receipts/`

---

### 10.7. Ejemplo Completo

```bash
# 1. Procesar el recibo
curl -X POST 'http://localhost:3050/api/v1/receipts/process-receipt' \
  -H 'Authorization: Bearer eyJ...' \
  -H 'Content-Type: application/json' \
  -d '{
    "monto_total_imputado": 1000000,
    "monto_recibido_fisico": 1000000,
    "tipo_flujo_neto": "INGRESO",
    "metodo_pago": "transferencia",
    "cuenta_afectada_id": "caja_id",
    "agente_id": "locatario_id",
    "asientos_a_imputar": [{
      "asientoId": "690a812dbff411728c9e830b",
      "montoImputado": 1000000
    }],
    "emitir_factura": false
  }'

# Respuesta incluye _id del recibo:
# { "recibo": { "_id": "673a812dbff411728c9e830b", ... } }

# 2. Enviar por email
curl -X POST 'http://localhost:3050/api/v1/receipts/send-email' \
  -H 'Authorization: Bearer eyJ...' \
  -H 'Content-Type: application/json' \
  -d '{
    "receiptId": "673a812dbff411728c9e830b",
    "email": "cliente@ejemplo.com"
  }'

# 3. Enviar por WhatsApp
curl -X POST 'http://localhost:3050/api/v1/receipts/send-whatsapp' \
  -H 'Authorization: Bearer eyJ...' \
  -H 'Content-Type: application/json' \
  -d '{
    "receiptId": "673a812dbff411728c9e830b",
    "phoneNumber": "5491123456789"
  }'
```

---

## 11. Resumen de Cambios - Comprobantes Mixtos y Compensación

### Cambios en el DTO (Breaking Changes)

**Archivo:** `src/modules/receipts/dto/create-receipt.dto.ts`

**Nuevo campo en `AsientoImputacionDto`:**

```typescript
{
  asientoId: string;
  montoImputado: number;
  tipoOperacion: "COBRO" | "PAGO";  // ← NUEVO: Define qué partidas se actualizan
  agenteId?: string;                 // ← NUEVO: Requerido si tipoOperacion = PAGO
}
```

**Antes:**

```json
{
  "asientos_a_imputar": [
    {
      "asientoId": "690a...",
      "montoImputado": 1000000
    }
  ],
  "tipo_flujo_neto": "INGRESO" // ← Determinaba si era COBRO o PAGO
}
```

**Ahora:**

```json
{
  "asientos_a_imputar": [
    {
      "asientoId": "690a...",
      "montoImputado": 1000000,
      "tipoOperacion": "COBRO" // ← Cada asiento define su operación
    }
  ],
  "tipo_flujo_neto": "INGRESO" // ← Solo define movimiento neto de caja
}
```

### Nuevas Capacidades

**1. Comprobantes Mixtos (COBRO + PAGO en un solo recibo):**

```json
{
  "asientos_a_imputar": [
    {
      "asientoId": "alquiler_id",
      "montoImputado": 1000000,
      "tipoOperacion": "COBRO"
    },
    {
      "asientoId": "alquiler_id",
      "montoImputado": 920000,
      "tipoOperacion": "PAGO",
      "agenteId": "locador_id"
    }
  ]
}
```

**Resultado:**

- Cobra $1M del inquilino (DEBE)
- Liquida $920K al propietario (HABER)
- Movimiento neto de caja: +$80K

**2. Compensación Automática (HABER - DEBE del mismo agente):**

```json
{
  "asientos_a_imputar": [
    {
      "asientoId": "alquiler_id",
      "montoImputado": 920000,
      "tipoOperacion": "PAGO",
      "agenteId": "locador_id" // Tiene HABER $920K
    },
    {
      "asientoId": "honorarios_id",
      "montoImputado": 720000,
      "tipoOperacion": "PAGO",
      "agenteId": "locador_id" // Tiene DEBE $720K
    }
  ]
}
```

**Resultado:**

- Sistema calcula automáticamente: $920K - $720K = $200K
- Actualiza `monto_liquidado` en partida HABER
- Actualiza `monto_pagado_acumulado` en partida DEBE
- Movimiento neto de caja: -$200K (EGRESO)

### Validaciones Nuevas

1. **Si `tipoOperacion = "PAGO"`** → `agenteId` es **obligatorio**
2. **Si `tipoOperacion = "COBRO"`** → `agenteId` es opcional (se ignora)
3. **Mismo asiento puede aparecer múltiples veces** con diferentes `tipoOperacion`
4. **`tipo_flujo_neto`** ya no determina COBRO/PAGO, solo el movimiento neto de caja

### Migración desde Versión Anterior

**Frontend Antiguo (sin `tipoOperacion`):**

```json
{
  "asientos_a_imputar": [{ "asientoId": "X", "montoImputado": 1000 }],
  "tipo_flujo_neto": "INGRESO"
}
```

**Frontend Nuevo (con `tipoOperacion`):**

```json
{
  "asientos_a_imputar": [
    {
      "asientoId": "X",
      "montoImputado": 1000,
      "tipoOperacion": "COBRO" // ← Mapear desde tipo_flujo_neto
    }
  ],
  "tipo_flujo_neto": "INGRESO"
}
```

**Regla de migración:**

- Si antes era `tipo_flujo_neto: "INGRESO"` → usar `tipoOperacion: "COBRO"`
- Si antes era `tipo_flujo_neto: "EGRESO"` → usar `tipoOperacion: "PAGO"` + agregar `agenteId`

### Casos de Uso Nuevos

| Escenario                               | Antes                    | Ahora                        |
| --------------------------------------- | ------------------------ | ---------------------------- |
| Cobrar y liquidar en 1 recibo           | ❌ Imposible (2 recibos) | ✅ Posible (1 recibo mixto)  |
| Liquidar con descuento de honorarios    | ❌ 2 recibos separados   | ✅ 1 recibo con compensación |
| Liquidar aunque no esté cobrado         | ❌ Error                 | ✅ Liquidación adelantada    |
| Liquidar después de liquidación parcial | ❌ Error "ya liquidado"  | ✅ Permitido                 |

### Consistencia Código-Documentación

✅ **DTO:** `AsientoImputacionDto` incluye `tipoOperacion` y `agenteId`  
✅ **Service:** `receipts.service.ts` procesa según `tipoOperacion` de cada asiento  
✅ **Accounting:** `liquidarAPropietario` soporta compensación HABER-DEBE  
✅ **Docs:** Ejemplos actualizados con comprobantes mixtos y compensación  
✅ **Validación:** Backend valida `agenteId` obligatorio si `tipoOperacion = PAGO`
