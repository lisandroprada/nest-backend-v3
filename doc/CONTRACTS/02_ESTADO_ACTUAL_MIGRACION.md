# Sistema Contable - Estado Actual

> **Última actualización:** 4 de diciembre de 2025  
> **Estado:** ⚠️ OPERATIVO PARCIAL - Migración de asientos históricos pendiente

---

## 📊 Estado de la Base de Datos

### Datos de Migración Disponibles

**Archivo JSON del sistema legacy:**
- **Ubicación:** `doc/CONTRACTS/json/propietas.leaseagreements.json`
- **Total de contratos:** 862 contratos
- **Contratos activos (`status: true`):** 613 contratos
- **Contratos inactivos (`status: false`):** 249 contratos
- **Formato:** MongoDB Extended JSON
- **Tamaño:** 132,792 líneas

**Campos disponibles en JSON legacy:**
```javascript
{
  _id, property, realtor, tenant, leaseHolder, guarantor,
  startDate, expiresAt, length, status,
  rentAmount, adminFee, rentIncrease, rentIncreaseType,
  rentIncreasePeriod, rentIncreaseFixed,
  depositAmount, depositLength, depositType,
  expensesAmount, expensesType,
  leaseHolderFee, leaseHolderAmountOfFees,
  tenantFee, tenantAmountOfFees,
  icl, interest, paymentTerm, type, use
}
```

### Registros Actuales en Backend-V3

- **Contratos migrados:** 838 contratos
- **Contratos activos migrados:** 613 contratos (100% de activos)
- **Contratos inactivos migrados:** 225 contratos (90.4% de inactivos)
- **Contratos NO migrados:** 24 contratos (9.6% de inactivos)
- **Asientos contables generados:** 3,556 asientos
- **Estrategia implementada:** OPENING_BALANCE (Apertura + Futuros)
- **Tasa de éxito:** 241/241 contratos vigentes procesados (100%)

### Análisis de Contratos No Migrados

**Razón principal:** Los 24 contratos no migrados tienen `status: false` en el sistema legacy y probablemente:
- Datos incompletos o inválidos
- Referencias rotas a agentes o propiedades
- No pasaron validaciones de migración

**Distribución:**
```
Total en JSON:          862 contratos
├─ Activos:             613 contratos → 613 migrados (100%) ✅
└─ Inactivos:           249 contratos → 225 migrados (90.4%) ⚠️
                                      → 24 NO migrados (9.6%) ❌
```

**Recomendación:** Los 24 contratos inactivos no migrados NO deberían migrarse ya que están marcados como inactivos y podrían tener datos inconsistentes.

---

## 🔄 Proceso de Migración Completo

### Opción 1: Dos Pasos (Ejecutado)

**Paso 1: Importar JSON a MongoDB**
```bash
mongoimport --db nest-propietasV3 --collection contracts \
  --file doc/CONTRACTS/json/propietas.leaseagreements.json \
  --jsonArray
```
**Resultado:** 862 contratos en formato legacy

**Paso 2: Transformar Legacy → V3**
```bash
mongosh mongodb://localhost:27017/nest-propietasV3 < doc/CONTRACTS/json/transform-contracts.js
```
**Resultado:** 862 contratos en formato V3 ✅

### Opción 2: Un Solo Paso (Recomendado para futuras migraciones)

**Script disponible:** `doc/CONTRACTS/json/migrate-contracts-one-step.js`

```bash
node doc/CONTRACTS/json/migrate-contracts-one-step.js
```

**Ventajas:**
- ✅ Un solo comando
- ✅ Transformación automática
- ✅ Validación de duplicados
- ✅ Inserción en lotes (mejor performance)

### Diferencias de Estructura

