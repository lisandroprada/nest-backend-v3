# Resumen de Datos Disponibles en la Colección `property`

Este documento detalla todos los datos que pueden extraerse actualmente de la colección `property` en el sistema. Está orientado a ingenieros que desarrollarán consultas para dashboards, KPIs y análisis avanzados.

---

## 1. Identificación y Ubicación

- `_id`: Identificador único (MongoId)
- `address`: Dirección completa
- `province`: Objeto o ID de provincia (nombre, centroide, ISO, etc.)
- `locality`: Objeto o ID de localidad (nombre, centroide, etc.)
- `lat`, `lng`: Coordenadas geográficas
- `gmaps`: Objeto Google Maps (`formattedAddress`, `placeId`)

## 2. Propietarios y Contratos

- `owners`: Array de referencias a propietarios (`Party`)
- `mainOwner`: Referencia al propietario principal
- `tenant`: Referencia a inquilino
- `contracts`: Array de contratos asociados

## 3. Características Generales

- `type`: Tipo de propiedad (departamento, casa, ph, oficina, local_comercial, galpon, lote, quinta, chacra, estudio, loft, duplex, triplex)
- `purpose`: Propósito (residencial, comercial, etc.)
- `status`: Estado (disponible, reservado, vendido, alquilado, etc.)
- `available`: Si está disponible
- `availableAt`: Fecha de disponibilidad

## 4. Publicación y Visibilidad

- `publishForSale`: Publicada para venta
- `publishForRent`: Publicada para alquiler
- `availableForSale`: Disponible para venta

## 5. Precios y Valores

- `valueForSale`: Objeto con datos de venta
  - `amount`: Monto
  - `currency`: Moneda
  - `pricePublic`: Si el precio es público
  - `paymentMethod`: Método de pago
  - `description`: Descripción adicional
  - `date`: Fecha de publicación del precio
- `valueForRent`: Objeto con datos de alquiler (mismos campos que venta)

## 6. Imágenes y Multimedia

- `img`: Array de imágenes (nombre, thumb, thumbWeb, imgSlider, título, descripción, fecha)
- `imgCover`: Imagen de portada (nombre, thumbWeb, fecha)
- Métodos para obtener imágenes huérfanas, consistencia, etc.

## 7. Características Técnicas y Specs

- `specs`: Array de strings del catálogo de características
- `associatedServices`: Array de servicios asociados
- `inventory`: Array de objetos con inventario (item, cantidad, ambiente, estado)

## 8. Descripción Detallada

- `detailedDescription`: Objeto con:
  - `availableServices`: Servicios disponibles
  - `sqFt`: Superficie total
  - `buildSqFt`: Superficie cubierta
  - `age`: Antigüedad
  - `petFriendly`: Permite mascotas
  - `rooms`: Ambientes
  - `bathrooms`: Baños
  - `orientation`: Orientación
  - `title`: Título comercial
  - `brief`: Descripción breve

## 9. Gastos y Expensas

- `expensesType`: Tipo de gastos/expensas

## 10. Estado y Fechas

- `createdAt`: Fecha de creación
- `active`: Si la propiedad está activa

---

## Ejemplo de Objeto Property

```json
{
  "_id": "507f1f77bcf86cd799439014",
  "address": "Av. Corrientes 1234, Buenos Aires",
  "province": { "_id": "507f1f77bcf86cd799439011", "name": "Buenos Aires" },
  "locality": { "_id": "507f1f77bcf86cd799439012", "name": "CABA" },
  "lat": -34.6037,
  "lng": -58.3816,
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
  "availableAt": "2025-08-01T00:00:00.000Z",
  "specs": ["aire_acondicionado", "cochera", "piscina"],
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
```

---

## Datos útiles para Dashboard/KPI

- Cantidad de propiedades por tipo, estado, provincia, localidad
- Precios promedio/mínimo/máximo de venta y alquiler
- Superficie total y cubierta promedio
- Distribución de specs/características
- Propiedades activas/inactivas/publicadas
- Fechas de alta y disponibilidad
- Inventario y servicios asociados
- Imágenes y multimedia (cantidad, portada, etc.)

---

¿Necesitas agregar algún campo extra, ejemplo de consulta, o formato especial para el ingeniero?
