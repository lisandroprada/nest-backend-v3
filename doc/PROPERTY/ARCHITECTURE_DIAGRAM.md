# Arquitectura del Property Module Upgrade

## 📐 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Mapa    │  │ Búsqueda │  │  Upload  │  │  Editor  │        │
│  │Interactivo│  │  Pública │  │ Imágenes │  │  Lotes   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼─────────────┼───────────────┘
        │             │             │             │
        │ GET /map    │ GET /public │ POST files  │ PATCH lotes
        │             │             │             │
┌───────▼─────────────▼─────────────▼─────────────▼───────────────┐
│                    API GATEWAY (NestJS)                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              CONTROLLERS LAYER                             │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │ │
│  │  │ Properties   │ │PropertyFiles │ │   Public     │      │ │
│  │  │ Controller   │ │ Controller   │ │ Properties   │      │ │
│  │  │              │ │              │ │ Controller   │      │ │
│  │  │ (Auth ✓)     │ │ (Auth ✓)     │ │ (Public)     │      │ │
│  │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘      │ │
│  └─────────┼────────────────┼────────────────┼──────────────┘ │
│            │                │                │                  │
│  ┌─────────▼────────────────▼────────────────▼──────────────┐ │
│  │                  SERVICES LAYER                           │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │ │
│  │  │ Properties   │ │PropertyFiles │ │   Public     │     │ │
│  │  │   Service    │ │   Service    │ │ Properties   │     │ │
│  │  │              │ │              │ │   Service    │     │ │
│  │  │ - CRUD       │ │ - Upload     │ │ - Search     │     │ │
│  │  │ - Validation │ │ - Delete     │ │ - Filter     │     │ │
│  │  │ - Business   │ │ - Reorder    │ │ - Sanitize   │     │ │
│  │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘     │ │
│  └─────────┼────────────────┼────────────────┼─────────────┘ │
│            │                │                │                 │
│            │         ┌──────▼─────┐          │                 │
│            │         │  Storage   │          │                 │
│            │         │  Service   │          │                 │
│            │         │            │          │                 │
│            │         │ - Process  │          │                 │
│            │         │ - Sharp    │          │                 │
│            │         │ - Versions │          │                 │
│            │         └──────┬─────┘          │                 │
│            │                │                │                 │
│  ┌─────────▼────────────────▼────────────────▼─────────────┐  │
│  │                  DATA ACCESS LAYER                       │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │           Property Entity (Mongoose)               │ │  │
│  │  │                                                    │ │  │
│  │  │  - valor_venta_detallado                         │ │  │
│  │  │  - valor_alquiler_detallado                      │ │  │
│  │  │  - publicar_para_venta                           │ │  │
│  │  │  - publicar_para_alquiler                        │ │  │
│  │  │  - imagenes[]                                    │ │  │
│  │  │  - planos[]                                      │ │  │
│  │  │  - imagen_satelital                              │ │  │
│  │  │  - lotes[]                                       │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────┬──────────────────────────────┘  │
└─────────────────────────────┼─────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │     MongoDB        │
                    │                    │
                    │ - properties       │
                    │ - Índices:         │
                    │   * lat/lng        │
                    │   * status         │
                    │   * publicar_*     │
                    └────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    FILE SYSTEM / STORAGE                         │
│                                                                  │
│  uploads/properties/{propertyId}/                               │
│  ├── images/                                                    │
│  │   ├── original/                                              │
│  │   ├── slider/  (800x600)                                     │
│  │   └── thumb/   (200x200)                                     │
│  ├── planos/                                                    │
│  │   └── original/                                              │
│  ├── satellite/                                                 │
│  │   └── original/                                              │
│  └── documentos/                                                │
│                                                                  │
│  Future: AWS S3 / Google Cloud Storage / Azure Blob            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos: Subida de Imagen

```
┌─────────┐
│Frontend │ 1. POST /properties/:id/imagenes
│         │    FormData with files
└────┬────┘
     │
     ▼
┌─────────────────────┐
│PropertyFilesController│ 2. Receive files
│  @UseInterceptors   │    Validate auth
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│PropertyFilesService │ 3. Business logic
│                     │    - Check property exists
└────┬────────────────┘    - Validate files
     │
     ▼
┌─────────────────────┐
│  StorageService     │ 4. Process & Save
│                     │    - Sharp processing
└────┬────────────────┘    - Create versions
     │                     - Save to disk
     ├─────────────────────┐
     │                     │
     ▼                     ▼
┌─────────┐         ┌──────────┐
│File     │         │MongoDB   │ 5. Update DB
│System   │         │Property  │    - Add to imagenes[]
└─────────┘         └──────────┘    - Set metadata
     │                     │
     └─────────┬───────────┘
               │
               ▼
     ┌─────────────────┐
     │Return Property  │ 6. Response
     │  with updated   │    - Updated property
     │  imagenes[]     │    - All versions URLs
     └─────────────────┘
```

---

## 🗺️ Flujo de Datos: Búsqueda en Mapa

```
┌─────────┐
│Frontend │ 1. GET /properties/map
│  Map    │    ?minLat=X&maxLat=Y&minLng=A&maxLng=B
└────┬────┘
     │
     ▼
┌─────────────────────┐
│PublicController     │ 2. No auth required
│  (Public endpoint)  │    Validate bounds
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│PublicProperties     │ 3. Build query
│Service              │    - Filter by bounds
│                     │    - Filter by public flags
└────┬────────────────┘    - Limit to 500
     │
     ▼
┌─────────────────────┐
│MongoDB              │ 4. Query with indexes
│  properties         │    - direccion.latitud
│  (indexed)          │    - direccion.longitud
└────┬────────────────┘    - publicar_para_venta
     │
     ▼
┌─────────────────────┐
│Sanitize & Format    │ 5. Process results
│                     │    - Select minimal fields
│                     │    - Format for markers
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│Return Array         │ 6. Response
│ [{id, lat, lng,     │    Lightweight JSON
│   precio, img}]     │    < 50KB typical
└─────────────────────┘
```

