# Procedimiento Final de Migración Contable (V3)

**Autor:** Equipo de Migración Propietas
**Fecha:** Diciembre 2025
**Estado:** ✅ COMPLETADO y VERIFICADO

Este documento detalla el procedimiento técnico definitivo ejecutado para trasladar la contabilidad del sistema Legacy a V3, incluyendo la estrategia de corrección global de discrepancias.

## 1. Estrategia General: Híbrida

La migración contable se basó en dos pilares para garantizar la trazabilidad:
1.  **Asientos Contractuales (Alquileres):** Generación "Full History" en V3 basada en reglas de contrato, y posterior **vinculación** con deudas Legacy.
2.  **Asientos Ad-Hoc (Expensas/Servicios/Varios):** Migración directa preservando `_id` original de Legacy.
3.  **Pagos y Recibos:** Migración determinística basada en los vínculos establecidos en los pasos anteriores.

---

## 2. Secuencia de Scripts (Paso a Paso)

La ejecución debe seguir estrictamente este orden para mantener la integridad referencial.

### Fase 4.5: Asientos No Contractuales
*   **Script:** `03-migrate-adhoc-entries.ts`
*   **Función:** Migra deudas aisladas (Expensas, arreglos, etc.) desde `Legacy.Accounts`.
*   **Clave:** Preserva el `_id` de Mongo original.
*   **Resultado:** Crea `AccountingEntry` en V3 con `metadata.legacy_id`.

### Fase 4.6: Vinculación Contractual (CRÍTICO)
*   **Script:** `04-link-contractual-entries.ts`
*   **Función:** Conecta las deudas de alquiler/honorarios Legacy con los asientos teóricos generados por V3.
*   **Mejoras de "Corrección Global":**
    *   **Filtro Débito:** Solo procesa cuentas de deuda real, ignorando cuentas espejo (Crédito) para evitar duplicación de pagos futura.
    *   **Validación de Roles:** Verifica si la cuenta Legacy pertenece al `Locatario` o `Locador` del contrato V3 para asignarla al asiento de Honorarios correcto (evita cruces).
*   **Resultado:** Actualiza `AccountingEntry` V3 agregando `metadata.legacy_account_ids` (Array).

### Fase 5A: Recibos Físicos
*   **Script:** `01-migrate-receipts.ts`
*   **Función:** Copia la colección `receipts` Legacy a V3.
*   **Clave:** Preserva `_id`. Campos de detalle se dejan vacíos inicialmente.

### Fase 5B: Migración de Pagos
*   **Script:** `05-migrate-payments.ts`
*   **Función:** Transforma `Legacy.AccountEntry` (movimientos de caja) en `V3.Transaction` y actualiza saldos.
*   **Lógica:**
    *   Busca el asiento destino usando el mapa de vínculos generado en Fase 4.6 (Contractuales) o por ID directo (Ad-Hoc).
    *   Genera una `Transaction` por cada pago real.
    *   Acumula el monto en `monto_pagado_acumulado` del asiento.
*   **Resultado:** Asientos pasan de `PENDIENTE` a `PAGADO` o `PARCIAL`.

### Fase 5C: Impacto en Recibos
*   **Script:** `07-link-receipts-impact.ts`
*   **Función:** Cierra el circuito conectando los Recibos (5A) con los Asientos y Transacciones (5B).
*   **Resultado:** Llena el array `asientos_afectados` en el Recibo V3 para visualización en frontend.

---

## 3. Corrección Global de Discrepancias (Fase 6)

Durante la validación se detectaron errores de duplicidad (pagos x2) y asignación cruzada. Se implementó un protocolo de saneamiento:

### Script de Limpieza: `08-reset-links-payments.ts`
Este script permite "rebobinar" la migración contable sin perder los contratos ni maestros:
1.  Elimina todas las transacciones con `referencia_externa` tipo LEGACY.
2.  Limpia los arrays `legacy_account_ids` de todos los asientos.
3.  Resetea `monto_pagado_acumulado` a 0.
4.  Restaura estado `PENDIENTE`.

**Procedimiento de Corrección:**
1.  Ejecutar `08-reset-links-payments.ts`.
2.  Ejecutar `04-link-contractual-entries.ts` (versión parcheada con filtros de rol).
3.  Ejecutar `05-migrate-payments.ts`.
4.  Ejecutar `07-link-receipts-impact.ts`.

---

## 4. Verificación Final

Utilizar **`06-verify-accounting-migration.ts`** para auditar el estado.

**Métricas de Éxito (Diciembre 2025):**
*   **Contratos Procesados:** 863
*   **Asientos V3 Totales:** ~47,800
*   **Asientos Vinculados:** ~96%
*   **Transacciones Generadas:** ~37,200 (coherente con Recibos únicos).
*   **Discrepancias Conocidas:** 0 (Resueltas).

---
**Nota:** Cualquier re-ejecución futura debe comenzar obligatoriamente con el script `08` para garantizar un estado limpio antes de re-importar datos.
