# Guía de uso del endpoint público de propiedades

## Endpoint principal

```
GET /api/v1/property/public
```

## Parámetros soportados

Puedes enviar los siguientes parámetros por query string:

- `page`: número de página (empezando en 0, opcional, default: 0)
- `pageSize`: cantidad de resultados por página (opcional, default: 10)
- `sort`: campo de ordenamiento (ej: `createdAt`, `-createdAt`, `address`)
- `search`: string JSON codificado con criterios de búsqueda avanzada (ver ejemplos)
- `populate`: campos a poblar, por defecto `province,locality`
- Cualquier campo público de la entidad Property como filtro (ej: `type`, `status`, `province`, `locality`, `address`, etc.)
- Bounding box: `north`, `south`, `east`, `west` (para filtrar por viewport de mapa)

## Filtros automáticos

El backend **siempre** filtra para que solo se devuelvan propiedades con al menos uno de estos campos en `true`:

- `publishForSale`
- `publishForRent`

No es necesario que el frontend agregue este filtro.

---

## Ejemplos de consultas

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

Propiedades ordenadas por fecha de creación descendente:

```
GET /api/v1/property/public?sort=-createdAt
```

Por dirección ascendente:

```
GET /api/v1/property/public?sort=address
```

### 3. Filtros simples

Por tipo y estado:

```
GET /api/v1/property/public?type=departamento&status=disponible
```

Por provincia y localidad (ciudad):

```
GET /api/v1/property/public?province=507f1f77bcf86cd799439011&locality=507f1f77bcf86cd799439012
```

Por texto parcial en dirección:

```
GET /api/v1/property/public?address=Corrientes
```

### 4. Filtros por campos anidados

Por cantidad de ambientes y valor de venta:

```
GET /api/v1/property/public?detailedDescription.rooms=3&valueForSale.amount=100000
```

### 5. Búsqueda avanzada (`search`)

El parámetro `search` debe ser un string JSON codificado (no un objeto anidado por query string).

**Ejemplo correcto:**

```
GET /api/v1/property/public?search={"criteria":[{"field":"locality","term":"507f1f77bcf86cd799439012","operation":"eq"},{"field":"detailedDescription.rooms","term":"2","operation":"eq"}]}&type=casa
```

**Desde JavaScript:**

```js
const search = JSON.stringify({
  criteria: [
    { field: 'locality', term: '507f1f77bcf86cd799439012', operation: 'eq' },
    { field: 'detailedDescription.rooms', term: '2', operation: 'eq' },
  ],
});
const url = `/api/v1/property/public?search=${encodeURIComponent(search)}&type=casa`;
```

> **Advertencia:** Aunque algunos frameworks permiten enviar `search[criteria][0][field]=...`, la forma recomendada y documentada es enviar `search` como string JSON codificado.

## Búsqueda avanzada (search) — Notación anidada recomendada

El backend acepta y recomienda la notación anidada en la query string para búsquedas avanzadas. Ejemplo:

```
GET /api/v1/property/public?page=0&pageSize=4&search[criteria][0][field]=detailedDescription.bathrooms&search[criteria][0][term]=2&search[criteria][0][operation]=eq
```

Puedes agregar más criterios:

```
GET /api/v1/property/public?search[criteria][0][field]=locality&search[criteria][0][term]=507f1f77bcf86cd799439012&search[criteria][0][operation]=eq&search[criteria][1][field]=detailedDescription.rooms&search[criteria][1][term]=3&search[criteria][1][operation]=gte
```

> **Nota:**
>
> - No es necesario enviar el parámetro `search` como string JSON codificado.
> - La notación anidada es compatible con la mayoría de clientes HTTP y frameworks frontend.
> - El backend la interpreta automáticamente como un objeto de criterios de búsqueda.

### Ejemplo en JavaScript (axios/fetch)

```js
const params = {
  page: 0,
  pageSize: 4,
  'search[criteria][0][field]': 'detailedDescription.bathrooms',
  'search[criteria][0][term]': '2',
  'search[criteria][0][operation]': 'eq',
};
axios.get('/api/v1/property/public', { params });
```

### 6. Filtros combinados y paginación

Página 2 de casas disponibles, ordenadas por fecha de creación descendente, 6 resultados por página:

```
GET /api/v1/property/public?page=2&pageSize=6&type=casa&status=disponible&sort=-createdAt
```

### 7. Filtros por bounding box (para mapas)

```
GET /api/v1/property/public?north=-34.5&south=-35.0&east=-58.3&west=-58.6
```

---

## Estructura de respuesta

```json
{
  "items": [
    // array de propiedades
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

---

## Notas importantes

- El endpoint es público, no requiere autenticación.
- Los campos `province` y `locality` pueden venir como IDs o como objetos poblados (depende de `populate`).
- Los campos `valueForSale` y `valueForRent` solo aparecen si `pricePublic: true`.
- Puedes combinar cualquier filtro simple, anidado o búsqueda avanzada con paginación y ordenamiento.
- El formato de paginación es estándar: incluye `items` y un objeto `meta` con la información de la página.
- El backend siempre filtra para devolver solo propiedades publicadas (`publishForSale` o `publishForRent` en true).

---

## Resumen

- Usa filtros simples como query params.
- Para búsquedas complejas, usa el parámetro `search` como string JSON codificado.
- Para mapas, usa los parámetros de bounding box.
- Siempre recibirás una respuesta paginada y estructurada.
