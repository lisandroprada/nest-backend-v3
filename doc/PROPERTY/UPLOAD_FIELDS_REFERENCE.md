# 📋 Referencia de Campos para Upload - Property Module

**Este documento lista los nombres EXACTOS de los campos que espera el backend en los endpoints de upload.**

---

## ⚠️ Importante

Los nombres de los campos en FormData deben coincidir **EXACTAMENTE** con los que espera el backend. Si el frontend envía un nombre diferente, recibirá error `"Unexpected field"`.

---

## 🖼️ Imágenes de Propiedad

### Endpoint: `POST /api/v1/properties/:id/imagenes`

**Campo esperado:** `imagenes` (plural, múltiples archivos)

**Backend Controller:**

```typescript
@UseInterceptors(FilesInterceptor('imagenes', 10))
```

**Ejemplo Frontend Correcto:**

```typescript
const formData = new FormData();
formData.append('imagenes', file1); // ✅ CORRECTO
formData.append('imagenes', file2); // ✅ Múltiples archivos con el mismo nombre
formData.append('imagenes', file3);
```

**Ejemplo Frontend Incorrecto:**

```typescript
formData.append('imagen', file); // ❌ ERROR: Unexpected field "imagen"
formData.append('images', file); // ❌ ERROR: Unexpected field "images"
formData.append('files', file); // ❌ ERROR: Unexpected field "files"
```

**cURL:**

```bash
curl -X POST "http://localhost:3050/api/v1/properties/:id/imagenes" \
  -H "Authorization: Bearer {token}" \
  -F "imagenes=@image1.jpg" \
  -F "imagenes=@image2.jpg"
```

---

## 📐 Planos

### Endpoint: `POST /api/v1/properties/:id/planos`

**Campos esperados:**

- `planos` (plural, múltiples archivos)
- `descripciones` (opcional, array de strings)

**Backend Controller:**

```typescript
@UseInterceptors(FilesInterceptor('planos', 5))
async uploadPlanos(
  @UploadedFiles() files: Array<Express.Multer.File>,
  @Body() body: { descripciones?: string[] },
)
```

**Ejemplo Frontend Correcto:**

```typescript
const formData = new FormData();
formData.append('planos', file1); // ✅ CORRECTO
formData.append('planos', file2);
formData.append('descripciones[]', 'Planta Baja');
formData.append('descripciones[]', 'Planta Alta');
```

**Ejemplo Frontend Incorrecto:**

```typescript
formData.append('plano', file); // ❌ ERROR: Unexpected field "plano"
formData.append('floorplans', file); // ❌ ERROR: Unexpected field "floorplans"
```

**cURL:**

```bash
curl -X POST "http://localhost:3050/api/v1/properties/:id/planos" \
  -H "Authorization: Bearer {token}" \
  -F "planos=@plano1.jpg" \
  -F "planos=@plano2.jpg" \
  -F "descripciones[]=Planta Baja" \
  -F "descripciones[]=Planta Alta"
```

---

## 📄 Documentos

### Endpoint: `POST /api/v1/properties/:id/documentos`

**Campo esperado:** `documentos` (plural, múltiples archivos)

**Backend Controller:**

```typescript
@UseInterceptors(FilesInterceptor('documentos', 10))
```

**Ejemplo Frontend Correcto:**

```typescript
const formData = new FormData();
formData.append('documentos', pdfFile1); // ✅ CORRECTO
formData.append('documentos', pdfFile2);
```

**Ejemplo Frontend Incorrecto:**

```typescript
formData.append('documento', file); // ❌ ERROR: Unexpected field "documento"
formData.append('documents', file); // ❌ ERROR: Unexpected field "documents"
formData.append('files', file); // ❌ ERROR: Unexpected field "files"
```

**cURL:**

```bash
curl -X POST "http://localhost:3050/api/v1/properties/:id/documentos" \
  -H "Authorization: Bearer {token}" \
  -F "documentos=@contrato.pdf" \
  -F "documentos=@escritura.pdf"
```

---

## 🛰️ Imagen Satelital

### Endpoint: `POST /api/v1/properties/:id/imagen-satelital`

**Campo esperado:** `imagen` (singular, UN SOLO archivo)

**Backend Controller:**

