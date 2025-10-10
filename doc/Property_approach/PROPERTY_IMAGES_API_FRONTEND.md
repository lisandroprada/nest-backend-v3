# API de Imágenes de Propiedades - Manual Completo para Frontend y Backend

Este documento describe exhaustivamente el uso de los endpoints y servicios relacionados con imágenes en el módulo de propiedades. Incluye ejemplos, formatos de request/response, validaciones, advertencias, buenas prácticas y métodos de consistencia/corrección.

---

## 📦 Endpoints disponibles

### 1. Subir imágenes a una propiedad

- **Endpoint:** `POST /api/v1/property/:id/images`
- **Autenticación:** Bearer Token (usuario autenticado)
- **Body:** `multipart/form-data` (campo `images`, máx 30 archivos de hasta 10MB)
- **Lógica:**
  - Permite subir hasta 30 imágenes por request.
  - La primera imagen subida se establece automáticamente como portada (cover).
  - Opcionalmente, puedes enviar títulos y descripciones como JSON string (ejemplo: `formData.append('titles', JSON.stringify([...]))`).
  - El backend valida que cada archivo sea una imagen válida usando `sharp`. Si algún archivo no es imagen válida, se rechaza todo el request con un error claro.
  - Solo se aceptan archivos JPEG, JPG, PNG, GIF, WebP.
  - Si algún archivo supera los 10MB, se rechaza el request.
  - Cada imagen se convierte a WebP y se generan 4 versiones: original, thumb (150x150), thumbWeb (400x300), imgSlider (800x600).

**Ejemplo curl:**

```bash
curl -X POST \
  http://localhost:3050/api/v1/property/507f1f77bcf86cd799439011/images \
  -H 'Authorization: Bearer your-jwt-token' \
  -F 'images=@image1.jpg' \
  -F 'images=@image2.png' \
  -F 'titles="[\"Fachada principal\", \"Interior cocina\"]"' \
  -F 'descriptions="[\"Vista frontal\", \"Cocina equipada\"]"'
```

**Ejemplo JavaScript/TypeScript:**

```js
const formData = new FormData();
files.forEach((file) => formData.append('images', file));
formData.append(
  'titles',
  JSON.stringify(['Fachada principal', 'Interior cocina']),
); // opcional
formData.append(
  'descriptions',
  JSON.stringify(['Vista frontal', 'Cocina equipada']),
); // opcional

const res = await fetch(`/api/v1/property/${propertyId}/images`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
const uploadedImages = await res.json();
```

**Respuesta:**

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

**Advertencias:**

- Si subes más de 30 archivos, solo se procesarán los primeros 30.
- Si algún archivo no es imagen válida, el backend rechaza el request y no sube ninguna imagen.
- La primera imagen subida se establece automáticamente como portada (cover).
- El backend valida tipo y tamaño de archivo antes de procesar.
- Si el archivo no es imagen válida, el backend responde:

```json
{
  "statusCode": 400,
  "message": "El archivo 'archivo.txt' no es una imagen válida o está corrupto.",
  "error": "Bad Request"
}
```

---

### 1b. Subir planos a una propiedad

- **Endpoint:** `POST /api/v1/property/:id/floor-plans`
- **Autenticación:** Bearer Token (usuario autenticado)
- **Body:** `multipart/form-data` (campo `floorPlans`, máx 30 archivos de hasta 10MB)
- **Lógica:**
  - Permite subir hasta 30 planos por request.
  - Solo se aceptan imágenes `.jpg`, `.jpeg`, `.png`, `.webp`.
  - Cada plano se guarda en `/uploads/properties/floorplans/`.
  - La respuesta es un array con los planos subidos:

```json
[
  {
    "url": "/uploads/properties/floorplans/uuid-filename.jpg",
    "name": "plano-original.jpg",
    "uploadedAt": "2025-08-06T10:30:00.000Z"
  }
]
```

**Ejemplo curl:**

```bash
curl -X POST \
  http://localhost:3050/api/v1/property/507f1f77bcf86cd799439011/floor-plans \
  -H 'Authorization: Bearer your-jwt-token' \
  -F 'floorPlans=@plano1.jpg' \
  -F 'floorPlans=@plano2.png'
```

---

### 2. Obtener imágenes de una propiedad

- **Endpoint:** `GET /api/v1/property/:id/images`
- **Autenticación:** Bearer Token
- **Respuesta:** Array de imágenes asociadas a la propiedad, con todos los campos y URLs de acceso.

---

### 3. Eliminar una imagen

- **Endpoint:** `DELETE /api/v1/property/:id/images/:imageName`
- **Autenticación:** Bearer Token
- **Lógica:**
  - Elimina la imagen indicada de la propiedad y del filesystem.
  - Si la imagen era portada, la siguiente imagen pasa a ser cover automáticamente.

---

### 4. Reordenar imágenes

- **Endpoint:** `PATCH /api/v1/property/:id/images/reorder`
- **Autenticación:** Bearer Token
- **Body:** JSON con el nuevo orden de los nombres de archivo:

