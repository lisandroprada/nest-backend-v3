# Backend Schema Issue - Missing Fields in Property.caracteristicas

## ✅ ESTADO: RESUELTO

**Fecha Reporte:** Octubre 9, 2025  
**Fecha Resolución:** Octubre 9, 2025  
**Ver solución:** `BACKEND_SCHEMA_FIX_SUMMARY.md`

---

## 🐛 Problema Detectado (RESUELTO)

Al editar `tipo_propiedad` de "Apartamento" a "Casa" en el frontend, el backend **NO guarda ni devuelve** este campo.

### Request PATCH Enviado

```json
{
  "caracteristicas": {
    "tipo_propiedad": "Casa", // ✅ Enviado correctamente
    "dormitorios": null,
    "banos": null,
    "metraje_total": null,
    "metraje_cubierto": null,
    "antiguedad_anos": null,
    "orientacion": null,
    "amenities": []
  }
}
```

### Response Recibida del Backend

```json
{
  "caracteristicas": {
    // ❌ tipo_propiedad NO está en la respuesta
    "dormitorios": null,
    "banos": null,
    "metraje_total": null,
    "metraje_cubierto": null,
    "antiguedad_anos": null,
    "orientacion": null,
    "amenities": []
  }
}
```

## 🔍 Análisis

### Campos Faltantes en Response

Comparando lo que enviamos vs lo que recibimos:

| Campo              | Enviado         | Recibido   | Estado       |
| ------------------ | --------------- | ---------- | ------------ |
| `tipo_propiedad`   | ✅ "Casa"       | ❌ Missing | **PROBLEMA** |
| `dormitorios`      | ✅ null         | ✅ null    | OK           |
| `banos`            | ✅ null         | ✅ null    | OK           |
| `ambientes`        | ✅ (en edición) | ❌ Missing | **PROBLEMA** |
| `metraje_total`    | ✅ null         | ✅ null    | OK           |
| `metraje_cubierto` | ✅ null         | ✅ null    | OK           |
| `antiguedad_anos`  | ✅ null         | ✅ null    | OK           |
| `cochera`          | ✅ (en edición) | ❌ Missing | **PROBLEMA** |
| `orientacion`      | ✅ null         | ✅ null    | OK           |
| `estado_general`   | ✅ (en edición) | ❌ Missing | **PROBLEMA** |
| `amenities`        | ✅ []           | ✅ []      | OK           |

### Campos que Faltan en el Backend

1. **`tipo_propiedad`** - Tipo de propiedad (Apartamento, Casa, Terreno, etc.)
2. **`ambientes`** - Número de ambientes
3. **`cochera`** - Número de cocheras
4. **`estado_general`** - Estado (EXCELENTE, BUENO, REGULAR, etc.)

## 🎯 Causa Raíz

El **schema de Mongoose en el backend** no incluye estos campos en el subdocumento `caracteristicas`.

### Schema Actual (Incompleto)

```typescript
// backend/src/properties/schemas/property.schema.ts
caracteristicas: {
  dormitorios: Number,
  banos: Number,
  metraje_total: Number,
  metraje_cubierto: Number,
  antiguedad_anos: Number,
  orientacion: String,
  amenities: [String],
  // ❌ Faltan: tipo_propiedad, ambientes, cochera, estado_general
}
```

### Schema Esperado (Completo)

```typescript
caracteristicas: {
  tipo_propiedad: {
    type: String,
    enum: ['Apartamento', 'Casa', 'Terreno', 'Local', 'Oficina', 'Galpón', 'Campo', 'Otro']
  },
  dormitorios: Number,
  banos: Number,
  ambientes: Number,  // ← AGREGAR
  metraje_total: Number,
  metraje_cubierto: Number,
  antiguedad_anos: Number,
  cochera: Number,  // ← AGREGAR
  orientacion: {
    type: String,
    enum: ['NORTE', 'SUR', 'ESTE', 'OESTE', 'NORESTE', 'NOROESTE', 'SURESTE', 'SUROESTE']
  },
  estado_general: {
    type: String,
    enum: ['EXCELENTE', 'MUY_BUENO', 'BUENO', 'REGULAR', 'MALO', 'A_REFACCIONAR']
  },  // ← AGREGAR
  amenities: [String],
}
```

## ✅ Solución Implementada

### Workaround Frontend (Temporal)

Mientras se arregla el backend, implementamos un **merge manual** de los campos editados:

```typescript
// PropertyDetail.tsx - handleSave()
const updatedProperty = await propertiesService.updateProperty(
  property._id,
  updateDto,
);

// WORKAROUND: El backend no devuelve algunos campos de caracteristicas
// Mantener los valores editados si el backend no los devuelve
const mergedProperty = {
  ...updatedProperty,
  caracteristicas: {
    ...updatedProperty.caracteristicas,
    // Preservar campos que el backend no devuelve
    tipo_propiedad:
      editedProperty.caracteristicas?.tipo_propiedad ||
      updatedProperty.caracteristicas?.tipo_propiedad,
    ambientes:
      editedProperty.caracteristicas?.ambientes ??
      updatedProperty.caracteristicas?.ambientes,
    cochera:
      editedProperty.caracteristicas?.cochera ??
      updatedProperty.caracteristicas?.cochera,
    estado_general:
      editedProperty.caracteristicas?.estado_general ||
      updatedProperty.caracteristicas?.estado_general,
  },
};

setProperty({
  ...mergedProperty,
  completitud: calculateCompleteness(mergedProperty),
});
```

**Comportamiento:**

- ✅ El usuario ve el cambio inmediatamente en el frontend
- ✅ Los valores se mantienen después de guardar
- ⚠️ Si recarga la página, los valores se pierden (porque el backend no los guardó)
- 🔄 Temporal hasta que se arregle el backend

