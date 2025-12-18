# Análisis Profundo: Migración de Contratos Legacy → V3

## 📊 Comparación de Schemas

### Legacy: `leaseagreements`
```javascript
{
  _id: ObjectId,
  property: { _id, address },
  realtor: { _id, fullName, email, address, city, state },
  leaseHolder: [{ _id, fullName, email, address, identityCard, city, state, gender }],  // Locador/Propietario
  tenant: [{ _id, fullName, email, address, identityCard, city, state, gender }],       // Locatario/Inquilino
  guarantor: [{ _id, fullName, email, address, identityCard, city, state, gender }],    // Fiador/Garante
  startDate: Date,
  expiresAt: Date,
  length: Number,               // Duración en meses
  rentAmount: Number,
  rentIncrease: Number,         // Porcentaje
  rentIncreaseType: String,     // "NO REGULADO", "ICL", "IPC"
  rentIncreaseFixed: Boolean,
  rentIncreasePeriod: Number,   // Meses
  adminFee: Number,             // Comisión administración %
  interest: Number,
  leaseHolderFee: Number,       // Honorarios locador %
  leaseHolderAmountOfFees: Number,
  tenantFee: Number,            // Honorarios locatario %
  tenantAmountOfFees: Number,
  depositType: String,
  depositAmount: Number,
  depositLength: Number,
  expensesType: String,
  expensesAmount: Number,
  paymentTerm: Number,          // Día de vencimiento
  type: String,                 // "Vivienda", "Comercial"
  use: String,                  // "Vivienda Única", "Vivienda"
  status: Boolean,              // true = vigente
  icl: Number,
  contrato: String,
  user: ObjectId,
  createdAt: Date,
  changedAt: Date,
  touched: Boolean
}
```

### V3: `contracts` (LeaseAgreement)
```javascript
{
  _id: ObjectId,
  propiedad_id: ObjectId,       // Referencia a Property
  partes: [{                    // Array de participantes
    agente_id: ObjectId,        // Referencia a Agent
    rol: String                 // "LOCADOR", "LOCATARIO", "FIADOR"
  }],
  fecha_inicio: Date,
  fecha_final: Date,
  duracion_meses: Number,
  tipo_contrato: String,        // "VIVIENDA_UNICA", "VIVIENDA", "COMERCIAL"
  status: String,               // "VIGENTE", "FINALIZADO", "RESCINDIDO", "PENDIENTE"
  
  terminos_financieros: {
    monto_base_vigente: Number,
    indice_tipo: String,        // "ICL", "IPC", "FIJO"
    ajuste_porcentaje: Number,
    ajuste_periodicidad_meses: Number,
    ajuste_es_fijo: Boolean,
    comision_administracion_porcentaje: Number,
    honorarios_locador_porcentaje: Number,
    honorarios_locador_cuotas: Number,
    honorarios_locatario_porcentaje: Number,
    honorarios_locatario_cuotas: Number,
    interes_mora_diaria: Number,
    indice_valor_inicial: Number,
    iva_calculo_base: String    // "INCLUIDO", "MAS_IVA"
  },
  
  deposito_monto: Number,
  deposito_cuotas: Number,
  deposito_tipo_ajuste: String,
  
  // Rescisión
  fecha_recision_anticipada: Date,
  fecha_notificacion_rescision: Date,
  penalidad_rescision_monto: Number,
  penalidad_rescision_motivo: String,
  rescision_dias_preaviso_minimo: Number,
  rescision_dias_sin_penalidad: Number,
  rescision_porcentaje_penalidad: Number,
  
  // Hitos de activación
  firmas_completas: Boolean,
  documentacion_completa: Boolean,
  visita_realizada: Boolean,
  inventario_actualizado: Boolean,
  fotos_inventario: String[],
  inventory_version_id: ObjectId,
  
  servicios_impuestos_contrato: Array,
  ajuste_programado: Date,
  usuario_creacion_id: ObjectId,
  usuario_modificacion_id: ObjectId
}
```

---

## 🎯 Propuesta de Desnormalización para Búsquedas

### Problema Actual
Al buscar contratos, necesitamos hacer múltiples lookups:
- `propiedad_id` → Property → direccion → provincia → nombre de provincia
- `partes[].agente_id` → Agent → nombre completo del locador/locatario

**Esto es ineficiente** especialmente en listados y búsquedas.

### ✨ Solución: Campos Desnormalizados

Agregar campos **redundantes pero optimizados** que se sincronizan al crear/actualizar:

```typescript
{
  _id: ObjectId,
  propiedad_id: ObjectId,
  
  // 🆕 CAMPOS DESNORMALIZADOS PARA BÚSQUEDA
  _search: {
    // Propiedad
    propiedad_direccion: string,          // "Doctor Antonio Zorrilla 1347"
    propiedad_provincia: string,          // "Chubut"
    propiedad_provincia_id: ObjectId,     // ObjectId (para filtros)
    propiedad_localidad: string,          // "Rawson"
    propiedad_localidad_id: ObjectId,     // ObjectId (para filtros)
    
    // Locador (primer locador si hay múltiples)
    locador_nombre: string,               // "Virginia Estela Villafañe"
    locador_id: ObjectId,                 // ObjectId directo
    
    // Locatario (primer locatario si hay múltiples)
    locatario_nombre: string,             // "Yanina Ayelen Castillo"
    locatario_id: ObjectId,               // ObjectId directo
    
    // Fiador (si existe)
    fiador_nombre: string,                // "Juan Pérez"
    fiador_id: ObjectId,                  // ObjectId directo o null
  },
  
  partes: [{ agente_id, rol }],           // Se mantiene la estructura original
  // ... resto de campos
}
```

### 📋 Índices Propuestos

```javascript
// Índice compuesto para búsquedas por ubicación
db.contracts.createIndex({ 
  "_search.propiedad_provincia_id": 1,
  "_search.propiedad_localidad_id": 1,
  "status": 1 
});

// Índice de texto para búsqueda por nombres
db.contracts.createIndex({ 
  "_search.locador_nombre": "text",
  "_search.locatario_nombre": "text",
  "_search.propiedad_direccion": "text"
});

// Índice para búsqueda por locador específico
db.contracts.createIndex({ "_search.locador_id": 1, "status": 1 });

// Índice para búsqueda por locatario específico
db.contracts.createIndex({ "_search.locatario_id": 1, "status": 1 });
```

### 🔄 Estrategia de Sincronización

**Durante migración:**
1. Al transformar el contrato, realizar lookups a Property y Agents
2. Extraer y almacenar los campos desnormalizados en `_search`

**En la aplicación V3:**
1. Al crear/actualizar un contrato → actualizar `_search`
2. Al actualizar nombre de un Agent → actualizar contratos donde ese agent aparece
3. Al actualizar dirección de Property → actualizar contratos de esa propiedad

**Middleware de Mongoose (ejemplo):**
```typescript
ContractSchema.pre('save', async function() {
  if (this.isModified('propiedad_id') || this.isModified('partes')) {
    // Sincronizar campos _search
    await this.syncSearchFields();
  }
});
```

---

## 🗺️ Mapeo Detallado de Campos

| Legacy | V3 | Transformación | Notas |
|:-------|:---|:---------------|:------|
| `_id` | `_id` | **Preservar** | Crítico para integridad |
| `property._id` | `propiedad_id` | ObjectId directo | |
| `property.address` | `_search.propiedad_direccion` | String copiado | **DESNORM** |
| - | `_search.propiedad_provincia` | Lookup Property → Provincia | **DESNORM** |
| - | `_search.propiedad_localidad` | Lookup Property → Localidad | **DESNORM** |
| `leaseHolder[0]._id` | `partes[].agente_id` + `_search.locador_id` | ObjectId + **DESNORM** | Rol="LOCADOR" |
| `leaseHolder[0].fullName` | `_search.locador_nombre` | String copiado | **DESNORM** |
| `tenant[0]._id` | `partes[].agente_id` + `_search.locatario_id` | ObjectId + **DESNORM** | Rol="LOCATARIO" |
| `tenant[0].fullName` | `_search.locatario_nombre` | String copiado | **DESNORM** |
| `guarantor[0]._id` | `partes[].agente_id` + `_search.fiador_id` | ObjectId + **DESNORM** | Rol="FIADOR" |
| `guarantor[0].fullName` | `_search.fiador_nombre` | String copiado | **DESNORM** |
| `startDate` | `fecha_inicio` | Date (UTC puro, NO -3h) | ⚠️ **CRÍTICO** |
| `expiresAt` | `fecha_final` | Date (UTC puro, NO -3h) | ⚠️ **CRÍTICO** |
| `length` | `duracion_meses` | Number directo | |
| `rentAmount` | `terminos_financieros.monto_base_vigente` | Number directo | |
| `rentIncreaseType` | `terminos_financieros.indice_tipo` | Mapear: "NO REGULADO"→"FIJO", "ICL"→"ICL", "IPC"→"IPC" | |
| `rentIncrease` | `terminos_financieros.ajuste_porcentaje` | Number directo | |
| `rentIncreasePeriod` | `terminos_financieros.ajuste_periodicidad_meses` | Number directo | |
| `rentIncreaseFixed` | `terminos_financieros.ajuste_es_fijo` | Boolean directo | |
| `adminFee` | `terminos_financieros.comision_administracion_porcentaje` | Number directo | |
| `leaseHolderFee` | `terminos_financieros.honorarios_locador_porcentaje` | Number directo | |
| `leaseHolderAmountOfFees` | `terminos_financieros.honorarios_locador_cuotas` | Number directo | |
| `tenantFee` | `terminos_financieros.honorarios_locatario_porcentaje` | Number directo | |
| `tenantAmountOfFees` | `terminos_financieros.honorarios_locatario_cuotas` | Number directo | |
| `interest` | `terminos_financieros.interes_mora_diaria` | Number / 30 (mensual → diaria) | Verificar si es % mensual o diario |
| `icl` | `terminos_financieros.indice_valor_inicial` | Number directo | |
| `depositAmount` | `deposito_monto` | Number directo | |
| `depositLength` | `deposito_cuotas` | Number directo | |
| `type` | `tipo_contrato` | Mapear: "Vivienda"→"VIVIENDA", "Comercial"→"COMERCIAL" | |
| `use` | `tipo_contrato` | "Vivienda Única"→"VIVIENDA_UNICA" | Prioritario sobre `type` |
| `status` (Boolean) | `status` (String) | true→"VIGENTE", false→"FINALIZADO" | Validar con `expiresAt < now` |
| `user` | `usuario_creacion_id` | ObjectId directo | |
| `createdAt` | - | No migrar (timestamps automáticos) | |

