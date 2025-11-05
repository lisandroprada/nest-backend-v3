# Fix: Error de Doble Imputación en Liquidación

## Problema Identificado

### Síntomas

1. Al liquidar 920 al locador, su saldo disponible quedaba en 1766.40 (920 + 920 \* 1.08) en vez de 0
2. El saldo del locatario quedaba en 998.080 en vez de 999.000

### Causa Raíz

**Error 1: `liquidarAPropietario` no especificaba el agente**

- El DTO `LiquidarAsientoDto` no incluía `agente_id`
- Se liquidaban TODAS las partidas HABER del asiento (locador + inmobiliaria)
- Esto generaba doble imputación y cálculos incorrectos

**Error 2: Actualización incorrecta de saldo de caja**

- Tanto `registerPayment` (DEBE) como `liquidarAPropietario` (HABER) actualizaban el saldo de caja
- Esto causaba que ambas operaciones sumaran al balance

**Error 3: Lógica de INGRESO/EGRESO incorrecta**

- `registerPayment` determinaba el tipo de movimiento según si había DEBE o HABER
- Pero para un asiento de alquiler (DEBE para locatario, HABER para locador/inmobiliaria), ambos tipos están presentes

## Solución Implementada

### 1. Agregar `agente_id` al DTO de Liquidación

**Archivo:** `src/modules/accounting-entries/dto/liquidar-asiento.dto.ts`

```typescript
export class LiquidarAsientoDto {
  @IsDateString()
  fecha_liquidacion: string;

  @IsString()
  metodo_liquidacion: string;

  @IsMongoId()
  cuenta_financiera_id: string;

  @IsMongoId()
  agente_id: string; // ✅ NUEVO: ID del agente al que se liquida

  @IsOptional()
  @IsString()
  comprobante?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  usuario_id: string;
}
```

### 2. Refactorizar `liquidarAPropietario`

**Archivo:** `src/modules/accounting-entries/accounting-entries.service.ts`

**Cambios clave:**

1. Filtrar solo las partidas HABER del agente especificado
2. Calcular `montoDisponible` correctamente sin doble acumulación
3. Actualizar `monto_liquidado` como valor absoluto (no acumulativo)
4. NO cambiar estado a LIQUIDADO hasta que TODAS las partidas HABER estén liquidadas

```typescript
async liquidarAPropietario(
  asientoId: string,
  dto: LiquidarAsientoDto,
  session?: any,
): Promise<AccountingEntry> {
  // ... validaciones ...

  // CRÍTICO: Filtrar solo las partidas HABER del agente especificado
  const partidasDelAgente = asiento.partidas.filter(
    (p) => p.haber > 0 && p.agente_id?.toString() === dto.agente_id,
  );

  if (partidasDelAgente.length === 0) {
    throw new BadRequestException(
      `No se encontraron partidas HABER para el agente ${dto.agente_id}`,
    );
  }

  let montoAPagar = 0;

  for (const partida of partidasDelAgente) {
    const proporcion = totalHaber > 0 ? partida.haber / totalHaber : 0;
    const montoProporcionado = montoCobrado * proporcion;
    const montoYaLiquidado = partida.monto_liquidado || 0;
    const montoDisponible = montoProporcionado - montoYaLiquidado;

    if (montoDisponible <= 0) {
      throw new BadRequestException(
        `La partida del agente ${dto.agente_id} ya está completamente liquidada`,
      );
    }

    // ✅ Actualizar como valor absoluto, no acumulativo
    partida.monto_liquidado = montoProporcionado;
    montoAPagar += montoDisponible;
  }

  // ✅ Solo actualizar caja si hay pago real
  if (montoAPagar > 0) {
    await this.financialAccountsService.updateBalance(
      dto.cuenta_financiera_id,
      montoAPagar,
      'EGRESO',
      session,
    );
  }

  // ✅ Solo cambiar a LIQUIDADO si TODAS las partidas HABER están liquidadas
  const todasLiquidadas = asiento.partidas
    .filter((p) => p.haber > 0)
    .every((p) => {
      const proporcion = totalHaber > 0 ? p.haber / totalHaber : 0;
      const montoProporcionado = montoCobrado * proporcion;
      const montoYaLiquidado = p.monto_liquidado || 0;
      return montoYaLiquidado >= montoProporcionado;
    });

  if (todasLiquidadas) {
    asiento.estado = 'LIQUIDADO';
    asiento.fecha_liquidacion = new Date(dto.fecha_liquidacion);
  }

  // ...
}
```

### 3. Corregir Actualización de Caja en `registerPayment`

**Antes:**

```typescript
// ❌ Determinaba tipo según DEBE/HABER (incorrecto para asientos mixtos)
const totalDebe = asiento.partidas.reduce((sum, p) => sum + p.debe, 0);
const tipoMovimiento = totalDebe > 0 ? 'INGRESO' : 'EGRESO';

await this.financialAccountsService.updateBalance(
  dto.cuenta_financiera_id,
  dto.monto_pagado,
  tipoMovimiento,
  null,
);
```

**Después:**

