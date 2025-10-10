# Property Module v2.0 - Documentación para Frontend

**Fecha:** 9 de Octubre, 2025  
**Versión Backend:** 2.0  
**Estado:** ✅ Listo para integración

---

## 🚀 Empezar Aquí

### Orden de Lectura Recomendado

1. **📖 Guía Rápida**: `PROPERTY_UPGRADE_QUICKSTART.md`
   - ⏱️ Tiempo de lectura: 10-15 minutos
   - Lee primero las secciones "Endpoints Públicos" y "Endpoints Privados"
   - Prueba los endpoints con Postman/Insomnia
   - **Empezar por aquí si quieres una visión general**

2. **⚠️ IMPORTANTE - Campos de Upload**: `UPLOAD_FIELDS_REFERENCE.md`
   - ⏱️ Tiempo de lectura: 5 minutos
   - **LEE ESTO ANTES de implementar upload de archivos**
   - Nombres EXACTOS de campos FormData que espera el backend
   - Evita errores "Unexpected field"
   - **Referencia obligatoria para multimedia**

3. **💻 Ejemplos de Código**: `FRONTEND_INTEGRATION_EXAMPLES.md`
   - ⏱️ Tiempo de lectura: 20-30 minutos
   - Código React/TypeScript completo y listo para usar
   - Ejemplos de todos los casos de uso
   - Hooks personalizados y componentes
   - **Empezar por aquí si quieres código inmediato**

4. **📚 Referencia API**: `PROPERTY_MODULE_UPGRADE_IMPLEMENTATION.md`
   - ⏱️ Tiempo de lectura: 30-45 minutos
   - Documentación técnica completa
   - Especificación detallada de todos los endpoints
   - **Usar como referencia durante el desarrollo**

5. **🏗️ Arquitectura**: `ARCHITECTURE_DIAGRAM.md` (Opcional)
   - ⏱️ Tiempo de lectura: 15-20 minutos
   - Diagramas de arquitectura y flujos
   - Para desarrolladores senior o líderes técnicos

---

## 🎯 Nuevas Funcionalidades Disponibles

### 1. Sistema de Multimedia Avanzado

**Qué hace:**

- Subida múltiple de imágenes con procesamiento automático
- 3 versiones por imagen: thumb (200px), slider (800px), original
- Drag & drop para reordenar imágenes
- Gestión de planos y documentos PDF

**Endpoints principales:**

```
POST   /properties/:id/imagenes              - Subir imágenes
DELETE /properties/:id/imagenes/:fileName    - Eliminar imagen
PATCH  /properties/:id/imagenes/reordenar    - Reordenar
PATCH  /properties/:id/imagenes/:fileName/portada - Establecer portada
POST   /properties/:id/planos                - Subir planos
POST   /properties/:id/documentos            - Subir documentos
```

**Casos de uso:**

- Agente sube fotos de propiedad desde su móvil
- Sistema genera automáticamente thumbnails para listados
- Usuario reordena galería arrastrando imágenes
- Establecer foto de portada para el catálogo

---

### 2. Búsqueda Pública de Propiedades

**Qué hace:**

- Endpoint público sin autenticación para portales
- Filtros avanzados (precio, características, ubicación)
- Paginación integrada
- Búsqueda por bounding box geográfico

**Endpoints principales:**

```
GET /properties/public          - Buscar propiedades
GET /properties/public/:id      - Detalle de propiedad
```

**Parámetros de búsqueda:**

- `tipo`: 'venta' | 'alquiler'
- `proposito`: 'COMERCIAL' | 'VIVIENDA' | 'INDUSTRIAL' | 'MIXTO'
- `minLat`, `maxLat`, `minLng`, `maxLng`: Coordenadas geográficas
- `minPrecio`, `maxPrecio`: Rango de precios
- `dormitorios`, `banos`, `ambientes`: Características
- `page`, `pageSize`: Paginación

**Casos de uso:**

- Portal público de búsqueda de propiedades
- Widget de propiedades en sitio web
- Aplicación móvil de catálogo

---

### 3. Visualización en Mapas Interactivos

**Qué hace:**

- Endpoint ultra-optimizado para mapas
- Filtro por área visible del mapa (bounding box)
- Respuesta mínima: solo datos necesarios para marcadores
- Límite de 500 propiedades para rendimiento

**Endpoint principal:**

```
GET /properties/map
```

**Parámetros requeridos:**

