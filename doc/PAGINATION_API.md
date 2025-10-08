# API de Paginación - Guía de Uso para Frontend

**Fecha:** 2025-09-30
**Versión:** 1.0
**Autor:** Gemini Agent
**Ámbito:** Documento técnico que describe el funcionamiento del servicio genérico de paginación (`@src/common/pagination`) y cómo consumirlo desde el frontend.

---

## 1. Resumen y Arquitectura

El módulo de paginación es un servicio reutilizable que proporciona una forma estandarizada de listar, paginar, ordenar, filtrar y buscar en cualquier colección de la base de datos (ej: Propiedades, Personas, etc.).

Todos los endpoints que usan este servicio comparten la misma interfaz de parámetros de consulta y devuelven una respuesta con una estructura consistente.

---

## 2. Endpoints de Ejemplo

Este servicio se utiliza en múltiples módulos. Dos ejemplos clave son:

- **Listar Propiedades Públicas:** `GET /api/v1/property/public`
- **Listar Personas (Parties):** `GET /api/v1/party` (requiere autenticación)

Esta guía utilizará estos endpoints para los ejemplos, pero la lógica aplica a cualquier otro endpoint que implemente paginación.

---

## 3. Parámetros de Paginación y Ordenamiento

### `page`
Número de la página que se desea obtener. La paginación empieza en 0.
- **Tipo:** `number`
- **Opcional:** Sí
- **Default:** `0`

**Ejemplo:** Obtener la segunda página de resultados.
```http
GET /api/v1/property/public?page=1
```

### `pageSize`
Cantidad de resultados a devolver por página.
- **Tipo:** `number`
- **Opcional:** Sí
- **Default:** `10`

**Ejemplo:** Obtener 15 propiedades por página.
```http
GET /api/v1/property/public?pageSize=15
```

### `sort`
Campo por el cual se deben ordenar los resultados.
- **Tipo:** `string`
- **Opcional:** Sí
- **Default:** Orden natural de la base de datos.
- **Sintaxis:**
  - `fieldName`: para orden ascendente.
  - `-fieldName`: para orden descendente.

**Ejemplos:**
- Ordenar propiedades por dirección de la A a la Z:
  ```http
  GET /api/v1/property/public?sort=address
  ```
- Ordenar propiedades por fecha de creación, de la más nueva a la más antigua:
  ```http
  GET /api/v1/property/public?sort=-createdAt
  ```

---

## 4. Parámetro `populate`

Permite poblar (incluir) documentos relacionados de otras colecciones.
- **Tipo:** `string`
- **Opcional:** Sí
- **Sintaxis:** Una cadena de texto con los nombres de los campos a poblar, separados por comas.

**Ejemplo:** Obtener las propiedades y, para cada una, incluir la información completa de su provincia y localidad.
```http
GET /api/v1/property/public?populate=province,locality
```
> **Nota:** Algunos endpoints pueden tener valores por defecto para `populate` o limitar los campos que se pueden poblar por seguridad.

---

## 5. Búsqueda y Filtrado

### 5.1. Filtros Simples por Campo

Puedes filtrar directamente por cualquier campo de la entidad, incluyendo campos anidados, usando su nombre como parámetro en la URL.

**Ejemplos:**
- Filtrar por tipo de propiedad:
  ```http
  GET /api/v1/property/public?type=casa
  ```
- Filtrar por cantidad de baños en la descripción detallada:
  ```http
  GET /api/v1/property/public?detailedDescription.bathrooms=2
  ```
- Combinar filtros:
  ```http
  GET /api/v1/property/public?type=departamento&status=disponible
  ```

### 5.2. Búsqueda Avanzada (parámetro `search`)

Para consultas más complejas (ej: "contiene", "mayor que", etc.), se utiliza el parámetro `search`. Este parámetro se construye con una notación anidada en la URL.

**Estructura:**
La búsqueda se compone de un array de criterios. Cada criterio se define así:
`search[criteria][INDEX][PROPERTY]=VALUE`

