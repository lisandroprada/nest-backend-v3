# 📝 Campos Titulo y Descripción - Property Entity

**Fecha:** 10 de Octubre, 2025  
**Cambio:** Agregados campos `titulo` y `descripcion`

---

## 🎯 Nuevos Campos

### 1. **`titulo`** (Opcional)

- **Tipo:** `string`
- **Descripción:** Título personalizado de la propiedad
- **Validación:** Opcional
- **Comportamiento:** Si no se proporciona, se genera automáticamente desde la dirección

### 2. **`descripcion`** (Opcional)

- **Tipo:** `string`
- **Descripción:** Descripción detallada de la propiedad
- **Validación:** Opcional
- **Uso:** Texto libre para describir la propiedad

### 3. **`titulo_display`** (Virtual)

- **Tipo:** `virtual` (calculado)
- **Descripción:** Campo virtual que devuelve el título personalizado o genera uno desde la dirección
- **Lógica:**
  1. Si existe `titulo`, devuelve ese valor
  2. Si no existe `titulo` pero hay `direccion`, genera: `"Calle Numero Piso/Dpto"`
  3. Si no hay ni título ni dirección, devuelve: `"Propiedad sin título"`

---

## 📋 Schema Entity

```typescript
// Campo titulo (opcional)
@Prop({ type: String })
titulo: string;

// Campo descripcion (opcional)
@Prop({ type: String })
descripcion: string;

// Virtual para título con fallback
PropertySchema.virtual('titulo_display').get(function () {
  if (this.titulo) {
    return this.titulo;
  }

  if (this.direccion) {
    const partes = [];
    if (this.direccion.calle) partes.push(this.direccion.calle);
    if (this.direccion.numero) partes.push(this.direccion.numero);
    if (this.direccion.piso_dpto) partes.push(this.direccion.piso_dpto);

    return partes.length > 0 ? partes.join(' ') : 'Propiedad sin título';
  }

  return 'Propiedad sin título';
});
```

---

## 📋 DTO

```typescript
export class CreatePropertyDto {
  // ... otros campos

  @IsString()
  @IsOptional()
  titulo?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  // ... resto de campos
}
```

---

## 💡 Ejemplos de Uso

### Crear Propiedad con Título Personalizado

```json
{
  "propietarios_ids": ["..."],
  "identificador_interno": "PROP-001",
  "titulo": "Hermoso Departamento en Recoleta",
  "descripcion": "Departamento de 3 ambientes con excelente luz natural...",
  "direccion": {
    "calle": "Av. Santa Fe",
    "numero": "1234",
    "piso_dpto": "5° A"
  }
}
```

**Response:**

```json
{
  "_id": "...",
  "titulo": "Hermoso Departamento en Recoleta",
  "titulo_display": "Hermoso Departamento en Recoleta",
  "descripcion": "Departamento de 3 ambientes con excelente luz natural...",
  "direccion": {
    "calle": "Av. Santa Fe",
    "numero": "1234",
    "piso_dpto": "5° A"
  }
}
```

---

### Crear Propiedad SIN Título (usa dirección automáticamente)

```json
{
  "propietarios_ids": ["..."],
  "identificador_interno": "PROP-002",
  "descripcion": "Casa amplia con jardín...",
  "direccion": { "calle": "Cerrito", "numero": "456" }
}
```

**Response:**

```json
{
  "_id": "...",
  "titulo": null,
  "titulo_display": "Cerrito 456", // ← Generado automáticamente
  "descripcion": "Casa amplia con jardín...",
  "direccion": { "calle": "Cerrito", "numero": "456" }
}
```

---

### Actualizar Solo el Título

```bash
curl -X PATCH http://localhost:3050/api/v1/properties/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "titulo": "Nuevo título personalizado"
  }'
```

---

## 🎨 Uso en Frontend

### Mostrar Título

```typescript
interface Property {
  _id: string;
  titulo?: string;
  titulo_display: string;  // ← Siempre disponible
  descripcion?: string;
  // ... otros campos
}

// Componente
const PropertyCard = ({ property }: { property: Property }) => {
  return (
    <div>
      <h3>{property.titulo_display}</h3>  {/* ← Usa siempre titulo_display */}
      {property.descripcion && <p>{property.descripcion}</p>}
    </div>
  );
};
```

### Formulario de Edición

```typescript
const PropertyForm = () => {
  const [titulo, setTitulo] = useState(property.titulo || '');
  const [descripcion, setDescripcion] = useState(property.descripcion || '');

  return (
    <form>
      <div>
        <label>Título (opcional)</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Deja vacío para usar la dirección"
        />
        <small>Si no especificas un título, se usará la dirección</small>
      </div>

      <div>
        <label>Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={5}
          placeholder="Describe la propiedad..."
        />
      </div>
    </form>
  );
};
```

---

## 🔍 Búsqueda y Filtros

### Buscar por Título o Descripción

```typescript
// Backend - agregar al servicio
async searchProperties(query: string) {
  return this.propertyModel.find({
    $or: [
      { titulo: { $regex: query, $options: 'i' } },
      { descripcion: { $regex: query, $options: 'i' } },
      { 'direccion.calle': { $regex: query, $options: 'i' } }
    ]
  });
}
```

---

## 📊 Casos de Uso

### 1. **Listados Públicos**

```typescript
// Mostrar siempre titulo_display
properties.map((p) => ({
  id: p._id,
  titulo: p.titulo_display, // ← Siempre tiene valor
  imagen: p.imagenes?.[0]?.versiones?.thumb,
  precio: p.valor_venta_detallado?.monto,
}));
```

### 2. **SEO y Meta Tags**

```tsx
<Head>
  <title>{property.titulo_display} - Mi Inmobiliaria</title>
  <meta
    name="description"
    content={property.descripcion || property.titulo_display}
  />
</Head>
```

### 3. **Notificaciones**

```typescript
const mensaje = `Nueva propiedad: ${property.titulo_display}`;
// "Nueva propiedad: Hermoso Departamento en Recoleta"
// o
// "Nueva propiedad: Av. Santa Fe 1234 5° A"
```

---

## ⚡ Optimización

### Índices Recomendados

```typescript
// Agregar índices para búsqueda de texto
PropertySchema.index({ titulo: 'text', descripcion: 'text' });
```

### Proyección en Listados

```typescript
// Solo obtener campos necesarios
this.propertyModel
  .find()
  .select('titulo descripcion direccion imagenes valor_venta_detallado')
  .lean();
```

---

## ✅ Checklist de Implementación

- [x] Campo `titulo` agregado a Entity
- [x] Campo `descripcion` agregado a Entity
- [x] Virtual `titulo_display` implementado
- [x] DTOs actualizados (Create y Update)
- [x] Compilación exitosa
- [ ] **TODO Frontend:** Actualizar interfaces TypeScript
- [ ] **TODO Frontend:** Actualizar formularios de creación/edición
- [ ] **TODO Frontend:** Usar `titulo_display` en listados y cards
- [ ] **TODO Backend:** Agregar índices de texto (opcional)
- [ ] **TODO Backend:** Implementar búsqueda por texto (opcional)

---

## 📝 Notas Importantes

1. **`titulo` es opcional** - El usuario puede dejarlo vacío
2. **`titulo_display` siempre existe** - Usar este campo para mostrar en UI
3. **Virtuals en JSON** - Los campos virtuales se incluyen automáticamente en las respuestas JSON
4. **Descripción flexible** - Sin límite de caracteres, validar en frontend según necesidad
5. **Backwards compatible** - Propiedades existentes funcionarán con título generado desde dirección
