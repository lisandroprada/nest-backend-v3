# 💰 Lógica de Pagos y Liquidación (Surgical Patch)

Este documento detalla la lógica contable y técnica implementada tras la migración quirúrgica del Contrato 6902, diseñada para garantizar la paridad de saldos entre Legacy y V3, y asegurar que el estado de los asientos refleje la realidad financiera del agente.

---

## 🏗️ Lógica de Estados (Accounting Entry)

El estado del asiento (`estado`) se determina de forma dinámica comparando el cumplimiento de las obligaciones en ambas columnas (Debe y Haber).

| Estado | Significado | Condición Técnica |
| :--- | :--- | :--- |
| **LIQUIDADO** | Ciclo completo cerrado | `totalDebe` cobrado **Y** `totalHaberAgentes` liquidado. |
| **COBRADO** | El inquilino pagó, dinero en caja | `totalDebe` cobrado **PERO** falta liquidar a dueños/proveedores. |
| **PAGADO_PARCIAL** | Cobranza en curso | `monto_pagado_acumulado > 0` pero < `totalDebe`. |
| **PENDIENTE** | Sin movimientos | `monto_pagado_acumulado == 0` y `monto_liquidado == 0`. |

> [!IMPORTANT]
> Un asiento de alquiler solo pasa a **LIQUIDADO** cuando el locatario pagó el 100% Y el locador recibió su 100% (neto de comisión).

---

## 📊 Campos de Partida (Data Strategy)

Para evitar colisiones de liquidación, se utilizan campos diferenciados según el sentido de la partida:

1. **`monto_pagado_acumulado` (Óptica del DEBE)**:
   - Se usa en las partidas donde el agente es deudor (ej. Inquilino pagando alquiler).
   - Registra cuánto ha pagado el agente hacia la inmobiliaria.
2. **`monto_liquidado` (Óptica del HABER)**:
   - Se usa en las partidas donde el agente es acreedor (ej. Dueño recibiendo su renta).
   - Registra cuánto ha entregado la inmobiliaria al agente.

---

## 🔄 Proceso de Vinculación de Recibos (Fase 5C)

Para que la UI de V3 muestre correctamente el detalle de los pagos, los recibos deben estar vinculados bidireccionalmente:

1. **Recibo → Asiento**: El objeto `asientos_afectados` en la colección `receipts` debe contener el `asiento_id` y el `monto_imputado`.
2. **Asiento → Recibo**: El array `historial_cambios` del `AccountingEntry` debe registrar la referencia al recibo, la fecha y el monto.

---

## 🛡️ Principios de Liquidación Segura (UX)

Se han implementado salvaguardas en el frontend (`FinanceTab.tsx`) para evitar errores humanos en la rendición de fondos:

1. **Sugerencia de Monto Seguro**: Por defecto, el sistema sugiere liquidar solo lo que ya entró en caja (`monto_recaudado_disponible`).
2. **Visibilidad de Acciones**: Los botones de "Solo cobrado" y "Adelantar" aparecen siempre que el deudor tenga saldo pendiente (`tiene_cobro_pendiente`).
3. **Cálculo de Remanente Real**: El botón "Solo cobrado" propone: `(Total Cobrado - Ya Liquidado)`. Esto garantiza que no se propongan liquidaciones duplicadas.

---

## 📜 Pasos para Replicar (Checklist Técnico)

Si se debe realizar una corrección quirúrgica en otro contrato:

1. **Reset de Estado**: Limpiar `monto_pagado_acumulado`, `monto_liquidado` y `estado` del asiento en V3.
2. **Migración de Gastos Ad-hoc**: Asegurar que gastos de servicios (Camuzzi, luz) tengan el `agente_id` del dueño en el DEBE si el dueño debe reintegrarlos, o en el HABER si se le cargan.
3. **Imputación Directa**: Correr el script de pagos (`05-migrate-payments.ts`) asegurando que:
   - Partidas de DEBE incrementen `monto_pagado_acumulado`.
   - Partidas de HABER incrementen `monto_liquidado`.
4. **Relink de Recibos**: Ejecutar `07-link-receipts-impact.ts` para que la UI muestre los "Vínculos" (asientos afectados).