| Campo Legacy | Campo V3 | Tipo de Cambio |
|--------------|----------|----------------|
| `rentAmount` | `terminos_financieros.monto_base_vigente` | Anidado |
| `adminFee` | `terminos_financieros.comision_administracion_porcentaje` | Anidado |
| `tenant[]` | `partes[{rol: 'LOCATARIO'}]` | Estructura |
| `leaseHolder[]` | `partes[{rol: 'LOCADOR'}]` | Estructura |
| `guarantor[]` | `partes[{rol: 'GARANTE'}]` | Estructura |
| `status: boolean` | `status: 'VIGENTE'\|'RESCINDIDO'` | Tipo |
| `startDate` | `fecha_inicio` | Nombre |
| `expiresAt` | `fecha_final` | Nombre |
| `length` | `duracion_meses` | Nombre |

### Estado Actual

- ✅ **862 contratos importados**
- ✅ **862 contratos transformados a V3**
- ✅ **Frontend compatible**
- ⚠️ **Asientos contables pendientes** (~23,000 asientos a generar)

### Colecciones MongoDB

```javascript
// Base de datos: nest-propietasV3
{
  contracts: 838,              // Contratos migrados
  accountingentries: 3556,     // Asientos contables generados
  chartofaccounts: X,          // Plan de cuentas
  agents: X                    // Agentes (propietarios, inquilinos, etc.)
}
```

---

## 🏗️ Arquitectura Implementada

### Módulos Principales

#### 1. **ContractsMigrationService** (OPERATIVO)

**Ubicación:** `src/modules/contracts/contracts-migration.service.ts`

**Funcionalidades:**

- ✅ Migración masiva de contratos
- ✅ Generación de asientos de apertura
- ✅ Generación de asientos futuros (ventana móvil)
- ✅ Aplicación de ajustes ICL/IPC
- ✅ Cálculo dinámico de comisiones (6%, 7%, 8%)
- ✅ Redondeo a 2 decimales

**Estrategia OPENING_BALANCE:**

```typescript
// 1. Asiento de Apertura
{
  tipo_asiento: 'Apertura',
  descripcion: 'Saldo inicial al [fecha]',
  monto: // Suma de todos los períodos vencidos con ajustes ICL
}

// 2. Asientos Futuros (ventana móvil)
// Genera asientos desde HOY hasta fecha_final del contrato
{
  tipo_asiento: 'Alquiler',
  descripcion: 'Alquiler MM/YYYY',
  fecha_vencimiento: // 10 días después del mes
}
```

#### 2. **AccountingEntriesService** (OPERATIVO)

**Ubicación:** `src/modules/accounting-entries/accounting-entries.service.ts`

**Funcionalidades:**

- ✅ CRUD de asientos contables
- ✅ Consultas y filtros (OPERATIVO)
- ✅ Estados de cuenta por agente (OPERATIVO)
- ✅ Reportes globales (OPERATIVO)

---

## 🔄 Ajustes ICL/IPC Implementados

### Lógica de Ajuste

```typescript
// Fórmula implementada
montoNuevo = montoBase * (ICL_nuevo / ICL_viejo);

// Ejemplo real:
// Monto base: $400,000
// ICL antiguo: 22.41
// ICL nuevo: 25.35
// Resultado: $400,000 * (25.35 / 22.41) = $452,480.00
// Ajuste: 13.12%
```

### Períodos de Ajuste

- **Frecuencia:** Configurable por contrato (`ajuste_programado`)
- **Tipos de índice:** ICL, IPC, FIJO
- **Aplicación:** Automática en asientos futuros

---

## 📐 Estructura de Asientos Contables

### Schema AccountingEntry

