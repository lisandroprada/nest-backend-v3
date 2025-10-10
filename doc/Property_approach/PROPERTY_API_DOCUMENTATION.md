# API de Propiedades y Sistema de Imágenes - Documentación Unificada y Literal para Frontend

Esta documentación es exhaustiva, literal y autosuficiente. Incluye todos los endpoints, DTOs, entities y relaciones reales del backend para la gestión de propiedades e imágenes, integrando y sintetizando la información de los servicios de propiedades e imágenes, así como las entidades y DTOs reales. Es la única fuente necesaria para el desarrollo frontend.

---

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT excepto los marcados como públicos.

```http
Authorization: Bearer <jwt-token>
```

---

## 📋 Índice de Endpoints

### 🏠 Propiedades

- Crear Propiedad `POST /api/v1/property`
- Listar Propiedades `GET /api/v1/property`
- Listar Propiedades Públicas `GET /api/v1/property/public`
- Obtener Propiedad por ID (Público) `GET /api/v1/property/public/:id`
- Obtener Propiedad por ID `GET /api/v1/property/:id`
- Actualizar Propiedad `PATCH /api/v1/property/:id`
- Eliminar Propiedad `DELETE /api/v1/property/:id`

### 📸 Imágenes (Fotos)

- Subir Imágenes (fotos) `POST /api/v1/property/:id/images`
- Obtener Imágenes de Propiedad `GET /api/v1/property/:id/images`
- Eliminar Imagen `DELETE /api/v1/property/:id/images/:imageName`
- Reordenar Imágenes `PATCH /api/v1/property/:id/images/reorder`
- Establecer Imagen de Portada `PATCH /api/v1/property/:id/images/:imageName/cover`
- Actualizar Metadatos de Imagen `PATCH /api/v1/property/:id/images/:imageName/metadata`

### 🗂️ Planos y Documentos

- Subir Plano (imagen) `POST /api/v1/property/:id/floor-plans`
  - **Implementado y funcional**. Recibe archivos `floorPlans[]` (solo imágenes: jpg, jpeg, png, webp). Rechaza PDFs y otros formatos. Responde con el array actualizado de planos.
- Listar Planos (imágenes) `GET /api/v1/property/:id/floor-plans`
- Eliminar Plano (imagen) `DELETE /api/v1/property/:id/floor-plans/:planName`
- Subir Documento (PDF/DOC/XLS) `POST /api/v1/property/:id/documents`
- Listar Documentos `GET /api/v1/property/:id/documents`
- Eliminar Documento `DELETE /api/v1/property/:id/documents/:docName`

### 🔍 Búsqueda de Propietarios

- Buscar Propietarios (Autocomplete) `GET /api/v1/party/search/owners`

---

### Tabla resumen de tipos de archivo y endpoint

| Tipo de archivo | Endpoint                    | Campo gestionado |
| --------------- | --------------------------- | ---------------- |
| Foto propiedad  | `/property/:id/images`      | `img`            |
| Plano (imagen)  | `/property/:id/floor-plans` | `floorPlans`     |
| Documento (PDF) | `/property/:id/documents`   | `documents`      |
| Plano (PDF)     | `/property/:id/documents`   | `documents`      |

---

> ⚠️ **Importante:** La distinción entre foto y plano en formato imagen depende exclusivamente del endpoint utilizado. El backend no detecta automáticamente si una imagen es un plano o una foto: depende del usuario/backoffice cargar el archivo en el endpoint correcto.

---

### Ejemplos de requests y responses

#### Subir foto de propiedad

```http
POST /api/v1/property/123/images
Content-Type: multipart/form-data
Authorization: Bearer <jwt-token>

(images[] = archivo(s) .jpg/.png/.webp)
```

**Response:**

```json
[
  {
    "name": "foto1.webp",
    "thumb": "/uploads/properties/thumb/foto1.webp",
    "thumbWeb": "/uploads/properties/thumbWeb/foto1.webp",
    "imgSlider": "/uploads/properties/imgSlider/foto1.webp",
    "title": "Fachada",
    "description": "Vista frontal",
    "createdAt": "2025-06-26T10:30:00.000Z"
  }
]
```

#### Subir plano en formato imagen (ejemplo exitoso)

