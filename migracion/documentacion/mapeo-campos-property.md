# Mapeo de Campos: Legacy → V3 (Property)

## Análisis Comparativo

### Campos Legacy → V3

| Legacy | V3 | Transformación |
|:-------|:---|:---------------|
| `_id` | `_id` | **Preservar** (crítico) |
| `address` (string) | `direccion.calle` | String simple → Objeto complejo |
| `state`, `city` | `direccion.provincia_id`, `direccion.localidad_id` | Lookup como en Agents |
| `owner[]._id` | `propietarios_ids[]` | Array de objetos → Array de ObjectIds |
| - | `identificador_interno` | Generar: `PROP-{últimos 8 del _id}` |
| `description[]` | `caracteristicas.*` | Parsear ambientes → Extraer dormitorios, baños |
| `description[]` | `_legacyData.description` | Preservar original |
| `inventory[]` | `_legacyData.inventory` | Preservar original |
| `specs` | `_legacyData.specs` | Preservar original |
| `associatedServices[]` | `servicios_impuestos[]` | Transformar estructura |
| `leaseAgreement` | `contrato_vigente_id` | Preservar ObjectId |
| `tenant` | - | No migrar (está en el contrato) |
| `active` | `status` | true → "DISPONIBLE", false → "INACTIVA" |
| `availableAt` | - | No migrar directamente |
| `img`, `imgCover` | `imagenes[]`, `img_cover_url` | Procesar URLs |

---

## Transformaciones Complejas

### 1. Identificador Interno
```typescript
identificador_interno: `PROP-${legacyProperty._id.toString().slice(-8).toUpperCase()}`
// Ejemplo: "PROP-E326124A"
```

### 2. Direccion (objeto completo)
```typescript
direccion: {
  calle: legacyProperty.address || 'Sin dirección',
  numero: '',
  piso_dpto: '',
  provincia_id: lookupProvince(legacyProperty.state?.id),
  localidad_id: lookupLocality(legacyProperty.city?.id),
  codigo_postal: '',
  latitud: null,
  longitud: null
}
```

### 3. Propietarios
```typescript
propietarios_ids: legacyProperty.owner?.map(o => toObjectId(o._id)) || []
```

### 4. Servicios/Impuestos
```typescript
servicios_impuestos: legacyProperty.associatedServices?.map(svc => ({
  proveedor_id: toObjectId(svc.serviceCompany._id),
  identificador_servicio: svc.id,
  porcentaje_aplicacion: svc.ratio,
  origen: mapSource(svc.paymentSource),  // "Locatario" → "LOCATARIO"
  destino: mapTarget(svc.paymentTarget), // "Prestador" → "PRESTADOR"
})) || []
```

Mapeo de origen/destino:
```typescript
{
  "Locatario": "LOCATARIO",
  "Locador": "LOCADOR",
  "Prestador": "PRESTADOR",
  "Propietario": "LOCADOR"
}
```

### 5. Características
Extraer de `description[]`:
```typescript
const dormitorios = description.find(d => 
  d.ambiente.toLowerCase().includes('dormitorio')
)?.cantidad || null;

const banos = description.find(d => 
  d.ambiente.toLowerCase().includes('baño')
)?.cantidad || null;

caracteristicas: {
  tipo_propiedad: 'departamento',  // Por defecto o inferir
  dormitorios,
  banos,
  metraje_total: null,
  metraje_cubierto: null,
  antiguedad_anos: null,
  orientacion: null
}
```

### 6. Estado Ocupacional
```typescript
estado_ocupacional: legacyProperty.leaseAgreement ? 'ALQUILADA' : 'DISPONIBLE'
contrato_vigente_id: legacyProperty.leaseAgreement || null
```

### 7. Status
```typescript
status: legacyProperty.active !== false ? 'DISPONIBLE' : 'INACTIVA'
```

---

## Campos con Valores por Defecto

```typescript
{
  identificador_tributario: '',
  titulo: '',
  descripcion: '',
  consorcio_nombre: '',
  tipo_expensas: null,
  img_cover_url: '',
  valor_venta: null,
  valor_alquiler: null,
  publicar_para_venta: false,
  publicar_para_alquiler: false,
  proposito: 'VIVIENDA',
  imagenes: [],
  usuario_creacion_id: null,
}
```

---

## Legacy Data (Preservación)

```typescript
_legacyData: {
  inventory: legacyProperty.inventory || [],
  description: legacyProperty.description || [],
  specs: legacyProperty.specs,
  createdAt: legacyProperty.createdAt,
}
```

---

## Migration Notes

Agregar notas sobre:
- Si se usó ubicación por defecto
- Si faltaron propietarios
- Si no hay servicios asociados
- Si se infirieron características

---

## Dependencias

**CRÍTICO:** Esta fase requiere que **Agents** ya estén migrados porque:
- `propietarios_ids` debe referenciar agents migrados
- `servicios_impuestos[].proveedor_id` debe referenciar agents/proveedores migrados

**Validación previa:**
- Verificar que todos los `owner[]._id` existen en V3 Agents
- Verificar que todos los `associatedServices[].serviceCompany._id` existen en V3 Agents