## 🚀 Solución Definitiva (Backend)

### Paso 1: Actualizar Schema de Mongoose

Archivo: `backend/src/properties/schemas/property.schema.ts`

```typescript
@Schema()
export class Property {
  // ... otros campos

  @Prop({
    type: {
      tipo_propiedad: {
        type: String,
        enum: [
          'Apartamento',
          'Casa',
          'Terreno',
          'Local',
          'Oficina',
          'Galpón',
          'Campo',
          'Otro',
        ],
      },
      dormitorios: { type: Number, default: null },
      banos: { type: Number, default: null },
      ambientes: { type: Number, default: null },
      metraje_total: { type: Number, default: null },
      metraje_cubierto: { type: Number, default: null },
      antiguedad_anos: { type: Number, default: null },
      cochera: { type: Number, default: null },
      orientacion: {
        type: String,
        enum: [
          'NORTE',
          'SUR',
          'ESTE',
          'OESTE',
          'NORESTE',
          'NOROESTE',
          'SURESTE',
          'SUROESTE',
        ],
      },
      estado_general: {
        type: String,
        enum: [
          'EXCELENTE',
          'MUY_BUENO',
          'BUENO',
          'REGULAR',
          'MALO',
          'A_REFACCIONAR',
        ],
      },
      amenities: [{ type: String }],
    },
    _id: false,
  })
  caracteristicas: {
    tipo_propiedad?: string;
    dormitorios?: number;
    banos?: number;
    ambientes?: number;
    metraje_total?: number;
    metraje_cubierto?: number;
    antiguedad_anos?: number;
    cochera?: number;
    orientacion?: string;
    estado_general?: string;
    amenities?: string[];
  };
}
```

### Paso 2: Actualizar DTO

Archivo: `backend/src/properties/dto/update-property.dto.ts`

```typescript
export class UpdatePropertyDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CaracteristicasDto)
  caracteristicas?: CaracteristicasDto;
}

class CaracteristicasDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'Apartamento',
    'Casa',
    'Terreno',
    'Local',
    'Oficina',
    'Galpón',
    'Campo',
    'Otro',
  ])
  tipo_propiedad?: string;

  @IsOptional()
  @IsNumber()
  dormitorios?: number;

  @IsOptional()
  @IsNumber()
  banos?: number;

  @IsOptional()
  @IsNumber()
  ambientes?: number;

  @IsOptional()
  @IsNumber()
  metraje_total?: number;

  @IsOptional()
  @IsNumber()
  metraje_cubierto?: number;

  @IsOptional()
  @IsNumber()
  antiguedad_anos?: number;

  @IsOptional()
  @IsNumber()
  cochera?: number;

  @IsOptional()
  @IsString()
  @IsIn([
    'NORTE',
    'SUR',
    'ESTE',
    'OESTE',
    'NORESTE',
    'NOROESTE',
    'SURESTE',
    'SUROESTE',
  ])
  orientacion?: string;

  @IsOptional()
  @IsString()
  @IsIn(['EXCELENTE', 'MUY_BUENO', 'BUENO', 'REGULAR', 'MALO', 'A_REFACCIONAR'])
  estado_general?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
```

### Paso 3: Verificar Migration

Si hay datos existentes, crear migración para agregar campos faltantes con valores por defecto.

## 🧪 Testing

### Verificar Fix en Backend

1. **Actualizar schema y DTO**
2. **Reiniciar backend**: `npm run start:dev`
3. **Probar PATCH desde frontend**
4. **Verificar response** incluye todos los campos:

```bash
curl -X PATCH http://localhost:3050/api/v1/properties/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "caracteristicas": {
      "tipo_propiedad": "Casa",
      "ambientes": 3,
      "cochera": 2,
      "estado_general": "BUENO"
    }
  }'
```

**Response esperada debe incluir:**

```json
{
  "caracteristicas": {
    "tipo_propiedad": "Casa",  // ✅ Ahora debe aparecer
    "ambientes": 3,            // ✅ Ahora debe aparecer
    "cochera": 2,              // ✅ Ahora debe aparecer
    "estado_general": "BUENO", // ✅ Ahora debe aparecer
    ...
  }
}
```

5. **Recargar página** en frontend y verificar que los valores persisten

## 📝 Archivos Afectados

### Frontend (Workaround Temporal)

- `pages/PropertyDetail.tsx`: Agregado merge manual de campos faltantes

### Backend (Solución Definitiva)

- `backend/src/properties/schemas/property.schema.ts`: Agregar campos faltantes
- `backend/src/properties/dto/update-property.dto.ts`: Actualizar validaciones
- `backend/src/properties/dto/create-property.dto.ts`: Actualizar validaciones (si aplica)

## ⚠️ Importante

**El workaround frontend es TEMPORAL**. Los valores editados se perderán al recargar la página hasta que el backend esté arreglado.

**Acción requerida:** Actualizar el schema del backend lo antes posible para persistir correctamente todos los campos.

## ✅ Checklist de Verificación

- [ ] Schema de Mongoose actualizado con todos los campos
- [ ] DTOs actualizados con validaciones
- [ ] Backend reiniciado
- [ ] Prueba PATCH desde Postman/curl incluye campos en response
- [ ] Prueba desde frontend: editar → guardar → recargar → valores persisten
- [ ] Remover workaround frontend una vez confirmado el fix del backend
- [ ] Actualizar documentación del API

## 💡 Lección Aprendida

**Frontend y Backend deben estar sincronizados en sus schemas**. Implementar:

1. Shared types entre frontend/backend (TypeScript)
2. Validación de contratos con OpenAPI/Swagger
3. Tests de integración que validen responses completas