```http
POST /api/v1/property/123/floor-plans
Content-Type: multipart/form-data
Authorization: Bearer <jwt-token>

(floorPlans[] = archivo(s) .jpg/.jpeg/.png/.webp)
```

> ⚠️ **Advertencia:** Este endpoint solo acepta imágenes (jpg, jpeg, png, webp). Si intentas subir un PDF u otro tipo de archivo, la petición será rechazada. Los planos en PDF deben subirse por `/documents`.

**Response exitosa:**

```json
[
  {
    "url": "/uploads/properties/floorplans/plan1.jpg",
    "name": "Plano general.jpg",
    "uploadedAt": "2025-06-26T10:30:00.000Z"
  },
  {
    "url": "/uploads/properties/floorplans/plan2.png",
    "name": "Corte cocina.png",
    "uploadedAt": "2025-06-26T10:31:00.000Z"
  }
]
```

#### Ejemplo de error: intento de subir PDF como plano

```http
POST /api/v1/property/123/floor-plans
Content-Type: multipart/form-data
Authorization: Bearer <jwt-token>

(floorPlans[] = plano.pdf)
```

**Response error:**

```json
{
  "statusCode": 400,
  "message": "Solo se permiten imágenes (jpg, jpeg, png, webp) en floorPlans.",
  "error": "Bad Request"
}
```

#### Ejemplo de response tras eliminar un plano

```http
DELETE /api/v1/property/123/floor-plans/plan1.jpg
Authorization: Bearer <jwt-token>
```

**Response:**

```json
[
  {
    "url": "/uploads/properties/floorplans/plan2.png",
    "name": "Corte cocina.png",
    "uploadedAt": "2025-06-26T10:31:00.000Z"
  }
]
```

> **Nota para backoffice:** Si un archivo es subido por el endpoint incorrecto, no aparecerá donde se espera en el frontend ni en la gestión de medios. Siempre verifica el tipo de archivo y el endpoint utilizado.
>
> Consulta también la [documentación pública de la API](PROPERTY_PUBLIC_API.md) para ver ejemplos de respuesta y estructura de los campos `img`, `floorPlans` y `documents` tal como los consume el frontend.

---

### Errores comunes y advertencias

- Subir un PDF por `/floor-plans`:
  - **Error 400:** Solo se permiten imágenes (jpg, jpeg, png, webp) en floorPlans.
- Subir una imagen por `/documents`:
  - Se aceptará, pero aparecerá como documento y no como plano ni foto.
- Subir un archivo por el endpoint incorrecto:
  - No aparecerá en la sección esperada del frontend/backoffice.
- Eliminar un plano inexistente:
  - **Error 404:** Plano no encontrado.
- No enviar archivos:
  - **Error 400:** No se enviaron archivos.

> **Recomendación:** Siempre verifica el tipo de archivo, el endpoint y revisa la respuesta del backend para confirmar que el archivo fue procesado correctamente.

#### Subir documento o plano en PDF

```http
POST /api/v1/property/123/documents
Content-Type: multipart/form-data
Authorization: Bearer <jwt-token>

(documents[] = archivo(s) .pdf/.doc/.xls)
```

**Response:**

```json
[
  {
    "url": "/uploads/properties/docs/plano-general.pdf",
    "name": "Plano general PDF",
    "type": "pdf",
    "isShared": true,
    "uploadedAt": "2025-06-26T10:30:00.000Z"
  }
]
```

> Para planos PDF, se recomienda nombrar el archivo como "Plano general.pdf" o similar para facilitar su identificación en el frontend y backoffice.

---

### Buenas prácticas para el frontend y la API pública

- **Siempre mostrar por separado:**
  - Fotos de la propiedad (`img`)
  - Planos en imagen (`floorPlans`)
  - Documentos (PDF, DOC, XLS, incluyendo planos PDF) (`documents`)
- **No mezclar archivos:** El backend solo valida el tipo de archivo, pero la semántica depende del endpoint usado.
- **Para mostrar planos PDF en el frontend:**
  - Filtrar `documents` por `type: "pdf"` y/o por nombre/descripción.
  - Mostrar un ícono o preview diferenciado para PDFs.
- **Referencias cruzadas:**
  - Consultar la [API Pública de Propiedades](PROPERTY_PUBLIC_API.md) para ver ejemplos de respuesta y estructura de los campos `img`, `floorPlans` y `documents`.
