# 🏠 Property Types Enum - Tipos de Propiedad

**Fecha:** 9 de Octubre, 2025  
**Campo:** `caracteristicas.tipo_propiedad`

---

## 📋 Enum Completo

### Backend (NestJS)

```typescript
// src/modules/properties/entities/property.entity.ts
@Prop({
  type: String,
  enum: [
    'departamento',
    'casa',
    'ph',
    'oficina',
    'local_comercial',
    'galpon',
    'lote',
    'quinta',
    'chacra',
    'estudio',
    'loft',
    'duplex',
    'triplex',
  ],
})
tipo_propiedad: string;
```

### Frontend (TypeScript)

```typescript
export enum TypeProperty {
  Departamento = 'departamento', // 🏢 Departamento
  Casa = 'casa', // 🏠 Casa
  PH = 'ph', // 🏘️ PH
  Oficina = 'oficina', // 🏢 Oficina
  LocalComercial = 'local_comercial', // 🏪 Local Comercial
  Galpon = 'galpon', // 🏭 Galpón
  Lote = 'lote', // 🌱 Lote
  Quinta = 'quinta', // 🌳 Quinta
  Chacra = 'chacra', // 🌾 Chacra
  Estudio = 'estudio', // 🏙️ Estudio
  Loft = 'loft', // 🏗️ Loft
  Duplex = 'duplex', // 🏠 Duplex
  Triplex = 'triplex', // 🏠 Triplex
}
```

---

## 📊 Valores Válidos

| Valor Backend     | Label Frontend  | Emoji | Descripción                       |
| ----------------- | --------------- | ----- | --------------------------------- |
| `departamento`    | Departamento    | 🏢    | Unidad en edificio                |
| `casa`            | Casa            | 🏠    | Casa independiente                |
| `ph`              | PH              | 🏘️    | Propiedad Horizontal              |
| `oficina`         | Oficina         | 🏢    | Espacio comercial para oficina    |
| `local_comercial` | Local Comercial | 🏪    | Local para comercio               |
| `galpon`          | Galpón          | 🏭    | Espacio industrial/depósito       |
| `lote`            | Lote            | 🌱    | Terreno sin construcción          |
| `quinta`          | Quinta          | 🌳    | Propiedad rural con jardín        |
| `chacra`          | Chacra          | 🌾    | Propiedad rural para cultivo      |
| `estudio`         | Estudio         | 🏙️    | Ambiente único                    |
| `loft`            | Loft            | 🏗️    | Espacio abierto estilo industrial |
| `duplex`          | Dúplex          | 🏠    | Propiedad de dos pisos            |
| `triplex`         | Tríplex         | 🏠    | Propiedad de tres pisos           |

---

## 💡 Uso en Frontend

### Componente Select

```typescript
import { TypeProperty } from '@/types/property';

const PropertyTypeSelect = () => {
  const propertyTypes = [
    { value: TypeProperty.Departamento, label: '🏢 Departamento' },
    { value: TypeProperty.Casa, label: '🏠 Casa' },
    { value: TypeProperty.PH, label: '🏘️ PH' },
    { value: TypeProperty.Oficina, label: '🏢 Oficina' },
    { value: TypeProperty.LocalComercial, label: '🏪 Local Comercial' },
    { value: TypeProperty.Galpon, label: '🏭 Galpón' },
    { value: TypeProperty.Lote, label: '🌱 Lote' },
    { value: TypeProperty.Quinta, label: '🌳 Quinta' },
    { value: TypeProperty.Chacra, label: '🌾 Chacra' },
    { value: TypeProperty.Estudio, label: '🏙️ Estudio' },
    { value: TypeProperty.Loft, label: '🏗️ Loft' },
    { value: TypeProperty.Duplex, label: '🏠 Dúplex' },
    { value: TypeProperty.Triplex, label: '🏠 Tríplex' },
  ];

  return (
    <select>
      {propertyTypes.map(type => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  );
};
```

### Helper para Labels

```typescript
export const getPropertyTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    departamento: '🏢 Departamento',
    casa: '🏠 Casa',
    ph: '🏘️ PH',
    oficina: '🏢 Oficina',
    local_comercial: '🏪 Local Comercial',
    galpon: '🏭 Galpón',
    lote: '🌱 Lote',
    quinta: '🌳 Quinta',
    chacra: '🌾 Chacra',
    estudio: '🏙️ Estudio',
    loft: '🏗️ Loft',
    duplex: '🏠 Dúplex',
    triplex: '🏠 Tríplex',
  };

  return labels[type] || type;
};
```

---

## 🔍 Ejemplos de Request/Response

### Crear Propiedad

```json
{
  "caracteristicas": {
    "tipo_propiedad": "departamento",
    "dormitorios": 2,
    "banos": 1
  }
}
```

### Actualizar Propiedad

```json
{ "caracteristicas": { "tipo_propiedad": "casa" } }
```

### Response

```json
{
  "_id": "...",
  "caracteristicas": { "tipo_propiedad": "casa", "dormitorios": 3, "banos": 2 }
}
```

---

## ⚠️ Validación

### Backend

El backend validará que el valor enviado esté dentro del enum:

```typescript
@IsEnum([
  'departamento',
  'casa',
  'ph',
  'oficina',
  'local_comercial',
  'galpon',
  'lote',
  'quinta',
  'chacra',
  'estudio',
  'loft',
  'duplex',
  'triplex',
])
tipo_propiedad?: string;
```

### Error si el valor es inválido

```json
{
  "statusCode": 400,
  "message": [
    "tipo_propiedad must be one of the following values: departamento, casa, ph, ..."
  ],
  "error": "Bad Request"
}
```

---

## 📝 Nota Importante

- **Formato:** Todos los valores están en **minúsculas** y usan **snake_case** para valores compuestos
- **Sin tildes:** Usar `galpon` en vez de `galpón`
- **Consistencia:** Backend y frontend deben usar exactamente los mismos valores
- **Case-sensitive:** `departamento` ✅ vs `Departamento` ❌

---

## ✅ Checklist de Integración Frontend

- [ ] Crear enum `TypeProperty` en tipos TypeScript
- [ ] Crear helper `getPropertyTypeLabel()`
- [ ] Actualizar componente de selección de tipo
- [ ] Actualizar validaciones de formularios
- [ ] Probar crear propiedad con cada tipo
- [ ] Verificar que los labels se muestran correctamente
- [ ] Actualizar tests unitarios si existen
