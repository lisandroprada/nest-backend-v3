# Propuesta de API para Gestión de Lotes en Propiedades

**Fecha:** 2025-09-23
**Autor:** Gemini Agent
**Estado:** Propuesta

## 1. Resumen del Requerimiento

El frontend ha implementado un editor de loteos que permite, sobre una imagen satelital de una propiedad, dibujar polígonos que representan sub-lotes. Para que esta funcionalidad sea persistente, es necesario que el backend pueda almacenar tanto la imagen satelital de fondo como la información detallada de cada lote dibujado.

Este documento propone las modificaciones necesarias en el schema `Property` y los endpoints de la API para dar soporte a esta funcionalidad.

## 2. Propuesta de Modificación al Schema `Property`

Se propone añadir dos nuevos campos a la entidad `Property`:

1.  `satelliteImage` (opcional): Almacenará la URL de la imagen de fondo para el editor de lotes.
2.  `lots` (opcional): Un array de objetos, donde cada objeto representa un lote (polígono) con sus detalles.

### Definición de los Nuevos Schemas

**Schema para `Lot` (un lote individual):**

```typescript
// Corresponde a la interfaz Lot en /lib/lot-types.ts
interface Point {
  x: number;
  y: number;
}

interface Lot {
  id: string; // Identificador único (e.g., UUID v4 generado en el frontend)
  name: string; // Nombre del lote, ej: "Lote A-12"
  points: Point[]; // Array de coordenadas {x, y} que definen el polígono
  status: 'available' | 'sold' | 'reserved' | 'pending' | 'inactive';
  price?: number; // Precio del lote
  currency?: 'USD' | 'ARS'; // Moneda del precio (Dólares o Pesos)
  surface?: number; // Superficie en m²
  description?: string; // Descripción adicional
}
```

**Schema para `satelliteImage`:**

```typescript
interface SatelliteImage {
  name: string; // Nombre del archivo en el servidor, ej: "uuid-image.webp"
  url: string; // URL pública para acceder a la imagen, ej: "/uploads/properties/satellite/uuid-image.webp"
  width: number; // Requerido: Ancho original de la imagen en píxeles.
  height: number; // Requerido: Alto original de la imagen en píxeles.
  pixelsPerMeter?: number; // Opcional: Ratio de píxeles por metro para cálculos de superficie.
}
```

### Schema `Property` Actualizado (fragmento)

```typescript
// ... campos existentes de la entidad Property

@Schema()
export class Property extends Document {
  // ... otros campos como address, owners, etc.

  @Prop({ type: Object })
  satelliteImage?: {
    name: string;
    url: string;
    width?: number;
    height?: number;
    pixelsPerMeter?: number;
  };

  @Prop({ type: Array })
  lots?: Lot[]; // Definido según el schema Lot de arriba

  // ... otros campos como createdAt, active, etc.
}
```

## 3. Propuesta de Nuevos Endpoints

### Subir/Actualizar Imagen Satelital

Se necesita un endpoint dedicado para manejar la carga de la imagen de fondo, separado de las imágenes generales de la propiedad.

- **Endpoint:** `POST /api/v1/property/:id/satellite-image`
- **Autenticación:** Bearer Token (usuario autenticado)
- **Body:** `multipart/form-data`
  - **Campo:** `satelliteImage` (un único archivo de imagen: jpg, png, webp)