- **Advertencia:**
  - El backend y la API pública nunca mezclan fotos y planos. Si un archivo fue subido por el endpoint incorrecto, no aparecerá donde el frontend lo espera.

---

## 🏠 Entidades y DTOs Literales

### Property (Entidad principal)

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class PropertyImage {
  @Prop() name: string;
  @Prop() thumb: string;
  @Prop() thumbWeb: string;
  @Prop() imgSlider: string;
  @Prop() title: string;
  @Prop() description: string;
  @Prop() createdAt: Date;
}

@Schema()
export class Property extends Document {
  @Prop({ required: true }) address: string;
  @Prop({ type: Types.ObjectId, ref: 'Province', required: true })
  province: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Locality', required: true })
  locality: Types.ObjectId;
  @Prop() lat: number;
  @Prop() lng: number;
  @Prop({ type: Object }) gmaps: { formattedAddress: string; placeId: string };
  @Prop({ type: [Types.ObjectId], ref: 'Party', required: true })
  owners: Types.ObjectId[];
  @Prop({ type: Types.ObjectId, ref: 'Party' }) tenant: Types.ObjectId;
  @Prop() consortium: string;
  @Prop({ type: [String] }) suppliers: string[];
  @Prop({ type: [String] }) specs: string[];
  @Prop() type: string;
  @Prop() purpose: string;
  @Prop() status: string;
  @Prop() availableForSale: boolean;
  @Prop() publishForRent: boolean;
  @Prop() publishForSale: boolean;
  @Prop({ type: Object }) valueForSale: {
    amount: number;
    currency: string;
    pricePublic: boolean;
    paymentMethod: string;
    description: string;
    date: Date;
  };
  @Prop({ type: Object }) valueForRent: {
    amount: number;
    currency: string;
    pricePublic: boolean;
    paymentMethod: string;
    description: string;
    date: Date;
  };
  @Prop({ required: true, default: true }) available: boolean;
  @Prop({ required: false }) availableAt: Date;
  @Prop({ type: [String] }) associatedServices: string[];
  @Prop({
    type: [{ item: String, quantity: Number, room: String, condition: String }],
  })
  inventory: {
    item: string;
    quantity: number;
    room: string;
    condition: string;
  }[];
  @Prop({ type: Object }) detailedDescription: {
    availableServices: string[];
    sqFt: number;
    buildSqFt: number;
    age: number;
    petFriendly: boolean;
    rooms: number;
    bedrooms: number;
    bathrooms: number;
    floors: number; // cantidad de pisos
    orientation: string;
    title: string;
    brief: string;
  };
  @Prop() expensesType: string;
  @Prop({ type: [PropertyImage] }) img: PropertyImage[];
  @Prop({ type: Object }) imgCover: {
    name: string;
    thumbWeb: string;
    createdAt: Date;
  };
  @Prop({ default: () => Date.now() - 3 * 60 * 60 * 1000 }) createdAt: Date;
  @Prop({ default: true }) active: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User' }) user: Types.ObjectId;
}
```

### CreatePropertyDto (DTO de creación)

```typescript
export class CreatePropertyDto {
  readonly address: string;
  readonly province: string;
  readonly locality: string;
  readonly lat: number;
  readonly lng: number;
  readonly gmaps?: { formattedAddress: string; placeId: string };
  readonly owners: string[];
  readonly tenant?: string;
  readonly consortium?: string;
  readonly suppliers?: string[];
  readonly specs?: string[];
  readonly type: string;
  readonly purpose: string;
  readonly status: string;
  readonly availableForSale?: boolean;
  readonly publishForRent?: boolean;
  readonly publishForSale?: boolean;
  readonly valueForSale?: {
    amount: number;
    currency: string;
    pricePublic: boolean;
    paymentMethod: string;
    description: string;
    date: string;
  };
  readonly valueForRent?: {
    amount: number;
    currency: string;
    pricePublic: boolean;
    paymentMethod: string;
    description: string;
    date: string;
  };
  readonly available?: boolean;
  readonly availableAt?: string;
  readonly associatedServices?: string[];
  readonly inventory?: {
    item: string;
    quantity: number;
    room: string;
    condition: string;
  }[];
  readonly detailedDescription?: {
    availableServices: string[];
    sqFt: number;
    buildSqFt: number;
    age: number;
    petFriendly: boolean;
    rooms: number;
    bedrooms: number;
    bathrooms: number;
    floors: number; // cantidad de pisos
    orientation: string;
    title: string;
    brief: string;
  };
  readonly expensesType?: string;
}
```

### UpdatePropertyDto (DTO de actualización)

```typescript
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
```

### UploadImagesDto (DTO de subida de imágenes)

```typescript
export class UploadImagesDto {
  titles?: string[];
  descriptions?: string[];
}
```

### UpdateImageMetadataDto (DTO de metadatos de imagen)

```typescript
export class UpdateImageMetadataDto {
  title?: string;
  description?: string;
}
```

### ReorderImagesDto (DTO de reordenamiento de imágenes)

```typescript
export class ReorderImagesDto {
  imageOrder: string[];
}
```

### Party (Entidad de propietario/inquilino)

```typescript
@Schema()
export class Party extends Document {
  agentType: string; // 'Client', 'Supplier', etc.
  personType: string; // 'Individual', 'Legal Entity'
  name: string;
  lastName: string;
  gender: string;
  maritalStatus: string;
  postalCode: string;
  locality?: Types.ObjectId;
  province?: Types.ObjectId;
  email: string;
  bankAccounts: {
    bank: string;
    cbu: string;
    bankId: Types.ObjectId;
    description?: string;
  }[];
  photo: string;
  uid: string;
  identityCard: string;
  taxId: string;
  taxType: string;
  taxIdType: string;
  taxAddress: string;
  address: string;
  workAddress: string;
  iva: string;
  billing: boolean;
  supplierMask: string;
  consortiumDetails: ConsortiumDetail[];
  phone: { number: string; type: string }[];
  active: boolean;
  createdAt: Date;
  agent?: Agent;
  user: Types.ObjectId;
  fullName: string;
}
```

### Province (Entidad de provincia)

```typescript
@Schema()
export class Province extends Document {
  id: number;
  nombre: string;
  nombre_completo: string;
  fuente: string;
  categoria: string;
  centroide: { lon: number; lat: number };
  iso_id: string;
  iso_nombre: string;
}
```

### Locality (Entidad de localidad)

```typescript
@Schema()
export class Locality extends Document {
  id: string;
  nombre: string;
  fuente: string;
  provincia: Provincia;
  departamento: Departamento;
  municipio: Municipio;
  localidad_censal: LocalidadCensal;
  categoria: string;
  centroide: Centroide;
}
```

---

## 📸 Sistema de Imágenes: Detalles y Buenas Prácticas

- Upload múltiple (hasta 10 archivos, máx 10MB c/u)
- Formatos permitidos: JPEG, JPG, PNG, GIF, WebP (convertidos a WebP)
- Versiones generadas: original (WebP), thumb (150x150), thumbWeb (400x300), imgSlider (800x600)
- URLs de acceso: `/uploads/properties/{tipo}/[filename].webp`
- Recomendación: usar CDN y almacenamiento externo en producción
- Validaciones: tipo, tamaño, cantidad
- Eliminar imágenes huérfanas periódicamente

---

## Ejemplos de Requests y Responses

### Crear Propiedad

#### Request

```json
{
  "address": "Av. Corrientes 1234, Buenos Aires",
  "province": "507f1f77bcf86cd799439011",
  "locality": "507f1f77bcf86cd799439012",
  "lat": -34.6037,
  "lng": -58.3816,
  "owners": ["507f1f77bcf86cd799439013"],
  "type": "departamento",
  "purpose": "residencial",
  "status": "disponible"
}
```

#### Response

```json
{
  "_id": "507f1f77bcf86cd799439014",
  "address": "Av. Corrientes 1234, Buenos Aires",
  "province": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Buenos Aires"
  },
  "locality": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "CABA"
  },
  "owners": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "firstName": "Juan",
      "lastName": "Pérez"
    }
  ],
  "type": "departamento",
  "purpose": "residencial",
  "status": "disponible",
  "available": true,
  "createdAt": "2025-06-26T10:30:00.000Z",
  "active": true
}
```

### Subir Imágenes

#### Request (FormData)

- images: File[]
- titles: string[] (opcional)
- descriptions: string[] (opcional)

#### Response

```json
[
  {
    "name": "uuid-generated-filename.webp",
    "thumb": "/uploads/properties/thumb/uuid-generated-filename.webp",
    "thumbWeb": "/uploads/properties/thumbWeb/uuid-generated-filename.webp",
    "imgSlider": "/uploads/properties/imgSlider/uuid-generated-filename.webp",
    "title": "Título opcional",
    "description": "Descripción opcional",
    "createdAt": "2025-06-26T10:30:00.000Z"
  }
]
```

---

## 📄 Ejemplos de Paginación y Filtros

### Listar Propiedades con Paginación y Filtros

#### Request (con paginación y filtros)

```http
GET /api/v1/property?page=1&limit=5&type=departamento&status=disponible&address=Corrientes&sort=createdAt&order=desc
Authorization: Bearer <jwt-token>
```

- `page`: número de página (empezando en 1)
- `limit`: cantidad de resultados por página
- `type`, `status`, `address`, etc.: cualquier campo de la entidad Property puede usarse como filtro (si está implementado en el backend)
- `sort`: campo de ordenamiento (ej: createdAt)
- `order`: dirección de ordenamiento (`asc` o `desc`)

#### Response

```json
{
  "items": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "address": "Av. Corrientes 1234, Buenos Aires",
      "province": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Buenos Aires"
      },
      "locality": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "CABA"
      },
      "owners": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "firstName": "Juan",
          "lastName": "Pérez"
        }
      ],
      "type": "departamento",
      "status": "disponible",
      "available": true,
      "createdAt": "2025-06-26T10:30:00.000Z",
      "active": true
    }
    // ...más propiedades
  ],
  "meta": {
    "totalItems": 12,
    "itemCount": 5,
    "itemsPerPage": 5,
    "totalPages": 3,
    "currentPage": 1
  }
}
```

#### Ejemplo de request solo con filtro por tipo y localidad

```http
GET /api/v1/property?type=ph&locality=507f1f77bcf86cd799439012
Authorization: Bearer <jwt-token>
```

#### Ejemplo de response vacío (sin resultados)

```json
{
  "items": [],
  "meta": {
    "totalItems": 0,
    "itemCount": 0,
    "itemsPerPage": 5,
    "totalPages": 0,
    "currentPage": 1
  }
}
```

#### Ejemplo de búsqueda por múltiples criterios

#### Request (por tipo, estado y provincia)

```http
GET /api/v1/property?type=departamento&status=disponible&province=507f1f77bcf86cd799439011&limit=10&page=1
Authorization: Bearer <jwt-token>
```

#### Response

```json
{
  "items": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "address": "Av. Corrientes 1234, Buenos Aires",
      "province": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Buenos Aires"
      },
      "locality": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "CABA"
      },
      "owners": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "firstName": "Juan",
          "lastName": "Pérez"
        }
      ],
      "type": "departamento",
      "status": "disponible",
      "available": true,
      "createdAt": "2025-06-26T10:30:00.000Z",
      "active": true
    }
    // ...más propiedades
  ],
  "meta": {
    "totalItems": 3,
    "itemCount": 3,
    "itemsPerPage": 10,
    "totalPages": 1,
    "currentPage": 1
  }
}
```

---

> ⚠️ **Importante sobre planos y documentos:**
>
> - El campo `floorPlans` solo acepta imágenes (jpg, jpeg, png, webp). Si intentas subir un PDF como plano, será rechazado por validación del backend.
> - Los planos en PDF deben incluirse en el array `documents` con `type: 'pdf'` y un nombre descriptivo.
> - Esta validación es estricta y aplica tanto en el backend como en la API pública.

### Ejemplos de uso correcto e incorrecto de planos y documentos

#### Payload válido (planos como imágenes, planos PDF en documents)

```json
{
  "address": "Av. Corrientes 1234",
  "province": "507f1f77bcf86cd799439011",
  "locality": "507f1f77bcf86cd799439012",
  "owners": ["507f1f77bcf86cd799439013"],
  "type": "departamento",
  "floorPlans": [
    {
      "url": "/uploads/properties/floorplans/plan1.jpg",
      "name": "Plano general"
    },
    {
      "url": "/uploads/properties/floorplans/plan2.png",
      "name": "Plano cocina"
    }
  ],
  "documents": [
    {
      "url": "/uploads/properties/docs/plano-general.pdf",
      "name": "Plano general PDF",
      "type": "pdf",
      "isShared": true
    },
    {
      "url": "/uploads/properties/docs/boleto.pdf",
      "name": "Boleto de compraventa",
      "type": "pdf",
      "isShared": true
    },
    {
      "url": "/uploads/properties/docs/reglamento.doc",
      "name": "Reglamento",
      "type": "doc"
    }
  ]
}
```

#### Payload inválido (planos PDF en floorPlans)

```json
{
  "floorPlans": [
    {
      "url": "/uploads/properties/floorplans/plan1.pdf",
      "name": "Plano general PDF"
    }
  ]
}
```

> ⛔ **Error esperado:** El backend rechazará este payload porque `plan1.pdf` no es una imagen válida para floorPlans. Los PDFs deben ir en `documents`.

---

## ⚠️ Advertencias y Buenas Prácticas

- Validar siempre los IDs de MongoDB antes de enviar requests.
- Usar los DTOs y entities literales como referencia para construir los formularios y requests.
- Las imágenes deben ser gestionadas siempre a través de los endpoints, nunca manipular archivos directamente.
- En producción, usar almacenamiento externo y CDN para servir imágenes.
- El endpoint público solo muestra propiedades con `publishForRent: true` o `publishForSale: true`.
- Los campos `province` y `locality` deben ser poblados para obtener el nombre legible.
- Los arrays de imágenes (`img`) y propietarios (`owners`) pueden estar vacíos.
- **CORS y orígenes permitidos:** El backend permite solicitudes desde los siguientes orígenes para el frontend y backoffice:
  - `http://localhost:3000`
  - `http://localhost:5174`
  - `http://localhost:3001`
  - `http://localhost:3002`
  - `https://backoffice.netra.com.ar`
  - Dominio de producción (consultar variable de entorno)
    Asegúrate de que el frontend utilice uno de estos orígenes para evitar errores de CORS.

