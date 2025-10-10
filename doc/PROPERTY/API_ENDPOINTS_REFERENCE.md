# Guía Rápida de Endpoints - Property Module

**Base URL Desarrollo:** `http://localhost:3050/api/v1`

---

## 🌍 Endpoints Públicos (Sin Autenticación)

### 1. Buscar Propiedades Públicas

**URL:** `GET /api/v1/public-properties`

**Query Parameters:**

- `tipo`: 'venta' | 'alquiler' (opcional)
- `proposito`: 'COMERCIAL' | 'VIVIENDA' | 'INDUSTRIAL' | 'MIXTO' (opcional)
- `minLat`, `maxLat`, `minLng`, `maxLng`: Coordenadas para filtrar por área (opcional)
- `minPrecio`, `maxPrecio`: Rango de precios (opcional)
- `dormitorios`: Número mínimo de dormitorios (opcional)
- `banos`: Número mínimo de baños (opcional)
- `ambientes`: Número mínimo de ambientes (opcional)
- **`page`**: Número de página (default: 0)
- **`pageSize`**: Cantidad por página (default: 20)
- `sort`: Campo para ordenar (opcional)

**Ejemplo:**

```bash
curl "http://localhost:3050/api/v1/public-properties?tipo=venta&pageSize=10&page=0"
```

**Respuesta:**

```json
{
  "data": [
    {
      "id": "...",
      "identificador": "PROP-001",
      "direccion": {...},
      "caracteristicas": {...},
      "precio_venta": {...},
      "imagenes": [...]
    }
  ],
  "total": 100,
  "limit": 10,
  "offset": 0
}
```

---

### 2. Detalle de Propiedad Pública

**URL:** `GET /api/v1/properties/public/:id`

**Ejemplo:**

```bash
curl "http://localhost:3050/api/v1/public-properties/507f1f77bcf86cd799439011"
```

---

### 3. Propiedades para Mapa

**URL:** `GET /api/v1/public-properties/map`

**Query Parameters (Requeridos):**

- `minLat`, `maxLat`, `minLng`, `maxLng`: Límites del mapa visible

**Query Parameters (Opcionales):**

- `tipo`: 'venta' | 'alquiler'
- `proposito`: 'COMERCIAL' | 'VIVIENDA' | 'INDUSTRIAL' | 'MIXTO'

**Ejemplo:**

```bash
curl "http://localhost:3050/api/v1/public-properties/map?minLat=-34.7&maxLat=-34.5&minLng=-58.5&maxLng=-58.3&tipo=venta"
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
  }
]
```

---

## 🔐 Endpoints Privados (Requieren JWT Token)

**Header requerido:**

```
Authorization: Bearer {tu-token-jwt}
```

### Gestión de Imágenes

#### Subir Imágenes

**URL:** `POST /api/v1/properties/:id/imagenes`
**Content-Type:** `multipart/form-data`
**Body:** Campo `imagenes` con archivos

```bash
curl -X POST "http://localhost:3050/api/v1/properties/:id/imagenes" \
  -H "Authorization: Bearer {token}" \
  -F "imagenes=@image1.jpg" \
  -F "imagenes=@image2.jpg"
```

#### Eliminar Imagen

**URL:** `DELETE /api/v1/properties/:id/imagenes/:fileName`

```bash
curl -X DELETE "http://localhost:3050/api/v1/properties/:id/imagenes/imagen.jpg" \
  -H "Authorization: Bearer {token}"
```

#### Reordenar Imágenes

**URL:** `PATCH /api/v1/properties/:id/imagenes/reordenar`
**Content-Type:** `application/json`

```bash
curl -X PATCH "http://localhost:3050/api/v1/properties/:id/imagenes/reordenar" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"ordenImagenes": ["img1.jpg", "img2.jpg"]}'
```

#### Establecer Portada

**URL:** `PATCH /api/v1/properties/:id/imagenes/:fileName/portada`

```bash
curl -X PATCH "http://localhost:3050/api/v1/properties/:id/imagenes/imagen.jpg/portada" \
  -H "Authorization: Bearer {token}"
```

---

### Gestión de Planos

#### Subir Planos

**URL:** `POST /api/v1/properties/:id/planos`
**Content-Type:** `multipart/form-data`

```bash
curl -X POST "http://localhost:3050/api/v1/properties/:id/planos" \
  -H "Authorization: Bearer {token}" \
  -F "planos=@plano1.jpg" \
  -F "descripciones[]=Plano Planta Baja"
```

#### Eliminar Plano

**URL:** `DELETE /api/v1/properties/:id/planos/:fileName`

---

