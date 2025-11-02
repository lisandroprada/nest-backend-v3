# 📚 Índice General - Sistema de Contratos

> **Documentación completa del sistema de contratos de Propietas**  
> **Última actualización:** 15 de octubre de 2025  
> **Total de documentos:** 13

> 📝 **Nuevo:** Todos los cambios ahora se registran en [CHANGELOG.md](./CHANGELOG.md)

---

## 🎯 Documentación Principal

### 📖 Resúmenes y Estados

1. **[README.md](./README.md)** - Introducción y guía rápida
2. **[RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md)** - Visión general ejecutiva del proyecto
3. **[SISTEMA_CONTABLE_ESTADO_ACTUAL.md](./SISTEMA_CONTABLE_ESTADO_ACTUAL.md)** - Estado completo y detallado del sistema

### 📊 Dashboards

4. **[PROGRESS_DASHBOARD.md](./PROGRESS_DASHBOARD.md)** - Dashboard de progreso del proyecto
5. **[CONTRACTS_DASHBOARD.md](./CONTRACTS_DASHBOARD.md)** - Dashboard de contratos y métricas

### 🏗️ Arquitectura y Schemas

6. **[ARQUITECTURA_COMPLETA.md](./ARQUITECTURA_COMPLETA.md)** - Arquitectura completa del sistema
7. **[CONTRACTS_COLLECTION.md](./CONTRACTS_COLLECTION.md)** - Schema de MongoDB y estructura de datos

### 📝 Control de Cambios

8. **[CHANGELOG.md](./CHANGELOG.md)** - Registro completo de todos los cambios (⭐ NUEVO)

---

## 📡 APIs y Endpoints

### API de Asientos Contables

**Documento:** [ACCOUNTING_ENTRIES_API.md](./ACCOUNTING_ENTRIES_API.md)

**Endpoints disponibles:**

```
GET  /api/v1/accounting-entries/search              # Búsqueda avanzada
GET  /api/v1/accounting-entries/estado-cuenta/:id   # Estado de cuenta
GET  /api/v1/accounting-entries/resumen-global      # Resumen global
POST /api/v1/accounting-entries/:id/pagar           # Marcar como pagado
POST /api/v1/accounting-entries/:id/pago-parcial    # Registrar pago parcial
POST /api/v1/accounting-entries/:id/anular          # Anular asiento
POST /api/v1/accounting-entries/:id/condonar        # Condonar deuda
POST /api/v1/accounting-entries/:id/liquidar        # Liquidar asiento
GET  /api/v1/accounting-entries/:id/historial       # Ver historial
```

### API de Saldos y Consultas Flexibles

**Endpoints sugeridos:**

```
GET  /api/v1/saldos/agente        # Saldos globales y por cuenta de un agente
GET  /api/v1/saldos/contrato      # Saldos de un agente en un contrato específico
GET  /api/v1/saldos/cuenta        # Saldos de una cuenta maestra para un agente
GET  /api/v1/saldos/detalle       # Detalle de partidas filtradas y paginadas
```

**Estructura de DTOs:**

```typescript
// Consulta de saldos por agente
export class AgentBalanceQueryDto {
  agente_id: string;
  rol?: 'LOCADOR' | 'LOCATARIO' | 'INMOBILIARIA' | string;
  contrato_id?: string;
  cuenta_id?: string;
  tipo_asiento?: string;
  estado?: string;
  fecha_corte?: Date;
}

// Consulta de saldos por contrato
export class ContractBalanceQueryDto {
  contrato_id: string;
  agente_id?: string;
  cuenta_id?: string;
  estado?: string;
  fecha_corte?: Date;
}

// Consulta de saldos por cuenta
export class AccountBalanceQueryDto {
  cuenta_id: string;
  agente_id?: string;
  contrato_id?: string;
  estado?: string;
  fecha_corte?: Date;
}

// Consulta de detalle de partidas
export class BalanceDetailQueryDto {
  agente_id?: string;
  contrato_id?: string;
  cuenta_id?: string;
  tipo_asiento?: string;
  estado?: string;
  fecha_corte?: Date;
  paginacion?: { skip: number; limit: number };
}
```

**Pipeline de ejemplo (MongoDB Aggregation):**

1. Filtrar asientos por estado, fecha, contrato, tipo_asiento, etc.
2. Desenrollar partidas.
3. Filtrar partidas por agente, rol, cuenta, etc.
4. Agrupar por el criterio deseado (agente, cuenta, contrato, etc.).
5. Sumarizar debe, haber, pagos, saldo.
6. Permitir paginación y ordenamiento.

**Escenarios de frontend documentados:**

