# Changelog - Sistema de Contratos

## Guía de Uso

Este archivo registra **todos los cambios notables** en el sistema de contratos y su documentación.

### Formato

Cada entrada debe incluir:

- **Fecha** en formato YYYY-MM-DD
- **Tipo de cambio**: [API] [SCHEMA] [DOC] [FIX] [BREAKING]
- **Descripción breve**
- **Archivos afectados**

---

## [2025-12-04] - Renombramiento y Ordenamiento de Archivos

### [DOC] Reorganización de nombres de archivos

- **Renombrados:** 8 archivos con numeración secuencial y títulos consistentes
- **Objetivo:** Facilitar navegación y mantener orden lógico

**Archivos renombrados:**

| Nombre Anterior | Nombre Nuevo |
|----------------|--------------|
| `01_INDEX.md` | `01_INDICE_GENERAL.md` |
| `05_SISTEMA_CONTABLE_ESTADO_ACTUAL.md` | `02_ESTADO_ACTUAL_MIGRACION.md` |
| `CONTRACTS_COLLECTION.md` | `03_SCHEMA_CONTRATOS.md` |
| `06_ACCOUNTING_ENTRIES_API.md` | `04_API_ASIENTOS_CONTABLES.md` |
| `07_CALCULATE_INITIAL_PAYMENTS_API.md` | `05_API_VISTA_PREVIA_PAGOS.md` |
| `CONTRACT_SETTINGS_API.md` | `06_API_CONFIGURACION.md` |
| `08_RESCISION_CONTRATO.md` | `07_API_RESCISION.md` |
| `CONTRACTS_DASHBOARD.md` | `08_DASHBOARD_CONTRATOS.md` |

**Estructura final (10 archivos):**

1. `01_INDICE_GENERAL.md` - Índice completo
2. `02_ESTADO_ACTUAL_MIGRACION.md` - Estado y migración pendiente ⭐
3. `03_SCHEMA_CONTRATOS.md` - Schema de MongoDB
4. `04_API_ASIENTOS_CONTABLES.md` - API de asientos
5. `05_API_VISTA_PREVIA_PAGOS.md` - API de vista previa
6. `06_API_CONFIGURACION.md` - API de configuración
7. `07_API_RESCISION.md` - API de rescisión
8. `08_DASHBOARD_CONTRATOS.md` - Dashboard
9. `CHANGELOG.md` - Este archivo
10. `README.md` - Introducción

---

## [2025-12-04] - Depuración y Consolidación de Documentación de Migración

### [DOC] Consolidación final de documentación

- **Reducido:** 15 → 10 documentos (33% menos)
- **Actualizado:** SISTEMA_CONTABLE_ESTADO_ACTUAL.md con información crítica de migración
- **Eliminados:** Documentos redundantes y obsoletos
- **Consolidado:** Información de migración en documentos existentes

**Documentos eliminados:**

- 02_RESUMEN_EJECUTIVO.md (información consolidada en SISTEMA_CONTABLE_ESTADO_ACTUAL.md)
- 03_ARQUITECTURA_COMPLETA.md (información en CONTRACTS_COLLECTION.md)
- 04_AGENT_ACCOUNT_STATEMENT_API.md (consolidado en ACCOUNTING_ENTRIES_API.md)
- PROGRESS_DASHBOARD.md (obsoleto)
- FIX_LIQUIDACION_DOUBLE_ACCOUNTING.md (fix específico ya aplicado)

**Archivos actualizados:**

- SISTEMA_CONTABLE_ESTADO_ACTUAL.md:
  - Agregada sección "MIGRACIÓN PENDIENTE - CRÍTICO"
  - Documentadas diferencias críticas con sistema legacy
  - Plan de acción inmediato para completar migración
  - Información sobre honorarios v1.1 (BREAKING CHANGE)
  - Referencias a documentación legacy

**Archivos mantenidos (10):**

1. 01_INDEX.md
2. README.md
3. 05_SISTEMA_CONTABLE_ESTADO_ACTUAL.md (actualizado)
4. 06_ACCOUNTING_ENTRIES_API.md
5. 07_CALCULATE_INITIAL_PAYMENTS_API.md
6. 08_RESCISION_CONTRATO.md
7. CHANGELOG.md
8. CONTRACTS_COLLECTION.md
9. CONTRACTS_DASHBOARD.md
10. CONTRACT_SETTINGS_API.md