```typescript
// ✅ Solo registrar INGRESO si hay DEBE (pago del locatario)
const totalDebe = asiento.partidas.reduce((sum, p) => sum + p.debe, 0);
if (totalDebe > 0) {
  await this.financialAccountsService.updateBalance(
    dto.cuenta_financiera_id,
    dto.monto_pagado,
    'INGRESO',
    null,
  );
}
// Si solo hay HABER, no actualiza saldo aquí (liquidación lo maneja)
```

## Ejemplo de Flujo Correcto

### Escenario: Alquiler de $1,000,000

- Locatario debe: $1,000,000
- Locador recibe: $920,000 (92%)
- Inmobiliaria recibe: $80,000 (8%)

### Paso 1: Locatario paga $1,000

**Request:**

```bash
POST /api/v1/accounting-entries/:asientoId/payment
{
  "monto_pagado": 1000,
  "cuenta_financiera_id": "...",
  "fecha_pago": "2025-11-04",
  "metodo_pago": "transferencia",
  "usuario_id": "..."
}
```

**Resultado:**

- Caja: +1000 (INGRESO) ✅
- Locatario saldo: 1,000,000 - 1,000 = 999,000 ✅
- Locador saldo disponible: 1000 \* 0.92 = 920 ✅
- Inmobiliaria saldo disponible: 1000 \* 0.08 = 80 ✅

### Paso 2: Liquidar $920 al Locador

**Request:**

```bash
POST /api/v1/accounting-entries/:asientoId/liquidate
{
  "agente_id": "<locador_id>",
  "cuenta_financiera_id": "...",
  "fecha_liquidacion": "2025-11-04",
  "metodo_liquidacion": "transferencia",
  "usuario_id": "..."
}
```

**Resultado:**

- Caja: -920 (EGRESO) ✅
- Locador saldo disponible: 920 - 920 = 0 ✅
- Inmobiliaria saldo disponible: 80 (sin cambios) ✅
- Locatario saldo: 999,000 (sin cambios) ✅

### Paso 3: Liquidar $80 a la Inmobiliaria

**Request:**

```bash
POST /api/v1/accounting-entries/:asientoId/liquidate
{
  "agente_id": "<inmobiliaria_id>",
  "cuenta_financiera_id": "...",
  "fecha_liquidacion": "2025-11-04",
  "metodo_liquidacion": "transferencia",
  "usuario_id": "..."
}
```

**Resultado:**

- Caja: -80 (EGRESO) ✅
- Inmobiliaria saldo disponible: 80 - 80 = 0 ✅
- Estado del asiento: LIQUIDADO ✅

## Validación

### Verificar Saldo de Caja

```bash
mongosh nest-propietasV3 --eval "db.financialaccounts.findOne({nombre: 'Caja Principal'})"
```

Debe mostrar: `saldo_inicial: 0` (1000 - 920 - 80)

### Verificar Estado de Cuenta del Locador

```bash
curl -X GET 'http://localhost:3050/api/v1/accounting-entries/estado-cuenta/<locador_id>' \
  -H 'Authorization: Bearer <token>'
```

Debe mostrar:

```json
{
  "resumen": {
    "saldo_disponible_haber": 0
  }
}
```

### Verificar Estado de Cuenta del Locatario

```bash
curl -X GET 'http://localhost:3050/api/v1/accounting-entries/estado-cuenta/<locatario_id>' \
  -H 'Authorization: Bearer <token>'
```

Debe mostrar:

```json
{
  "resumen": {
    "saldo_pendiente_debe": 999000
  }
}
```

## Migración de Datos Existentes

Si hay datos corruptos de versiones anteriores del código, ejecutar:

```bash
# Limpiar monto_liquidado duplicado
mongosh nest-propietasV3 --eval "
  db.accountingentries.updateMany(
    { 'partidas.monto_liquidado': { \$exists: true } },
    { \$set: { 'partidas.\$.monto_liquidado': 0 } }
  )
"

# Re-liquidar manualmente con el nuevo endpoint (especificando agente_id)
```

## Breaking Changes en API

### ⚠️ Endpoint de Liquidación Requiere `agente_id`

**Antes:**

```json
POST /api/v1/accounting-entries/:id/liquidate
{
  "cuenta_financiera_id": "...",
  "fecha_liquidacion": "...",
  "metodo_liquidacion": "...",
  "usuario_id": "..."
}
```

**Ahora:**

```json
POST /api/v1/accounting-entries/:id/liquidate
{
  "agente_id": "...",  // ✅ REQUERIDO
  "cuenta_financiera_id": "...",
  "fecha_liquidacion": "...",
  "metodo_liquidacion": "...",
  "usuario_id": "..."
}
```

## Estado del Fix

- ✅ DTO actualizado con `agente_id`
- ✅ Lógica de `liquidarAPropietario` corregida
- ✅ Lógica de `registerPayment` corregida
- ✅ Estado LIQUIDADO solo cuando todas las partidas están liquidadas
- ⏳ Pendiente: Validar con datos reales del usuario
- ⏳ Pendiente: Migrar datos corruptos si existen

## Fecha de Implementación

2025-11-04
