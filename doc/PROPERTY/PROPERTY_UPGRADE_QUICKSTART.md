# Property Module Upgrade - Guía de Inicio Rápido

## 🎯 Resumen

Se ha completado la implementación del upgrade del módulo de propiedades según las 4 etapas del plan:

✅ **Etapa 1**: Modelo de datos enriquecido
✅ **Etapa 2**: Sistema de multimedia dedicado
✅ **Etapa 3**: Funcionalidad de lotes y mapas
✅ **Etapa 4**: Endpoints públicos optimizados

---

## 📁 Archivos Creados

### Servicios

- `src/modules/properties/services/storage.service.ts` - Gestión de archivos y procesamiento de imágenes
- `src/modules/properties/property-files.service.ts` - Lógica de negocio para archivos
- `src/modules/properties/public-properties.service.ts` - Lógica para endpoints públicos

### Controladores

- `src/modules/properties/property-files.controller.ts` - Endpoints de gestión de archivos
- `src/modules/properties/public-properties.controller.ts` - Endpoints públicos

### DTOs

- `src/modules/properties/dto/public-property-query.dto.ts` - Query params para búsquedas públicas
- `src/modules/properties/dto/map-query.dto.ts` - Query params para mapas
- `src/modules/properties/dto/update-lotes.dto.ts` - DTO para actualización de lotes

### Documentación

- `doc/PROPERTY_MODULE_UPGRADE_IMPLEMENTATION.md` - Documentación completa de la API

---

## 🚀 Cómo Probar

### 1. Verificar Compilación

```bash
npm run build
```

### 2. Iniciar el Servidor

```bash
npm run start:dev
```

### 3. Probar Endpoints Públicos (sin autenticación)

```bash
# Listar propiedades públicas
curl http://localhost:3000/properties/public?tipo=venta&pageSize=10

# Ver propiedades en un mapa
curl "http://localhost:3000/properties/map?minLat=-34.7&maxLat=-34.5&minLng=-58.5&maxLng=-58.3"
```

### 4. Probar Endpoints Privados (con autenticación)

Necesitarás un token JWT válido. Primero autentícate:

```bash
# Ejemplo de login (ajusta según tu sistema de auth)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

Luego usa el token para subir una imagen:

```bash
# Subir imágenes a una propiedad
curl -X POST http://localhost:3000/properties/{propertyId}/imagenes \
  -H "Authorization: Bearer {tu-token}" \
  -F "imagenes=@/path/to/image1.jpg" \
  -F "imagenes=@/path/to/image2.jpg"
```

---

## 🔧 Configuración Recomendada

### 1. Crear Índices Geoespaciales en MongoDB

Conecta a tu base de datos y ejecuta:

```javascript
db.properties.createIndex({ 'direccion.latitud': 1, 'direccion.longitud': 1 });
db.properties.createIndex({ publicar_para_venta: 1 });
db.properties.createIndex({ publicar_para_alquiler: 1 });
db.properties.createIndex({ status: 1 });
```

### 2. Configurar CORS (si usas frontend separado)

En `src/main.ts`:

```typescript
app.enableCors({
  origin: ['http://localhost:4200', 'https://tu-frontend.com'],
  credentials: true,
});
```

### 3. Servir Archivos Estáticos

Asegúrate de que la carpeta `uploads` esté configurada en `src/main.ts`:

```typescript
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

// ...

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });
```

---

## 📊 Ejemplos de Uso desde el Frontend

### Subir Imágenes

```javascript
const formData = new FormData();
formData.append('imagenes', imageFile1);
formData.append('imagenes', imageFile2);