**Estado de migración documentado:**

- ✅ Contratos migrados: 838/852 (98.4%)
- ⚠️ Asientos generados: 3,556 (parcial, estrategia OPENING_BALANCE)
- ❌ Asientos históricos pendientes: ~19,500 (estrategia FULL_HISTORY no implementada)
- ❌ Validación y reconciliación: Pendiente

**Próximos pasos críticos:**

1. Implementar estrategia FULL_HISTORY (2-3 días estimados)
2. Generar ~19,500 asientos históricos faltantes
3. Validar y reconciliar con sistema legacy
4. Integrar con frontend

---

## [2025-10-15] - Consolidación de Documentación

### [DOC] Reducción masiva de documentos

- **Reducido:** 31 → 12 documentos (61% menos)
- **Eliminados:** Archivos redundantes sobre fases, implementations, resúmenes
- **Consolidado:** Información en documentos principales de API
- **Reescrito:** INDEX.md completamente simplificado

**Documentos eliminados:**

- README_FASE_2.md, IMPLEMENTATION_FASE_2.md
- README_FASE_3.md, IMPLEMENTATION_FASE_3.md, PLAN_FASE_3.md, FASE_3_RESUMEN_FINAL.md
- CONTRACT_SETTINGS_IMPLEMENTATION.md, CONTRACT_SETTINGS_FRONTEND_EXAMPLES.md
- CONTRACT_SETTINGS_RESCISION_UPDATE.md, CONTRACT_SETTINGS_RESUMEN.md
- RESCISION_ANTICIPADA_FRONTEND.md, RESCISION_ANTICIPADA_RESUMEN.md
- RESCISION_IMPLEMENTACION_COMPLETA.md
- HONORARIOS_CALCULATION_CHANGE.md, HONORARIOS_IMPLEMENTATION_SUMMARY.md
- CALCULATE_INITIAL_PAYMENTS_IMPLEMENTATION.md
- FRONTEND_INTEGRATION_GUIDE.md, CONTRACTS_DASHBOARD_IMPLEMENTATION.md
- 04-lease-agreement-creation-flow.md, asientos.md

**Archivos mantenidos (12):**

1. INDEX.md
2. README.md
3. RESUMEN_EJECUTIVO.md
4. SISTEMA_CONTABLE_ESTADO_ACTUAL.md
5. PROGRESS_DASHBOARD.md
6. CONTRACTS_DASHBOARD.md
7. ARQUITECTURA_COMPLETA.md
8. CONTRACTS_COLLECTION.md
9. ACCOUNTING_ENTRIES_API.md
10. CONTRACT_SETTINGS_API.md
11. CALCULATE_INITIAL_PAYMENTS_API.md
12. RESCISION_CONTRATO.md

---

## [2025-10-15] - Cambio en Cálculo de Honorarios (v1.1)

### [BREAKING] Honorarios calculados sobre monto total del contrato

- **Cambio:** Honorarios de locador/locatario ahora se calculan como % del **monto total del contrato** (duración × monto base), no del monto mensual
- **Impacto:** Valores ~36x mayores para contratos de 36 meses
- **Versión:** 1.1

**Ejemplo:**

- Contrato: 36 meses × $100,000/mes = $3,600,000 total
- Honorarios locador 2%:
  - Antes: $100,000 × 2% = $2,000
  - Ahora: $3,600,000 × 2% = $72,000

**Archivos modificados:**

- `src/modules/contracts/contracts.service.ts`
  - Método `calculateInitialPayments()` actualizado
  - Nuevo método `generateHonorariosEntries()` creado
  - Integrado en `create()` para generar asientos reales
- `doc/CONTRACTS/CALCULATE_INITIAL_PAYMENTS_API.md`
  - Sección "Cálculo de Honorarios" agregada
  - Ejemplos actualizados
  - Changelog interno v1.0 → v1.1
- `CHANGELOG.md` (proyecto principal)
  - Nueva versión 2.1.0

**Scripts:**

- `scripts/test-honorarios-calculation.sh` (nuevo)

---

## [2025-10-15] - API de Vista Previa de Pagos Iniciales (v1.0)