---

## 🏗️ Flujo de Datos: Sistema de Lotes

```
┌─────────┐
│Frontend │ 1. Upload satellite image
│         │    POST /properties/:id/imagen-satelital
└────┬────┘
     │
     ▼
┌─────────────────────┐
│PropertyFilesService │ 2. Process image
│                     │    - Sharp extracts dimensions
└────┬────────────────┘    - Save to disk
     │                     - Update DB
     ▼
┌─────────┐
│MongoDB  │ imagen_satelital: {
│         │   ancho: 1920,
└─────────┘   alto: 1080,
              pixels_por_metro: 0  // Not calibrated yet
              }

┌─────────┐
│Frontend │ 3. User calibrates
│         │    POST /properties/:id/imagen-satelital/calibrar
└────┬────┘    { pixels_por_metro: 10.5 }
     │
     ▼
┌─────────┐
│MongoDB  │ Update: pixels_por_metro = 10.5
└─────────┘

┌─────────┐
│Frontend │ 4. User draws lots
│ Canvas  │    - Click to create polygon
└────┬────┘    - Calculate area using calibration
     │         - Set price, status
     ▼
┌─────────┐
│Frontend │ 5. Save lots
│         │    PATCH /properties/:id
└────┬────┘    { lotes: [...] }
     │
     ▼
┌─────────────────────┐
│PropertiesService    │ 6. Validate & save
└────┬────────────────┘
     │
     ▼
┌─────────┐
│MongoDB  │ lotes: [
│         │   {
└─────────┘     id: 'lote-1',
                coordenadas: [...],
                superficie_m2: 250,
                precio: 50000
              }
            ]
```

---

## 📦 Capas y Responsabilidades

### 1. Controllers Layer

**Responsabilidad**: Manejo de HTTP requests/responses

- Validación de entrada (DTOs)
- Autenticación y autorización
- Manejo de archivos multipart
- Formateo de respuestas

### 2. Services Layer

**Responsabilidad**: Lógica de negocio

- Validación de reglas de negocio
- Coordinación entre servicios
- Transformación de datos
- Gestión de transacciones

### 3. Storage Service

**Responsabilidad**: Gestión de archivos

- Procesamiento de imágenes (Sharp)
- Creación de versiones
- Almacenamiento físico
- Eliminación de archivos
- **Abstracción**: Preparado para migrar a cloud

### 4. Data Access Layer

**Responsabilidad**: Persistencia

- Esquemas de Mongoose
- Validación de datos
- Relaciones entre entidades
- Índices y optimización

---

## 🔐 Seguridad en Capas

```
┌──────────────────────────────────────┐
│  1. Guards (Auth)                    │
│     - JWT validation                 │
│     - Role-based access              │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  2. Validators (DTOs)                │
│     - Type checking                  │
│     - Range validation               │
│     - Format validation              │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  3. Business Logic (Services)        │
│     - Entity validation              │
│     - Business rules                 │
│     - Data integrity                 │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  4. Data Sanitization                │
│     - Remove sensitive fields        │
│     - Privacy controls               │
│     - Public/Private separation      │
└──────────────────────────────────────┘
```

---

## 🚀 Escalabilidad

### Horizontal Scaling

- Múltiples instancias de NestJS
- Load balancer (Nginx/AWS ALB)
- Session-less (JWT)
- Shared storage (S3)

### Vertical Scaling

- Procesamiento de imágenes en background
- Queue system (Bull/Redis)
- CDN para archivos estáticos
- Database read replicas

### Caching Strategy

```
┌────────────┐
│  Frontend  │ Cache: 5 min
└─────┬──────┘
      │
┌─────▼──────┐
│   CDN      │ Cache: 1 hour (images)
└─────┬──────┘
      │
┌─────▼──────┐
│   Redis    │ Cache: 15 min (queries)
└─────┬──────┘
      │
┌─────▼──────┐
│  MongoDB   │ Source of truth
└────────────┘
```

---

## 📊 Flujo de Migración

```
┌──────────────────────────────────────────────┐
│  Old Schema                                  │
│  - valor_venta: Number                       │
│  - valor_alquiler: Number                    │
└──────────────┬───────────────────────────────┘
               │
               │ Migration Script
               │ (scripts/migrate-properties.js)
               │
┌──────────────▼───────────────────────────────┐
│  New Schema (Compatible)                     │
│  - valor_venta: Number (kept)                │
│  - valor_venta_detallado: Object (new)       │
│  - valor_alquiler: Number (kept)             │
│  - valor_alquiler_detallado: Object (new)    │
│  - publicar_para_venta: Boolean (new)        │
│  - publicar_para_alquiler: Boolean (new)     │
│  - imagenes: Array (new)                     │
│  - planos: Array (new)                       │
│  - lotes: Array (new)                        │
│  - imagen_satelital: Object (new)            │
└──────────────────────────────────────────────┘
```

---

Este diagrama muestra la arquitectura completa del sistema actualizado, incluyendo todas las capas, flujos de datos, y consideraciones de escalabilidad.