### Gestión de Documentos

#### Subir Documentos

**URL:** `POST /api/v1/properties/:id/documentos`
**Content-Type:** `multipart/form-data`

```bash
curl -X POST "http://localhost:3050/api/v1/properties/:id/documentos" \
  -H "Authorization: Bearer {token}" \
  -F "documentos=@documento.pdf"
```

#### Eliminar Documento

**URL:** `DELETE /api/v1/properties/:id/documentos/:fileName`

---

### Sistema de Lotes

#### Subir Imagen Satelital

**URL:** `POST /api/v1/properties/:id/imagen-satelital`
**Content-Type:** `multipart/form-data`

```bash
curl -X POST "http://localhost:3050/api/v1/properties/:id/imagen-satelital" \
  -H "Authorization: Bearer {token}" \
  -F "imagen=@satelital.jpg"
```

#### Calibrar Imagen Satelital

**URL:** `POST /api/v1/properties/:id/imagen-satelital/calibrar`
**Content-Type:** `application/json`

```bash
curl -X POST "http://localhost:3050/api/v1/properties/:id/imagen-satelital/calibrar" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"pixels_por_metro": 10.5}'
```

#### Actualizar Lotes

**URL:** `PATCH /api/v1/properties/:id`
**Content-Type:** `application/json`

```bash
curl -X PATCH "http://localhost:3050/api/v1/properties/:id" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "lotes": [
      {
        "id": "lote-1",
        "coordenadas": [
          {"x": 100, "y": 200},
          {"x": 150, "y": 200},
          {"x": 150, "y": 250},
          {"x": 100, "y": 250}
        ],
        "status": "DISPONIBLE",
        "precio": 50000,
        "moneda": "USD",
        "superficie_m2": 250
      }
    ]
  }'
```

---

## 🔍 Ejemplos de Uso Común

### Búsqueda Básica

```
GET /api/v1/properties/public?tipo=venta&page=0&pageSize=20
```

### Búsqueda con Filtros

```
GET /api/v1/properties/public?tipo=venta&proposito=VIVIENDA&dormitorios=3&minPrecio=100000&maxPrecio=200000&page=0&pageSize=10
```

### Búsqueda por Área Geográfica

```
GET /api/v1/properties/public?minLat=-34.7&maxLat=-34.5&minLng=-58.5&maxLng=-58.3&page=0&pageSize=20
```

### Mapa con Filtros

```
GET /api/v1/properties/map?minLat=-34.7&maxLat=-34.5&minLng=-58.5&maxLng=-58.3&tipo=venta&proposito=VIVIENDA
```

---

## 📊 Estructura de Respuesta de Paginación

```json
{
  "data": [...],      // Array de propiedades
  "total": 150,       // Total de registros que coinciden con los filtros
  "limit": 20,        // Tamaño de página usado
  "offset": 0         // Offset usado (page * pageSize)
}
```

**Cálculo de páginas:**

- Total de páginas: `Math.ceil(total / pageSize)`
- Página actual: `page`
- Siguiente página: `page + 1` (si existe)
- Página anterior: `page - 1` (si existe)

---

## ⚠️ Errores Comunes

### 401 Unauthorized

- **Causa:** Falta token JWT o es inválido
- **Solución:** Asegurar que el header `Authorization: Bearer {token}` esté presente
- **Nota:** Los endpoints `/public` y `/map` NO requieren autenticación

### 404 Not Found

- **Causa:** ID de propiedad no existe
- **Solución:** Verificar que el ID sea válido

### 400 Bad Request

- **Causa:** Parámetros inválidos
- **Solución:** Revisar tipos de datos y valores permitidos

---

## 🧪 Testing con cURL

### Obtener Token (Login)

```bash
curl -X POST "http://localhost:3050/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password"
  }'
```

### Usar Token en Requests

```bash
TOKEN="tu-token-aqui"

curl "http://localhost:3050/api/v1/properties/:id/imagenes" \
  -H "Authorization: Bearer $TOKEN" \
  -F "imagenes=@test.jpg"
```

---

## 📝 Notas Importantes

1. **Prefijo Global:** Todas las rutas tienen el prefijo `/api/v1`
2. **Puerto:** El servidor corre en `http://localhost:3050`
3. **CORS:** Configurado para permitir orígenes específicos
4. **Paginación:** Usa `page` (número de página, base 0) y `pageSize` (elementos por página)
5. **Endpoints Públicos:** Marcados con `@Public()`, no requieren autenticación
6. **Tamaño Máximo:** Las peticiones pueden tener hasta 20MB de payload

---

**Última actualización:** 9 de Octubre, 2025
