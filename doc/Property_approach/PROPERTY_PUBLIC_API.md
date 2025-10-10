# API Pública de Propiedades

Este endpoint permite a la web pública consultar propiedades con paginación y filtros, sin autenticación. Solo se exponen campos públicos y no se incluyen datos sensibles como propietarios o inquilinos.

---

## Endpoint

```
GET /api/v1/property/public
```

---

## Parámetros soportados (query params)

- `page`: número de página (empezando en 0, opcional, default: 0)
- `pageSize`: cantidad de resultados por página (opcional, default: 10)
- `sort`: campo de ordenamiento (ej: address, createdAt, opcional)
- `search`: **(avanzado)** string JSON codificado con criterios de búsqueda avanzada (ver ejemplo abajo)
- Cualquier campo público de la entidad Property puede usarse como filtro (ej: `type`, `status`, `province`, `locality`, `address`, etc.)
- `populate`: por defecto `province,locality` (solo se permite `province` y `locality`)

---

## Filtro automático aplicado

> **Importante:**  
> El backend **siempre** filtra para que solo se devuelvan propiedades con al menos uno de estos campos en `true`:
>
> - `publishForSale`
> - `publishForRent`
>
> No es necesario que el frontend agregue este filtro.

---

## Ejemplo de Request

```
GET /api/v1/property/public?page=0&pageSize=6&type=departamento&status=disponible&province=507f1f77bcf86cd799439011
```

---

## Ejemplo de búsqueda avanzada

Para búsquedas complejas, usa el parámetro `search` como string JSON codificado:

```
GET /api/v1/property/public?search={"criteria":[{"field":"locality","term":"507f1f77bcf86cd799439012","operation":"eq"}]}
```

> **Ejemplo en JavaScript:**
>
> ```js
> const search = JSON.stringify({
>   criteria: [
>     { field: 'locality', term: '507f1f77bcf86cd799439012', operation: 'eq' },
>   ],
> });
> const url = `/api/v1/property/public?search=${encodeURIComponent(search)}`;
> ```

---

> ⚠️ **Importante:**
>
> - El endpoint `/property/:id/floor-plans` ya está implementado y **solo acepta imágenes** (jpg, jpeg, png, webp). Si intentas subir un PDF u otro formato no permitido, será rechazado.
> - Los planos en PDF deben incluirse en el array `documents` usando el endpoint `/property/:id/documents` con `type: 'pdf'` y un nombre descriptivo.
> - Esta validación es estricta tanto en el backend como en la API pública. Consulta la documentación técnica para ver ejemplos completos de requests y responses.
>
> **Errores comunes:**
>
> - Si intentas subir un PDF por `/floor-plans`, obtendrás un error 400.
> - Si subes una imagen por `/documents`, aparecerá como documento, no como plano ni foto.
> - Si usas el endpoint incorrecto, el archivo no se mostrará donde esperas.
>
> Consulta la [documentación técnica interna](PROPERTY_API_DOCUMENTATION.md) para ver advertencias y ejemplos extendidos.

