# API Documentation - Property Module Upgrade

## Resumen de Implementación

Este documento describe las nuevas funcionalidades implementadas en el módulo de propiedades según el plan de upgrade.

---

## 📋 Cambios en la Entidad Property

### Nuevos Campos Agregados:

#### 1. Gestión Avanzada de Precios

- `valor_venta_detallado`: Objeto con monto, moneda, visibilidad pública y descripción
- `valor_alquiler_detallado`: Objeto con monto, moneda, visibilidad pública y descripción
- `publicar_para_venta`: Boolean para controlar publicación
- `publicar_para_alquiler`: Boolean para controlar publicación

#### 2. Sistema de Multimedia

- `imagenes`: Array de imágenes con versiones (thumb, slider, original), orden y flag de portada
- `planos`: Array de planos con URL y descripción

#### 3. Lotes y Mapas

- `imagen_satelital`: Objeto con dimensiones y calibración
- `lotes`: Array de lotes con coordenadas, status, precio y superficie

---

## 🔐 Endpoints Privados (Requieren Autenticación)

### Gestión de Imágenes

#### `POST /properties/:id/imagenes`

Subir una o más imágenes a la propiedad.

- **Auth**: admin, superUser, agente
- **Body**: FormData con campo `imagenes` (multipart/form-data)
- **Respuesta**: Propiedad actualizada con las nuevas imágenes

#### `DELETE /properties/:id/imagenes/:fileName`

Eliminar una imagen específica.

- **Auth**: admin, superUser, agente
- **Respuesta**: Propiedad actualizada

#### `PATCH /properties/:id/imagenes/reordenar`

Reordenar las imágenes de la propiedad.

- **Auth**: admin, superUser, agente
- **Body**:

```json
{ "ordenImagenes": ["imagen1.jpg", "imagen2.jpg", "imagen3.jpg"] }
```

#### `PATCH /properties/:id/imagenes/:fileName/portada`

Establecer una imagen como portada.

- **Auth**: admin, superUser, agente

### Gestión de Planos

#### `POST /properties/:id/planos`

Subir planos de la propiedad.

- **Auth**: admin, superUser, agente
- **Body**: FormData con campo `planos` y opcionalmente `descripciones`

#### `DELETE /properties/:id/planos/:fileName`

Eliminar un plano.

- **Auth**: admin, superUser, agente

### Gestión de Documentos

#### `POST /properties/:id/documentos`

Subir documentos (PDF, DOC, etc.).

- **Auth**: admin, superUser, agente
- **Body**: FormData con campo `documentos`

#### `DELETE /properties/:id/documentos/:fileName`

Eliminar un documento.

- **Auth**: admin, superUser, agente

### Gestión de Imagen Satelital y Lotes

#### `POST /properties/:id/imagen-satelital`

Subir imagen satelital para edición de lotes.

- **Auth**: admin, superUser, agente
- **Body**: FormData con campo `imagen`
- **Nota**: Automáticamente extrae y guarda las dimensiones de la imagen

#### `POST /properties/:id/imagen-satelital/calibrar`

Calibrar la escala de la imagen satelital.

- **Auth**: admin, superUser, agente
- **Body**:

```json
{ "pixels_por_metro": 10.5 }
```

#### `PATCH /properties/:id` (Actualización de Lotes)

Actualizar lotes dibujados sobre la imagen satelital.

- **Auth**: admin, superUser, agente
- **Body**:

```json
{
  "lotes": [
    {
      "id": "lote-1",
      "coordenadas": [
        { "x": 100, "y": 200 },
        { "x": 150, "y": 200 },
        { "x": 150, "y": 250 },
        { "x": 100, "y": 250 }
      ],
      "status": "DISPONIBLE",
      "precio": 50000,
      "moneda": "USD",
      "superficie_m2": 250
    }
  ]
}
```

---

## 🌍 Endpoints Públicos (Sin Autenticación)

### `GET /properties/public`

Listar propiedades públicas con filtros avanzados.

**Query Parameters:**

- `tipo`: 'venta' | 'alquiler' (opcional)
- `proposito`: 'COMERCIAL' | 'VIVIENDA' | 'INDUSTRIAL' | 'MIXTO' (opcional)
- `minLat`, `maxLat`, `minLng`, `maxLng`: Filtro por bounding box geográfico
- `minPrecio`, `maxPrecio`: Rango de precios
- `dormitorios`, `banos`, `ambientes`: Filtros por características
- `limit`, `offset`: Paginación

**Ejemplo de Uso:**

```
GET /properties/public?tipo=venta&proposito=VIVIENDA&minLat=-34.7&maxLat=-34.5&minLng=-58.5&maxLng=-58.3&limit=20&offset=0
```