- Saldos globales y por cuenta de un agente
- Saldos de un agente en un contrato específico
- Saldos de una cuenta maestra para un agente
- Detalle de partidas filtradas y paginadas

**Ejemplo de consulta y respuesta:**

```http
GET /api/v1/saldos/agente?agente_id=9dfb41fafca8ce58ae359ba3&fecha_corte=2025-10-16
```

```json
[
  {
    "cuenta_id": "68ed638fce19a9b3a4038a54",
    "contrato_id": "68ed72f084229ed30655d9e8",
    "rol": "LOCADOR",
    "saldo": 1362382.97,
    "saldo_pagado": 0,
    "detalle": [
      {
        "debe": 0,
        "haber": 1362382.97,
        "monto_pagado_acumulado": 0,
        "descripcion": "Saldo apertura - Crédito acumulado locador (neto 92%)",
        "cuenta_id": "68ed638fce19a9b3a4038a54",
        "agente_id": "9dfb41fafca8ce58ae359ba3"
      }
      // ...más partidas
    ]
  }
  // ...más agrupaciones por cuenta/contrato/rol
]
```

**Notas para el frontend:**

- Todos los endpoints permiten filtrar y agrupar por agente, contrato, cuenta, rol, estado y fecha de corte.
- El saldo se interpreta como: `saldo = total_debe - total_haber` para el agente consultado.
- El campo `saldo_pagado` permite mostrar lo efectivamente pagado/rendido.
- El campo `detalle` permite mostrar el desglose de partidas para drill-down.
- El frontend puede construir dashboards, reportes, y vistas de deuda, crédito, pagos, vencidos, liquidados, etc. usando estos endpoints y filtros.

### API de Configuración de Contratos

**Documento:** [CONTRACT_SETTINGS_API.md](./CONTRACT_SETTINGS_API.md)

**Endpoints disponibles:**

```
GET   /api/v1/contract-settings                          # Obtener configuración
GET   /api/v1/contract-settings/tipo/:tipoContrato       # Config por tipo
PATCH /api/v1/contract-settings                          # Actualizar config
PATCH /api/v1/contract-settings/tipo/:tipo/honorarios    # Actualizar honorarios
PATCH /api/v1/contract-settings/reset                    # Resetear defaults
```

**Configuraciones disponibles:**

- Honorarios por defecto (locador/locatario)
- Comisión de administración mensual
- Parámetros de rescisión (preaviso, exención, penalidad)
- Configuración de depósitos
- IVA (INCLUIDO | MAS_IVA)
- Overrides por tipo de contrato

### API de Preview de Pagos Iniciales

**Documento:** [CALCULATE_INITIAL_PAYMENTS_API.md](./CALCULATE_INITIAL_PAYMENTS_API.md)

**Endpoint:**

```
POST /api/v1/contracts/calculate-initial-payments    # Vista previa sin persistir
```

**Características:**

- Calcula asientos de alquiler mensual
- Calcula asiento de depósito en garantía
- Calcula honorarios locador/locatario (en cuotas)
- Resumen financiero completo
- NO persiste datos (solo preview)

**⚠️ Nota importante (v1.1):** Los honorarios se calculan sobre el **monto total del contrato** (duración × monto base), no sobre el monto mensual.

### API de Rescisión Anticipada

**Documento:** [RESCISION_CONTRATO.md](./RESCISION_CONTRATO.md)

**Endpoints:**

```
POST /api/v1/contracts/:id/calcular-rescision     # Calcular penalidad
POST /api/v1/contracts/:id/registrar-rescision    # Registrar rescisión
```

**Reglas de rescisión:**

- **Penalidad estándar:** 10% del saldo futuro
- **Preaviso mínimo:** 30 días (configurable)
- **Exención:** >= 90 días de anticipación (configurable)
- **Anulación automática:** Asientos futuros se anulan

### Endpoint para eliminar contrato y asientos asociados

**Propósito:** Eliminar un contrato y todos los asientos contables vinculados, útil para migraciones o correcciones de schema.

**Endpoint sugerido:**

```
DELETE /api/v1/contracts/:id/delete-with-entries
```

**DTO de entrada:**

```typescript
export class DeleteContractWithEntriesDto {
  contrato_id: string;
  motivo?: string; // Opcional, para registrar en historial
}
```

**Pipeline de borrado:**

1. Eliminar el contrato por `contrato_id`.
2. Eliminar todos los asientos contables (`accountingentries`) con ese `contrato_id`.
3. (Opcional) Registrar la acción en historial de cambios.

**Ejemplo de uso:**

```http
DELETE /api/v1/contracts/68ed72f084229ed30655d9e8/delete-with-entries
Body: { "motivo": "Migración de schema v2" }
```