- `minLat`, `maxLat`, `minLng`, `maxLng`: Límites del mapa visible
- `tipo`: 'venta' | 'alquiler' (opcional)

**Respuesta típica:**

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

**Casos de uso:**

- Mapa interactivo con Google Maps / Leaflet
- Búsqueda por zona geográfica
- Vista rápida de propiedades en el área

---

### 4. Sistema de Lotes para Terrenos

**Qué hace:**

- Subida de imagen satelital del terreno
- Calibración de escala (píxeles por metro)
- Editor de polígonos sobre la imagen
- Cálculo automático de superficies
- Guardar lotes con coordenadas, precios y estados

**Endpoints principales:**

```
POST /properties/:id/imagen-satelital           - Subir imagen
POST /properties/:id/imagen-satelital/calibrar  - Calibrar escala
PATCH /properties/:id                           - Guardar lotes
```

**Casos de uso:**

- Inmobiliaria lotea terreno y vende parcelas
- Visualización interactiva de lotes disponibles
- Gestión de estados (disponible, reservado, vendido)

---

## 🔗 Configuración del Backend

### URLs de Conexión

**Desarrollo:**

```
http://localhost:3000
```

**Staging:** (Configurar según tu infraestructura)

```
https://api-staging.tudominio.com
```

**Producción:** (Configurar según tu infraestructura)

```
https://api.tudominio.com
```

### Autenticación

Los endpoints privados requieren un token JWT en el header:

```javascript
headers: {
  'Authorization': 'Bearer tu-token-jwt-aqui'
}
```

**Cómo obtener el token:**

1. Endpoint de login: `POST /auth/login`
2. Almacenar token en localStorage o sessionStorage
3. Incluir en todas las peticiones a endpoints privados

---

## 📝 Resumen de Endpoints

### Endpoints Públicos (Sin autenticación requerida)

| Método | Endpoint                 | Descripción                    | Uso Principal            |
| ------ | ------------------------ | ------------------------------ | ------------------------ |
| GET    | `/properties/public`     | Buscar propiedades con filtros | Portal público, listados |
| GET    | `/properties/public/:id` | Detalle de una propiedad       | Página de detalle        |
| GET    | `/properties/map`        | Datos para mapa                | Mapa interactivo         |

### Endpoints Privados (Requieren autenticación)

**Gestión de Imágenes:**

| Método | Endpoint                                     | Descripción                          |
| ------ | -------------------------------------------- | ------------------------------------ |
| POST   | `/properties/:id/imagenes`                   | Subir imágenes (multipart/form-data) |
| DELETE | `/properties/:id/imagenes/:fileName`         | Eliminar una imagen                  |
| PATCH  | `/properties/:id/imagenes/reordenar`         | Reordenar imágenes                   |
| PATCH  | `/properties/:id/imagenes/:fileName/portada` | Establecer portada                   |

**Gestión de Planos:**

| Método | Endpoint                           | Descripción    |
| ------ | ---------------------------------- | -------------- |
| POST   | `/properties/:id/planos`           | Subir planos   |
| DELETE | `/properties/:id/planos/:fileName` | Eliminar plano |

**Gestión de Documentos:**

| Método | Endpoint                               | Descripción        |
| ------ | -------------------------------------- | ------------------ |
| POST   | `/properties/:id/documentos`           | Subir documentos   |
| DELETE | `/properties/:id/documentos/:fileName` | Eliminar documento |

**Sistema de Lotes:**

| Método | Endpoint                                    | Descripción            |
| ------ | ------------------------------------------- | ---------------------- |
| POST   | `/properties/:id/imagen-satelital`          | Subir imagen satelital |
| POST   | `/properties/:id/imagen-satelital/calibrar` | Calibrar escala        |
| PATCH  | `/properties/:id`                           | Actualizar lotes       |

---

## 🛠️ Plan de Implementación Sugerido

### Fase 1: Búsqueda y Listado (Semana 1)

**Prioridad:** Alta  
**Complejidad:** Baja

- [ ] Implementar búsqueda pública (`GET /properties/public`)
- [ ] Componente de listado con paginación
- [ ] Filtros básicos (precio, tipo, ubicación)
- [ ] Tarjetas de propiedad con imagen de portada

**Archivos a revisar:**

- `FRONTEND_INTEGRATION_EXAMPLES.md` → Sección "Búsqueda Pública con Filtros"
- `PROPERTY_MODULE_UPGRADE_IMPLEMENTATION.md` → Sección "GET /properties/public"