**Respuesta:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "identificador": "PROP-001",
      "direccion": {
        "calle": "Av. Example",
        "numero": "123",
        "latitud": -34.6037,
        "longitud": -58.3816
      },
      "caracteristicas": {
        "dormitorios": 3,
        "banos": 2,
        "ambientes": 4
      },
      "precio_venta": {
        "monto": 150000,
        "moneda": "USD"
      },
      "imagenes": [...]
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### `GET /properties/public/:id`

Obtener una propiedad pública específica.

**Respuesta:** Objeto de propiedad con todos los detalles públicos.

### `GET /properties/map`

Endpoint optimizado para visualización en mapas.

**Query Parameters** (requeridos):

- `minLat`, `maxLat`, `minLng`, `maxLng`: Bounding box del mapa
- `tipo`: 'venta' | 'alquiler' (opcional)
- `proposito`: 'COMERCIAL' | 'VIVIENDA' | 'INDUSTRIAL' | 'MIXTO' (opcional)

**Ejemplo de Uso:**

```
GET /properties/map?minLat=-34.7&maxLat=-34.5&minLng=-58.5&maxLng=-58.3&tipo=venta
```

**Respuesta:**

```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "lat": -34.6037,
    "lng": -58.3816,
    "precio": 150000,
    "imgCover": "/uploads/properties/.../thumb/...",
    "proposito": "VIVIENDA"
  },
  ...
]
```

**Características:**

- Límite de 500 propiedades para rendimiento óptimo
- Solo devuelve campos esenciales para marcadores
- Filtrado automático por propiedades públicas

---

## 📦 Procesamiento de Imágenes

El sistema utiliza **Sharp** para procesar automáticamente las imágenes en tres versiones:

1. **Original**: Imagen sin modificar
2. **Thumb**: 200x200px (para miniaturas)
3. **Slider**: 800x600px (para galerías)

### Estructura de Almacenamiento:

```
uploads/
  properties/
    {propertyId}/
      images/
        original/
        thumb/
        slider/
      planos/
        original/
        thumb/
        slider/
      satellite/
        original/
      documentos/
```

---

## 🔒 Privacidad de Precios

Los precios pueden configurarse como públicos o privados mediante el campo `es_publico`:

- Si `es_publico: true` → Se muestra el monto
- Si `es_publico: false` → Se muestra como "Consultar"

Esto aplica tanto para `valor_venta_detallado` como `valor_alquiler_detallado`.

---

## 🗺️ Sistema de Lotes

### Flujo de Trabajo:

1. **Subir imagen satelital**: `POST /properties/:id/imagen-satelital`
   - El sistema extrae automáticamente ancho y alto en píxeles

2. **Calibrar escala**: `POST /properties/:id/imagen-satelital/calibrar`
   - Establecer cuántos píxeles equivalen a 1 metro

3. **Dibujar lotes en frontend**: El frontend dibuja polígonos sobre la imagen

4. **Guardar lotes**: `PATCH /properties/:id` con el array de lotes
   - Incluye coordenadas, status, precio y superficie calculada

---

## 🔄 Compatibilidad con Versión Anterior

✅ **100% Compatible**: Todos los endpoints y campos anteriores siguen funcionando.

Los nuevos campos son opcionales, permitiendo una adopción gradual:

- `valor_venta` y `valor_alquiler` siguen siendo válidos
- `valor_venta_detallado` y `valor_alquiler_detallado` son opcionales
- Campos antiguos y nuevos pueden coexistir

---

## 📝 Mejoras Implementadas

1. **StorageService**: Servicio abstracto para gestión de archivos (preparado para migración a S3)
2. **Procesamiento automático**: Imágenes procesadas en múltiples tamaños
3. **Endpoints especializados**: Separación clara entre gestión privada y consulta pública
4. **Optimización para mapas**: Endpoint dedicado con respuesta mínima para mejor rendimiento
5. **Filtros geoespaciales**: Búsqueda por bounding box para mapas interactivos
6. **Sistema de lotes**: Soporte completo para división de terrenos

---

## 🚀 Próximos Pasos Recomendados

1. Configurar CORS para acceso público desde frontend
2. Implementar caché para endpoint `/properties/map`
3. Agregar índices geoespaciales en MongoDB para mejor rendimiento
4. Implementar CDN para servir imágenes estáticas
5. Migrar almacenamiento a S3/CloudStorage usando StorageService

---

## 📚 Archivos Creados/Modificados

### Nuevos Archivos:

- `src/modules/properties/services/storage.service.ts`
- `src/modules/properties/property-files.controller.ts`
- `src/modules/properties/property-files.service.ts`
- `src/modules/properties/public-properties.controller.ts`
- `src/modules/properties/public-properties.service.ts`
- `src/modules/properties/dto/public-property-query.dto.ts`
- `src/modules/properties/dto/map-query.dto.ts`
- `src/modules/properties/dto/update-lotes.dto.ts`

### Archivos Modificados:

- `src/modules/properties/entities/property.entity.ts`
- `src/modules/properties/dto/create-property.dto.ts`
- `src/modules/properties/properties.module.ts`