---

## ⚠️ Puntos Críticos

### 1. **Normalización de Fechas**
```typescript
// ❌ INCORRECTO (Legacy guarda con -3h manual)
fecha_inicio: new Date(legacyContract.startDate)  

// ✅ CORRECTO (Ignorar offset, interpretar como UTC)
fecha_inicio: new Date(legacyContract.startDate.toISOString())
```

### 2. **Múltiples Participantes por Rol**
Legacy permite arrays de `leaseHolder`, `tenant`, `guarantor`. En V3:
- Todos van a `partes[]` con su `rol` correspondiente
- Para `_search` usamos el **primer elemento** de cada array
-Si hay múltiples, agregar nota en `_migration Notes`

### 3. **Status del Contrato**
```typescript
// Lógica combinada:
if (legacy.status === false) {
  v3.status = 'FINALIZADO';
} else if (legacy.expiresAt < new Date()) {
  v3.status = 'FINALIZADO';
} else if (legacy.startDate > new Date()) {
  v3.status = 'PENDING';
} else {
  v3.status = 'VIGENTE';
}
```

### 4. **Validación de Dependencias**
Antes de migrar, verificar que existen en V3:
- `property._id` existe en `properties`
- `leaseHolder[]._id` existen en `agents`
- `tenant[]._id` existen en `agents`
- `guarantor[]._id` existen en `agents`

---

## 💾 Campos con Valores por Defecto

```typescript
{
  firmas_completas: true,  // Asumir que contratos legacy están firmados
  documentacion_completa: true,
  visita_realizada: true,
  inventario_actualizado: false,
  fotos_inventario: [],
  inventory_version_id: null,
  servicios_impuestos_contrato: [],  // Heredan de la propiedad
  terminos_financieros: {
    iva_calculo_base: 'MAS_IVA',  // Por defecto
  },
  rescision_dias_preaviso_minimo: 30,
  rescision_dias_sin_penalidad: 90,
  rescision_porcentaje_penalidad: 10,
  deposito_tipo_ajuste: 'AL_ULTIMO_ALQUILER',
}
```

---

## 📊 Beneficios de la Desnormalización

### Antes (Sin `_search`):
```javascript
// Buscar contratos en Rawson
const contracts = await Contract.find({ status: 'VIGENTE' });
for (let c of contracts) {
  const property = await Property.findById(c.propiedad_id);
  const locality = await Locality.findById(property.direccion.localidad_id);
  if (locality.nombre === 'Rawson') results.push(c);
}
// ❌ N+1 queries (lento)
```

### Después (Con `_search`):
```javascript
// Buscar contratos en Rawson
const contracts = await Contract.find({ 
  '_search.propiedad_localidad': 'Rawson',
  'status': 'VIGENTE'
});
// ✅ 1 query (rápido, indexado)
```

---

## 🎯 Resumen de la Propuesta

1. ✅ **Preservar `_id`** original para integridad
2. ✅ **Agregar objeto `_search`** con campos desnormalizados:
   - Dirección, provincia, localidad de la propiedad
   - Nombres completos de locador, locatario, fiador
   - IDs directos para filtros rápidos
3. ✅ **Crear índices** en campos `_search` para búsquedas optimizadas
4. ✅ **Normalizar fechas** a UTC puro (ignorar -3h de Legacy)
5. ✅ **Validar dependencias** antes de migrar
6. ✅ **Determinar status** con lógica combinada
7. ✅ **Sincronizar** campos `_search` en la aplicación

**Ventajas:**
- 🚀 Búsquedas 10-100x más rápidas
- 📊 Listados sin lookups
- 🎯 Filtros directos por ubicación/participantes
- 💾 Costo de almacenamiento mínimo (~200 bytes extras)

**Desventajas:**
- 🔄 Requiere sincronización al actualizar Agents/Properties
- 💻 Código adicional en la aplicación (mitigable con middlewares)
