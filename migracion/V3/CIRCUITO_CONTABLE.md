# Circuito Contable y de Cobranzas - Propietas V3

Este documento explica en detalle el funcionamiento del motor contable de Propietas V3, cubriendo desde la generación automática de asientos hasta su cobro y liquidación.

## 1. Conceptos Fundamentales

El sistema sigue un modelo de **Contabilidad de Partida Doble**, donde cada movimiento económico se registra como un `AccountingEntry` equilibrado (Debe = Haber).

### Entidades Clave

*   **AccountingEntry (Asiento Contable):** Representa una obligación o derecho (Devengamiento). Es la "factura" interna del sistema.
    *   *Ejemplo:* "Alquiler Enero 2025" (El inquilino debe pagar, el propietario tiene derecho a cobrar).
*   **Receipt (Recibo):** Representa el movimiento de dinero (Caja). Documenta el cumplimiento de la obligación.
    *   *Ejemplo:* "Recibo X por pago de Alquiler Enero".
*   **Transaction (Transacción Financiera):** Representa el impacto en una cuenta financiera real (Caja chica, Banco).
    *   *Ejemplo:* "Ingreso de $500.000 a Caja Efectivo".
*   **ChartOfAccount (Plan de Cuentas):** Catálogo de conceptos contables.

---

## 2. Flujo de Generación (Devengamiento)

En V3, los asientos contables CONTRACTUALES se generan **por adelantado para toda la duración del contrato** al momento de activarlo. Esto se conoce como estrategia "Full History".

**Disparador:** Activación del Contrato (Status `PENDIENTE` -> `VIGENTE`) en `ContractsService`.

### Tipos de Asientos Generados

#### A. Alquiler Mensual
Se genera un asiento por cada mes de contrato.
*   **Cuenta DEBE:** `CXC_ALQ` (Cuentas por Cobrar - Alquileres). Cargo al Locatario.
*   **Cuenta HABER:**
    *   `CXP_LOC` (Cuentas por Pagar - Locadores). Monto neto para el propietario.
    *   `ING_HNR` (Ingresos por Honorarios). Comisión de la inmobiliaria.
*   **Estado Inicial:** `PENDIENTE` (o `PENDIENTE_AJUSTE` si es variable).

#### B. Depósito en Garantía
Se generan dos asientos:
1.  **Cobro:** Cargo al Locatario (`CXC_ALQ` o similar) vs Pasivo Depósito (`PAS_DEP`). (Nota: En código actual usa `ACT_FID` vs `PAS_DEP` al cobro).
2.  **Devolución:** Pasivo Depósito (`PAS_DEP`) vs Caja (`ACT_FID`) al final del contrato.

#### C. Honorarios (Locador/Locatario)
Se generan asientos de cuotas para el cobro de honorarios iniciales.

### Plan de Cuentas Invocado (Automático)
El sistema busca cuentas específicas por código (`ChartOfAccountsService`):
| Código | Nombre (Ejemplo) | Uso |
|---|---|---|
| `CXC_ALQ` | Deudores por Alquileres | Lo que debe el Inquilino |
| `CXP_LOC` | Acreedores Locadores | Lo que se le debe al Propietario |
| `ING_HNR` | Honorarios Administración | Ganancia mensual de la Inmobiliaria |
| `ING_HNR_INIC` | Honorarios Contratos | Ganancia por firma de contrato |
| `PAS_DEP` | Depósitos en Garantía | Pasivo (dinero de terceros en custodia) |
| `ACT_FID` | Caja Fiduciaria | Cuenta puente de manejo de fondos |

### Arquitectura de Generación (Factory Pattern)

La lógica de creación de asientos está **centralizada** en el módulo `accounting-entries` siguiendo el patrón Factory:

```
src/modules/accounting-entries/
├── builders/
│   └── accounting-entry.builder.ts    ← Construcción y validación
├── factories/
│   └── accounting-entry.factory.ts    ← Lógica de negocio contable
└── dto/
    └── create-accounting-entry.dto.ts ← Contratos de datos
```

#### AccountingEntryBuilder
**Responsabilidad:** Construcción fluida y validación técnica.
- ✅ Validación de balanceo (Debe = Haber)
- ✅ Construcción de partidas con valores por defecto
- ✅ Validación de campos requeridos

**Ejemplo:**
```typescript
builder
  .setType('Alquiler')
  .setDates(imputacion, vencimiento)
  .addDebit(cuentaId, monto, agenteId)
  .addCredit(cuentaId, monto, agenteId)
  .build(); // ← Valida y retorna DTO
```

#### AccountingEntryFactory
**Responsabilidad:** Lógica de negocio y conocimiento del Plan de Cuentas.
- ✅ `createMonthlyRentEntry()` - Alquileres mensuales
- ✅ `createDepositEntry()` - Depósitos (cobro/devolución)
- ✅ `createHonorariosEntry()` - Honorarios iniciales
- ✅ Caché de cuentas contables para optimización
- ✅ Cálculos de comisiones y distribución

**Ventajas:**
1. **Reutilizable:** Cualquier módulo puede crear asientos (Contratos, Ajustes, Gastos)
2. **Testeable:** Lógica contable aislada y fácil de probar
3. **Mantenible:** Cambios en reglas contables solo afectan el Factory
4. **Consistente:** Todas las descripciones y cálculos siguen el mismo patrón

**Flujo de Generación:**
```
ContractsService (activación)
    ↓
AccountingEntryFactory.createMonthlyRentEntry()
    ↓
AccountingEntryBuilder.build() (validación)
    ↓
AccountingEntriesService.create() (persistencia)
```

---

## 3. Circuito de Cobro (Locatario -> Inmobiliaria)