**Respuesta:**

```json
{ "contratoEliminado": true, "asientosEliminados": 25 }
```

**Notas:**

- Solo debe estar disponible para usuarios con permisos de administración.
- Útil para limpiar datos incompatibles tras cambios estructurales.

---

## 📋 Historial de Fases del Proyecto

### ✅ Fase 1: Migración de Contratos

- **Estado:** Completada
- **Asientos generados:** 3,556
- **Contratos migrados:** 838
- **Documentación:** [SISTEMA_CONTABLE_ESTADO_ACTUAL.md](./SISTEMA_CONTABLE_ESTADO_ACTUAL.md)

### ✅ Fase 2: API de Consultas

- **Estado:** Completada
- **Endpoints:** 3 (search, estado-cuenta, resumen-global)
- **Documentación:** [ACCOUNTING_ENTRIES_API.md](./ACCOUNTING_ENTRIES_API.md)

### ✅ Fase 3: Acciones sobre Asientos

- **Estado:** Completada (14/oct/2025)
- **Endpoints:** 6 (pagar, pago-parcial, anular, condonar, liquidar, historial)
- **Documentación:** [ACCOUNTING_ENTRIES_API.md](./ACCOUNTING_ENTRIES_API.md)

### ✅ Fase 4: Rescisión Anticipada

- **Estado:** Completada (15/oct/2025)
- **Endpoints:** 2 (calcular-rescision, registrar-rescision)
- **Documentación:** [RESCISION_CONTRATO.md](./RESCISION_CONTRATO.md)

### ✅ Fase 5: Vista Previa de Asientos Iniciales

- **Estado:** Completada (15/oct/2025)
- **Versión:** 1.1
- **Endpoint:** 1 (calculate-initial-payments)
- **Documentación:** [CALCULATE_INITIAL_PAYMENTS_API.md](./CALCULATE_INITIAL_PAYMENTS_API.md)

**⚠️ Nota v1.1:** Honorarios se calculan sobre monto total del contrato (duración × monto base).

---

## 🚀 Próximos Pasos

### Frontend Angular

- **Estado:** Pendiente
- **Prioridad:** Alta
- **Componentes:** Servicios HTTP, tablas de asientos, filtros, dashboards

### Testing

- **Estado:** Pendiente
- **Prioridad:** Media
- **Objetivo:** Cobertura 80%+

---

## 📚 Guía de Uso de la Documentación

### Para empezar:

1. Lee [README.md](./README.md) para una introducción general
2. Consulta [RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md) para una visión de alto nivel

### Para implementar APIs:

1. **Asientos contables:** [ACCOUNTING_ENTRIES_API.md](./ACCOUNTING_ENTRIES_API.md)
2. **Configuración:** [CONTRACT_SETTINGS_API.md](./CONTRACT_SETTINGS_API.md)
3. **Preview de pagos:** [CALCULATE_INITIAL_PAYMENTS_API.md](./CALCULATE_INITIAL_PAYMENTS_API.md)
4. **Rescisión:** [RESCISION_CONTRATO.md](./RESCISION_CONTRATO.md)

### Para entender la arquitectura:

1. [ARQUITECTURA_COMPLETA.md](./ARQUITECTURA_COMPLETA.md) - Diagrama y explicación
2. [CONTRACTS_COLLECTION.md](./CONTRACTS_COLLECTION.md) - Schemas de MongoDB

### Para ver el progreso:

1. [PROGRESS_DASHBOARD.md](./PROGRESS_DASHBOARD.md) - Estado del proyecto
2. [CONTRACTS_DASHBOARD.md](./CONTRACTS_DASHBOARD.md) - Métricas de contratos

---

## 📝 Registro de Cambios

### 2025-10-15 - Consolidación de Documentación

- **Reducción:** 31 → 12 documentos (61% menos)
- **Cambio v1.1:** Cálculo de honorarios sobre monto total del contrato
- **Eliminados:** Documentos redundantes sobre fases, implementations y resúmenes
- **Consolidado:** Información en documentos principales de API

### 2025-10-15 - Fase 5: Vista Previa de Pagos

- Implementado endpoint calculate-initial-payments
- Breaking change en cálculo de honorarios (v1.1)

### 2025-10-15 - Fase 4: Rescisión Anticipada

- Implementados endpoints de rescisión
- Documentación completa en RESCISION_CONTRATO.md

### 2025-10-14 - Fase 3: Acciones sobre Asientos

- 6 nuevos endpoints implementados
- Documentación en ACCOUNTING_ENTRIES_API.md

---

**Última actualización:** 15 de octubre de 2025  
**Mantenido por:** GitHub Copilot + Equipo de Desarrollo