```typescript
@UseInterceptors(FileInterceptor('imagen'))  // ⚠️ Singular!
```

**Ejemplo Frontend Correcto:**

```typescript
const formData = new FormData();
formData.append('imagen', satelliteFile); // ✅ CORRECTO - singular
```

**Ejemplo Frontend Incorrecto:**

```typescript
formData.append('imagenes', file); // ❌ ERROR: Unexpected field "imagenes"
formData.append('satellite', file); // ❌ ERROR: Unexpected field "satellite"
formData.append('imagen-satelital', file); // ❌ ERROR: Unexpected field "imagen-satelital"
```

**cURL:**

```bash
curl -X POST "http://localhost:3050/api/v1/properties/:id/imagen-satelital" \
  -H "Authorization: Bearer {token}" \
  -F "imagen=@satelital.jpg"
```

---

## 🔍 Resumen Rápido

| Endpoint                                | Campo FormData | Tipo         | Máximo Archivos |
| --------------------------------------- | -------------- | ------------ | --------------- |
| `POST /properties/:id/imagenes`         | `imagenes`     | Múltiple     | 10              |
| `POST /properties/:id/planos`           | `planos`       | Múltiple     | 5               |
| `POST /properties/:id/documentos`       | `documentos`   | Múltiple     | 10              |
| `POST /properties/:id/imagen-satelital` | `imagen`       | **Singular** | 1               |

---

## 🐛 Debugging

### Error: "Unexpected field"

**Causa:** El nombre del campo en FormData no coincide con el esperado en el backend.

**Solución:**

1. Verifica esta tabla
2. Usa **exactamente** el nombre del campo especificado
3. Respeta singular/plural según corresponda

### Ejemplo de Error:

```json
{ "statusCode": 400, "message": "Unexpected field", "error": "Bad Request" }
```

**Verificar:**

- ¿Usaste `imagen` en vez de `imagenes`?
- ¿Usaste `imagenes` en vez de `imagen` para satelital?
- ¿Olvidaste el plural en `planos` o `documentos`?

---

## 💡 Tips Frontend

### React + TypeScript

```typescript
// Función genérica para upload de imágenes
async function uploadPropertyImages(
  propertyId: string,
  files: File[],
): Promise<Property> {
  const formData = new FormData();

  // Importante: usar 'imagenes' (plural)
  files.forEach((file) => {
    formData.append('imagenes', file);
  });

  const response = await fetch(
    `${API_URL}/api/v1/properties/${propertyId}/imagenes`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // NO enviar Content-Type, FormData lo maneja automáticamente
      },
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error('Error uploading images');
  }

  return response.json();
}

// Función para imagen satelital (singular)
async function uploadSatelliteImage(
  propertyId: string,
  file: File,
): Promise<Property> {
  const formData = new FormData();

  // Importante: usar 'imagen' (singular)
  formData.append('imagen', file);

  const response = await fetch(
    `${API_URL}/api/v1/properties/${propertyId}/imagen-satelital`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error('Error uploading satellite image');
  }

  return response.json();
}
```

### Axios

```typescript
import axios from 'axios';

// Upload imágenes
const formData = new FormData();
files.forEach((file) => formData.append('imagenes', file));

await axios.post(`/api/v1/properties/${propertyId}/imagenes`, formData, {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'multipart/form-data',
  },
});

// Upload imagen satelital
const satelliteFormData = new FormData();
satelliteFormData.append('imagen', satelliteFile);

await axios.post(
  `/api/v1/properties/${propertyId}/imagen-satelital`,
  satelliteFormData,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  },
);
```

---

## ✅ Checklist para Frontend

Antes de implementar, verifica:

- [ ] ¿Estás usando `imagenes` (plural) para fotos de la propiedad?
- [ ] ¿Estás usando `imagen` (singular) para imagen satelital?
- [ ] ¿Estás usando `planos` (plural) para planos?
- [ ] ¿Estás usando `documentos` (plural) para documentos?
- [ ] ¿No estás enviando `Content-Type` manualmente con FormData?
- [ ] ¿Estás incluyendo el header `Authorization: Bearer {token}`?
- [ ] ¿Estás respetando los límites de archivos (10 imagenes, 5 planos, etc)?
