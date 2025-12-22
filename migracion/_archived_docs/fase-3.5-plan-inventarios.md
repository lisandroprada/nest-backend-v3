# Plan de Migración de Inventarios Legacy → V3

## 📋 Contexto

**Bloqueador identificado:** Los contratos en V3 requieren `inventory_version_id` para ser activados, pero los contratos migrados no tienen inventarios asociados.

**Solución:** Migrar los inventarios Legacy antes de generar asientos contables.

---

## 🏗️ Estructura de Inventarios en V3

### Modelo Jerárquico

```
PropertyInventory (1 por propiedad)
└── InventoryVersion[] (múltiples versiones)
    └── InventoryItemSnapshot[] (items en esa versión)
```

### Entidades Principales

**1. `PropertyInventory`**
- `property_id`: ObjectId → referencia a Property
- `current_version_id`: ObjectId → versión act iva
- `versions[]`: ObjectId[] → todas las versiones

**2. `InventoryVersion`**
- `property_inventory_id`: ObjectId → referencia a PropertyInventory
- `version_number`: Number → 1, 2, 3...
- `description`: String → ej. "Inventario Inicial Legacy"
- `status`: DRAFT | ACTIVE | ARCHIVED
- `items[]`: InventoryItemSnapshot[]
- `created_by`: ObjectId → usuario
- `created_at`: Date

**3. `InventoryItemSnapshot` (embebido)**
- `nombre`: String
- `cantidad`: Number
- `ambiente`: String
- `estado`: String  
- `observaciones`: String
- `fotos_urls`: String[]

---

## 📊 Mapeo Legacy → V3

### Estructura Legacy (en `properties.inventory[]`)
```javascript
{
  "item": "Puerta de ingreso de chapa...",
  "cantidad": 1,
  "ambiente": "Puerta de acceso",
  "estado": "Regular"
}
```

### Transformación a V3
```javascript
// InventoryItemSnapshot
{
  "nombre": "Puerta de ingreso de chapa...",  // ← item
  "cantidad": 1,
  "ambiente": "Puerta de acceso",
  "estado": "Regular",
  "observaciones": "",
  "fotos_urls": []
}
```

---

## ✅ Plan de Migración

### Fase 3.5: Migración de Inventarios

#### Paso 1: Identificar Propiedades con Inventario
```typescript
const legacyProperties = await legacyDb.collection('properties').find({
  inventory: { $exists: true, $ne: null, $not: { $size: 0 } }
}).toArray();
```

**Estimación:** ~200-300 propiedades de 448 total

#### Paso 2: Para Cada Propiedad con Inventario

**2.1. Crear `PropertyInventory`**
```typescript
const propertyInventory = {
  property_id: legacyProperty._id, // MISMO _id que en V3
  current_version_id: null, // Se asignará después
  versions: [],
};
```

**2.2. Crear `InventoryVersion` (versión 1 - inicial)**
```typescript
const inventoryVersion = {
  property_inventory_id: propertyInventory._id,
  version_number: 1,
  description: "Inventario Inicial (migrado desde Legacy)",
  status: "ACTIVE",
  created_at: new Date(),
  created_by: null, // o usuario admin
  items: legacyProperty.inventory.map(item => ({
    nombre: item.item,
    cantidad: item.cantidad || 1,
    ambiente: item.ambiente || "Sin especificar",
    estado: item.estado || "Regular",
    observaciones: "",
    fotos_urls: [],
  }))
};
```

**2.3. Actualizar `PropertyInventory` con versión creada**
```typescript
propertyInventory.current_version_id = inventoryVersion._id;
propertyInventory.versions.push(inventoryVersion._id);
```

#### Paso 3: Asociar Inventarios a Contratos

Para cada contrato cuya propiedad tiene inventario:

