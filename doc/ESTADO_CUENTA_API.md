# API de Estado de Cuenta y Liquidaciones

## Índice

1. [Principios de Diseño](#principios-de-diseño)
2. [Arquitectura](#arquitectura)
3. [Estado de Cuenta de un Agente](#1-estado-de-cuenta-de-un-agente)
4. [Procesar Recibo (Endpoint Unificado)](#2-procesar-recibo-endpoint-unificado)
5. [Balance de un Agente](#3-balance-de-un-agente)
6. [Ejemplos Completos](#4-ejemplos-completos)
7. [Validación](#5-validación)
8. [Guía Frontend](#6-guía-frontend)
9. [Flujo de Datos Interno](#7-flujo-de-datos-interno)
10. [Casos de Uso Reales](#8-casos-de-uso-reales)
11. [Preguntas Frecuentes](#9-preguntas-frecuentes)

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
  "monto_total_imputado": number,           // Suma de todos los montos imputados
  "monto_recibido_fisico": number,          // Monto real recibido/pagado
  "tipo_flujo_neto": "INGRESO" | "EGRESO", // INGRESO = cobro, EGRESO = pago
  "metodo_pago": "transferencia" | "efectivo" | "cheque" | "tarjeta",
  "cuenta_afectada_id": "string",           // ID de la cuenta de caja/banco
  "agente_id": "string",                    // ID del agente (locatario/locador)
  "asientos_a_imputar": [
    {
      "asientoId": "string",                // ID del asiento contable
      "montoImputado": number               // Monto a imputar
    }
  ],
  "comprobante_externo": "string (opcional)", // Número de transferencia/cheque
  "observaciones": "string (opcional)",
  "contrato_id": "string (opcional)",
  "emitir_factura": boolean
}
```

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
      "montoImputado": 1000000
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
      "montoImputado": 920000
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
      "montoImputado": 1000000
    },
    {
      "asientoId": "honorarios_id",
      "montoImputado": 50000
    }
  ],
  "comprobante_externo": "TRF-003",
  "emitir_factura": false,
  "observaciones": "Alquiler + Honorarios Enero"
}
```

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

**COBRO:**

- ✅ Actualiza `monto_pagado_acumulado` en partidas DEBE
- ✅ Suma a caja (**INGRESO +**)
- ✅ Cambia estado a PAGADO/PAGADO_PARCIAL

**PAGO:**

- ✅ Actualiza `monto_liquidado` en partidas HABER del agente
- ✅ Resta de caja (**EGRESO -**)
- ✅ Cambia estado a LIQUIDADO si todas las partidas HABER están liquidadas
- ❌ NO afecta otros agentes

### Errores Comunes

```json
{
  "statusCode": 400,
  "message": "La línea de PAGO del asiento X requiere agente_id"
}
```

```json
{
  "operaciones": [
    {
      "estado": "ERROR",
      "error": "No se encontraron partidas HABER para el agente X"
    }
  ]
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