```typescript
{
  _id: ObjectId,
  contrato_id: ObjectId,               // Referencia a Contract
  tipo_asiento: string,                // 'Apertura' | 'Alquiler' | 'Deposito'
  fecha_vencimiento: Date,             // Fecha de vencimiento del pago
  descripcion: string,                 // Ej: "Alquiler 07/2025"

  partidas: [{
    cuenta_id: ObjectId,               // Referencia a ChartOfAccount
    descripcion: string,
    debe: number,                      // 2 decimales
    haber: number,                     // 2 decimales
    agente_id: ObjectId,               // Opcional: para filtros por agente
    es_iva_incluido: boolean,
    tasa_iva_aplicada: number,
    base_imponible: number
  }],

  total_debe: number,                  // Suma debe
  total_haber: number,                 // Suma haber
  esta_balanceado: boolean,            // debe === haber

  usuario_creacion_id: ObjectId,
  usuario_modificacion_id: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Partidas Generadas por Asiento

#### Asiento de Alquiler:

```typescript
[
  {
    cuenta: 'CXC_ALQ', // Cuentas por Cobrar - Alquiler
    debe: monto + IVA,
    haber: 0,
    agente_id: inquilino_id,
  },
  {
    cuenta: 'CXP_LOC', // Cuentas por Pagar - Locador
    debe: 0,
    haber: monto - comision,
    agente_id: propietario_id,
  },
  {
    cuenta: 'ING_HNR', // Ingresos - Honorarios
    debe: 0,
    haber: comision,
  },
];
```

---

## 🚀 Endpoints Disponibles

### Migración de Contratos

#### POST `/api/v1/contracts/migration/generate-accounting-entries`

**Descripción:** Migración masiva de contratos

**Request Body:**

```json
{
  "contractIds": ["id1", "id2"], // Opcional: IDs específicos
  "dryRun": false, // true = simulación
  "strategy": "OPENING_BALANCE", // Estrategia por defecto
  "deleteExisting": false // ⚠️ BUG CONOCIDO: No funciona
}
```

**Response:**

```json
{
  "totalContracts": 838,
  "successCount": 241,
  "failureCount": 0,
  "totalAmount": 1234567890,
  "executionTime": 5755,
  "results": [
    {
      "success": true,
      "contractId": "...",
      "asientosGenerados": 24,
      "montoTotal": 10800000
    }
  ]
}
```

#### POST `/api/v1/contracts/migration/contract/:id`

**Descripción:** Migración de un contrato específico

**Request Body:**

```json
{
  "dryRun": false,
  "strategy": "OPENING_BALANCE",
  "deleteExisting": false
}
```

---

## ⚠️ Problemas Conocidos

### 1. Flag `deleteExisting` No Funcional

**Estado:** 🔴 BUG CONFIRMADO  
**Descripción:** El parámetro `deleteExisting: true` no elimina asientos existentes  
**Workaround:** Eliminación manual desde MongoDB

```javascript
db.accountingentries.deleteMany({ contrato_id: ObjectId('...') });
```

### 2. Estrategia FULL_HISTORY

**Estado:** 🟡 NO IMPLEMENTADA  
**Descripción:** Estrategia para generar asientos desde fecha_inicio (no solo apertura)  
**Pendiente:** Desarrollo futuro si se requiere historial completo

---

## ✅ Próximos Pasos - Consultas y Frontend (COMPLETADO)

#### GET `/api/v1/accounting-entries` (IMPLEMENTADO)

**Filtros necesarios:**

```typescript
{
  contrato_id?: string,
  agente_id?: string,              // Propietario o inquilino
  tipo_asiento?: string,           // 'Apertura' | 'Alquiler' | 'Deposito'
  fecha_desde?: Date,
  fecha_hasta?: Date,
  esta_pagado?: boolean,
  page?: number,
  limit?: number,
  sort?: string                    // '-fecha_vencimiento', 'monto', etc.
}
```

#### GET `/api/v1/accounting-entries/estado-cuenta/:agente_id` (IMPLEMENTADO)

**Descripción:** Estado de cuenta de un agente (propietario/inquilino)

**Response esperado:**

```json
{
  "agente": {
    "_id": "...",
    "nombre": "Juan Pérez",
    "rol": "PROPIETARIO"
  },
  "resumen": {
    "total_debe": 1000000,
    "total_haber": 800000,
    "saldo": 200000,
    "asientos_pendientes": 5,
    "asientos_pagados": 15
  },
  "asientos": [
    {
      "fecha_vencimiento": "2025-07-10",
      "descripcion": "Alquiler 07/2025",
      "debe": 500000,
      "haber": 0,
      "saldo_acumulado": 500000,
      "pagado": false
    }
  ]
}
```

#### GET `/api/v1/accounting-entries/resumen-global` (IMPLEMENTADO)

**Descripción:** Resumen global de todos los asientos

**Response esperado:**

```json
{
  "total_contratos": 838,
  "total_asientos": 3556,
  "total_debe": 50000000,
  "total_haber": 50000000,
  "saldo_pendiente": 5000000,
  "por_tipo": {
    "Apertura": { "count": 241, "monto": 15000000 },
    "Alquiler": { "count": 3000, "monto": 30000000 },
    "Deposito": { "count": 315, "monto": 5000000 }
  },
  "por_estado": {
    "pagados": { "count": 1000, "monto": 20000000 },
    "pendientes": { "count": 2556, "monto": 30000000 }
  }
}
```

### 2. Servicios Implementados

```typescript
// accounting-entries.service.ts

