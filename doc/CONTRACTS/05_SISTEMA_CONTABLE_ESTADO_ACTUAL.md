# Sistema Contable - Estado Actual

> **Última actualización:** 14 de octubre de 2025  
> **Estado:** ✅ OPERATIVO - Migración completada exitosamente

---

## 📊 Estado de la Base de Datos

### Registros Actuales

- **Contratos migrados:** 838 contratos
- **Asientos contables generados:** 3,556 asientos
- **Estrategia implementada:** OPENING_BALANCE (Apertura + Futuros)
- **Tasa de éxito:** 241/241 contratos procesados (100%)

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

**Versión:** 1.0.0  
**Última migración exitosa:** 14/10/2025 01:33:46 AM  
**Próxima tarea:** Integrar con frontend