### [API] Nuevo endpoint calculate-initial-payments

- **Endpoint:** `POST /api/v1/contracts/calculate-initial-payments`
- **Propósito:** Calcular y mostrar asientos contables sin persistir
- **Roles:** admin, superUser, contabilidad, agente

**Características:**

- Calcula asientos de alquiler mensual
- Calcula depósito en garantía
- Calcula honorarios locador/locatario en cuotas
- Resumen financiero completo
- Campo `imputaciones` por asiento
- Soporte `iva_calculo_base` (INCLUIDO | MAS_IVA)
- Bloque `honorarios_inmobiliaria` detallado

**Archivos creados:**

- `src/modules/contracts/dto/calculate-initial-payments.dto.ts`
- `doc/CONTRACTS/CALCULATE_INITIAL_PAYMENTS_API.md`
- `scripts/test-calculate-payments.sh`

**Archivos modificados:**

- `src/modules/contracts/contracts.service.ts` (método calculateInitialPayments)
- `src/modules/contracts/contracts.controller.ts` (endpoint agregado)

---

## [2025-10-15] - API de Rescisión Anticipada

### [API] Endpoints de rescisión de contratos

- **Endpoints:**
  - `POST /api/v1/contracts/:id/calcular-rescision`
  - `POST /api/v1/contracts/:id/registrar-rescision`
- **Roles:** admin, superUser (registro), contabilidad (cálculo)

**Reglas de negocio:**

- Penalidad estándar: 10% del saldo futuro
- Preaviso mínimo: 30 días (configurable en ContractSettings)
- Exención: >= 90 días de anticipación (configurable)
- Anulación automática de asientos futuros

**Archivos creados:**

- `src/modules/contracts/dto/calcular-rescision.dto.ts`
- `src/modules/contracts/dto/registrar-rescision.dto.ts`
- `scripts/test-rescision.sh`

**Archivos modificados:**

- `src/modules/contracts/contracts.service.ts`
  - calcularRescision()
  - registrarRescision()
  - generarAsientoPenalidad()
  - anularAsientosFuturos()
- `src/modules/contracts/contracts.controller.ts`
- `src/modules/contract-settings/entities/contract-settings.entity.ts`
  - Campos de rescisión agregados
- `doc/CONTRACTS/RESCISION_CONTRATO.md` (creado)

---

## [2025-10-14] - Acciones sobre Asientos (Fase 3)

### [API] 6 nuevos endpoints de gestión de asientos

- **Endpoints:**
  - POST /accounting-entries/:id/pagar
  - POST /accounting-entries/:id/pago-parcial
  - POST /accounting-entries/:id/anular
  - POST /accounting-entries/:id/condonar
  - POST /accounting-entries/:id/liquidar
  - GET /accounting-entries/:id/historial

**Archivos creados:**

- DTOs para cada acción
- Métodos en AccountingEntriesService

**Archivos modificados:**

- `src/modules/accounting-entries/accounting-entries.controller.ts`
- `src/modules/accounting-entries/accounting-entries.service.ts`
- `doc/CONTRACTS/ACCOUNTING_ENTRIES_API.md`

---

## [Anterior] - API de Consultas (Fase 2)

### [API] Endpoints de consulta implementados

- GET /accounting-entries/search
- GET /accounting-entries/estado-cuenta/:agentId
- GET /accounting-entries/resumen-global

**Características:**

- Búsqueda avanzada con 8 filtros
- Estados de cuenta por agente
- Resumen global del sistema
- Paginación y ordenamiento

---

## [Anterior] - Migración de Contratos (Fase 1)

### [SCHEMA] Migración inicial completada

- 838 contratos migrados
- 3,556 asientos generados
- Estrategia OPENING_BALANCE implementada
- Ajustes ICL/IPC configurados

---

## Convenciones de Etiquetas

- `[API]` - Nuevo endpoint o cambio en API
- `[SCHEMA]` - Cambio en estructura de MongoDB
- `[DOC]` - Actualización de documentación
- `[FIX]` - Corrección de bug
- `[BREAKING]` - Cambio que rompe compatibilidad
- `[FEATURE]` - Nueva funcionalidad
- `[REFACTOR]` - Refactorización de código

---

**Última actualización:** 15 de octubre de 2025