---

### Fase 2: Galería de Imágenes (Semana 2)

**Prioridad:** Alta  
**Complejidad:** Media

- [ ] Componente de galería con lightbox
- [ ] Upload de múltiples imágenes
- [ ] Drag & drop para reordenar
- [ ] Establecer imagen de portada

**Archivos a revisar:**

- `FRONTEND_INTEGRATION_EXAMPLES.md` → Sección "Gestión de Imágenes"
- Ejemplos de código: ImageUploadComponent, ImageGalleryEditor

---

### Fase 3: Visualización en Mapa (Semana 3)

**Prioridad:** Alta  
**Complejidad:** Media

- [ ] Integración con Google Maps o Leaflet
- [ ] Cargar propiedades según bounds del mapa
- [ ] Marcadores con precio y foto
- [ ] InfoWindow con datos básicos
- [ ] Actualización al mover/hacer zoom

**Archivos a revisar:**

- `FRONTEND_INTEGRATION_EXAMPLES.md` → Sección "Búsqueda en Mapa"
- Ejemplo de código: PropertyMap component

---

### Fase 4: Detalle de Propiedad (Semana 4)

**Prioridad:** Media  
**Complejidad:** Baja

- [ ] Página de detalle completa
- [ ] Galería de fotos en slider
- [ ] Mostrar características
- [ ] Planos descargables
- [ ] Formulario de contacto

**Archivos a revisar:**

- `PROPERTY_MODULE_UPGRADE_IMPLEMENTATION.md` → Sección "GET /properties/public/:id"

---

### Fase 5: Editor de Lotes (Opcional - Semana 5+)

**Prioridad:** Baja (según necesidad del negocio)  
**Complejidad:** Alta

- [ ] Upload de imagen satelital
- [ ] Calibración de escala
- [ ] Canvas para dibujar polígonos
- [ ] Cálculo de superficies
- [ ] Guardar lotes con precios

**Archivos a revisar:**

- `FRONTEND_INTEGRATION_EXAMPLES.md` → Sección "Sistema de Lotes"
- Ejemplo de código: LotDrawer component

---

## 📦 Estructura de Datos Importantes

### Objeto Property (Propiedades Nuevas)

```typescript
interface Property {
  // ... campos existentes ...

  // Nuevos campos de precio
  valor_venta_detallado?: {
    monto: number;
    moneda: string; // 'USD', 'ARS'
    es_publico: boolean; // true = mostrar, false = "Consultar"
    descripcion: string;
  };

  valor_alquiler_detallado?: {
    monto: number;
    moneda: string;
    es_publico: boolean;
    descripcion: string;
  };

  // Flags de publicación
  publicar_para_venta: boolean;
  publicar_para_alquiler: boolean;

  // Imágenes con versiones
  imagenes: Array<{
    nombre: string;
    url: string;
    orden: number;
    es_portada: boolean;
    versiones: {
      thumb: string; // 200x200px
      slider: string; // 800x600px
      original: string;
    };
  }>;

  // Planos
  planos: Array<{ nombre: string; url: string; descripcion: string }>;

  // Imagen satelital
  imagen_satelital?: {
    nombre: string;
    url: string;
    ancho: number;
    alto: number;
    pixels_por_metro: number;
  };

  // Lotes
  lotes: Array<{
    id: string;
    coordenadas: { x: number; y: number }[];
    status: string; // 'DISPONIBLE', 'RESERVADO', 'VENDIDO'
    precio?: number;
    moneda?: string;
    superficie_m2?: number;
  }>;
}
```

---

## 🎨 Consideraciones de UI/UX

### Imágenes y Performance

1. **Usar versiones apropiadas:**
   - Listados/Tarjetas → `thumb` (200x200)
   - Galerías/Sliders → `slider` (800x600)
   - Lightbox/Zoom → `original`

2. **Lazy loading:**
   - Implementar lazy loading para imágenes
   - Usar placeholders mientras cargan

3. **Optimización:**
   - El backend ya genera 3 versiones optimizadas
   - No es necesario procesar en el frontend

### Manejo de Precios

**Si `es_publico: false`:**

```jsx
{
  property.precio_venta?.consultar ? (
    <span className="precio-consultar">Consultar</span>
  ) : (
    <span className="precio">
      {property.precio_venta?.moneda}{' '}
      {property.precio_venta?.monto?.toLocaleString()}
    </span>
  );
}
```