## Ejemplo de Response

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
      "lat": -34.6037,
      "lng": -58.3816,
      "gmaps": { "formattedAddress": "...", "placeId": "..." },
      "type": "departamento",
      "purpose": "residencial",
      "status": "disponible",
      "available": true,
      "availableAt": "2025-07-01T00:00:00.000Z",
      "specs": ["balcón", "cochera"],
      "img": [
        {
          "name": "foto1.webp",
          "thumb": "/uploads/properties/thumb/foto1.webp",
          "thumbWeb": "/uploads/properties/thumbWeb/foto1.webp",
          "imgSlider": "/uploads/properties/imgSlider/foto1.webp",
          "title": "Fachada",
          "description": "Vista frontal",
          "createdAt": "2025-06-26T10:30:00.000Z"
        }
      ],
      "floorPlans": [
        {
          "url": "/uploads/properties/floorplans/plan1.jpg",
          "name": "Plano general",
          "uploadedAt": "2025-06-26T10:30:00.000Z"
        },
        {
          "url": "/uploads/properties/floorplans/plan2.png",
          "name": "Plano cocina",
          "uploadedAt": "2025-06-26T10:31:00.000Z"
        }
      ],
      "documents": [
        {
          "url": "/uploads/properties/docs/boleto.pdf",
          "name": "Boleto de compraventa",
          "type": "pdf",
          "isShared": true,
          "uploadedAt": "2025-06-26T10:30:00.000Z"
        },
        {
          "url": "/uploads/properties/docs/reglamento.doc",
          "name": "Reglamento",
          "type": "doc"
        }
      ],
      "imgCover": {
        "name": "foto1.webp",
        "thumbWeb": "/uploads/properties/thumbWeb/foto1.webp",
        "createdAt": "2025-06-26T10:30:00.000Z"
      },
      "detailedDescription": {
        "availableServices": ["agua", "gas"],
        "sqFt": 80,
        "buildSqFt": 75,
        "age": 10,
        "petFriendly": true,
        "rooms": 3,
        "bedrooms": 2,
        "bathrooms": 2,
        "orientation": "norte",
        "title": "Departamento luminoso",
        "brief": "Excelente ubicación"
      },
      "createdAt": "2025-06-26T10:30:00.000Z",
      "active": true,
      "publishForSale": true,
      "publishForRent": false,
      "valueForSale": {
        "amount": 120000,
        "currency": "USD",
        "pricePublic": true,
        "paymentMethod": "contado",
        "description": "Negociable",
        "date": "2025-06-26T10:30:00.000Z"
      }
    }
    // ...más propiedades
  ],
  "meta": {
    "totalItems": 12,
    "itemCount": 4,
    "itemsPerPage": 4,
    "totalPages": 3,
    "currentPage": 0
  }
}
```

---

### Campos nuevos

- **floorPlans**: Array de imágenes de planos de la propiedad. **Solo imágenes** (jpg, png, webp, etc). Cada plano incluye:

  - `url` (string, requerido): URL de la imagen del plano.
  - `name` (string, opcional): Nombre o descripción del plano.
  - `uploadedAt` (date, opcional): Fecha de carga.
  - **No incluir PDFs aquí; los planos en PDF deben ir en documents.**

- **documents**: Array de documentos asociados a la propiedad. Incluye PDFs, Word, Excel y también planos en PDF. Cada documento incluye:
  - `url` (string, requerido): URL del documento.
  - `name` (string, opcional): Nombre o descripción del documento.
  - `type` (string, requerido): Tipo de documento (`pdf`, `doc`, `xls`).
  - `isShared` (boolean, opcional): Solo para PDFs, indica si el documento es compartido públicamente.
  - `uploadedAt` (date, opcional): Fecha de carga.
  - **Para planos en PDF, usar type: 'pdf' y un nombre descriptivo (ej: "Plano general PDF").**

---

## Ejemplos prácticos de paginación y filtros

A continuación se muestran ejemplos reales de cómo consumir el endpoint público de propiedades utilizando paginación, filtros simples y avanzados:

### 1. Paginación básica

Obtener la primera página (0) con 10 resultados por página (valores por defecto):

```
GET /api/v1/property/public
```

Obtener la segunda página (page=1) con 5 resultados por página:

```
GET /api/v1/property/public?page=1&pageSize=5
```

### 2. Ordenamiento

Obtener propiedades ordenadas por fecha de creación descendente:

```
GET /api/v1/property/public?sort=-createdAt
```

Obtener propiedades ordenadas por dirección ascendente:

```
GET /api/v1/property/public?sort=address
```

### 3. Filtros simples por campo

Filtrar por tipo de propiedad y estado:

```
GET /api/v1/property/public?type=departamento&status=disponible
```

Filtrar por provincia y localidad:

```
GET /api/v1/property/public?province=507f1f77bcf86cd799439011&locality=507f1f77bcf86cd799439012
```

Filtrar por texto parcial en dirección:

```
GET /api/v1/property/public?address=Corrientes
```

### 4. Filtros por campos anidados

Filtrar por cantidad de ambientes (rooms) y valor de venta:

```
GET /api/v1/property/public?detailedDescription.rooms=3&valueForSale.amount=100000
```

### 5. Búsqueda avanzada (parámetro `search`)

Buscar propiedades en una localidad específica usando búsqueda avanzada:

```
GET /api/v1/property/public?search={"criteria":[{"field":"locality","term":"507f1f77bcf86cd799439012","operation":"eq"}]}
```

Buscar propiedades con ambientes mayores o iguales a 3:

```
GET /api/v1/property/public?search={"criteria":[{"field":"detailedDescription.rooms","term":"3","operation":"gte"}]}
```

> **Tip:** Para búsquedas avanzadas desde JavaScript:
>
> ```js
> const search = JSON.stringify({
>   criteria: [
>     { field: 'detailedDescription.rooms', term: '3', operation: 'gte' },
>     { field: 'province', term: '507f1f77bcf86cd799439011', operation: 'eq' },
>   ],
> });
> const url = `/api/v1/property/public?search=${encodeURIComponent(search)}`;
> ```

### 6. Filtros combinados y paginación

Obtener la página 2 de propiedades tipo "casa" en estado "disponible", ordenadas por fecha de creación descendente, 6 resultados por página:

```
GET /api/v1/property/public?page=2&pageSize=6&type=casa&status=disponible&sort=-createdAt
```

---

## Notas adicionales sobre paginación

- El backend siempre devuelve la estructura estándar:

```json
{
  "items": [
    /* array de propiedades */
  ],
  "meta": {
    "totalItems": 120,
    "itemCount": 10,
    "itemsPerPage": 10,
    "totalPages": 12,
    "currentPage": 0
  }
}
```

- Si no se especifica `page` o `pageSize`, se usan los valores por defecto (`page=0`, `pageSize=10`).
- El parámetro `sort` acepta el nombre del campo (ascendente) o `-campo` (descendente).
- Puedes combinar cualquier filtro simple, anidado o búsqueda avanzada con paginación y ordenamiento.

---

## Campos públicos devueltos

El endpoint solo expone los siguientes campos de cada propiedad:

- `_id`
- `address`
- `province`
- `locality`
- `lat`
- `lng`
- `gmaps`
- `type`
- `purpose`
- `status`
- `available`
- `availableAt`
- `specs`
- `img`
- `imgCover`
- `detailedDescription`
- `createdAt`
- `active`
- `publishForSale`
- `publishForRent`
- `valueForSale` (solo si `pricePublic: true`)
- `valueForRent` (solo si `pricePublic: true`)

---

## Estructura de los campos principales

```typescript
// Property (respuesta de cada ítem)
{
  _id: string;
  address: string;
  province: { _id: string; name: string };
  locality: { _id: string; name: string };
  lat: number;
  lng: number;
  gmaps?: { formattedAddress: string; placeId: string };
  type: string;
  purpose: string;
  status: string;
  available: boolean;
  availableAt?: string;
  specs?: string[];
  img?: Array<{
    name: string;
    thumb: string;
    thumbWeb: string;
    imgSlider: string;
    title: string;
    description: string;
    createdAt: string;
  }>;
  imgCover?: {
    name: string;
    thumbWeb: string;
    createdAt: string;
  };
  detailedDescription?: {
    availableServices: string[];
    sqFt: number;
    buildSqFt: number;
    age: number;
    petFriendly: boolean;
    rooms: number;
    bedrooms: number;
    bathrooms: number;
    orientation: string;
    title: string;
    brief: string;
  };
  createdAt: string;
  active: boolean;
  publishForSale: boolean;
  publishForRent: boolean;
  valueForSale?: {
    amount: number;
    currency: string;
    pricePublic: boolean;
    paymentMethod: string;
    description: string;
    date: string;
  };
  valueForRent?: {
    amount: number;
    currency: string;
    pricePublic: boolean;
    paymentMethod: string;
    description: string;
    date: string;
  };
}
```

---

## Notas y consideraciones

- Solo se devuelven propiedades con `publishForSale: true` o `publishForRent: true` (esto lo aplica automáticamente el backend).
- Los campos `valueForSale` y `valueForRent` solo aparecen si `pricePublic: true`.
- Los campos `province` y `locality` pueden venir como IDs o como objetos poblados (depende del parámetro `populate`).
- El array `img` puede estar vacío.
- El campo `imgCover` puede ser `null` si no hay imágenes.
- Los campos de fechas son strings ISO.
- El endpoint es público, no requiere autenticación.
- El frontend debe validar los campos obligatorios antes de enviar filtros.
- El formato de paginación es estándar: incluye `items` y un objeto `meta` con la información de la página.
- Los resultados pueden usarse directamente para mostrar listados y fichas públicas en la web.

---

## Enum de tipos de propiedad

```typescript
export enum TypeProperty {
  Departamento = 'departamento',
  Casa = 'casa',
  PH = 'ph',
  Oficina = 'oficina',
  LocalComercial = 'local_comercial',
  Galpon = 'galpon',
  Lote = 'lote',
  Quinta = 'quinta',
  Chacra = 'chacra',
  Estudio = 'estudio',
  Loft = 'loft',
  Duplex = 'duplex',
  Triplex = 'triplex',
}
```

---

## Endpoint: Localidades con propiedades disponibles

### Ruta

`GET /locality/with-available-properties`

### Parámetro opcional: `type`

Permite filtrar las localidades según el tipo de publicación disponible:

- `all` (por defecto): localidades con propiedades en venta **o** alquiler.
- `sale`: solo localidades con propiedades publicadas para **venta**.
- `rent`: solo localidades con propiedades publicadas para **alquiler**.

#### Ejemplos de uso

- Todas las localidades con propiedades publicadas (venta o alquiler):
  ```http
  GET /locality/with-available-properties
  ```
- Solo localidades con propiedades en venta:
  ```http
  GET /locality/with-available-properties?type=sale
  ```
- Solo localidades con propiedades en alquiler:
  ```http
  GET /locality/with-available-properties?type=rent
  ```

### Ejemplo de respuesta

```json
[
  {
    "_id": "66a25b0d1f1570568e03e9c4",
    "nombre": "La Floresta",
    "provincia": "Córdoba"
  },
  {
    "_id": "66a25b0d1f1570568e03e1e8",
    "nombre": "Villa Allende",
    "provincia": "Córdoba"
  }
]
```

---

## DTO de consulta (request DTO)

```typescript
export class PaginationDto {
  pageSize?: number = 10;
  page?: number = 0;
  sort?: string;
  populate?: string;
  search?: AdvancedSearchDto;
}

export class SearchCriteriaDto {
  field: string;
  term: string;
  operation: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
}

export class AdvancedSearchDto {
  criteria: SearchCriteriaDto[];
}
```

---

Para cualquier duda, consulta al equipo backend.