const response = await fetch(`/properties/${propertyId}/imagenes`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

### Buscar Propiedades en un Mapa

```javascript
const bounds = map.getBounds();
const response = await fetch(
  `/properties/map?minLat=${bounds.south}&maxLat=${bounds.north}&minLng=${bounds.west}&maxLng=${bounds.east}&tipo=venta`,
);

const markers = await response.json();
markers.forEach((marker) => {
  // Crear marcador en el mapa con marker.lat, marker.lng, marker.precio, etc.
});
```

### Gestionar Lotes sobre Imagen Satelital

```javascript
// 1. Subir imagen satelital
const formData = new FormData();
formData.append('imagen', satelliteImage);

await fetch(`/properties/${propertyId}/imagen-satelital`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

// 2. Calibrar escala
await fetch(`/properties/${propertyId}/imagen-satelital/calibrar`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ pixels_por_metro: 10.5 }),
});

// 3. Guardar lotes dibujados
const lotes = [
  {
    id: 'lote-1',
    coordenadas: [
      { x: 100, y: 200 },
      { x: 150, y: 200 },
      { x: 150, y: 250 },
      { x: 100, y: 250 },
    ],
    status: 'DISPONIBLE',
    precio: 50000,
    moneda: 'USD',
    superficie_m2: 250,
  },
];

await fetch(`/properties/${propertyId}`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ lotes }),
});
```

---

## 🔍 Verificar la Implementación

### Endpoints Implementados

Puedes verificar que todos los endpoints estén activos revisando las rutas en:

```bash
# Ver todas las rutas registradas
npm run start:dev
# Luego verifica los logs de NestJS que mostrarán todas las rutas
```

### Estructura de Base de Datos

Verifica que el esquema se haya actualizado correctamente:

```javascript
// En MongoDB
db.properties.findOne();
// Deberías ver los nuevos campos:
// - valor_venta_detallado
// - valor_alquiler_detallado
// - publicar_para_venta
// - publicar_para_alquiler
// - imagenes
// - planos
// - imagen_satelital
// - lotes
```

---

## ⚠️ Consideraciones Importantes

### 1. Migración de Datos Existentes

Si tienes propiedades existentes, considera ejecutar una migración para:

- Convertir `valor_venta` simple a `valor_venta_detallado`
- Convertir `valor_alquiler` simple a `valor_alquiler_detallado`
- Establecer valores por defecto para `publicar_para_venta` y `publicar_para_alquiler`

### 2. Espacio en Disco

El procesamiento de imágenes creará 3 versiones de cada imagen. Asegúrate de tener suficiente espacio:

- Original: Tamaño completo
- Slider: ~100-300 KB por imagen
- Thumb: ~20-50 KB por imagen

### 3. Rendimiento

Para bases de datos grandes:

- Usa índices en los campos de filtro más comunes
- Implementa caché en Redis para el endpoint `/properties/map`
- Considera usar CDN para servir imágenes

### 4. Seguridad

- Los endpoints privados requieren autenticación
- Los archivos se guardan con nombres UUID para evitar conflictos
- Los precios pueden ocultarse con el flag `es_publico: false`

---

## 📖 Documentación Completa

Para más detalles, consulta:

- `doc/PROPERTY_MODULE_UPGRADE_IMPLEMENTATION.md` - API completa
- `doc/Property_Module_Upgrade_Plan.md` - Plan original

---

## 🆘 Soporte

Si encuentras algún problema:

1. Verifica que todas las dependencias estén instaladas: `npm install`
2. Revisa los logs del servidor para errores específicos
3. Asegúrate de que MongoDB esté corriendo
4. Verifica que la carpeta `uploads/properties` exista y tenga permisos de escritura

---

## ✅ Checklist de Implementación

- [x] Modelo de datos actualizado
- [x] DTOs creados y validados
- [x] StorageService para gestión de archivos
- [x] PropertyFilesController y Service
- [x] PublicPropertiesController y Service
- [x] Procesamiento de imágenes con Sharp
- [x] Endpoints públicos sin autenticación
- [x] Filtros geoespaciales
- [x] Sistema de lotes
- [ ] Índices en MongoDB (manual)
- [ ] Configuración de CORS (si aplica)
- [ ] Migración de datos existentes (si aplica)
- [ ] Pruebas end-to-end

---

## 🎉 ¡Implementación Completa!

El módulo de propiedades ahora cuenta con:

- ✨ Gestión avanzada de multimedia
- 🗺️ Soporte completo para mapas interactivos
- 📦 Sistema de lotes para división de terrenos
- 🔒 Control granular de privacidad de precios
- 🚀 Endpoints optimizados para rendimiento
- 🔄 100% compatible con la versión anterior
