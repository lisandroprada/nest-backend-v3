# Guía de Integración para Frontend - Módulo de Propiedades

**Fecha:** 2025-10-02
**Versión:** 1.0
**Autor:** Gemini Agent
**Ámbito:** Documento técnico que describe la entidad `Property`, sus endpoints y la estructura de datos completa para ser consumida por el frontend.

---

## 1. Resumen y Arquitectura

El módulo de `properties` es el núcleo para la gestión de los inmuebles del sistema. Proporciona endpoints para crear, leer, actualizar y eliminar propiedades (CRUD), así como para realizar búsquedas y filtrados complejos.

La entidad `Property` está diseñada para ser rica en datos, conteniendo no solo información básica, sino también detalles estructurales, características, servicios, impuestos y referencias a otras entidades como Agentes, Contratos y Amenities.

---

## 2. Endpoints de la API

La ruta base para este módulo es `/api/v1/properties`.

| Método | Ruta | Descripción | Roles Requeridos |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Crea una nueva propiedad. | `admin`, `superUser`, `agente` |
| `GET` | `/` | Lista todas las propiedades con paginación y filtros. | `admin`, `superUser`, `agente`, `contabilidad` |
| `GET` | `/:id` | Obtiene los detalles de una propiedad específica. | `admin`, `superUser`, `agente` |
| `PATCH` | `/:id` | Actualiza parcialmente una propiedad existente. | `admin`, `superUser`, `agente` |
| `DELETE` | `/:id` | Realiza un borrado lógico de una propiedad. | `superUser` |

**Nota sobre Paginación y Filtros:** Los endpoints de listado (`GET /`) utilizan el servicio genérico de paginación. Por favor, consulta la guía **`PAGINATION_API.md`** en este mismo directorio para ver en detalle cómo implementar el ordenamiento, paginación y filtrado avanzado.

---

## 3. Modelo de Datos Completo (Entidad `Property`)

Este es un ejemplo de un documento `Property` completo, tal como lo recibirías desde un endpoint `GET /properties/:id`. Contempla el 100% del schema.

```json
{
  "_id": "633c5e9b1e9b7c2b6c8f2d31",
  "propietarios_ids": [
    "633c5e9b1e9b7c2b6c8f2d2b",
    "633c5e9b1e9b7c2b6c8f2d2c"
  ],
  "identificador_interno": "PROP-00123",
  "identificador_tributario": "039-051864-3",
  "datos_registro_propiedad": {
    "folio": "1234/56",
    "tomo": "78-A",
    "fecha_registro": "2010-05-20T00:00:00.000Z"
  },
  "direccion": {
    "calle": "Av. del Libertador",
    "numero": "1234",
    "piso_dpto": "5A",
    "provincia_id": "633c5e9b1e9b7c2b6c8f2d32",
    "localidad_id": "633c5e9b1e9b7c2b6c8f2d33",
    "codigo_postal": "C1426AAR",
    "latitud": -34.5833,
    "longitud": -58.4000
  },
  "caracteristicas": {
    "dormitorios": 3,
    "banos": 2,
    "ambientes": 4,
    "metraje_total": 120,
    "metraje_cubierto": 110,
    "antiguedad_anos": 15,
    "cochera": 1,
    "estado_general": "EXCELENTE",
    "orientacion": "NORTE",
    "amenities": [
      "633c5e9b1e9b7c2b6c8f2d34",
      "633c5e9b1e9b7c2b6c8f2d35",
      "633c5e9b1e9b7c2b6c8f2d36"
    ]
  },
  "servicios_impuestos": [
    {
      "proveedor_id": "633c5e9b1e9b7c2b6c8f2d37",
      "identificador_servicio": "AGUAS-987654",
      "porcentaje_aplicacion": 100
    }
  ],
  "consorcio_nombre": "Administración Consorcios S.A.",
  "tipo_expensas": "ORDINARIAS",
  "img_cover_url": "https://example.com/uploads/properties/prop-00123/cover.jpg",
  "valor_venta": 350000,
  "valor_alquiler": 1500,
  "proposito": "VIVIENDA",
  "estado_ocupacional": "DISPONIBLE",
  "contrato_vigente_id": null,
  "documentos_digitales": [
    {
      "nombre": "Escritura",
      "url": "https://example.com/uploads/properties/prop-00123/escritura.pdf"
    }
  ],
  "usuario_creacion_id": "633c5e9b1e9b7c2b6c8f2d39",
  "usuario_modificacion_id": "633c5e9b1e9b7c2b6c8f2d3a",
  "createdAt": "2023-10-27T10:00:00.000Z",
  "updatedAt": "2023-10-27T12:30:00.000Z"
}
```

