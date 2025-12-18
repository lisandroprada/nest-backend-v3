# Tabla de Equivalencias: Legacy vs V3 (Estrategia Pre-Migración)

Esta tabla define cómo se transformará cada concepto legacy.
**Cambio Clave:** Los conceptos Ad-Hoc se migran en una fase dedicada (Fase 4.5) ANTES de procesar los recibos.

## 1. Conceptos Contractuales (Vinculación)
Existen en V3 gracias a la Fase 4 (Generación Automática Contractual).

| Legacy Account | V3 `tipo_asiento` | Estrategia de Búsqueda |
|---|---|---|
| `Alquiler Devengado` | `Alquiler Mensual` | `contrato_id` + **Match Determinístico** (Período `metadata.periodo`). |
| `Honorarios` | `Honorarios Locatario`/`Locador` | `contrato_id` + **Match Determinístico** (Período o Cuota). |
| `Deposito en Garantía` | `Deposito en Garantia - Cobro` | `contrato_id` + Match único o por fecha. |
| `Devolucion Deposito` | `Deposito en Garantia - Devolucion` | `contrato_id` + Match único. |

## 2. Conceptos Ad-Hoc (Pre-Migración Fase 4.5)
Estos asientos **NO** existen por contrato. Deben migrarse desde `AccountEntry` legacy a `AccountingEntry` V3 **antes** de la migración de recibos.

| Legacy Account | V3 `tipo_asiento` | Cuenta Contable V3 | Acción Fase 4.5 |
|---|---|---|---|
| `Factura de Servicios` | `Pago de Servicios` | `CXC_SERVICIOS` | Crear `AccountingEntry` (Estado: PENDIENTE). |
| `Expensas` | `Pago de Expensas` | `CXC_SERVICIOS` | Crear `AccountingEntry` (Estado: PENDIENTE). |
| `Cargo proveedor` | `Gasto Proveedor` | `CXP_SERVICIOS` | Crear `AccountingEntry` (Estado: PENDIENTE). |
| `Interés` | `Interes por Mora` | `ING_INT_MORA` | Crear `AccountingEntry` (Estado: PENDIENTE). |
| `Bonificación` | `Nota de Credito` | `EGR_AJU` | Crear `AccountingEntry` (Estado: PENDIENTE). |

## 3. Estrategia de Vinculación (Fase 5B)
Al procesar los recibos, ya **TODOS** los asientos (Contractuales y Ad-Hoc) existirán en V3.

1. **Receipt Entry Legacy:** Obtener `masterAccount` (ID del asiento legacy).
2. **Búsqueda V3:**
   - Si es Ad-Hoc: Buscar `AccountingEntry` V3 que tenga `metadata.legacy_id == slave_id`.
   - Si es Contractual: Buscar por Lógica Determinística (Período).
3. **Imputación:** Registrar el pago en el asiento encontrado.