```typescript
await v3Db.collection('contracts').updateOne(
  { propiedad_id: property_id },
  {
    $set: {
      inventory_version_id: inventoryVersion._id,
      inventario_actualizado: true,
      fotos_inventario: ['inventario-legacy-migrado.jpg'], // Dummy
    }
  }
);
```

#### Paso 4: Contratos SIN Inventario

**Opción A:** Bypass temporal de validación
- Modificar `contracts.service.ts` para NO validar `inventory_version_id` si el contrato tiene `_legacyData` (es migrado)

**Opción B:** Crear inventario vacío
- Crear PropertyInventory + InventoryVersion con `items: []`
- Marcar como "Sin inventario registrado"

---

## 📁 Estructura de Scripts

```
migracion/scripts/fase-3.5-inventarios/
├── 01-analyze-inventories.ts        # Análisis: cuántas props tienen inventario
├── 02-migrate-inventories.ts        # Migración principal
└── 03-associate-to-contracts.ts     # Asociar inventory_version_id
```

---

## 🔄 Flujo Completo Actualizado

### Orden de Ejecución

1. ✅ **Fase 1:** Migrar Agentes (1,625)
2. ✅ **Fase 2:** Migrar Propiedades (448)
3. ✅ **Fase 3:** Migrar Contratos (862)
4. **🆕 Fase 3.5:** Migrar Inventarios (~200-300)
5. **Fase 4:** Generar Asientos Contables (862 contratos)
6. **Fase 5:** Migrar Datos Contables Históricos

---

## 📝 Detalles de Implementación

### Script: `02-migrate-inventories.ts`

```typescript
interface InventoryMigrationResult {
  total_properties: number;
  properties_with_inventory: number;
  inventories_created: number;
  versions_created: number;
  contracts_updated: number;
  skipped: number;
}

async function migrateInventories() {
  // 1. Obtener propiedades Legacy con inventario
  const legacyProps = await legacyDb.collection('properties').find({
    inventory: { $exists: true, $ne: [] }
  }).toArray();

  for (const legacyProp of legacyProps) {
    // 2. Verificar que la propiedad exista en V3
    const v3Property = await v3Db.collection('properties').findOne({
      _id: new ObjectId(legacyProp._id)
    });
    
    if (!v3Property) continue;

    // 3. Crear PropertyInventory
    const propertyInventory = await createPropertyInventory(legacyProp._id);

    // 4. Crear InventoryVersion con items migrados
    const inventoryVersion = await createInventoryVersion(
      propertyInventory._id,
      legacyProp.inventory
    );

    // 5. Actualizar PropertyInventory.current_version_id
    await updatePropertyInventory(propertyInventory._id, inventoryVersion._id);

    // 6. Asociar a contratos de esta propiedad
    await associateToContracts(legacyProp._id, inventoryVersion._id);
  }
}
```

---

## ⚠️ Casos Especiales

### 1. Propiedades SIN Inventario en Legacy
- No crear PropertyInventory
- Dejar `inventory_version_id: null` en contratos
- **Bypass validación** en `contracts.service.ts` para contratos migrados

### 2. Múltiples Contratos por Propiedad
- Todos los contratos de la misma propiedad apuntan a la MISMA `InventoryVersion` (versión 1)
- En el futuro, al crear un nuevo contrato, se crea una nueva versión

### 3. Campos Faltantes en Legacy
- `cantidad`: Default = 1
- `ambiente`: Default = "Sin especificar"
- `estado`: Default = "Regular"

---

## 🎯 Resultados Esperados

**Después de Fase 3.5:**
- ✅ ~200-300 `PropertyInventory` creados
- ✅ ~200-300 `InventoryVersion` creados (versión 1 cada uno)
- ✅ ~500-700 contratos actualizados con `inventory_version_id`
- ✅ ~162-362 contratos sin inventario (quedancon `inventory_version_id: null`)

**Impacto en Fase 4:**
- Los contratos CON inventario se activarán normalmente
- contratos SIN inventario: bypass de validación (temporal)