```json
{
  "imageOrder": ["uuid-img1.webp", "uuid-img2.webp", "uuid-img3.webp"]
}
```

- **Lógica:**
  - El backend valida que todos los nombres existan.
  - Reordena el array de imágenes en la propiedad.
  - La primera imagen del array se establece como portada.

---

### 5. Establecer imagen de portada manualmente

- **Endpoint:** `PATCH /api/v1/property/:id/images/:imageName/cover`
- **Autenticación:** Bearer Token
- **Lógica:**
  - Establece la imagen indicada como portada (cover) de la propiedad.

---

### 6. Actualizar metadatos de imagen

- **Endpoint:** `PATCH /api/v1/property/:id/images/:imageName/metadata`
- **Autenticación:** Bearer Token
- **Body:** JSON con los campos a actualizar:

```json
{
  "title": "Nuevo título",
  "description": "Nueva descripción"
}
```

---

### 7. Verificar consistencia de imágenes

- **Endpoint:** `GET /api/v1/property/images-consistency`
- **Autenticación:** Opcional
- **Respuesta:** Array con el estado de cada imagen referenciada en las propiedades, indicando si existe físicamente en el filesystem.

---

### 8. Corregir inconsistencias de imágenes

- **Endpoint:** `POST /api/v1/property/fix-images-consistency`
- **Autenticación:** Opcional
- **Lógica:**
  - Elimina referencias a imágenes inexistentes en los registros de propiedades.
  - Devuelve informe de las acciones realizadas.

---

### 9. Corregir inconsistencias en una propiedad individual

- **Endpoint:** `POST /api/v1/property/:id/fix-images-consistency`
- **Autenticación:** Opcional
- **Lógica:**
  - Elimina referencias a imágenes inexistentes en la propiedad indicada.

---

### 10. Buscar imágenes huérfanas

- **Endpoint:** `GET /api/v1/property/orphan-images`
- **Autenticación:** Opcional
- **Respuesta:** Array de archivos de imagen que existen en el filesystem pero no están referenciados por ninguna propiedad.

---

## 🗂️ Estructura de Archivos Generados

Para cada imagen subida se generan 4 versiones:

```
uploads/properties/
├── original/     # Imagen original convertida a WebP (calidad 90%)
├── thumb/        # Thumbnail 150x150px (calidad 80%)
├── thumbWeb/     # Thumbnail web 400x300px (calidad 85%)
└── imgSlider/    # Imagen para slider 800x600px (calidad 90%)
```

## 🌐 URLs de Acceso

- Original: `/uploads/properties/original/[filename].webp`
- Thumbnail: `/uploads/properties/thumb/[filename].webp`
- Thumbnail Web: `/uploads/properties/thumbWeb/[filename].webp`
- Slider: `/uploads/properties/imgSlider/[filename].webp`

## 📄 Formato de Respuesta

**Upload de Imágenes / Obtener Imágenes:**

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

## ✅ Validaciones

- **Tipos de archivo permitidos:** JPEG, JPG, PNG, GIF, WebP
- **Tamaño máximo por archivo:** 10MB
- **Número máximo de archivos por request:** 30 (imágenes y planos)
- **Formatos de salida:** WebP (optimizado para web)
- **Validación de imagen:** El backend valida que cada archivo sea una imagen válida usando `sharp`. Si no lo es, rechaza el request con error claro.

## ⚠️ Advertencias y buenas prácticas

- Usa siempre `FormData` para uploads.
- No envíes títulos ni descripciones al subir imágenes si el backend no lo soporta.
- La portada se determina automáticamente (primera imagen) o manualmente con el endpoint de cover.
- El backend valida tipo y tamaño de archivo antes de procesar.
- Si eliminas la portada, la siguiente imagen pasa a ser cover.
- El orden de las imágenes es importante para la UI y la portada.
- Si el archivo no es imagen válida, el backend rechaza el request y muestra un error claro.

## 🛠️ Métodos de Consistencia y Corrección

- **GET /property/images-consistency:** Permite al frontend obtener un informe de consistencia entre las imágenes referenciadas y las existentes en disco.
- **POST /property/fix-images-consistency:** Permite al frontend solicitar la corrección automática de inconsistencias (eliminando referencias a imágenes inexistentes).

## 🏭 Consideraciones de Producción

1. **Almacenamiento:** Considera usar servicios como AWS S3, Google Cloud Storage o similar.
2. **CDN:** Implementa un CDN para servir las imágenes de manera más eficiente.
3. **Backup:** Configura respaldos automáticos de las imágenes.
4. **Monitoreo:** Implementa monitoreo del espacio en disco utilizado.
5. **Limpieza:** Considera implementar un job que elimine imágenes huérfanas.

## 🚀 Extensiones Futuras

- Soporte para videos
- Watermarks automáticos
- Redimensionamiento dinámico
- Compresión adaptativa según el dispositivo
- Integración con servicios de almacenamiento en la nube

---

**Mantén solo este documento:** `PROPERTY_IMAGES_API_FRONTEND.md`
**Puedes borrar:** `IMAGES_SERVICE_DOCUMENTATION.md`