async getEstadoCuentaByAgente(
  agenteId: string,
  filters: {
    fechaDesde?: Date,
    fechaHasta?: Date,
    incluirPagados?: boolean
  }
) {
  // 1. Buscar todas las partidas donde agente_id = agenteId
  // 2. Agrupar por asiento
  // 3. Calcular saldo acumulado
  // 4. Retornar estado de cuenta ordenado
}

async getResumenGlobal(filters?: {
  fechaDesde?: Date,
  fechaHasta?: Date
}) {
  // 1. Agregar todos los asientos
  // 2. Calcular totales por tipo
  // 3. Calcular saldos pendientes
  // 4. Retornar resumen
}

async findWithFilters(filters: AccountingEntryFilters) {
  // 1. Construir query MongoDB
  // 2. Aplicar paginación
  // 3. Poblar referencias (contrato, agente, cuentas)
  // 4. Retornar resultados
}
```

### 3. Frontend - Componentes Necesarios (PENDIENTE)

#### Tabla de Asientos Contables

```typescript
// Columnas requeridas:
- Fecha Vencimiento
- Contrato (propiedad)
- Tipo Asiento
- Descripción
- Debe
- Haber
- Saldo
- Estado (Pagado/Pendiente)
- Acciones (Ver detalle, Marcar como pagado)
```

#### Filtros

```typescript
// Filtros a implementar:
- Rango de fechas (desde/hasta)
- Agente (select con autocomplete)
- Tipo de asiento (select)
- Estado (pagado/pendiente)
- Contrato (search)
- Ordenamiento (fecha, monto, estado)
```

#### Estado de Cuenta Individual

```typescript
// Vista por agente:
- Header: Datos del agente, saldo total
- Tabla de movimientos con saldo acumulado
- Gráfico de evolución del saldo
- Exportar a PDF/Excel
```

#### Dashboard Global

```typescript
// Tarjetas resumen:
- Total contratos activos
- Asientos generados
- Saldo total pendiente
- Gráfico de torta por tipo de asiento
- Timeline de vencimientos próximos
```

---

## 🛠️ Herramientas de Desarrollo

### Consultas MongoDB Útiles

```javascript
// Contar asientos por tipo
db.accountingentries.aggregate([
  { $group: { _id: '$tipo_asiento', count: { $sum: 1 } } },
]);

// Asientos de un contrato específico
db.accountingentries
  .find({
    contrato_id: ObjectId('68ed72f084229ed30655d6ea'),
  })
  .sort({ fecha_vencimiento: 1 });

// Asientos de un agente (en partidas)
db.accountingentries.find({
  'partidas.agente_id': ObjectId('...'),
});

// Resumen de debe/haber
db.accountingentries.aggregate([
  {
    $group: {
      _id: null,
      total_debe: { $sum: '$total_debe' },
      total_haber: { $sum: '$total_haber' },
    },
  },
]);
```

### Scripts de Utilidad

```bash
# Limpiar todos los asientos (CUIDADO!)
mongosh mongodb://localhost:27017/nest-propietasV3 --eval "db.accountingentries.deleteMany({})"

