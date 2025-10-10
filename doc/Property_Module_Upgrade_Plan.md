# Propuesta y Plan de Acción: Evolución del Módulo de Propiedades

**Fecha:** 2025-10-08
**Versión:** 1.0
**Autor:** Gemini Agent
**Propósito:** Presentar un análisis y un plan de implementación por etapas para integrar funcionalidades avanzadas en el módulo de propiedades actual, basándose en las especificaciones de un sistema de referencia.

## 1. Resumen Ejecutivo

El objetivo de este plan es evolucionar nuestro sistema de gestión de propiedades para incluir características de vanguardia que mejoren la inteligencia de negocio, la experiencia de usuario en mapas y la gestión de multimedia. Este documento detalla un plan de acción incremental diseñado para implementar estas mejoras manteniendo la compatibilidad con la funcionalidad existente.

### **Características Clave a Implementar:**

1.  **Gestión Avanzada de Precios y Publicación:** Control granular sobre los precios de venta/alquiler y su visibilidad pública.
2.  **Sistema de Multimedia Dedicado:** Endpoints específicos para la gestión de imágenes, planos y documentos, con procesamiento automático de versiones.
3.  **Funcionalidad de Lotes y Mapas:** Soporte para la creación de loteos sobre imágenes satelitales y endpoints optimizados para la visualización en mapas interactivos.

---

## 2. Plan de Implementación por Etapas

El plan se divide en cuatro etapas secuenciales para garantizar una implementación controlada y estable.

### **Etapa 1: Enriquecer el Modelo de Datos de `Property`**

La base de la actualización es extender la entidad `Property` actual para dar soporte a los nuevos datos.

**Acciones de Implementación:**

1.  **Modificar `src/modules/properties/entities/property.entity.ts`:**
    *   **Actualizar Campos de Precios:** Reemplazar `valor_venta` y `valor_alquiler` por objetos que contengan más detalles.

        ```typescript
        @Prop({ type: Object })
        valor_venta: {
          monto: Number,
          moneda: String, // 'USD', 'ARS'
          es_publico: Boolean,
          descripcion: String
        };

        @Prop({ type: Object })
        valor_alquiler: {
          monto: Number,
          moneda: String,
          es_publico: Boolean,
          descripcion: String
        };
        ```

    *   **Añadir Flags de Publicación:**

        ```typescript
        @Prop({ type: Boolean, default: false })
        publicar_para_venta: boolean;

        @Prop({ type: Boolean, default: false })
        publicar_para_alquiler: boolean;
        ```

    *   **Añadir Campos para Futuras Etapas (Lotes e Imágenes):**

        ```typescript
        @Prop({ type: Object })
        imagen_satelital: {
          nombre: String,
          url: String,
          ancho: Number,
          alto: Number,
          pixels_por_metro: Number
        };

        @Prop({ type: Array })
        lotes: any[];

        @Prop({ type: Array })
        imagenes: any[];
        ```

2.  **Actualizar DTOs y Servicios:** Se deberán actualizar los archivos `create-property.dto.ts`, `update-property.dto.ts` y `properties.service.ts` para reflejar y gestionar estos nuevos campos.

### **Etapa 2: Implementar Sistema Avanzado de Multimedia**

Se crearán endpoints dedicados para una gestión de archivos más robusta y especializada.

**Acciones de Implementación:**

1.  **Crear `PropertyFilesController`:** Un nuevo controlador para gestionar la carga y eliminación de archivos, separando esta lógica del `PropertiesController`.
2.  **Implementar Endpoints de Carga:**
    *   `POST /properties/:id/imagenes`: Para subir fotos de la propiedad. El backend deberá procesarlas con `sharp` para crear diferentes tamaños (ej. `thumb`, `slider`) y guardar las referencias en el nuevo campo `imagenes` de la propiedad.
    *   `POST /properties/:id/planos`: Para planos en formato de imagen.
    *   `POST /properties/:id/documentos`: Para archivos PDF, DOC, etc.
3.  **Implementar Endpoints de Gestión de Imágenes:**
    *   `DELETE /properties/:id/imagenes/:nombre_archivo`
    *   `PATCH /properties/:id/imagenes/reordenar`
    *   `PATCH /properties/:id/imagenes/:nombre_archivo/portada`

### **Etapa 3: Implementar Funcionalidad de Lotes y Mapa Satelital**

Esta etapa da soporte a la herramienta de edición de loteos del frontend.

**Acciones de Implementación:**

1.  **Implementar Endpoints de Imagen Satelital:**
    *   `POST /properties/:id/imagen-satelital`: Para subir la imagen de fondo. Es **crítico** que el backend use `sharp` para leer y almacenar las dimensiones originales (`ancho`, `alto`) de la imagen.
    *   `POST /properties/:id/imagen-satelital/calibrar`: Para establecer la escala en píxeles por metro, necesaria para calcular superficies.
2.  **Actualizar `PATCH /properties/:id`:** Este endpoint deberá ser capaz de recibir y almacenar en la base de datos el array `lotes`, que contendrá los polígonos (coordenadas, status, precio) dibujados por el frontend.

### **Etapa 4: Crear Endpoints Públicos y Optimizados para Mapas**

La última etapa se enfoca en exponer los datos de manera eficiente y segura al público.

**Acciones de Implementación:**

1.  **Crear `PublicController` (o rutas públicas):** Para manejar las peticiones no autenticadas.
2.  **Implementar `GET /properties/public`:**
    *   Debe filtrar obligatoriamente por `publicar_para_venta: true` o `publicar_para_alquiler: true`.
    *   Debe soportar los filtros de paginación existentes y el nuevo filtro por **bounding box** (coordenadas geográficas) para consultas espaciales.
    *   Debe exponer solo un subconjunto de campos seguros y públicos de la propiedad.
3.  **Implementar `GET /properties/map`:**
    *   Endpoint sin paginación, optimizado para mapas.
    *   Debe devolver una respuesta muy ligera, con solo los campos necesarios para pintar un marcador en el mapa (`_id`, `lat`, `lng`, `precio`, `imgCover`, etc.).

---

## 3. Propuestas de Mejora y Estrategia de Compatibilidad

*   **Compatibilidad:** El plan propuesto es **100% compatible con la versión actual**. Al añadir nuevos campos y endpoints en lugar de modificar los existentes, el frontend puede adoptar las nuevas características de forma gradual y sin romper la integración actual.
*   **Mejora (Consolidación de Estados):** Se recomienda unificar los campos `status` y `estado_ocupacional` en un único campo `status` con un set de valores bien definido (`DISPONIBLE`, `RESERVADO`, `ALQUILADO`, `VENDIDO`, `INACTIVO`) para simplificar la lógica en ambos extremos de la aplicación.
*   **Mejora (Abstracción de Almacenamiento):** Se sugiere la creación de un `StorageService` para manejar la lógica de subida y eliminación de archivos. Esto desacoplará el código de un sistema de archivos local y facilitará una futura migración a servicios en la nube como AWS S3.

Este documento establece una hoja de ruta clara y estructurada para la evolución del módulo de propiedades, alineándolo con funcionalidades avanzadas y preparándolo para futuras necesidades.
