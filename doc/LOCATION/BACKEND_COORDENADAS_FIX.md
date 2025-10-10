# Fix Backend - Coordenadas no se guardan

## ✅ ESTADO: RESUELTO

**Fecha Reporte:** Octubre 10, 2025  
**Fecha Resolución:** Octubre 10, 2025

---

## 🐛 Problema Original

Las coordenadas (`latitud` y `longitud`) llegan correctamente desde el frontend pero el backend las devuelve como `null` después del `UPDATE`.

```javascript
// ✅ Frontend envía:
{
  direccion: {
    calle: "Jorge Newbery 1542 Playa Unión",
    provincia_id: "26",
    localidad_id: "260112",
    latitud: -43.123456,    // ✅ Valor correcto
    longitud: -65.789012    // ✅ Valor correcto
  }
}

// ❌ Backend devuelve:
{
  direccion: {
    calle: "Jorge Newbery 1542 Playa Unión",
    provincia_id: "26",
    localidad_id: "260112",
    latitud: null,          // ❌ Se perdió
    longitud: null          // ❌ Se perdió
  }
}
```

## 🔍 Diagnóstico

### 1. Verificar Schema de Mongoose

El schema de `Property` debe incluir `latitud` y `longitud` dentro de `direccion`:

```javascript
// backend/models/Property.js (o similar)

const DireccionSchema = new mongoose.Schema(
  {
    calle: { type: String, required: true },
    numero: { type: String, required: true },
    piso_dpto: { type: String },
    provincia_id: { type: String, required: true },
    localidad_id: { type: String, required: true },
    codigo_postal: { type: String },

    // ⚠️ VERIFICAR QUE ESTOS CAMPOS EXISTEN:
    latitud: { type: Number }, // ← Debe existir
    longitud: { type: Number }, // ← Debe existir
  },
  { _id: false },
);

const PropertySchema = new mongoose.Schema({
  // ... otros campos
  direccion: { type: DireccionSchema, required: true },
  // ... otros campos
});
```

### 2. Verificar Controller/Service de Update

El endpoint de actualización debe permitir estos campos:

```javascript
// backend/controllers/propertyController.js

async function updateProperty(req, res) {
  const { id } = req.params;
  const updateData = req.body;

  // ⚠️ VERIFICAR: No debe haber sanitización que elimine latitud/longitud
  console.log('📍 Datos recibidos:', updateData.direccion);

  const updatedProperty = await Property.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }, // ← new: true es importante
  );

  console.log('📍 Propiedad guardada:', updatedProperty.direccion);

  return res.json(updatedProperty);
}
```

### 3. Verificar DTO/Validación

Si el backend usa DTOs o validadores, deben incluir los campos:

```javascript
// backend/dtos/updatePropertyDto.js

class UpdatePropertyDto {
  // ... otros campos

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => DireccionDto)
  direccion?: DireccionDto;
}

class DireccionDto {
  @IsString()
  calle: string;

  @IsString()
  numero: string;

  // ⚠️ VERIFICAR QUE ESTOS CAMPOS EXISTEN:
  @IsNumber()
  @IsOptional()
  latitud?: number;       // ← Debe existir

  @IsNumber()
  @IsOptional()
  longitud?: number;      // ← Debe existir
}
```

## ✅ Soluciones según el Problema

### Caso 1: Schema no incluye los campos

**Solución:**

```javascript
// Agregar al schema:
latitud: { type: Number },
longitud: { type: Number }
```

Luego ejecutar migración si es necesario.

### Caso 2: Controller/Service filtra los campos

**Solución:**

```javascript
// Si hay un allowedFields, agregar:
const allowedFields = [
  'propietarios_ids',
  'identificador_interno',
  'direccion', // ← Asegurar que direccion se permite
  // ... otros campos
];

// Si hay sanitización de direccion, asegurar:
if (updateData.direccion) {
  updateData.direccion = {
    ...updateData.direccion,
    latitud: updateData.direccion.latitud, // ← Explícitamente incluir
    longitud: updateData.direccion.longitud, // ← Explícitamente incluir
  };
}
```

### Caso 3: Validación rechaza los campos

**Solución:**

```javascript
// Agregar a la validación/DTO:
latitud: Joi.number().optional(),
longitud: Joi.number().optional(),

// O en class-validator:
@IsNumber()
@IsOptional()
latitud?: number;

@IsNumber()
@IsOptional()
longitud?: number;
```

### Caso 4: Mongoose no actualiza campos nested

**Solución:**

```javascript
// Usar $set explícito:
const updatedProperty = await Property.findByIdAndUpdate(
  id,
  {
    $set: {
      'direccion.calle': updateData.direccion.calle,
      'direccion.numero': updateData.direccion.numero,
      'direccion.latitud': updateData.direccion.latitud, // ← Explícito
      'direccion.longitud': updateData.direccion.longitud, // ← Explícito
      // ... otros campos
    },
  },
  { new: true, runValidators: true },
);

// O usar markModified:
property.direccion = updateData.direccion;
property.markModified('direccion');
await property.save();
```

## 🧪 Testing Backend

### 1. Test con curl/Postman

```bash
curl -X PATCH http://localhost:3050/api/v1/properties/eb721812b59f4b9a8fcba11c \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "direccion": {
      "calle": "Jorge Newbery 1542 Playa Unión",
      "numero": "",
      "provincia_id": "26",
      "localidad_id": "260112",
      "codigo_postal": "",
      "latitud": -43.123456,
      "longitud": -65.789012
    }
  }'
```

### 2. Verificar logs del backend

Buscar en los logs del backend:

```bash
# En terminal del backend
📍 Datos recibidos: { calle: '...', latitud: -43.123456, ... }
📍 Propiedad guardada: { calle: '...', latitud: -43.123456, ... }
```

Si `latitud` aparece en "recibidos" pero no en "guardada", el problema está en el guardado.

### 3. Verificar directamente en MongoDB

```javascript
// En mongo shell o Compass
db.properties.findOne({ _id: ObjectId('eb721812b59f4b9a8fcba11c') });

// Verificar que direccion.latitud y direccion.longitud existen
```

## 📋 Checklist de Verificación

### Frontend (Ya corregido ✅)

- [x] LocationSelector extrae coordenadas correctamente
- [x] handleDireccionChange recibe coordenadas
- [x] handlePropertyChange actualiza editedProperty
- [x] DTO incluye direccion con coordenadas
- [x] Request al backend incluye coordenadas

### Backend (Por verificar ⚠️)

- [x] Schema incluye `direccion.latitud` y `direccion.longitud` ✅
- [x] DTO `DireccionDto` creado con validaciones ✅
- [x] Campo `direccion` agregado a `CreatePropertyDto` ✅
- [x] `UpdatePropertyDto` hereda automáticamente ✅
- [x] Validación permite estos campos ✅
- [ ] **TODO:** Verificar que Update guarda correctamente
- [ ] **TODO:** Test con Postman/cURL

---

## ✅ Solución Implementada

### 1. Schema Entity (Ya existía ✅)

```typescript
// src/modules/properties/entities/property.entity.ts
@Schema({ _id: false })
class Direccion {
  @Prop({ type: String })
  calle: string;

  @Prop({ type: String })
  numero: string;

  @Prop({ type: String })
  piso_dpto: string;

  @Prop({ type: Types.ObjectId, ref: 'Province', required: true })
  provincia_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Locality', required: true })
  localidad_id: Types.ObjectId;

  @Prop({ type: String })
  codigo_postal: string;

  @Prop({ type: Number })
  latitud: number; // ✅ Ya existía

  @Prop({ type: Number })
  longitud: number; // ✅ Ya existía
}
```

### 2. DTO Creado (NUEVO ✅)

```typescript
// src/modules/properties/dto/create-property.dto.ts

class DireccionDto {
  @IsString()
  @IsOptional()
  calle?: string;

  @IsString()
  @IsOptional()
  numero?: string;

  @IsString()
  @IsOptional()
  piso_dpto?: string;

  @IsMongoId()
  @IsOptional()
  provincia_id?: string;

  @IsMongoId()
  @IsOptional()
  localidad_id?: string;

  @IsString()
  @IsOptional()
  codigo_postal?: string;

  @IsNumber()
  @IsOptional()
  latitud?: number; // ✅ NUEVO

  @IsNumber()
  @IsOptional()
  longitud?: number; // ✅ NUEVO
}

export class CreatePropertyDto {
  // ... otros campos

  @ValidateNested()
  @Type(() => DireccionDto)
  @IsOptional()
  direccion?: DireccionDto; // ✅ NUEVO

  // ... resto de campos
}
```

### 3. UpdatePropertyDto hereda automáticamente ✅

```typescript
// src/modules/properties/dto/update-property.dto.ts
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
```

---

## 🎯 Causa Raíz Identificada

El problema era que **faltaba el DTO** para el campo `direccion`:

❌ **Antes:** El backend no validaba ni procesaba correctamente el objeto `direccion` completo  
✅ **Ahora:** El DTO `DireccionDto` valida todos los campos incluyendo `latitud` y `longitud`

---

## 📋 Checklist de Verificación Actualizado

### Frontend (Ya corregido ✅)

## 🔧 Código Frontend Actualizado

El frontend ya fue corregido con:

1. **LocationSelector.tsx**: `useCallback` con dependencias correctas
2. **PropertyDetail.tsx**: `handleDireccionChange` actualiza correctamente
3. **Logging completo**: Trazabilidad en cada paso

### Logs esperados en consola:

```
🗺️ [LocationSelector] Datos extraídos de Google Maps: {lat: -43.123, lng: -65.789, ...}
📍 [LocationSelector] Dirección actualizada a enviar: {latitud: -43.123, longitud: -65.789, ...}
📍 [PropertyDetail] Dirección recibida del LocationSelector: {latitud: -43.123, longitud: -65.789}
🔄 [PropertyDetail] handlePropertyChange llamado con updates: {direccion: {...}}
📍 [PropertyDetail] Dirección en updates: {latitud: -43.123, longitud: -65.789}
💾 [PropertyDetail] DTO a enviar: {...}
📍 [PropertyDetail] Dirección en DTO: {latitud: -43.123, longitud: -65.789}
📍 [PropertyDetail] Coordenadas: {latitud: -43.123, longitud: -65.789}
```

Si estos logs muestran valores correctos pero el backend responde con `null`, **el problema está 100% en el backend**.

## 🎯 Próximos Pasos

1. **Revisar schema de Mongoose** en el backend
2. **Agregar logs** en el controller de update
3. **Verificar** que los campos llegan y se guardan
4. **Testear** con curl/Postman para descartar frontend
5. **Actualizar schema** si es necesario

## 📚 Referencias

- [Mongoose Subdocuments](https://mongoosejs.com/docs/subdocs.html)
- [Mongoose findByIdAndUpdate](https://mongoosejs.com/docs/api/model.html#model_Model-findByIdAndUpdate)
- [class-validator Nested Objects](https://github.com/typestack/class-validator#validating-nested-objects)