- `INDEX`: El índice del criterio (0, 1, 2...).
- `PROPERTY`: Una de las siguientes propiedades: `field`, `term`, `operation`.

**Propiedades de un Criterio:**
- `field`: El campo de la base de datos sobre el que se busca (puede ser anidado, ej: `detailedDescription.rooms`).
- `term`: El valor a buscar.
- `operation`: La operación de comparación a realizar.

**Operaciones Soportadas (`operation`):**
| Valor | Descripción |
|---|---|
| `eq` | Igual a (Equals) |
| `contains` | Contiene el texto (case-insensitive) |
| `gt` | Mayor que (Greater Than) |
| `lt` | Menor que (Less Than) |
| `gte` | Mayor o igual que (Greater Than or Equal) |
| `lte` | Menor o igual que (Less Than or Equal) |

**Ejemplo 1: Buscar propiedades con 3 o más ambientes.**
```http
GET /api/v1/property/public?search[criteria][0][field]=detailedDescription.rooms&search[criteria][0][term]=3&search[criteria][0][operation]=gte
```

**Ejemplo 2: Buscar propiedades cuya dirección contenga "Corrientes" y tengan 2 baños.**
```http
GET /api/v1/property/public?search[criteria][0][field]=address&search[criteria][0][term]=Corrientes&search[criteria][0][operation]=contains&search[criteria][1][field]=detailedDescription.bathrooms&search[criteria][1][term]=2&search[criteria][1][operation]=eq
```

**Ejemplo 3: Búsqueda en campos de documentos populados (Caso Especial).**
El backend tiene lógica especial para buscar por el nombre completo de los propietarios (`owners`).
```http
GET /api/v1/property?search[criteria][0][field]=owners[fullName]&search[criteria][0][term]=Perez&search[criteria][0][operation]=contains
```
> Esta consulta buscará propiedades cuyo propietario (`Party`) tenga "Perez" en su `fullName`.

---

## 6. Estructura de la Respuesta

Todos los endpoints paginados devuelven un objeto con la siguiente estructura:

```json
{
  "items": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "address": "Av. Corrientes 1234, Buenos Aires",
      "type": "departamento",
      "status": "disponible"
      // ... otros campos de la propiedad
    }
    // ... más items
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

**Campos del objeto `meta`:**
- `totalItems`: Cantidad total de resultados que coinciden con la consulta (sin paginar).
- `itemCount`: Cantidad de resultados en la página actual.
- `itemsPerPage`: Límite de resultados por página.
- `totalPages`: Número total de páginas disponibles.
- `currentPage`: La página actual que se está devolviendo (empezando en 0).

---

## 7. Ejemplo de Implementación (React + Axios)

```javascript
import axios from 'axios';

async function fetchProperties(filters) {
  const params = new URLSearchParams();

  // Paginación y ordenamiento
  if (filters.page) params.append('page', filters.page);
  if (filters.pageSize) params.append('pageSize', filters.pageSize);
  if (filters.sort) params.append('sort', filters.sort);

  // Filtros simples
  if (filters.type) params.append('type', filters.type);
  if (filters.status) params.append('status', filters.status);

  // Búsqueda avanzada
  if (filters.advancedSearch) {
    filters.advancedSearch.forEach((criterion, index) => {
      params.append(`search[criteria][${index}][field]`, criterion.field);
      params.append(`search[criteria][${index}][term]`, criterion.term);
      params.append(`search[criteria][${index}][operation]`, criterion.operation);
    });
  }

  try {
    const response = await axios.get('/api/v1/property/public', { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching properties:", error);
    throw error;
  }
}

// Ejemplo de uso:
const filters = {
  page: 0,
  pageSize: 10,
  sort: '-createdAt',
  type: 'casa',
  advancedSearch: [
    { field: 'detailedDescription.rooms', term: '4', operation: 'gte' }
  ]
};

fetchProperties(filters).then(data => {
  console.log('Propiedades encontradas:', data.items);
  console.log('Metadatos de paginación:', data.meta);
});
```