### Mapas

**Recomendaciones:**

- Actualizar marcadores solo al soltar el mapa (no al arrastrar)
- Debounce en búsqueda por bounds
- Mostrar máximo 500 propiedades a la vez
- Usar clustering para muchos marcadores

---

## 🔧 Configuración Necesaria

### Variables de Entorno (.env)

```bash
# Backend API
REACT_APP_API_URL=http://localhost:3000
REACT_APP_API_TIMEOUT=30000

# Google Maps (si usas mapas)
REACT_APP_GOOGLE_MAPS_API_KEY=tu-api-key-aqui

# Uploads path (para construir URLs completas)
REACT_APP_UPLOADS_BASE_URL=http://localhost:3000/uploads
```

### Dependencias Sugeridas

```json
{
  "dependencies": {
    // Para mapas
    "@react-google-maps/api": "^2.19.0",
    // o
    "react-leaflet": "^4.2.1",

    // Para drag & drop
    "react-beautiful-dnd": "^13.1.1",

    // Para galería
    "react-image-lightbox": "^5.1.4",

    // Para upload
    "react-dropzone": "^14.2.3",

    // Para estado (opcional)
    "@reduxjs/toolkit": "^1.9.7",

    // Para forms
    "react-hook-form": "^7.48.2"
  }
}
```

---

## ✅ Checklist de Integración

### Antes de Empezar

- [ ] Revisar documentación en orden sugerido
- [ ] Configurar variables de entorno
- [ ] Probar endpoints con Postman/Insomnia
- [ ] Obtener token JWT de autenticación
- [ ] Verificar CORS configurado en backend

### Durante el Desarrollo

- [ ] Implementar manejo de errores para cada endpoint
- [ ] Agregar loading states en componentes
- [ ] Validar datos antes de enviar al backend
- [ ] Usar TypeScript interfaces del documento
- [ ] Implementar feedback visual (toasts, alerts)

### Testing

- [ ] Probar subida de múltiples imágenes
- [ ] Verificar que se muestran las versiones correctas
- [ ] Probar filtros de búsqueda
- [ ] Verificar paginación
- [ ] Probar mapa con diferentes zoom levels
- [ ] Verificar responsive en móvil

### Antes de Producción

- [ ] Optimizar bundle size
- [ ] Implementar lazy loading de componentes
- [ ] Configurar CDN para imágenes (opcional)
- [ ] Agregar analytics
- [ ] Testing end-to-end

---

## 🐛 Manejo de Errores Comunes

### Error 401 - Unauthorized

**Causa:** Token JWT inválido o expirado  
**Solución:** Redirigir a login y obtener nuevo token

### Error 404 - Not Found

**Causa:** Propiedad o imagen no existe  
**Solución:** Mostrar mensaje amigable, volver a listado

### Error 413 - Payload Too Large

**Causa:** Archivo muy grande  
**Solución:** Validar tamaño antes de subir (max 10MB sugerido)

### Error 500 - Internal Server Error

**Causa:** Error en backend  
**Solución:** Mostrar mensaje genérico, reportar a backend team

---

## 📞 Soporte y Contacto

### Documentación

- Referencia completa: `PROPERTY_MODULE_UPGRADE_IMPLEMENTATION.md`
- Ejemplos de código: `FRONTEND_INTEGRATION_EXAMPLES.md`
- Arquitectura: `ARCHITECTURE_DIAGRAM.md`

### Comunicación

- **Slack/Teams:** [Canal del proyecto]
- **Email:** [Email del equipo backend]
- **Issues:** [Sistema de tickets]

### Recursos Adicionales

- Colección de Postman: [Link cuando esté disponible]
- Swagger/OpenAPI: [Link cuando esté disponible]
- Mockups/Diseños: [Link a Figma/etc]

---

## 🚀 Listo para Empezar

1. ✅ Lee `PROPERTY_UPGRADE_QUICKSTART.md` (10 min)
2. ✅ Revisa ejemplos en `FRONTEND_INTEGRATION_EXAMPLES.md` (20 min)
3. ✅ Prueba endpoints con Postman
4. ✅ Comienza con Fase 1: Búsqueda y Listado
5. ✅ ¡Consulta esta guía siempre que lo necesites!

---

**¡Éxito en la implementación!** 🎉

Si tienes dudas o encuentras algún problema, no dudes en consultar la documentación o contactar al equipo de backend.
