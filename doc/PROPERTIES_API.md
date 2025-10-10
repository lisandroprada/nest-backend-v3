# Guía de Integración para Frontend - Módulo de Propiedades

**Fecha:** 2025-10-08
**Versión:** 3.0
**Autor:** Gemini Agent
**Ámbito:** Documento técnico que describe la entidad `Property` y todos los módulos relacionados (`Assets`, `Inventory`, `Amenities`) para su gestión integral.

---

## 1. Arquitectura General

La gestión de una propiedad involucra varias entidades y colecciones que trabajan en conjunto:

1.  **Propiedades (`/properties`):** Es la entidad central que contiene la información principal del inmueble.
2.  **Catálogo de Inventario (`/inventory`):** Una colección maestra de todos los *tipos* de muebles y activos que pueden existir (ej. "Sillón de 3 cuerpos", "Aire Acondicionado 3000 frigorías").
3.  **Activos de la Propiedad (`/assets`):** Es el inventario *real* de una propiedad específica. Vincula una propiedad con un item del catálogo y le añade detalles únicos como número de serie y su historial de estados.
4.  **Amenities (`/amenities`):** Una colección de características y servicios disponibles (ej. "Piscina", "SUM", "Gimnasio").

**URL Base de la API (Desarrollo):** `http://localhost:3050`

---

## 2. Endpoints Principales (`/properties`)

| Método | Ruta   | Descripción                                      | Roles Requeridos                               |
| :----- | :----- | :----------------------------------------------- | :--------------------------------------------- |
| `POST` | `/`    | Crea una nueva propiedad.                        | `admin`, `superUser`, `agente`                 |
| `GET`  | `/`    | Lista todas las propiedades con paginación.      | `admin`, `superUser`, `agente`, `contabilidad` |
| `GET`  | `/:id` | Obtiene los detalles de una propiedad específica.  | `admin`, `superUser`, `agente`                 |
| `PATCH`| `/:id` | Actualiza parcialmente una propiedad existente.    | `admin`, `superUser`, `agente`                 |
| `DELETE`| `/:id` | Realiza un borrado lógico de una propiedad.      | `superUser`                                    |

---

## 3. Gestión de Características y Amenities

El objeto `caracteristicas` dentro de la entidad `Property` contiene todos los detalles físicos del inmueble.

### 3.1. Amenities

El campo `caracteristicas.amenities` es un array de `ObjectId` que referencia a la colección `amenities`.

**Flujo para el Frontend:**
1.  Obtener la lista completa de amenities disponibles con `GET /amenities`.
2.  En el formulario de creación/edición de la propiedad, presentar estas opciones al usuario (ej. como checkboxes).
3.  Al guardar la propiedad, enviar el array de `ObjectId` de las amenities seleccionadas dentro del objeto `caracteristicas`.

**Ejemplo de `caracteristicas` en un payload:**
```json
"caracteristicas": {
    "dormitorios": 2,
    "banos": 1,
    "ambientes": 3,
    "amenities": ["633c5e9b1e9b7c2b6c8f2d34", "633c5e9b1e9b7c2b6c8f2d35"]
}
```

---

## 4. Gestión de Inventario y Activos (Flujo Detallado)

Este es un proceso de dos pasos que requiere interactuar con dos módulos diferentes.

### Paso 1: Consultar o Crear en el Catálogo General (`/inventory`)

Antes de añadir un mueble o electrodoméstico a una propiedad, su "tipo" debe existir en el catálogo.

-   **Endpoint:** `GET /inventory` para listar todos los items del catálogo.
-   **Endpoint:** `POST /inventory` para añadir un nuevo tipo de item si no existe.

**Payload para `POST /inventory`:**
```json
{
  "categoria": "Electrodoméstico",
  "descripcion_base": "Aire Acondicionado Split 3000 Frigorías",
  "marca": "Surrey",
  "modelo": "553BFQ1201F"
}
```

### Paso 2: Asociar un Activo a la Propiedad (`/assets`)

Una vez que tienes el `_id` del item del catálogo, puedes crear un "activo", que es la instancia real de ese item dentro de una propiedad específica.

-   **Endpoint:** `POST /assets`

**Payload para `POST /assets`:**
```json
{
  "catalogo_id": "68e1c3a0b4d9a2a7a3f8b9e1", // ID del item en /inventory
  "propiedad_id": "68de6f42edfa775c6741352d", // ID de la propiedad a la que pertenece
  "numero_serie": "SN-A987XYZ",
  "estado_actual": "NUEVO", // 'NUEVO', 'ACTIVO', 'EN_REPARACION', 'DE_BAJA'
  "historial_estados": [
    {
      "fecha": "2025-10-08T10:00:00.000Z",
      "estado_item": "NUEVO", // 'NUEVO', 'BUENO', 'DESGASTE', 'DAÑADO', 'EN_REPARACION'
      "observaciones": "Instalación inicial en la propiedad."
    }
  ]
}
```

### 4.1. Versiones de Inventario (`historial_estados`)

El campo `historial_estados` dentro de cada activo es crucial. Funciona como un **control de versiones del estado del item**.

-   **Propósito:** Permite registrar el estado de un activo en momentos clave, como al inicio de un contrato de alquiler, al finalizarlo, o después de una reparación.
-   **Uso:** Cuando se realiza un check-in o check-out de una propiedad, el frontend debe recorrer los activos de esa propiedad y añadir una nueva entrada al `historial_estados` de cada uno, documentando su estado actual (`BUENO`, `DAÑADO`, etc.) y la fecha. Esto es fundamental para el control de depósitos en garantía y mantenimiento.

**Para obtener todos los activos de una propiedad, el frontend deberá hacer una consulta a `GET /assets` filtrando por `propiedad_id`.**

---

## 5. Gestión de Imágenes y Documentos

El sistema maneja dos tipos de archivos asociados a una propiedad:

1.  **Imagen de Portada (`img_cover_url`):** Un campo de tipo `string` en la entidad `Property` que almacena la URL de la imagen principal.
2.  **Documentos Digitales (`documentos_digitales`):** Un array de objetos en la entidad `Property` para almacenar múltiples archivos (escrituras, planos, etc.). Cada objeto tiene la forma `{ nombre: string, url: string }`.

### Flujo de Subida de Archivos

El backend no gestiona directamente la subida de archivos. El flujo recomendado es:

1.  El frontend sube el archivo (imagen o documento) a un servicio de almacenamiento de archivos (como AWS S3, Firebase Storage, o incluso una carpeta estática en el propio backend si la configuración lo permite).
2.  El servicio de almacenamiento devuelve una URL pública para el archivo subido.
3.  El frontend realiza una petición `PATCH /properties/:id` para guardar esa URL en el campo `img_cover_url` o para añadir un nuevo objeto al array `documentos_digitales`.

**Ejemplo de `PATCH` para añadir un documento:**
```json
// PATCH /properties/68de6f42edfa775c6741352d
{
  "documentos_digitales": [
    {
      "nombre": "Escritura",
      "url": "http://localhost:3050/uploads/properties/PROP-001/escritura.pdf"
    },
    {
      "nombre": "Plano de planta",
      "url": "http://localhost:3050/uploads/properties/PROP-001/plano.pdf"
    }
  ]
}
```

---

## 6. Diccionario de Datos y Payload de Creación

(El resto del documento con el diccionario de datos y los payloads de ejemplo permanece como en la versión anterior, ya que sigue siendo válido y se complementa con la información de estas nuevas secciones).
