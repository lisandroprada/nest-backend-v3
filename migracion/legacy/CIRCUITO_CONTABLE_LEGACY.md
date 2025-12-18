# Circuito Contable Completo: Legacy y V3

Este documento describe el funcionamiento completo del motor contable utilizado en el sistema de gestión inmobiliaria, cubriendo tanto el sistema Legacy (`sistema-be`) como el nuevo sistema V3 (`nest-backend-v3`).

---

## TABLA DE CONTENIDOS

1. [Comparativa Legacy vs V3](#comparativa-legacy-vs-v3)
2. [Sistema Legacy (sistema-be)](#sistema-legacy-sistema-be)
3. [Sistema V3 (nest-backend-v3)](#sistema-v3-nest-backend-v3)
   - [Entidades Clave](#entidades-clave-v3)
   - [Flujo de Creación de Asientos](#flujo-de-creación-de-asientos-v3)
   - [Circuito de Cobro](#circuito-de-cobro-v3)
   - [Circuito de Liquidación](#circuito-de-liquidación-v3)
   - [Estados y Transiciones](#estados-y-transiciones-v3)
   - [Recibos y Transacciones](#recibos-y-transacciones-v3)
4. [Relaciones Entre Entidades](#relaciones-entre-entidades)
5. [Migración Legacy → V3](#migración-legacy--v3)

---

## COMPARATIVA LEGACY VS V3

| Característica | Legacy (`sistema-be`) | V3 (`nest-backend-v3`) |
|---|---|---|
| **Estructura** | MasterAccount / Account | AccountingEntry / Partidas |
| **Atomicidad** | 1 Cuenta = 1 Documento | 1 Asiento = N Partidas (Debe/Haber) |
| **Relación Cobro/Liq** | Implícita por `MasterAccount` | Explícita en el mismo Asiento |
| **Estado Liq** | Campo `available` calculado dinámicamente | Campos `monto_liquidado` y estados |
| **Updates** | Cascading al guardar Recibo | Lógica centralizada en Servicio |
| **Plan de Cuentas** | No existe (Hardcoded accounts) | `ChartOfAccounts` real y configurable |
| **Balance Contable** | No se valida | Validación automática (Debe = Haber) |
| **Patrón de Diseño** | Procedural (mongoose hooks) | Factory + Builder Pattern |
| **Liquidación Adelantada** | No soportado | Soportado (liquidar antes de cobrar) |
| **Compensación Automática** | No soportado | Automática HABER - DEBE por agente |
| **Auditoría** | Básica (`AccountEntry`) | Completa (`historial_cambios` + estados) |

---

## SISTEMA LEGACY (sistema-be)

### 1. Entidades Clave

*   **LeaseAgreement (Contrato):** Entidad principal. Al guardarse, dispara la creación de todas las cuentas.
*   **MasterAccount (Cuenta Maestra):** Representa un "Concepto" global del contrato (ej. "Alquileres del Contrato X"). No tiene saldo por sí misma, sirve de agrupador.
*   **Account (Cuenta Corriente):** La entidad más importante. Representa una cuota o período específico.
    *   **Tipos:** `Debito` (Deuda del Inquilino), `Credito` (Haber del  Propietario/Inmobiliaria).
    *   *Ejemplo:* "Alquiler Enero 2024 (Débito)", "Acreedor Propietario Enero 2024 (Crédito)".
*   **Receipt (Recibo):** Documento de movimiento de fondos (Cobro o Liquidación).
*   **AccountEntry (Asiento/Movimiento):** Registro individual de impacto en una `Account` generado por un `Receipt`.
*   **Transaction (Caja):** Registro físico del dinero (ingreso/egreso) si el pago es en efectivo.

### 2. Flujo de Generación (Full History)

El sistema genera **todas** las cuentas (mes a mes) al momento de crear/guardar el contrato.

**Disparador:** `LeaseAgreement.pre('save')` -> `masterAccountController.createMaster`.

#### Lógica de Creación (`createMaster`)

Por cada concepto (Alquiler, Depósito, Honorarios), el sistema realiza lo siguiente:

1.  **Iteración Mensual:** Calcula una proyección mes a mes basada en la duración y ajustes.
2.  **MasterAccount:** Crea registros temporales o de agrupación en memoria (`masterAccount` array).
3.  **Account (Débito - Inquilino):**
    *   Crea una cuenta `Debito` por mes.
    *   `amount`: Monto total del alquiler.
    *   `totalBalance`: Inicializa igual al `amount` (Deuda total).
    *   `available`: Igual al `totalBalance` (Monto pendiente de cobro).
4.  **Account (Crédito - Propietario):**
    *   Crea una cuenta `Credito` por mes.
    *   `amount`: Monto neto (Alquiler - Honorarios).
    *   `totalBalance`: Monto neto (Obligación futura de la inmobiliaria).
    *   `available`: **0** (Inicialmente no está disponible para liquidar hasta que se cobre).
5.  **Account (Crédito - Honorarios Inmobiliaria):**
    *   Crea una cuenta `Credito` por mes para la inmobiliaria.
    *   `amount`: Monto de honorarios.

**Resultado:** Si el contrato es de 36 meses, se generan 36 cuentas de débito para el inquilino y 36 cuentas de crédito para el propietario inmediatamente.

### 3. Circuito de Cobro (Legacy)

El cobro imputa contra las cuentas de tipo `Debito`.

**Actor:** Usuario.
**Entidad:** `Receipt`.

#### Paso a Paso (`Receipt.pre('save')`)

1.  **Selección:** Se eligen las `Account` (Débito) a pagar.
2.  **ReceiptEntries:** Se guarda un snapshot de qué se pagó.
3.  **AccountEntry:** Se crean documentos `AccountEntry` para historial.
4.  **Actualización de Saldos (Débito):**
    *   Se busca la `Account` de débito.
    *   `totalBalance` = `totalBalance` - `amount_pagado`.
    *   Si `totalBalance` llega a 0, la cuota está saldada.
5.  **Actualización "Aguas Abajo" (Trigger):**
    *   El sistema busca las cuentas **Crédito** asociadas al mismo `MasterAccount` (mismo concepto/mes).
    *   **Propietario:** Incrementa el campo `collected` (recaudado) proporcionalmente.
    *   **Inmobiliaria:** Incrementa el campo `collected` proporcionalmente.
    *   **Efecto:** Al incrementar `collected`, la fórmula de `available` del propietario se actualiza, permitiendo su liquidación.

### 4. Circuito de Liquidación (Legacy)

La liquidación imputa contra las cuentas de tipo `Credito`.

**Tipo:** `Receipt` (tipo Liquidación).

#### Paso a Paso

1.  **Selección:** Se eligen las `Account` (Crédito) que tienen `available > 0` (es decir, que fueron cobradas previamente).
2.  **Receipt:** Se genera un recibo de tipo liquidación.
3.  **Actualización de Saldos (Crédito):**
    *   Se busca la `Account` de crédito (Propietario).
    *   `totalBalance` = `totalBalance` - `amount_liquidado`.
    *   Esto reduce la deuda con el propietario.
4.  **Transaction:**
    *   Si es efectivo, se genera una `Transaction` de tipo `d` (débito/egreso).

### 5. Auditoría en Legacy

Legacy utiliza `AccountEntry` como auditoría básica. Cada vez que se mueve saldo, se crea un `AccountEntry`. Sin embargo, la trazabilidad de cambios de estado (quién modificó qué y cuándo fuera de un recibo) es limitada en comparación con el `historial_cambios` de V3.

---

## SISTEMA V3 (nest-backend-v3)

El sistema V3 implementa contabilidad por partida doble verdadera, con validaciones automáticas de balanceo (Debe = Haber), plan de cuentas configurable, y una arquitectura basada en patrones de diseño (Factory + Builder).

---

### ENTIDADES CLAVE (V3)

#### 1. ChartOfAccount (Plan de Cuentas)

**Ubicación:** `src/modules/chart-of-accounts/entities/chart-of-account.entity.ts`

Representa el plan de cuentas contable de la organización. Define las cuentas disponibles para imputación.

```typescript
class ChartOfAccount {
  codigo: string;                    // Código único (ej: "CXC_ALQ", "CXP_LOC")
  nombre: string;                    // Nombre descriptivo
  tipo_cuenta: string;               // ACTIVO, PASIVO, PATRIMONIO_NETO, INGRESO, EGRESO
  descripcion?: string;
  cuenta_padre_id?: ObjectId;        // Jerarquía de cuentas
  es_imputable: boolean;             // ¿Se pueden registrar asientos?
  tasa_iva_aplicable?: number;
  es_facturable: boolean;
}
```

**Ejemplo de cuentas:**
- `CXC_ALQ`: Cuentas por Cobrar - Alquileres
- `CXP_LOC`: Cuentas por Pagar - Locadores
- `ING_HNR`: Ingresos por Honorarios
- `ACT_FID`: Activo - Caja Fiduciaria (depósitos)
- `PAS_DEP`: Pasivo - Depósitos a Devolver

**Servicio:** `ChartOfAccountsService`

---

#### 2. AccountingEntry (Asiento Contable)

**Ubicación:** `src/modules/accounting-entries/entities/accounting-entry.entity.ts`

El corazón del sistema contable V3. Un asiento agrupa múltiples **partidas** (debe/haber) que deben cumplir la ecuación **Debe = Haber**.

```typescript
class AccountingEntry {
  // Identificación y Contexto
  contrato_id: ObjectId;
  fecha_imputacion: Date;
  fecha_vencimiento: Date;
  descripcion: string;
  tipo_asiento: string;              // 'Alquiler', 'Deposito en Garantia', 'Honorarios'
  metadata?: Record<string, any>;    // Datos adicionales estructurados
  
  // Estado y Montos
  estado: string;                    // Ver Estados más abajo
  monto_original: number;            // Monto total original
  monto_actual: number;              // Monto actual (tras ajustes)
  
  // Partidas Contables (DEBE/HABER)
  partidas: Partida[];               // Array de partidas
  
  // Ajustes
  es_ajustable: boolean;
  regla_ajuste?: string;             // Ej: 'AL_ULTIMO_ALQUILER'
  
  // Relaciones
  recibo_id?: ObjectId;              // Recibo asociado (si fue pagado/liquidado)
  
  // Campos de Pago (para partidas DEBE)
  fecha_pago?: Date;
  metodo_pago?: string;
  
  // Campos de Liquidación (para partidas HABER)
  fecha_liquidacion?: Date;
  metodo_liquidacion?: string;
  comprobante_liquidacion?: string;
  
  // Campos de Anulación
  fecha_anulacion?: Date;
  motivo_anulacion?: string;
  tipo_motivo_anulacion?: string;
  
  // Campos de Condonación
  fecha_condonacion?: Date;
  monto_condonado?: number;
  motivo_condonacion?: string;
  
  // Auditoría
  historial_cambios: HistorialCambio[];
}
```

#### 2.1 Partida (Subdocumento de AccountingEntry)

Cada `AccountingEntry` contiene un array de partidas.

```typescript
class Partida {
  cuenta_id: ObjectId;               // Ref a ChartOfAccount
  descripcion: string;
  debe: number;                      // Débito (Carga)
  haber: number;                     // Crédito (Abono)
  agente_id?: ObjectId;              // Agente asociado (locador/locatario/inmobiliaria)
  
  // Acumuladores de Operaciones
  monto_pagado_acumulado?: number;   // Solo para partidas DEBE (cobros)
  monto_liquidado?: number;          // Solo para partidas HABER (liquidaciones)
  
  // IVA (si aplica)
  es_iva_incluido: boolean;
  tasa_iva_aplicada?: number;
  monto_base_imponible?: number;
  monto_iva_calculado?: number;
}
```

**Regla de Oro:** `Σ(debe) = Σ(haber)` para cada AsientoExplained

---

#### 3. Receipt (Recibo)

**Ubicación:** `src/modules/receipts/entities/receipt.entity.ts`

Documento que registra una operación de cobro o liquidación. Puede afectar múltiples asientos contables.

```typescript
class Receipt {
  numero_recibo: number;             // Número secuencial único
  fecha_emision: Date;
  monto_total: number;               // Monto NETO del recibo (absoluto)
  metodo_pago: string;               // 'efectivo', 'transferencia', 'cheque', 'tarjeta'
  comprobante_externo?: string;      // Número de transferencia/cheque
  
  cuenta_financiera_id: ObjectId;    // FinancialAccount afectada
  agente_id: ObjectId;               // Agente que paga/recibe (locador/locatario)
  
  // NUEVO: Detalle de asientos afectados con tipo de operación
  asientos_afectados: Array<{
    asiento_id: ObjectId;
    monto_imputado: number;
    tipo_operacion: 'COBRO' | 'PAGO';  // COBRO→DEBE, PAGO→HABER
  }>;
  
  // LEGACY: Mantener compatibilidad
  asientos_afectados_ids?: ObjectId[];
  
  tipo_flujo_neto: string;           // 'INGRESO' | 'EGRESO' (calculado automáticamente)
  
  contrato_id?: ObjectId;
  fiscal_document_id?: ObjectId;     // Factura asociada (si aplica)
  saldo_a_favor_entry_id?: ObjectId; // Asiento de saldo a favor
  
  pdf_path?: string;
  pdf_url?: string;
  
  usuario_emisor_id: ObjectId;
  observaciones?: string;
}
```

**CÁLCULO DEL FLUJO NETO:**

El sistema calcula automáticamente el `tipo_flujo_neto` basándose en:

```
flujo_neto = Σ(COBROS) - Σ(PAGOS)

Si flujo_neto >= 0 → INGRESO (entra dinero)
Si flujo_neto < 0  → EGRESO (sale dinero)
```

**Ejemplo:**
- Cobro al locatario: $1,000,000 (COBRO/DEBE)
- Liquidación al locador: $920,000 (PAGO/HABER)
- **Flujo neto:** $1,000,000 - $920,000 = **$80,000 INGRESO**

---

#### 4. Transaction (Transacción Financiera)

**Ubicación:** `src/modules/transactions/entities/transaction.entity.ts`

Registro del movimiento real de dinero en las cuentas financieras (cajas, bancos).

```typescript
class Transaction {
  referencia_asiento?: ObjectId;     // Asiento contable relacionado
  cuenta_financiera_id: ObjectId;    // Cuenta bancaria/caja afectada
  fecha_transaccion: Date;
  monto: number;
  tipo: string;                      // 'INGRESO' | 'EGRESO'
  descripcion: string;
  
  receipt_id?: ObjectId;             // Recibo asociado
  
  // Conciliación Bancaria
  conciliado: boolean;
  fecha_conciliacion?: Date;
  referencia_bancaria?: string;
  
  usuario_creacion_id: ObjectId;
}
```

**Relación:** Un `Receipt` genera uno o más `Transaction` dependiendo del flujo neto (INGRESO/EGRESO).

---

#### 5. Estados de Asiento Contable

Los asientos contables pueden tener los siguientes estados:

| Estado | Descripción |
|---|---|
| `PENDIENTE` | Asiento creado, sin pagos ni liquidaciones |
| `PENDIENTE_AJUSTE` | Asiento pendiente de ajuste por índice (ej: ICL) |
| `PAGADO_PARCIAL` | Partidas DEBE pagadas parcialmente |
`COBRADO` | Partidas DEBE 100% cobradas, HABER pendiente de liquidación |
| `PAGADO` | Asiento 100% cobrado Y liquidado (cerrado)|
| `LIQUIDADO` | Partidas HABER 100% liquidadas |
| `ANULADO` | Asiento anulado (no válido) |
| `ANULADO_PORRESCISION` | Anulado por rescisión de contrato |
| `CONDONADO` | Deuda condonada (total o parcial) |
| `PENDIENTE_FACTURAR` | Marcado para generación de factura |
| `FACTURADO` | Factura ya emitida |
| `PENDIENTE_APROBACION` | Requiere aprobación manual |

---

### FLUJO DE CREACIÓN DE ASIENTOS (V3)

El sistema V3 utiliza un patrón **Factory + Builder** para garantizar la creación correcta de asientos contables.

---

#### 1. AccountingEntryBuilder

**Ubicación:** `src/modules/accounting-entries/builders/accounting-entry.builder.ts`

Builder pattern que garantiza:
- Balanceo automático (Debe = Haber)
- Validaciones de campos requeridos
- Construcción fluida y legible

```typescript
// Ejemplo de uso
const asiento = builder
  .reset()
  .setType('Alquiler')
  .setDescription('Alquiler Enero 2024 - Propiedad X')
  .setDates(fechaImputacion, fechaVencimiento)
  .setState('PENDIENTE')
  .addDebit(cuentaId_CXC_ALQ, 1000000, locatarioId, 'Alquiler Enero')
  .addCredit(cuentaId_CXP_LOC, 920000, locadorId, 'Crédito Locador Enero')
  .addCredit(cuentaId_ING_HNR, 80000, inmobiliariaId, 'Honorarios 8%')
  .build();   // Lanza error si no balancea
```

**Validaciones automáticas en `build()`:**
1. Al menos una partida
2. Debe = Haber (tolerancia 0.01)
3. Campos requeridos presentes

---

#### 2. AccountingEntryFactory

**Ubicación:** `src/modules/accounting-entries/factories/accounting-entry.factory.ts`

Factoría que encapsula la lógica de negocio para crear tipos específicos de asientos.

##### 2.1 `createMonthlyRentEntry()` - Alquiler Mensual

Genera el asiento de alquiler de un mes:

```
DEBE  [CXC_ALQ]     $1,000,000  (Locatario)
HABER [CXP_LOC]       $920,000  (Locador)
HABER [ING_HNR]        $80,000  (Inmobiliaria)
```

**Cálculo:**
- Monto bruto: $1,000,000
- Comisión (8%): $80,000
- Neto a locador: $920,000

##### 2.2 `createDepositEntry()` - Depósito en Garantía

**Tipo: COBRO** (al inicio del contrato):
```
DEBE  [CXC_ALQ]     $2,000,000  (Locatario)
HABER [ACT_FID]     $2,000,000  (Fiduciaria)
```

**Tipo: DEVOLUCION** (al fin del contrato):
```
DEBE  [ACT_FID]     $2,000,000  (Fiduciaria - egreso)
HABER [PAS_DEP]     $2,000,000  (Locador - pasivo a devolver)
```

##### 2.3 `createHonorariosEntry()` - Honorarios Iniciales

Genera asientos de honorarios iniciales (locador o locatario):

**Honorarios Locador:**
```
DEBE  [CXP_LOC]      $300,000  (Locador - descuento)
HABER [ING_HNR_INIC] $300,000  (Inmobiliaria)
```

**Honorarios Locatario:**
```
DEBE  [CXC_ALQ]      $300,000  (Locatario - cargo)
HABER [ING_HNR_INIC] $300,000  (Inmobiliaria)
```

---

### CIRCUITO DE COBRO (V3)

El cobro en V3 actualiza las partidas **DEBE** de los asientos contables.

**Método:** `AccountingEntriesService.registerPayment()`
**Ubicación:** Líneas 1108-1243 de `accounting-entries.service.ts`

---

#### Flujo del Cobro

**1. Validaciones Iniciales**
- Asiento existe
- Estado no es ANULADO ni CONDONADO
- Monto a pagar no excede saldo pendiente

**2. Cálculo de Saldo Pendiente (DEBE)**

```typescript
totalDebe = Σ(partidas donde debe > 0)
montoPagadoDebe = Σ(partidas.monto_pagado_acumulado donde debe > 0)
saldoPendiente = totalDebe - montoPagadoDebe
```

**3. Actualización de Partidas DEBE**

El monto recibido se **distribuye** entre las partidas DEBE:

```typescript
for (partida of partidas donde debe > 0) {
  deudaPartida = partida.debe - (partida.monto_pagado_acumulado || 0);
  if (deudaPartida > 0) {
    montoAImputar = Math.min(montoRestante, deudaPartida);
    partida.monto_pagado_acumulado += montoAImputar;
    montoRestante -= montoAImputar;
  }
}
```

**4. Actualización del Estado**

El estado se determina automáticamente basándose en:
- Partidas DEBE: ¿cobradas completamente?
- Partidas HABER: ¿liquidadas completamente?

```typescript
if (debeTotalmenteCobrado && haberTotalmenteLiquidado) {
  estado = 'PAGADO';                 // Cerrado completamente
} else if (debeTotalmenteCobrado && !haberTotalmenteLiquidado) {
  estado = 'COBRADO';                // Cobrado pero pendiente liquidar
} else {
  estado = 'PAGADO_PARCIAL';         // Aún hay saldo pendiente
}
```

**5. Actualización de Cuenta Financiera**

Si hay partidas DEBE (cobro al locatario), se registra INGRESO:

```typescript
await financialAccountsService.updateBalance(
  cuenta_financiera_id,
  monto_pagado,
  'INGRESO',  // Entra dinero
);
```

**6. Historial de Cambios**

Se registra en `historial_cambios` del asiento:

```typescript
asiento.historial_cambios.push({
  fecha: new Date(),
  usuario_id: usuario,
  accion: 'PAGO_COMPLETO' | 'PAGO_PARCIAL',
  estado_anterior: 'PENDIENTE',
  estado_nuevo: 'COBRADO',
  monto: monto_pagado,
  observaciones: 'Cobro del locatario'
});
```

---

### CIRCUITO DE LIQUIDACIÓN (V3)

La liquidación actualiza las partidas **HABER** de los asientos contables y permite **compensación automática**.

**Método:** `AccountingEntriesService.liquidarAPropietario()`
**Ubicación:** Líneas 1389-1560+ de `accounting-entries.service.ts`

---

#### Características Únicas de V3

1. **Liquidación Adelantada:** Se puede liquidar ANTES de cobrar al locatario
2. **Compensación Automática:** El sistema compensa automáticamente HABER - DEBE del mismo agente
3. **Liquidación Parcial:** Se puede especificar `monto_a_liquidar` para liquidar en partes

---

#### Flujo de Liquidación

**1. Filtrar Partidas del Agente**

```typescript
partidasHaberDelAgente = asiento.partidas.filter(
  p => p.haber > 0 && p.agente_id === agente_id
);

partidasDebeDelAgente = asiento.partidas.filter(
  p => p.debe > 0 && p.agente_id === agente_id
);
```

**2. Procesar Partidas HABER (a favor del agente)**

```typescript
for (partida of partidasHaberDelAgente) {
  montoLiquidable = partida.haber;
  montoYaLiquidado = partida.monto_liquidado || 0;
  montoDisponible = montoLiquidable - montoYaLiquidado;
  
  if (montoDisponible > 0) {
    montoALiquidar = Math.min(montoDisponible, montoRestanteALiquidar);
    partida.monto_liquidado += montoALiquidar;
    montoHaberTotal += montoALiquidar;
  }
}
```

**3. COMPENSAR Partidas DEBE (el agente debe)**

Si el agente tiene partidas DEBE (ej: honorarios), se compensan automáticamente:

```typescript
for (partida of partidasDebeDelAgente) {
  montoADescontar = partida.debe;
  montoYaPagado = partida.monto_pagado_acumulado || 0;
  montoDisponible = montoADescontar - montoYaPagado;
  
  if (montoDisponible > 0) {
    // Marcar como pagado (compensado)
    partida.monto_pagado_acumulado += montoDisponible;
    montoDebeTotal += montoDisponible;
  }
}
```

**4. Cálculo del Flujo Neto**

```typescript
montoNeto = montoHaberTotal - montoDebeTotal;
montoAbsoluto = Math.abs(montoNeto);

// Ejemplo:
// HABER (a favor del locador): $920,000
// DEBE (honorarios del locador): $50,000
// NETO: $920,000 - $50,000 = $870,000 (EGRESO)
```

**5. Actualización de Cuenta Financiera**

```typescript
await financialAccountsService.updateBalance(
  cuenta_financiera_id,
  montoAbsoluto,
  'EGRESO',  // Sale dinero
);
```

**6. CRÍTICO: NO cambiar estado a LIQUIDADO automáticamente**

El asiento puede tener múltiples agentes HABER que se liquidan por separado. El estado se actualiza SOLO cuando TODAS las partidas HABER están liquidadas (lo hace `registerPayment` o lógica externa).

---

### RECIBOS Y TRANSACCIONES (V3)

La generación de recibos integra cobros y liquidaciones en una **sola operación atómica**.

**Método:** `ReceiptsService.createReceipt()`
**Ubicación:** `src/modules/receipts/receipts.service.ts` líneas 45-362

---

#### Características

1. **Recibos Mixtos:** Un solo recibo puede contener COBROS + LIQUIDACIONES
2. **Detección Automática:** El sistema detecta automáticamente si una línea es COBRO o PAGO
3. **Flujo Neto Calculado:** Calcula automáticamente INGRESO/EGRESO
4. **Transaccionalidad:** Todo ocurre dentro de una transacción MongoDB
5. **Generación de PDF:** Genera PDF del recibo automáticamente

---

#### Flujo de Creación de Recibo

**1. Inicio de Transacción**

```typescript
const session = await receiptModel.db.startSession();
session.startTransaction();
```

**2. Generación de Número de Recibo**

```typescript
const numero_recibo = await sequenceService.generateReceiptNumber('receipt');
```

**3. Procesamiento de Asientos a Imputar**

Para cada asiento en `asientos_a_imputar`:

```typescript
for (imputacion of dto.asientos_a_imputar) {
  // Determinar tipo de operación (COBRO o PAGO)
  tipoOperacion = imputacion.tipoOperacion || detectarAutomaticamente();
  
  if (tipoOperacion === 'COBRO') {
    // Registrar pago del locatario (DEBE)
    await accountingEntriesService.registerPayment(asiento_id, {
      monto_pagado: montoImputado,
      fecha_pago: new Date(),
      metodo_pago: dto.metodo_pago,
      cuenta_financiera_id: dto.cuenta_afectada_id,
    });
    montoCobrosTotal += montoImputado;
    
  } else if (tipoOperacion === 'PAGO') {
    // Liquidar al locador/inmobiliaria (HABER)
    await accountingEntriesService.liquidarAPropietario(asiento_id, {
      agente_id: agenteId,
      cuenta_financiera_id: dto.cuenta_afectada_id,
      monto_a_liquidar: montoImputado,
    });
    montoPagosTotal += montoImputado;
  }
}
```

**4. Cálculo de Flujo Neto**

```typescript
montoNeto = montoCobrosTotal - montoPagosTotal;
tipoFlujoNeto = (montoNeto >= 0) ? 'INGRESO' : 'EGRESO';
montoNetoAbsoluto = Math.abs(montoNeto);
```

**Ejemplos:**

| Cobros | Pagos | Neto | Tipo |
|---|---|---|---|
| $1,000,000 | $0 | $1,000,000 | INGRESO |
| $1,000,000 | $920,000 | $80,000 | INGRESO |
| $0 | $920,000 | -$920,000 | EGRESO |
| $500,000 | $920,000 | -$420,000 | EGRESO |

**5. Manejo de Saldo a Favor**

Si `monto_recibido_fisico > monto_total_imputado`:

```typescript
saldoAFavor = monto_recibido_fisico - monto_total_imputado;

// Crear asiento contable de saldo a favor
const saldoAFavorEntry = await accountingEntriesService.create({
  tipo_asiento: 'SALDO_A_FAVOR',
  fecha_imputacion: new Date(),
  descripcion: `Saldo a favor por recibo #${numero_recibo}`,
  monto_original: saldoAFavor,
  partidas: [{
    cuenta_id: cuentaSaldoAFavor._id,
    haber: saldoAFavor,
    descripcion: 'Saldo a favor',
    agente_id: agente_id,
  }],
});
```

**6. Crear Documento de Recibo**

```typescript
const recibo = new Receipt({
  numero_recibo,
  fecha_emision: new Date(),
  monto_total: montoNetoAbsoluto,
  metodo_pago: dto.metodo_pago,
  tipo_flujo_neto: tipoFlujoNeto,       // INGRESO o EGRESO
  cuenta_financiera_id: dto.cuenta_afectada_id,
  agente_id: dto.agente_id,
  asientos_afectados: [                  // Detalle con tipo de operación
    {
      asiento_id: asiento1._id,
      monto_imputado: 1000000,
      tipo_operacion: 'COBRO',
    },
    {
      asiento_id: asiento2._id,
      monto_imputado: 920000,
      tipo_operacion: 'PAGO',
    }
  ],
  saldo_a_favor_entry_id: saldoAFavorEntry?._id,
});
await recibo.save({ session });
```

**7. Registrar Transacción Financiera**

```typescript
await transactionsService.create({
  referencia_asiento: asientos_afectados[0],
  monto: montoNetoAbsoluto,
  cuenta_financiera_id: dto.cuenta_afectada_id,
  tipo: (tipoFlujoNeto === 'INGRESO') ? 'INGRESO' : 'EGRESO',
  descripcion: `Cobro/Liquidación según recibo #${numero_recibo}`,
  referencia_bancaria: dto.comprobante_externo,
  receipt_id: recibo._id,
}, userId, session);
```

**8. Facturación (Opcional)**

Si `dto.emitir_factura && asientosFacturables.length > 0`:

```typescript
await fiscalDocumentsService.queueInvoiceGeneration(
  asientosFacturablesIds,
  userId,
  session
);
```

**9. Commit de Transacción**

```typescript
await session.commitTransaction();
return recibo;
```

**10. Generación de PDF**

El PDF se genera bajo demanda:

```typescript
const { pdfPath, pdfUrl } = await receiptsService.generatePDF(recibo._id);
```

---

### ESTADOS Y TRANSICIONES (V3)

#### Diagrama de Estados

```
                         ┌──────────────┐
                         │  PENDIENTE   │ (Inicial)
                         └──────┬───────┘
                                │
           ┌────────────────────┼────────────────────┐
           │ registerPayment()  │                    │
           ▼                    ▼                    │
    ┌──────────────┐     ┌──────────────┐           │
    │ PAGADO       │     │  COBRADO     │           │
    │ PARCIAL      │     │ (DEBE 100%,  │           │
    └──────┬───────┘     │ HABER pend.) │           │
           │             └──────┬───────┘           │
           │                    │                    │
           │   liquidarAPropietario()                │
           │                    │                    │
           └────────────────────┼────────────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │   PAGADO     │ (Cerrado)
                         └──────────────┘

           ┌────────────────────────────────────┐
           │  Otros Estados (paralelos)         │
           ├────────────────────────────────────┤
           │  ANULADO (no se puede operar)      │
           │  CONDONADO (deuda condonada)       │
           │  PENDIENTE_FACTURAR                │
           │  FACTURADO                         │
           └────────────────────────────────────┘
```

---

#### Métodos de Transición

| Método | Transición | Descripción |
|---|---|---|
| `registerPayment()` | PENDIENTE → PAGADO_PARCIAL → COBRADO → PAGADO | Registra cobro (actualiza DEBE) |
| `liquidarAPropietario()` | COBRADO → PAGADO | Liquida a propietario (actualiza HABER) |
| `anularAsiento()` | cualquier → ANULADO | Anula asiento (irreversible) |
| `condonarDeuda()` | PENDIENTE/PAGADO_PARCIAL → CONDONADO | Condona deuda |
| `markAsInvoiced()` | cualquier → FACTURADO | Marca como facturado |

---

## RELACIONES ENTRE ENTIDADES

### Diagrama de Relaciones (V3)

```
                                    ┌─────────────────┐
                                    │   Contract      │
                                    └────────┬────────┘
                                             │1
                                             │
                                             │hasMany
                                             ▼
                                    ┌─────────────────┐
                                    │ AccountingEntry │◀──────┐
                                    │ (Asiento)       │       │
                                    └────────┬────────┘       │
                                       │     │                │
                 ┌─────────────────────┼─────┼────────────────┤
                 │ partidas[]          │     │ recibo_id      │
                 ▼                     │     │                │
        ┌─────────────────┐            │     │         ┌──────┴───────┐
        │    Partida       │            │     └─────────│   Receipt    │
        │  - cuenta_id ────┼────┐       │               │  (Recibo)    │
        │  - agente_id ────┼──┐ │       │               └──────┬───────┘
        │  - debe          │  │ │       │                      │
        │  - haber         │  │ │       │                      │
        │  - monto_pagado  │  │ │       │                      │ receipt_id
        │  - monto_liquidado│ │ │       │                      ▼
        └──────────────────┘  │ │       │               ┌──────────────┐
                              │ │       │               │ Transaction  │
                              │ │       │ asiento_id    │ (Movimiento  │
                              │ │       └───────────────│  Financiero) │
                              │ │                       └──────────────┘
                              │ │
                              │ └────────────────────┐
                              │ refAgente            │
                              ▼                      ▼
                     ┌─────────────────┐    ┌─────────────────┐
                     │ ChartOfAccount  │    │     Agent       │
                     │ (Plan Cuentas)  │    │ (Locador/       │
                     │                 │    │  Locatario/     │
                     │ - codigo        │    │  Inmobiliaria)  │
                     │ - tipo_cuenta   │    └─────────────────┘
                     │ - es_imputable  │
                     └─────────────────┘
```

### Explicación de Relaciones

1. **Contract → AccountingEntry:** Un contrato tiene muchos asientos contables (1:N)

2. **AccountingEntry → Partida:** Un asiento contiene múltiples partidas (1:N embedded)

3. **Partida → ChartOfAccount:** Cada partida referencia una cuenta del plan contable

4. **Partida → Agent:** Cada partida puede estar asociada a un agente (locador, locatario, inmobiliaria)

5. **AccountingEntry ← Receipt:** Un recibo afecta múltiples asientos (N:M)

6. **Receipt → Transaction:** Un recibo genera una transacción financiera (1:1 o 1:N)

7. **Transaction → FinancialAccount:** Cada transacción afecta una cuenta financiera (caja/banco)

---

## TABLA DE EQUIVALENCIAS AMPLIADA: LEGACY vs V3

Esta tabla detalla cómo se transforman los conceptos del sistema Legacy al nuevo Plan de Cuentas de V3, incluyendo todos los tipos de movimientos identificados.

| Concepto Legacy (`MasterAccount`) | Tipo Legacy (`Account`) | V3 Tipo Asiento | V3 Cuenta Código | V3 Nombre Cuenta | Naturaleza | Notas |
|---|---|---|---|---|---|---|
| **Alquiler Devengado** | Debito (Inquilino) | `Alquiler` | **CXC_ALQ** | Ctas x Cobrar Alquileres | Activo | |
| **Alquiler Devengado** | Credito (Propietario) | `Alquiler` | **CXP_LOC** | Ctas x Pagar Locadores | Pasivo | Neto de honorarios |
| **Alquiler Devengado** | Credito (Honorarios) | `Alquiler` | **ING_HNR** | Ingresos por Honorarios | Ingreso | |
| **Deposito en Garantía** | Debito (Inquilino) | `Deposito en Garantia - Cobro` | **CXC_ALQ** | Ctas x Cobrar Alquileres | Activo | Se usa la misma CxC |
| **Deposito en Garantía** | Credito (Caja/Banco) | `Deposito en Garantia - Cobro` | **ACT_FID** | Activo Fiduciario / Caja | Activo | Cuenta puente |
| **Deposito en Garantía** | Credito (Pasivo) | `Deposito en Garantia - Devolucion` | **PAS_DEP** | Pasivo por Depósitos | Pasivo | |
| **Honorarios** | Debito (Inquilino) | `Honorarios Locatario` | **CXC_ALQ** | Ctas x Cobrar Alquileres | Activo | |
| **Honorarios** | Debito (Propietario) | `Honorarios Locador` | **CXP_LOC** | Ctas x Pagar Locadores | Pasivo | Reducción de Pasivo |
| **Honorarios** | Credito (Inmobiliaria) | `Honorarios ...` | **ING_HNR_INIC** | Honorarios Iniciales | Ingreso | |
| **Expensas** | Debito (Inquilino) | `Expensa` | **CXC_EXP** | Ctas x Cobrar Expensas | Activo | |
| **Expensas** | Credito (Consorcio) | `Expensa` | **CXP_TER** | Ctas x Pagar Terceros | Pasivo | Proveedor: Consorcio |
| **Bonificación** | Source/Target inv. | `Nota de Crédito` (o Ajuste) | **CXP_LOC** / **CXC_ALQ** | (Variable) | Ajuste | Reduce deuda/crédito |
| **Cargo proveedor** | Source (Propietario) | `Gasto / Reparación` | **CXP_LOC** | Ctas x Pagar Locadores | Pasivo | Reduce saldo a favor prop. |
| **Cargo proveedor** | Target (Proveedor) | `Gasto / Reparación` | **CXP_PRO** | Ctas x Pagar Proveedores | Pasivo | Genera deuda con prov. |
| **Factura de Servicios** | Source (Prop/Inq) | `Servicio (Luz/Gas)` | **CXP_LOC** / **CXC_ALQ** | (Variable) | Pasivo/Activo | Según a cargo de quién |
| **Factura de Servicios** | Target (Empresa) | `Servicio (Luz/Gas)` | **CXP_SER** | Ctas x Pagar Servicios | Pasivo | Edesur/Metrogas/etc |
| **Interés** | Source (Inquilino) | `Nota de Débito` (Interés) | **CXC_ALQ** | Ctas x Cobrar Alquileres | Activo | Aumenta deuda |
| **Interés** | Target (Propietario) | `Nota de Débito` (Interés) | **CXP_LOC** | Ctas x Pagar Locadores | Pasivo | Aumenta crédito prop. |

> **Nota:** En V3, el código de cuenta es la clave para la imputación correcta.

---

## ESTRUCTURA Y LÓGICA DE RECIBOS (LEGACY)

El análisis del controlador `receiptController.js` y el modelo `Receipt` revela una lógica de negocio compleja que debe ser migrada con cuidado.

### 1. Definición de Recibo Legacy
Un `Receipt` en Legacy es un **agregador de pagos**. No es unitario. Un solo recibo puede pagar parcial o totalmente múltiples conceptos (ej: Alquiler + Expensas + Intereses).

*   **Estructura:** Contiene un array `receiptEntries`.
*   **Imputación:** Cada `receiptEntry` apunta a una `MasterAccount` y un tipo (`Debito`/`Credito`).
*   **Persistencia:** Al guardarse (`pre('save')`), genera documentos `AccountEntry`. **Cuidado:** En Legacy, `AccountEntry` NO es el asiento contable (devengamiento), sino el registro del MOVIMIENTO DE CAJA (el pago).

### 2. Impacto en Saldos (Side-Effects)
El sistema Legacy actualiza los saldos de manera **destructiva/directa** en la colección `Account`:
1.  **Cuenta Directa:** Resta el monto pagado del `totalBalance` de la cuenta origen (ej. cuenta del inquilino).
2.  **Cuentas Espejo (Recaudación):** Busca las cuentas de crédito asociadas (`MasterAccount` compartida) y actualiza explícitamente el campo `collected` (recaudado). Separa la parte de honorarios (`isFee: true`) de la parte del propietario (`isFee: false`).

### 3. Estrategia de Migración Optimizada: Vinculación + Preservación de IDs

Para minimizar la complejidad del mapeo, utilizaremos una estrategia híbrida dependiendo del tipo de asiento.

#### Paso 1: Migración de Deudas (`Account`) → `AccountingEntry` V3

**Caso A: Asientos Contractuales (Alquileres, Honorarios)**
Estos asientos **YA EXISTEN** en V3 porque fueron generados al migrar el contrato.
1.  **Iterar** sobre `Account` Legacy.
2.  **Buscar** el asiento V3 correspondiente (Match por `contrato_id` + `dueDate`).
3.  **Vincular:** Actualizar el asiento V3 agregando el ID legacy en metadata.
    *   `metadata.legacy_account_id = Legacy_Account_ID`
    *   Esto nos permite buscarlo fácilmente después.

**Caso B: Asientos Ad-Hoc (Expensas, Servicios, Reparaciones)**
Estos asientos **NO EXISTEN** en V3.
1.  **Iterar** sobre `Account` Legacy.
2.  **Crear** el nuevo `AccountingEntry` en V3.
3.  **Preservar ID:** Forzar que el `_id` del nuevo documento sea **IGUAL** al `_id` de Legacy.
    *   `_id = Legacy_Account_ID`
    *   **Ventaja:** No hace falta tabla de mapeo. La referencia es directa.

#### Paso 2: Migración de Pagos (`AccountEntry`)
Gracias al Paso 1, la búsqueda del asiento destino se simplifica drásticamente.

1.  **Iterar** sobre `accountentries` Legacy.
2.  **Resolver Destino:**
    *   Intentar buscar por ID directo: `AccountingEntry.findById(legacyEntry.accountId)`.
        *   -> Si encuentra, es un asiento **Ad-Hoc** (Caso B).
    *   Si no encuentra, buscar por metadata: `AccountingEntry.findOne({ "metadata.legacy_account_id": legacyEntry.accountId })`.
        *   -> Si encuentra, es un asiento **Contractual** (Caso A).
3.  **Imputación:** Registrar el pago, actualizar saldos e historial.

> **Resultado:** Esta estrategia reduce errores de integridad y hace que la migración de pagos sea agnóstica al origen del asiento.

---

## SISTEMA DE ACTUALIZACIÓN POR ÍNDICES (LEGACY)

El sistema Legacy implementa un mecanismo de actualización automática de alquileres devengados mediante índices económicos (ICL, IPC, CASA PROPIA).

### Resumen Ejecutivo

El sistema:
1. **Genera un historial completo** de cuentas al crear el contrato
2. **Marca cuentas como actualizables** (`upgradeable: true`) para contratos con ICL o CASA PROPIA
3. **Aplica factores de ajuste** mediante operadores MongoDB cuando se publican nuevos valores de índices
4. **Actualiza balances** de `MasterAccount` y `Account` de forma masiva

---

### 1. Modelos de Índices

#### 1.1 ICL Model

```javascript
const iclSchema = new mongoose.Schema({
  date: { type: Date },
  value: { type: Number },
});
```

**Características:**
- Índice de Contratos de Locación
- Un registro por fecha
- Valor directo (ej: 1.0523)

---

#### 1.2 IPC Model

```javascript
const ipcSchema = new mongoose.Schema({
  date: { type: Date },
  month: { type: String },      // 'enero', 'febrero', etc.
  year: { type: Number },
  formula: { type: String },     // 'IPC'
  value: { type: Number },
});

ipcSchema.index({ month: 1, year: 1 }, { unique: true });
```

**Características:**
- Índice de Precios al Consumidor
- **DESFASE DE 1 MES:** El IPC de noviembre se publica en diciembre
- Índice único por mes/año
- Valor acumulado (ej: 352.3)

---

#### 1.3 Casa Propia Model

```javascript
const casaPropiaSchema = new mongoose.Schema({
  date: { type: Date },
  month: { type: String },
  year: { type: Number },
  formula: { type: String },     // 'CASAPROPIA'
  value: { type: Number },
});

casaPropiaSchema.index({ month: 1, year: 1 }, { unique: true });
```

**Características:**
- Coeficiente de Variación Salarial
- **Se aplica producto acumulado de últimos 6 meses**
- Valores tipo 1.003, 1.005 (coeficientes mensuales)

---

### 2. Estructura en LeaseAgreement

#### Campos Relacionados con Índices

```javascript
const leaseAgreementSchema = new mongoose.Schema({
  rentAmount: { type: Number, required: true },              // Monto base
  rentIncreaseType: { type: String, required: true },        // 'ICL', 'IPC', 'CASA PROPIA', 'NO REGULADO'
  rentIncreasePeriod: { type: Number },                      // Cada cuántos meses se ajusta
  rentIncreaseFixed: { type: Boolean },                      // ¿Ajuste fijo o compuesto?
  
  // Array de historial de actualizaciones
  iclArray: [{
    icl: { type: Number },                                   // Factor aplicado (ej: 1.034)
    casapropia: { type: Number },                            // Factor Casa Propia
    date: { type: Date },                                    // Fecha de aplicación
    status: { type: Boolean },                               // true = procesado
    stage: { type: Number },                                 // Segmento (1, 2, 3...)
  }],
});
```

#### El Array `iclArray`

**Este array registra TODAS las actualizaciones de índices aplicadas al contrato.**

Ejemplo de registro:

```javascript
{
  icl: 1.0762,              // Factor de ajuste aplicado (7.62%)
  casapropia: null,
  date: "2024-05-15",
  status: true,             // Ya fue procesado
  stage: 2                  // Segunda etapa de actualización
}
```

---

### 3. Estructura en MasterAccount

Al crear un contrato con índices, se marcan las cuentas como actualizables:

```javascript
const data = {
  // ... otros campos
  type: 'Alquiler Devengado',
  amount: this.rentAmount,
  increasePeriod: this.rentIncreasePeriod,
  
  // CLAVE: Marca las cuentas como actualizables
  upgradeable: this.rentIncreaseType === 'ICL' || this.rentIncreaseType === 'CASA PROPIA',
};
```

#### Campos para Actualización

```javascript
{
  type: 'Alquiler Devengado',
  amount: 500000,                   // Monto (se actualiza con índices)
  upgradeable: true,                // ¿Puede actualizarse?
  upgradeStage: 2,                  // Segmento de actualización
  upgradeStartDate: Date,           // Fecha inicio del contrato
  upgradeStageStartDate: Date,      // Fecha inicio de este segmento
}
```

**Segmentos (upgradeStage):**
- Segmento 1: Meses 1-4 (sin ajuste, monto base)
- Segmento 2: Meses 5-8 (primer ajuste)
- Segmento 3: Meses 9-12 (segundo ajuste)
- etc.

---

### 4. Flujo de Actualización

#### Paso 1: Consulta de Contratos Pendientes

Endpoint: `GET /api/v1/accounts/index/getNonUpdated?rentIncreaseType=IPC`

```javascript
const leases = await LeaseAgreement.aggregate([
  {
    $match: {
      rentIncreaseType: rentIncreaseType,
      $or: [
        { iclArray: { $eq: [] } },                      // Sin historial
        {
          iclArray: {
            $elemMatch: {
              date: { $lt: currentDate },                // Fecha vencida
            },
          },
        },
      ],
    },
  },
]);
```

---

#### Paso 2: Aplicación del Índice

Endpoint: `GET /api/v1/accounts/ipc/getMasterAccounts`

**Parámetros:**
- `leaseId`: ID del contrato
- `upgradeStage`: Número de segmento (2, 3, 4...)
- `updateIndex`: Porcentaje de ajuste (ej: "7.62%")
- `date`: Fecha de aplicación

**Proceso:**

```javascript
// 1. Validar que no esté actualizado
const result = await LeaseAgreement.findOne({
  _id: leaseId,
  'iclArray.stage': upgradeStage,
  'iclArray.status': true,              // Ya procesado
});

if (result !== null) {
  return { status: 'Actualizado', action: false };
}

// 2. Convertir porcentaje a factor
let updateNumber = parseFloat(updateIndex.replace('%', '')) / 100;
updateNumber = currency(updateNumber, { precision: 6 }).add(1).value;
// "7.62%" -> 0.0762 -> 1.0762

// 3. Registrar en iclArray
leaseAgreement.iclArray.push({
  stage: upgradeStage,
  icl: updateNumber,
  date: date,
  status: true,
});

await LeaseAgreement.findByIdAndUpdate(leaseId, { iclArray: leaseAgreement.iclArray });

// 4. Actualizar MasterAccounts del segmento
await MasterAccount.updateMany(
  { origin: leaseId, upgradeStage: upgradeStage },
  [
    {
      $set: {
        amount: { $multiply: ['$amount', updateNumber] },
        // amount = amount * 1.0762
      },
    },
  ]
);

// 5. Actualizar Accounts asociadas
const masterAccountsIds = await MasterAccount.find({
  origin: leaseId,
  upgradeStage: upgradeStage,
}).distinct('_id');

await Account.updateMany(
  { masterAccount: { $in: masterAccountsIds } },
  [
    {
      $set: {
        amount: {
          $round: [{ $multiply: ['$amount', updateNumber] }, 2],
        },
        totalBalance: {
          $round: [
            {
              $sum: [
                '$totalBalance',
                { $multiply: ['$amount', { $subtract: [updateNumber, 1] }] },
              ],
            },
            2,
          ],
        },
        // ... actualización de available y collected
      },
    },
  ]
);
```

**Lógica de actualización de `Account`:**

1. **amount:** Se multiplica por el factor
2. **totalBalance:** Se incrementa: `totalBalance + (amount * (factor - 1))`
3. **available:**
   - **DEBITO:** Igual a `totalBalance` actualizado
   - **CREDITO:** Solo si ya se cobró (`collected - amount + totalBalance > 0`)
4. **collected:** `amount - totalBalance` (para DEBITO)

---

### 5. Diferencias por Tipo de Índice

#### ICL (Índice de Contratos de Locación)

**Fórmula:** `ICL_actual / ICL_inicio`

```
ICL inicio contrato (15/01/2024): 1.0523
ICL inicio segmento 2 (15/05/2024): 1.0891
Factor = 1.0891 / 1.0523 = 1.035 (3.5% de ajuste)
```

#### IPC (Índice de Precios al Consumidor)

**Fórmula:** `IPC_mes_anterior_segmento / IPC_mes_anterior_inicio`

**IMPORTANTE: DESFASE DE 1 MES**

```
Contrato inicia: 15/01/2024
Segmento 2 inicia: 15/05/2024

IPC a usar para inicio: Diciembre 2023 (mes anterior)
IPC a usar para segmento 2: Abril 2024 (mes anterior)

IPC diciembre 2023: 352.3
IPC abril 2024: 379.1
Factor = 379.1 / 352.3 = 1.076 (7.6% de ajuste)
```

#### Casa Propia (Coeficiente de Variación Salarial)

**Fórmula:** `producto_acumulado_últimos_6_meses`

```
Segmento 2 inicia: 15/05/2024
Últimos 6 meses: Noviembre 2023 - Abril 2024

Valores Casa Propia:
Nov 2023: 1.003
Dic 2023: 1.005
Ene 2024: 1.004
Feb 2024: 1.006
Mar 2024: 1.003
Abr 2024: 1.005

Producto = 1.003 × 1.005 × 1.004 × 1.006 × 1.003 × 1.005 = 1.0267

Monto base: $500,000
Nuevo monto: $500,000 × 1.0267 = $513,350
```

---

### 6. Ejemplo Completo: Contrato con IPC

#### Datos del Contrato

```
Inicio: 15/01/2024
Duración: 24 meses
Monto base: $500,000
Ajuste: Cada 4 meses (trimestral)
Tipo: IPC
```

#### Segmentos Generados

| Segmento | Período | upgradeStage | Monto Inicial |
|----------|---------|--------------|---------------|
| 1 | Ene-Abr 2024 | 1 | $500,000 (base) |
| 2 | May-Ago 2024 | 2 | Por calcular |
| 3 | Sep-Dic 2024 | 3 | Por calcular |
| 4 | Ene-Abr 2025 | 4 | Por calcular |
| 5 | May-Ago 2025 | 5 | Por calcular |
| 6 | Sep-Dic 2025 | 6 | Por calcular |

#### Actualización Segmento 2 (Primera Actualización)

**Fecha de inicio:** 15/05/2024

**Cálculo IPC:**
```
IPC base (dic 2023): 352.3
IPC actual (abr 2024): 379.1
Factor = 379.1 / 352.3 = 1.0762
```

**Request:**
```http
GET /api/v1/accounts/ipc/getMasterAccounts
  ?leaseId=60290abbb2614a30d9d131
  &upgradeStage=2
  &updateIndex=7.62%
  &date=2024-05-15
```

**Resultado:**

1. **Registro en `iclArray`:**
```javascript
{
  stage: 2,
  icl: 1.0762,
  date: "2024-05-15",
  status: true,
}
```

2. **MasterAccounts actualizadas:**
```
Meses 5-8: amount = $500,000 × 1.0762 = $538,100
```

3. **Accounts actualizadas (mes 5):**
```javascript
// DEBITO (Locatario):
{
  amount: 538100,
  totalBalance: 538100,
  available: 538100,
}

// CREDITO (Locador - 92%):
{
  amount: 495052,        // 538100 × 0.92
  totalBalance: 495052,
  available: 0,          // Hasta que se cobre
}

// CREDITO (Inmobiliaria - 8%):
{
  amount: 43048,         // 538100 × 0.08
  totalBalance: 43048,
  available: 0,
}
```

#### Actualización Segmento 3 (Segunda Actualización)

**Fecha:** 15/09/2024

**Cálculo IPC:**
```
IPC base (dic 2023): 352.3          // MISMO QUE SEGMENTO 2
IPC actual (ago 2024): 411.5
Factor = 411.5 / 352.3 = 1.168
```

**IMPORTANTE:** El ajuste es siempre sobre el **monto base original** ($500,000), NO sobre el monto ya ajustado.

**Resultado:**
```
Meses 9-12: amount = $500,000 × 1.168 = $584,000
```

---

### 7. Ingreso de Valores de Índice

#### ICL - Web Scraping

```javascript
exports.scrapIcl = async (req, res, next) => {
  const table = await scrapeTable(2025);           // Scraping automático
  const latestRecord = await Icl.findOne().sort({ date: -1 });
  
  const filteredTable = table.filter(
    ({ date }) => new Date(date) > new Date(latestRecord.date)
  );
  
  await Icl.insertMany(filteredTable);
};
```

#### IPC - Descarga CSV Gubernamental

```javascript
exports.fetchAndStoreIPC = async (req, res, next) => {
  const url = 'https://infra.datos.gob.ar/catalog/sspm/dataset/145/.../indice-precios-al-consumidor...csv';
  const response = await axios.get(url, { responseType: 'text' });
  
  // Parsear CSV y crear operaciones bulk
  const bulkOperations = seriesData.map((datum) => {
    const [year, monthNumber] = datum[0].split('-');
    const month = meses[parseInt(monthNumber) - 1];
    const value = datum[1];
    
    return {
      updateOne: {
        filter: { month, year: parseInt(year) },
        update: { date, month, year, formula: 'IPC', value },
        upsert: true,
      },
    };
  });
  
  await IPC.bulkWrite(bulkOperations);
};
```

#### Manual - Endpoint de Creación

```javascript
exports.createManualIPC = async (req, res, next) => {
  const { month, year, value } = req.body;
  
  await IPC.findOneAndUpdate(
    { month: month.toLowerCase(), year: parseInt(year) },
    { date, month, year, formula: 'IPC', value },
    { upsert: true, new: true }
  );
};
```

---

### 8. Limitaciones del Sistema Legacy

| Limitación | Descripción | Impacto |
|------------|-------------|---------|
| **Actualización Manual** | Requiere intervención del administrador | Retraso en ajustes |
| **Lógica Distribuida** | Cálculos en frontend, aplicación en backend | Difícil de auditar |
| **Falta de Auditoría** | No guarda IPC base/actual utilizados | Imposible verificar cálculos históricos |
| **Complejidad MongoDB** | Operadores `$multiply`, `$cond` anidados | Difícil mantenimiento |
| **Sin Validación** | No verifica Debe = Haber | Riesgo de inconsistencias |
| **Sin Rollback** | No hay forma de revertir actualizaciones | Errores permanentes |

---

### 9. Recomendaciones para V3

#### Centralizar Lógica de Cálculo

Crear `IndicesService` con métodos específicos:

```typescript
class IndicesService {
  calculateIPCFactor(startDate: Date, segmentDate: Date): number {
    // Obtener IPC del mes anterior a startDate
    // Obtener IPC del mes anterior a segmentDate  
    // Retornar factor
  }
  
  calculateICLFactor(startDate: Date, segmentDate: Date): number {
    // Obtener ICL exacto de startDate
    // Obtener ICL más reciente antes de segmentDate
    // Retornar factor
  }
  
  calculateCasaPropiaFactor(segmentDate: Date): number {
    // Obtener últimos 6 meses de Casa Propia
    // Calcular producto acumulado
    // Retornar factor
  }
}
```

#### Automatización

```typescript
// Cron job diario
@Cron('0 2 * * *')  // 2 AM todos los días
async checkAndUpdateIndices() {
  // 1. Verificar si hay nuevos índices disponibles
  const newIndices = await this.indexValueService.getLatestIndices();
  
  // 2. Buscar contratos con segmentos pendientes de actualización
  const pendingContracts = await this.contractsService.findPendingIndexUpdates();
  
  // 3. Calcular y aplicar ajustes automáticamente
  for (const contract of pendingContracts) {
    await this.applyIndexAdjustment(contract);
  }
  
  // 4. Notificar a admin
  await this.notificationsService.send({
    type: 'INDEX_UPDATE_COMPLETE',
    contractsUpdated: pendingContracts.length,
  });
}
```

#### Auditoría Completa

Guardar en `historial_cambios` del `AccountingEntry`:

```typescript
{
  fecha: new Date(),
  usuario_id: userId,
  accion: 'AJUSTE_POR_INDICE',
  estado_anterior: 'PENDIENTE_AJUSTE',
  estado_nuevo: 'PENDIENTE',
  monto_anterior: 500000,
  monto_nuevo: 538100,
  observaciones: JSON.stringify({
    tipo_indice: 'IPC',
    indice_base: { fecha: '2023-12', valor: 352.3 },
    indice_actual: { fecha: '2024-04', valor: 379.1 },
    factor_aplicado: 1.0762,
    segmento: 2,
  }),
}
```

#### Validaciones

```typescript
async validateIndexAdjustment(accountingEntry: AccountingEntry, factor: number) {
  // 1. Verificar rango razonable del factor
  if (factor < 0.9 || factor > 1.5) {
    throw new BadRequestException(`Factor fuera de rango: ${factor}`);
  }
  
  // 2. Verificar balanceo post-actualización
  const newDebe = accountingEntry.partidas
    .filter(p => p.debe > 0)
    .reduce((sum, p) => sum + p.debe * factor, 0);
    
  const newHaber = accountingEntry.partidas
    .filter(p => p.haber > 0)
    .reduce((sum, p) => sum + p.haber * factor, 0);
  
  if (Math.abs(newDebe - newHaber) > 0.01) {
    throw new Error(`Desbalanceo detectado: Debe=${newDebe}, Haber=${newHaber}`);
  }
  
  // 3. Registrar en logs
  this.logger.log({
    action: 'INDEX_ADJUSTMENT_VALIDATED',
    accountingEntryId: accountingEntry._id,
    factor,
    newDebe,
    newHaber,
  });
}
```

#### Interfaz Mejorada

- **Dashboard de índices pendientes** con vista de contratos afectados
- **Previsualización de ajustes** antes de aplicar
- **Historial completo** de ajustes aplicados por contrato
- **Alertas automáticas** cuando hay nuevos índices disponibles

---

## MIGRACIÓN LEGACY → V3

### Estrategia General

**Principio:** Migrar **datos** del Legacy al nuevo formato V3, preservando la integridad contable.

---

### Mapeo de Entidades

| Legacy | V3 | Transformación |
|---|---|---|
| `MasterAccount` | Metadatos en `AccountingEntry` | El concepto de agrupación se preserva en metadata |
| `Account` (DEBITO/CREDITO) | `AccountingEntry` con partidas | Una Account → Una o más partidas en un asiento |
| `AccountEntry` (movimiento) | `historial_cambios` | Los movimientos se reconstruyen como cambios |
| `Receipt` (Legacy) | `Receipt` (V3) | Mapeo directo con nuevo formato `asientos_afectados` |
| `Transaction` (Legacy) | `Transaction` (V3) | Mapeo directo con mejoras |

---

### Proceso de Migración

**Fases:**

1. **Migración de Plan de Cuentas**
   - Crear cuentas estándar (CXC_ALQ, CXP_LOC, ING_HNR, etc.)
   - Definir tipos y jerarquías

2. **Migración de Asientos Contables**
   - **Por cada `Account` DEBITO del Legacy:**
     - Buscar `Account` CREDITO relacionadas (mismo `MasterAccount`)
     - Crear `AccountingEntry` con:
       - Partida DEBE: Monto de cuenta DEBITO
       - Partida(s) HABER: Montos de cuentas CREDITO relacionadas
     - Establecer `monto_pagado_acumulado` basándose en `totalBalance` de Legacy
     - Establecer `monto_liquidado` basándose en `collected` de Legacy

3. **Migración de Recibos**
   - **Por cada `Receipt` del Legacy:**
     - Mapear `ReceiptEntries` a `asientos_afectados`
     - Determinar `tipo_operacion` (COBRO/PAGO) basándose en el tipo de `Account`
     - Calcular `tipo_flujo_neto` basándose en los montos

4. **Migración de Transacciones**
   - **Por cada `Transaction` del Legacy:**
     - Vincular con `Receipt` V3 correspondiente
     - Preservar tipo (INGRESO/EGRESO)

5. **Validación Post-Migración**
   - Verificar balanceo: Σ(DEBE) = Σ(HABER) para cada asiento
   - Verificar saldos: Comparar saldos Legacy vs V3
   - Verificar estados: PENDIENTE vs PAGADO vs COBRADO

---

### Ejemplo de Migración

#### Legacy (Alquiler Enero 2024)

**MasterAccount:**
- `type`: "Alquiler"
- `source`: Locatario ID
- `target`: Locador ID

**Accounts:**
1. DEBITO Locatario:
   - `amount`: 1,000,000
   - `totalBalance`: 0 (ya cobrado)
   - `available`: 0

2. CREDITO Locador:
   - `amount`: 920,000
   - `totalBalance`: 920,000
   - `collected`: 920,000
   - `available`: 0 (ya liquidado)

3. CREDITO Inmobiliaria:
   - `amount`: 80,000
   - `totalBalance`: 80,000
   - `collected`: 80,000

#### V3 (Migrado)

**AccountingEntry:**
```typescript
{
  tipo_asiento: 'Alquiler',
  fecha_imputacion: '2024-01-01',
  fecha_vencimiento: '2024-01-10',
  descripcion: 'Alquiler Enero 2024',
  monto_original: 1000000,
  monto_actual: 1000000,
  estado: 'PAGADO',  // Porque está 100% cobrado Y liquidado
  partidas: [
    {
      cuenta_id: CXC_ALQ_id,
      debe: 1000000,
      haber: 0,
      agente_id: locatario_id,
      descripcion: 'Alquiler Enero 2024',
      monto_pagado_acumulado: 1000000,  // Migrado de totalBalance=0
    },
    {
      cuenta_id: CXP_LOC_id,
      debe: 0,
      haber: 920000,
      agente_id: locador_id,
      descripcion: 'Crédito Locador Enero 2024',
      monto_liquidado: 920000,  // Migrado de collected=920000
    },
    {
      cuenta_id: ING_HNR_id,
      debe: 0,
      haber: 80000,
      agente_id: inmobiliaria_id,
      descripcion: 'Honorarios Enero 2024',
      monto_liquidado: 80000,  // Migrado de collected=80000
    }
  ]
}
```

---

## CONCLUSIÓN

El sistema V3 representa una evolución significativa sobre el Legacy:

**Ventajas Clave:**
1. **Contabilidad por Partida Doble Real:** Validación automática de balanceo
2. **Plan de Cuentas Configurable:** No hardcoded, adaptable a diferentes reglas
3. **Transparencia:** Todo movimiento registrado en `historial_cambios`
4. **Flexibilidad:** Liquidación adelantada, compensación automática, recibos mixtos
5. **Arquitectura Moderna:** Factory + Builder, servicios centralizados
6. **Auditoría Completa:** Rastreo de quién, cuándo, qué y por qué

**Complejidad Reducida:**
- No más cascading updates en hooks de Mongoose
- No más cálculos de `available` distribuidos
- Lógica centralizada en servicios bien definidos

**Escalabilidad:**
- Preparado para multi-tenant
- Facturación electrónica integrada
- Conciliación bancaria automática
- Reportes financieros avanzados

---

**Documento actualizado:** 2025-12-16
**Versión:** 3.0
**Autor:** AI Agent - Revisión Exhaustiva del Circuito Contable