- **Lógica:**
  - Recibe un archivo de imagen.
  - **Importante:** Extrae las dimensiones (ancho y alto) de la imagen.
  - Lo procesa (ej: convierte a webp, optimiza) y lo guarda en una ruta específica como `uploads/properties/satellite/`.
  - Actualiza el campo `satelliteImage` en el documento `Property` correspondiente con la URL y las dimensiones extraídas.
  - Si ya existía una imagen, la reemplaza y elimina el archivo antiguo.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "name": "new-uuid-image.webp",
    "url": "/uploads/properties/satellite/new-uuid-image.webp",
    "width": 1280,
    "height": 720
  }
  ```

### Calibrar Escala de Imagen Satelital

Este endpoint permite establecer la escala real de la imagen, que es crucial para calcular la superficie de los lotes.

- **Endpoint:** `POST /api/v1/property/:id/satellite-image/calibrate`
- **Autenticación:** Bearer Token
- **Body:** `application/json`
  ```json
  {
    "point1": { "x": 100, "y": 150 },
    "point2": { "x": 350, "y": 150 },
    "distanceInMeters": 20
  }
  ```
- **Lógica:**
  - Recibe dos puntos en coordenadas de píxeles y la distancia real en metros entre ellos.
  - Calcula la distancia en píxeles entre los dos puntos.
  - Calcula el ratio `pixelsPerMeter` (distancia en píxeles / distancia en metros).
  - Guarda este valor en el campo `satelliteImage.pixelsPerMeter` de la propiedad.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Imagen calibrada correctamente",
    "pixelsPerMeter": 12.5
  }
  ```

### Eliminar Imagen Satelital

- **Endpoint:** `DELETE /api/v1/property/:id/satellite-image`
- **Autenticación:** Bearer Token
- **Lógica:**
  - Elimina el archivo de imagen del servidor.
  - Limpia el campo `satelliteImage` en el documento `Property` (lo establece a `null` o lo elimina).
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Imagen satelital eliminada correctamente."
  }
  ```

## 4. Modificación de Endpoints Existentes

Los endpoints de creación y actualización de propiedades deben ser capaces de recibir y guardar la información de los lotes.

- `POST /api/v1/property`
- `PATCH /api/v1/property/:id`

Ambos endpoints deben aceptar el campo `lots` en el body de la request. El DTO (`CreatePropertyDto` y `UpdatePropertyDto`) debe ser actualizado para incluir:

```typescript
// En CreatePropertyDto y UpdatePropertyDto
// ...