El proceso de cobro cancela la deuda del inquilino y registra el ingreso de dinero.

**Actor:** Usuario (Administrador/Cajero).
**Servicio:** `ReceiptsService.createReceipt`.
**Tipo:** `COBRO` (Ingreso).

### Paso a Paso
1.  **Selección:** El usuario selecciona un `AccountingEntry` pendiente (ej. Alquiler Enero).
2.  **Generación de Recibo:** Se crea un `Receipt` que agrupa los asientos pagados.
3.  **Registro de Transacción:** Se crea una `Transaction` de tipo `INGRESO` en la Caja/Banco seleccionada (`cuenta_financiera_id`).
4.  **Imputación:** El sistema invoca `AccountingEntriesService.registerPayment`.
    *   Busca las partidas del **DEBE** (Cargo al Locatario).
    *   Incrementa `monto_pagado_acumulado` en esas partidas.
    *   Si `monto_pagado_acumulado >= debe`, el asiento pasa a estado `PAGADO` (o `COBRADO` si aún falta liquidar la contraparte).

**Resultado:**
*   Dinero en Caja Inmobiliaria.
*   Deuda del Inquilino saldada.
*   Obligación con el Propietario (`CXP_LOC`) lista para liquidar.

---

## 4. Circuito de Liquidación (Inmobiliaria -> Propietario)

El proceso de liquidación transfiere el dinero cobrado (menos comisiones) al propietario.

**Actor:** Usuario.
**Servicio:** `ReceiptsService.createReceipt`.
**Tipo:** `PAGO` (Egreso).

### Paso a Paso
1.  **Selección:** El usuario ve "Saldos Disponibles" (Asientos cobrados pero no liquidados).
    *   Esto se calcula filtrando partidas `HABER` (`CXP_LOC`) donde el `DEBE` asociado ya fue cobrado.
2.  **Generación de Liquidación:** Se crea un `Receipt`.
3.  **Registro de Transacción:** Se crea una `Transaction` de tipo `EGRESO` desde la Caja/Banco.
4.  **Imputación:** El sistema invoca `AccountingEntriesService.liquidarAPropietario`.
    *   Busca las partidas del **HABER** (A favor del Locador).
    *   Incrementa `monto_liquidado` en esas partidas.
    *   Si se cubre el total, el asiento se marca como totalmente procesado (`LIQUIDADO` conceptualmente, aunque el estado principal `PAGADO` suele indicar ciclo cerrado).

---

## 5. Auditoría y Trazabilidad (`historial_cambios`)

El campo `historial_cambios` es fundamental para la integridad del sistema. Funciona como un "Ledger" inmutable dentro del documento que registra cada evento crítico en la vida del asiento.

**No es opcional.** Cada vez que el estado o el monto del asiento cambian, se DEBE agregar una entrada aquí.

### Estructura del Registro
```typescript
{
  fecha: Date,              // Cúando ocurrió
  usuario_id: ObjectId,     // Quién lo hizo
  accion: string,           // Qué hizo (CREACION, PAGO, AJUSTE, LIQUIDACION, ANULACION)
  estado_anterior: string,  // Cómo estaba antes
  estado_nuevo: string,     // Cómo quedó después
  monto: number,            // Monto involucrado en la operación
  observaciones: string     // Detalles adicionales (ej. "Ajuste por índice 10%")
}
```

### Casos de Uso
1.  **Ajustes por Inflación:** Cuando un asiento `PENDIENTE_AJUSTE` actualiza su valor, se guarda el valor anterior y el nuevo.
2.  **Pagos Parciales:** Permite reconstruir la historia de pagos si hubo múltiples entregas.
3.  **Anulaciones:** Si se anula un asiento por error operativo, queda registrado quién y por qué lo hizo.

---

## Resumen de Estados del Asiento

1.  **PENDIENTE:** Recién creado (inicio de mes/contrato). Nadie pagó nada.
2.  **PAGADO / COBRADO:** El Inquilino pagó. El dinero está en la Inmobiliaria.
3.  **LIQUIDADO:** (Implícito en partidas) La Inmobiliaria pagó al Propietario.

## Ejemplo Práctico: Alquiler de $100.000 (10% Comisión)

#### 1. Generación (Inicio Contrato)
Se crea asiento `AccountingEntry`:
*   `DEBE` [CXC_ALQ] (Inquilino): $100.000
    *   *Significado:* Inquilino debe 100k.
*   `HABER` [CXP_LOC] (Propietario): $90.000
    *   *Significado:* Debemos pagar 90k al prop.
*   `HABER` [ING_HNR] (Inmobiliaria): $10.000
    *   *Significado:* Ganancia de 10k.

#### 2. Cobro (Día 5)
Inquilino paga $100.000 en efectivo.
*   Se crea `Receipt` #001.
*   Se crea `Transaction`: +$100.000 en "Caja Efectivo".
*   Actualización Asiento:
    *   Partida [CXC_ALQ]: `monto_pagado_acumulado` += 100.000.
    *   Estado: `PAGADO`.
    *   **Historial:** Se agrega evento `PAGO`.

#### 3. Liquidación (Día 10)
Pagamos al propietario sus $90.000.
*   Se crea `Receipt` #002 (Egreso).
*   Se crea `Transaction`: -$90.000 en "Caja Efectivo".
*   Actualización Asiento:
    *   Partida [CXP_LOC]: `monto_liquidado` += 90.000.
    *   **Historial:** Se agrega evento `LIQUIDACION` (o similar).

**Saldo Final:**
*   Caja: +$10.000 (Nuestra comisión, correcto).
*   Deuda Inquilino: $0.
*   Deuda con Propietario: $0.