---

## 🔗 Relaciones Clave

- `Property.owners[]` → Party (propietarios)
- `Property.tenant` → Party (inquilino)
- `Property.province` → Province
- `Property.locality` → Locality
- `Property.img[]` → PropertyImage (estructura literal)

---

## 📚 Adenda: Guía para el Consumo Correcto desde el Frontend

### 1. Campos obligatorios y valores válidos

- El campo `type` es obligatorio y debe ser uno de:
  - departamento, casa, ph, oficina, local_comercial, galpon, lote, quinta, chacra, estudio, loft, duplex, triplex
- Ejemplo de payload válido:

```json
{
  "address": "Av. Corrientes 1234",
  "province": "507f1f77bcf86cd799439011",
  "locality": "507f1f77bcf86cd799439012",
  "lat": -34.6037,
  "lng": -58.3816,
  "owners": ["507f1f77bcf86cd799439013"],
  "type": "departamento",
  "purpose": "residencial",
  "status": "disponible"
}
```

### 2. Manejo de errores de validación

- Si falta un campo obligatorio o hay un valor inválido, el backend responde con status 400 y un array de mensajes en `message`.
- Ejemplo de respuesta de error:

```json
{
  "message": [
    "El tipo de propiedad debe ser uno de: departamento, casa, ph, oficina, local_comercial, galpon, lote, quinta, chacra, estudio, loft, duplex, triplex",
    "El tipo de propiedad (type) es obligatorio."
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

- El frontend debe mostrar estos mensajes al usuario.

### 3. Validaciones recomendadas en frontend

- Validar que todos los campos obligatorios estén presentes antes de enviar.
- Validar que `type` tenga un valor permitido.
- Validar que los IDs sean válidos (formato MongoDB).

### 4. Ejemplo de manejo de error en React/Axios

```js
try {
  await axios.post('/api/v1/property', data, {
    headers: { Authorization: `Bearer ${token}` },
  });
} catch (error) {
  if (error.response && error.response.data && error.response.data.message) {
    alert(error.response.data.message.join('\n'));
  } else {
    alert('Error inesperado');
  }
}
```

### 5. Subida de imágenes

- Usa `FormData` y el campo `images` (array de archivos).
- No envíes campos de título ni descripción.
- Endpoint: `POST /api/v1/property/:id/images`

```js
const formData = new FormData();
files.forEach((file) => formData.append('images', file));
await axios.post(`/api/v1/property/${propertyId}/images`, formData, {
  headers: { Authorization: `Bearer ${token}` },
});
```