---

## 4. Diccionario de Datos Detallado

#### Campos Principales
*   `_id` (`ObjectId`): ID único de la propiedad.
*   `propietarios_ids` (`Array<ObjectId>`): Referencia a la colección `agentes`. Lista de dueños.
*   `identificador_interno` (`String`): Código único de la inmobiliaria.
*   `identificador_tributario` (`String`): Nomenclatura Catastral / Partida Municipal.
*   `consorcio_nombre` (`String`): Nombre de la administración del edificio.
*   `tipo_expensas` (`Enum`): Valores posibles: `'ORDINARIAS'`, `'EXTRAORDINARIAS'`, `'INCLUIDAS'`.
*   `img_cover_url` (`String`): URL de la imagen de portada.
*   `valor_venta` (`Number`): Precio de venta (ej. en USD).
*   `valor_alquiler` (`Number`): Precio de alquiler mensual.
*   `proposito` (`Enum`): `'COMERCIAL'`, `'VIVIENDA'`, `'INDUSTRIAL'`, `'MIXTO'`.
*   `estado_ocupacional` (`Enum`): `'OCUPADA'`, `'EN_REFACCION'`, `'DISPONIBLE'`, `'ALQUILADA'`, `'VENDIDA'`, `'RESERVADA'`.
*   `contrato_vigente_id` (`ObjectId | null`): ID del `Contract` activo o `null`.
*   `documentos_digitales` (`Array<Object>`): Lista de documentos (`{nombre: String, url: String}`).

#### Sub-Documentos
*   **`datos_registro_propiedad`**:
    *   `folio`, `tomo` (`String`), `fecha_registro` (`Date`).
*   **`direccion`**:
    *   `provincia_id` (`ObjectId`): ID de la colección `provinces`.
    *   `localidad_id` (`ObjectId`): ID de la colección `localities`.
    *   `latitud`, `longitud` (`Number`): Coordenadas para Google Maps.
*   **`caracteristicas`**:
    *   `dormitorios`, `banos`, `ambientes`, `metraje_total`, `metraje_cubierto`, `antiguedad_anos`, `cochera` (`Number`).
    *   `estado_general` (`Enum`): `'A ESTRENAR'`, `'EXCELENTE'`, `'BUENO'`, `'A RECICLAR'`.
    *   `orientacion` (`Enum`): `'NORTE'`, `'SUR'`, `'ESTE'`, `'OESTE'`.
    *   `amenities` (`Array<ObjectId>`): Lista de IDs de la colección `amenities`.
*   **`servicios_impuestos`**:
    *   `proveedor_id` (`ObjectId`): ID del `Agent` proveedor.
    *   `identificador_servicio` (`String`): Nro. de cliente, medidor, etc.
    *   `porcentaje_aplicacion` (`Number`): Porcentaje de la factura que aplica a esta propiedad (de 0 a 100).

#### Campos de Auditoría (Automáticos)
*   `usuario_creacion_id`, `usuario_modificacion_id` (`ObjectId`): Referencia a la colección `users`.
*   `createdAt`, `updatedAt` (`Date`): Fechas de creación y modificación gestionadas por la base de datos.