# Verificar balance
mongosh mongodb://localhost:27017/nest-propietasV3 --eval "
  db.accountingentries.aggregate([
    { \$match: { esta_balanceado: false } },
    { \$count: 'desbalanceados' }
  ])
"

# Contar asientos por contrato
mongosh mongodb://localhost:27017/nest-propietasV3 --eval "
  db.accountingentries.aggregate([
    { \$group: { _id: '\$contrato_id', count: { \$sum: 1 } } },
    { \$sort: { count: -1 } }
  ])
"
```

---

## 📝 Notas Técnicas

### Ventana Móvil

- **Concepto:** Generar asientos futuros solo hasta `fecha_final` del contrato
- **Beneficio:** No genera asientos innecesarios más allá del término del contrato
- **Implementación:** Verificada y funcionando correctamente

### Redondeo

- **Precisión:** 2 decimales en todos los cálculos
- **Método:** `Math.round(value * 100) / 100`
- **Aplicación:** Montos, comisiones, base imponible, IVA

### Comisiones Dinámicas

- **Porcentajes:** 6%, 7%, u 8% según configuración del contrato
- **Cálculo:** `comision = monto * (porcentaje / 100)`
- **Redondeo:** Aplicado después del cálculo

---

## 🔐 Validaciones Implementadas

### En Creación de Asientos

- ✅ Balance debe = haber
- ✅ Monto total > 0
- ✅ Contrato existe
- ✅ Cuentas contables existen
- ✅ Agentes válidos en partidas
- ✅ IVA calculado correctamente

### En Ajustes ICL

- ✅ Índice actual > 0
- ✅ Índice nuevo > 0
- ✅ Período de ajuste válido
- ✅ Tipo de índice coincide (ICL/IPC)

---

## 📚 Referencias Rápidas

### Archivos Clave

- `src/modules/contracts/contracts-migration.service.ts` - Lógica de migración
- `src/modules/contracts/contracts-migration.controller.ts` - Endpoints
- `src/modules/accounting-entries/accounting-entries.service.ts` - CRUD asientos
- `src/modules/accounting-entries/entities/accounting-entry.entity.ts` - Schema

### Endpoints Activos

- `POST /api/v1/contracts/migration/generate-accounting-entries` - Migración masiva
- `POST /api/v1/contracts/migration/contract/:id` - Migración individual
- `GET /api/v1/contracts/migration/summary` - Resumen de migración

### Documentación Actualizada

- ✅ Este documento (SISTEMA_CONTABLE_ESTADO_ACTUAL.md)
- ❌ Documentos obsoletos eliminados

---

## ✅ MIGRACIÓN CONTABLE - LÓGICA CONSOLIDADA (Diciembre 2025)

### Estado Actual de Asientos y Pagos

- ✅ **Lógica de Estados:** Validada la transición `PENDIENTE` → `COBRADO` → `LIQUIDADO`.
- ✅ **Paridad de Saldos:** Lograda en el Contrato 6902 (modelo quirúrgico).
- ✅ **Campos Técnicos:** Uso de `monto_pagado_acumulado` para deudores y `monto_liquidado` para acreedores.
- ✅ **Vinculación:** Automatizada la relación `Receipt` → `AccountingEntry`.

Para más detalles, consultar [09_LOGICA_PAGOS_Y_LIQUIDACION.md](./09_LOGICA_PAGOS_Y_LIQUIDACION.md).

### Próximos Pasos Críticos

#### 1. Implementar Estrategia FULL_HISTORY

**Objetivo:** Generar todos los asientos históricos desde `fecha_inicio` hasta hoy

**Alcance:**
- Alquileres mensuales: ~20,000 asientos
- Depósitos: ~800 asientos
- Honorarios locador: ~800 asientos
- Honorarios locatario: ~1,400 asientos

**Estimación:** 2-3 días de desarrollo + testing

#### 2. Validar y Reconciliar

**Tareas:**
- Comparar saldos con sistema-be (legacy)
- Verificar balances debe/haber
- Validar comisiones variables (6%, 7%, 8%)
- Confirmar cálculo de honorarios v1.1

#### 3. Integrar con Frontend

**Componentes pendientes:**
- Servicios Angular para contratos
- Estados de cuenta por agente
- Dashboard de contratos
- Acciones sobre asientos

---

## ⚠️ DIFERENCIAS CRÍTICAS CON SISTEMA LEGACY

### 1. Honorarios v1.1 (BREAKING CHANGE)

**Sistema Legacy:**
```javascript
honorarios = monto_mensual × (porcentaje / 100)
```

**Backend-V3:**
```typescript
honorarios = (duracion_meses × monto_base_vigente) × (porcentaje / 100)
```

**Impacto:** Honorarios en V3 son ~24-36x mayores que en legacy ⚠️

**Ejemplo:**
- Contrato: 24 meses × $10,000/mes = $240,000 total
- Honorarios locador 2%:
  - Legacy: $10,000 × 2% = $200
  - V3: $240,000 × 2% = $4,800 ✅

### 2. Comisiones Variables

**Sistema Legacy:** Comisión fija global

**Backend-V3:** Comisión variable por contrato
- 66% contratos: 7%
- 27% contratos: 6%
- 7% contratos: 8%

### 3. Expensas como Servicios Públicos

**Sistema Legacy:** Asientos directos del contrato

**Backend-V3:** Sistema `servicios_impuestos_contrato`
- Permite múltiples servicios por contrato
- Soporta división de costos (porcentaje_aplicacion)
- Requiere migración de consorcios a proveedores

### 4. Validación de Hitos Pre-Activación

**Backend-V3 requiere:**
- `firmas_completas`: true
- `documentacion_completa`: true
- `visita_realizada`: true
- `inventario_actualizado`: true
- `fotos_inventario`: Al menos 1 foto

**Sin estos hitos, el contrato NO puede pasar a estado VIGENTE**

---

## 📋 PLAN DE ACCIÓN INMEDIATO

### Esta Semana

1. **Implementar FULL_HISTORY**
   - Desarrollar generación de asientos históricos
   - Testing en ambiente de desarrollo
   - Validación con muestra representativa

2. **Ejecutar Migración Completa**
   - Generar ~19,500 asientos históricos
   - Validar balances debe/haber
   - Comparar saldos con sistema legacy

3. **Documentar y Replicar**
   - ✅ Generado manual de paridad y liquidación quirúrgica.
   - ✅ Implementadas salvaguardas de UX en el frontend.
   - [ ] Continuar con la migración masiva aplicando el modelo quirúrgico validado.

### Próxima Semana

4. **Validación y Reconciliación**
   - Comparación exhaustiva con sistema legacy
   - Verificación de comisiones variables
   - Confirmación de ajustes ICL/IPC

5. **Integración Frontend**
   - Crear servicios Angular
   - Implementar componentes
   - Testing E2E

---

## 📚 Referencias

### Documentación Sistema Legacy

- **Ubicación:** `sistema-be/docs/migration/04-lease-agreement-creation-flow.md`
- **Propósito:** Flujo original de creación de contratos
- **Uso:** Referencia para validación

### Archivos Clave Backend-V3

- `src/modules/contracts/contracts.service.ts` - Lógica de contratos
- `src/modules/contracts/contracts-migration.service.ts` - Migración
- `src/modules/accounting-entries/accounting-entries.service.ts` - Asientos
- `src/modules/accounting-entries/entities/accounting-entry.entity.ts` - Schema

---

**Versión:** 2.0.0  
**Última actualización:** 4 de diciembre de 2025  
**Última migración parcial:** 14/10/2025 01:33:46 AM  
**Próxima tarea crítica:** Implementar FULL_HISTORY y generar asientos históricos
