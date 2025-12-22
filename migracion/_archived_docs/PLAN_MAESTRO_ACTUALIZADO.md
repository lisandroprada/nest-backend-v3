# Plan Maestro de Migración - Sistema Propietas (V3.3 Final)

**Estado:** RE-DISEÑO INTEGRAL (Fase 4.5 + 5 Determinística)
**Última Actualización:** 15 Diciembre 2025

Este documento define la estrategia final validada. Se introduce la **Fase 4.5** para migrar asientos no contractuales ANTES de los pagos.

## 🗺️ Mapa de Fases Corregido

| Fase | Descripción | Estado |
|---|---|---|
| **1-4** | Estructura Base (Agentes, Propiedades, Contratos, Asientos Contractuales) | ✅ COMPLETADO |
| **4.5** | **Migración de Asientos Ad-Hoc** (Servicios, Expensas, etc.) | ✅ COMPLETADO |
| **5A** | Migración de Recibos (Legacy Data) | ✅ COMPLETADO |
| **5B** | Vinculación Determinística de Pagos | ✅ COMPLETADO |
| **5C** | Vinculación de Recibos e Impacto Contable | ✅ COMPLETADO |
| **6** | **Corrección Global y Verificación Final** | ✅ COMPLETADO |

## 🚀 Estrategia de Ejecución

### Fase 4.5: Migración de Asientos Ad-Hoc
**Objetivo:** Crear los `AccountingEntry` V3 para movimientos que NO vienen de contratos.
- **Fuente:** `Legacy.AccountEntry` (filtrado por tipos: Servicios, Expensas, Intereses, etc.).
- **Destino:** `V3.AccountingEntry`.
- **Clave:** Guardar el `_id` legacy en `metadata.legacy_id` para vinculación posterior.
- **Estado Inicial:** `PENDIENTE`.

### Fase 5A: Importación de Recibos
- Resetear y re-importar Recibos Legacy con `_legacy_data`.

### Fase 5B: Vinculación Determinística
**Objetivo:** Vincular Recibos con Asientos (que ahora YA EXISTEN TODOS).
1. **Ad-Hoc:** Vincular por `receiptEntry.masterAccount` == `AccountingEntry.metadata.legacy_id`.
2. **Contractuales:** Vincular por `contrato_id` + `Período` (Regex sobre description).

## 📚 Documentación de Referencia
- **[MAPPING_TABLE.md](./MAPPING_TABLE.md)**: Definición de estrategia por tipo de cuenta.
- **[PROCEDIMIENTO FINAL (Paso a Paso)](./documentacion/procedimiento-migracion-contable-final.md)**: ⭐️ Guía técnica detallada con scripts y correcciones.
- **[task.md](./task.md)**: Checklist operativo histórico.