readonly lots?: Lot[]; // Usando la definición de Lot de esta documentación
```

### Ejemplo de Body para `PATCH /api/v1/property/:id`

```json
{
  "lots": [
    {
      "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "name": "Lote 1",
      "points": [
        { "x": 150, "y": 100 },
        { "x": 300, "y": 120 },
        { "x": 280, "y": 250 },
        { "x": 130, "y": 230 }
      ],
      "status": "available",
      "price": 50000,
      "currency": "USD",
      "surface": 450,
      "description": "Lote con vista al lago."
    },
    {
      "id": "b2c3d4e5-f6a7-8901-2345-67890abcdef1",
      "name": "Lote 2",
      "points": [
        { "x": 320, "y": 125 },
        { "x": 450, "y": 140 },
        { "x": 430, "y": 270 },
        { "x": 300, "y": 255 }
      ],
      "status": "reserved",
      "price": 52000,
      "currency": "USD",
      "surface": 480,
      "description": ""
    }
  ]
}
```

## 5. Flujo de Uso Recomendado

1.  **Crear Propiedad:** El usuario crea una propiedad de tipo `lote` a través del formulario existente.
2.  **Subir Imagen:** En la pestaña de "Lotes", el usuario sube la imagen satelital. El backend devuelve la URL y las dimensiones originales de la imagen.
3.  **Calibrar Imagen (Opcional pero recomendado):** El frontend ofrece una herramienta para que el usuario dibuje una línea sobre la imagen y especifique su longitud real en metros. Luego, llama al endpoint `POST /api/v1/property/:id/satellite-image/calibrate`.
4.  **Dibujar y Guardar Lotes:** El usuario dibuja los polígonos en el editor. Mientras dibuja, el frontend puede calcular y mostrar la superficie real en m² si la imagen fue calibrada. Al guardar, envía la petición `PATCH /api/v1/property/:id` con el array `lots`.
5.  **Visualización:** Al acceder a la propiedad, el frontend obtiene los datos completos, incluyendo `satelliteImage` (con `url`, `width`, `height` y `pixelsPerMeter`) y el array `lots`.

## 6. Guía de Renderizado para el Frontend

Para asegurar que los polígonos de los lotes se superpongan correctamente sobre la imagen satelital, es fundamental escalar las coordenadas de los puntos (`lot.points`) en función del tamaño al que se renderiza la imagen en el navegador.

> **Nota Crítica para Backend y Frontend:**
> Las coordenadas `x` e `y` de cada punto se guardan como valores de píxeles absolutos correspondientes a las dimensiones originales de la imagen (`satelliteImage.width` y `satelliteImage.height`).
> **El backend TIENE que proveer `satelliteImage.width` y `satelliteImage.height` para que el escalado funcione.** Sin estas dimensiones originales, el frontend no puede calcular la posición correcta de los polígonos.

### Fórmula de Escalado de Puntos

Para calcular la posición de un punto en la imagen mostrada en pantalla, utiliza la siguiente fórmula:

- `punto_mostrado_x = (punto_original_x / ancho_original_imagen) * ancho_mostrado_imagen`
- `punto_mostrado_y = (punto_original_y / alto_original_imagen) * alto_mostrado_imagen`

### Cálculo de Superficie Real (m²)

Si la imagen ha sido calibrada (`satelliteImage.pixelsPerMeter` existe), puedes calcular la superficie real de un lote.

1.  **Calcular el área en píxeles cuadrados:** Usa la [Fórmula del área de Gauss (Shoelace formula)](https://es.wikipedia.org/wiki/F%C3%B3rmula_del_%C3%A1rea_de_Gauss) con las coordenadas originales del polígono (`lot.points`).

    ```javascript
    function polygonArea(points) {
      let area = 0;
      let j = points.length - 1;
      for (let i = 0; i < points.length; i++) {
        area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
        j = i; // j is previous vertex to i
      }
      return Math.abs(area / 2);
    }

    const areaInSquarePixels = polygonArea(lot.points);
    ```

2.  **Convertir a metros cuadrados:** Divide el área en píxeles cuadrados por el cuadrado del ratio `pixelsPerMeter`.

    ```javascript
    const pixelsPerMeter = satelliteImage.pixelsPerMeter;
    const areaInSquareMeters = areaInSquarePixels / (pixelsPerMeter * pixelsPerMeter);
    ```

### Ejemplo de Implementación (React)

A continuación se muestra un ejemplo de cómo renderizar la imagen y los polígonos SVG en un componente de React.

```jsx
import React from 'react';

const LotMap = ({ property }) => {
  const { satelliteImage, lots } = property;
  const imageRef = React.useRef(null);
  const [imageSize, setImageSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    // Obtener el tamaño real de la imagen una vez que se carga
    if (imageRef.current) {
      const { width, height } = imageRef.current.getBoundingClientRect();
      setImageSize({ width, height });
    }
  }, [imageRef.current]);

  if (!satelliteImage || !satelliteImage.url) {
    return <div>No hay imagen satelital disponible.</div>;
  }

  const originalWidth = satelliteImage.width;
  const originalHeight = satelliteImage.height;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <img
        ref={imageRef}
        src={satelliteImage.url}
        alt="Vista satelital de la propiedad"
        style={{ width: '100%', height: 'auto' }}
      />
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
        preserveAspectRatio="none"
      >
        {lots &&
          lots.map((lot) => {
            // Escalar los puntos del polígono
            const scaledPoints = lot.points
              .map((point) => {
                const x = (point.x / originalWidth) * imageSize.width;
                const y = (point.y / originalHeight) * imageSize.height;
                return `${x},${y}`;
              })
              .join(' ');

            return (
              <polygon
                key={lot.id}
                points={scaledPoints}
                style={{
                  fill: 'rgba(255, 193, 7, 0.5)', // Color de relleno semitransparente
                  stroke: '#FFC107', // Color del borde
                  strokeWidth: 2,
                }}
              />
            );
          })}
      </svg>
    </div>
  );
};

export default LotMap;
```

Este enfoque garantiza que los polígonos se ajusten dinámicamente si el tamaño del contenedor de la imagen cambia, manteniendo siempre la correspondencia visual correcta.
