# Nuevos Endpoints para Mapa tipo Airbnb

Se han agregado dos nuevos endpoints para mejorar la experiencia del mapa y permitir funcionalidad tipo Airbnb:

## 1. Endpoint `/property/map` - Datos para el Mapa

### Descripción

Devuelve todas las propiedades con datos mínimos optimizados para mostrar marcadores en el mapa, sin paginación.

### URL

```
GET /property/map
```

### Parámetros de Query (todos opcionales)

- `type`: Tipo de propiedad (departamento, casa, ph, etc.)
- `locality`: ID de la localidad
- `operation`: Tipo de operación ('sale', 'rent', 'both')
- `north`: Latitud norte del bounding box
- `south`: Latitud sur del bounding box
- `east`: Longitud este del bounding box
- `west`: Longitud oeste del bounding box

### Ejemplo de Request

```
GET /property/map?type=departamento&operation=sale&north=-34.5&south=-34.7&east=-58.3&west=-58.5
```

### Ejemplo de Response

```json
[
  {
    "_id": "64a1b2c3d4e5f6789abcdef0",
    "lat": -34.603851,
    "lng": -58.381775,
    "address": "Av. Corrientes 1234",
    "type": "departamento",
    "province": {
      "_id": "64a1b2c3d4e5f6789abcdef1",
      "nombre": "CABA"
    },
    "locality": {
      "_id": "64a1b2c3d4e5f6789abcdef2",
      "nombre": "Balvanera"
    },
    "publishForSale": true,
    "publishForRent": false,
    "imgCover": {
      "name": "property_64a1b2c3d4e5f6789abcdef0_1.jpg",
      "thumbWeb": "/uploads/properties/thumbWeb/property_64a1b2c3d4e5f6789abcdef0_1.jpg",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "title": "Hermoso departamento en Balvanera",
    "valueForSale": {
      "amount": 120000,
      "currency": "USD"
    }
  }
]
```

### Campos Devueltos

- `_id`: ID único de la propiedad
- `lat`, `lng`: Coordenadas geográficas
- `address`: Dirección de la propiedad
- `type`: Tipo de propiedad
- `province`: Información de la provincia
- `locality`: Información de la localidad
- `publishForSale`/`publishForRent`: Flags de publicación
- `imgCover`: Imagen de portada (si existe)
- `title`: Título de la propiedad (si existe)
- `valueForSale`/`valueForRent`: Precios (solo si son públicos)

## 2. Endpoint `/property/public` - Mejorado con Bounding Box

### Descripción

El endpoint público existente ahora soporta filtros de bounding box para mostrar solo las propiedades visibles en el viewport del mapa.

### URL

```
GET /property/public
```

### Nuevos Parámetros de Query (opcionales)

- `north`: Latitud norte del bounding box
- `south`: Latitud sur del bounding box
- `east`: Longitud este del bounding box
- `west`: Longitud oeste del bounding box

### Ejemplo de Request

```
GET /property/public?page=0&pageSize=10&north=-34.5&south=-34.7&east=-58.3&west=-58.5&type=departamento
```

### Ejemplo de Response

```json
{
  "items": [
    {
      "_id": "64a1b2c3d4e5f6789abcdef0",
      "address": "Av. Corrientes 1234",
      "province": {
        "_id": "64a1b2c3d4e5f6789abcdef1",
        "nombre": "CABA"
      },
      "locality": {
        "_id": "64a1b2c3d4e5f6789abcdef2",
        "nombre": "Balvanera"
      },
      "lat": -34.603851,
      "lng": -58.381775,
      "type": "departamento",
      "imgCover": {
        "name": "property_64a1b2c3d4e5f6789abcdef0_1.jpg",
        "thumbWeb": "/uploads/properties/thumbWeb/property_64a1b2c3d4e5f6789abcdef0_1.jpg"
      },
      "detailedDescription": {
        "title": "Hermoso departamento en Balvanera",
        "rooms": 3,
        "bedrooms": 2,
        "bathrooms": 1
      },
      "valueForSale": {
        "amount": 120000,
        "currency": "USD"
      }
    }
  ],
  "meta": {
    "totalItems": 45,
    "itemCount": 10,
    "itemsPerPage": 10,
    "totalPages": 5,
    "currentPage": 0
  }
}
```

## Casos de Uso

### 1. Cargar todos los marcadores del mapa

```javascript
// Obtener todas las propiedades para mostrar marcadores
const response = await fetch('/property/map?operation=sale');
const properties = await response.json();

// Renderizar marcadores en el mapa
properties.forEach((property) => {
  const marker = new Marker({
    position: { lat: property.lat, lng: property.lng },
    title: property.address,
  });

  // InfoWindow con datos básicos
  marker.addListener('click', () => {
    const infoWindow = new InfoWindow({
      content: `
        <div>
          <img src="${property.imgCover?.thumbWeb}" />
          <h3>${property.title || property.address}</h3>
          <p>$${property.valueForSale?.amount} ${property.valueForSale?.currency}</p>
        </div>
      `,
    });
    infoWindow.open(map, marker);
  });
});
```

### 2. Filtrar por viewport del mapa

```javascript
// Cuando el usuario mueve el mapa
map.addListener('bounds_changed', async () => {
  const bounds = map.getBounds();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  // Actualizar marcadores visibles
  const response = await fetch(
    `/property/map?north=${ne.lat()}&south=${sw.lat()}&east=${ne.lng()}&west=${sw.lng()}`,
  );
  const visibleProperties = await response.json();

  // Actualizar listado lateral con paginación
  const listResponse = await fetch(
    `/property/public?page=0&pageSize=10&north=${ne.lat()}&south=${sw.lat()}&east=${ne.lng()}&west=${sw.lng()}`,
  );
  const listData = await listResponse.json();

  updatePropertyList(listData.items);
  updatePagination(listData.meta);
});
```

### 3. Combinar filtros

```javascript
// Filtrar por tipo y localidad específica
const response = await fetch(
  '/property/map?type=departamento&locality=64a1b2c3d4e5f6789abcdef2&operation=sale',
);
const apartments = await response.json();
```

## Notas de Performance

- El endpoint `/property/map` está optimizado para devolver solo los campos necesarios para el mapa
- Se recomienda usar bounding box para limitar los resultados cuando sea posible
- Los precios solo se devuelven si `pricePublic` es `true`
- Las imágenes de portada incluyen la versión `thumbWeb` optimizada para web

## Compatibilidad

- Los endpoints existentes siguen funcionando sin cambios
- La funcionalidad de bounding box es opcional y retrocompatible
- Los filtros existentes siguen funcionando normalmente
