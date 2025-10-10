# Guía de Integración para Frontend - Módulo de Agentes

**Fecha:** 2025-10-08
**Versión:** 2.0
**Autor:** Gemini Agent
**Ámbito:** Documento técnico que describe la entidad `Agent`, sus endpoints y la estructura de datos completa para la creación y gestión de Clientes, Proveedores y otras entidades.

---

## 1. Arquitectura y Concepto Clave

El módulo de `agents` es la base de datos central para todas las entidades (personas físicas o jurídicas) con las que el sistema interactúa. En lugar de tener colecciones separadas para "Clientes" y "Proveedores", utilizamos una única colección `agents` y los diferenciamos a través del campo `rol`.

Este enfoque unificado simplifica la arquitectura y permite que una misma entidad (ej. una persona que es propietaria y también proveedora de servicios) pueda tener múltiples roles sin duplicar datos.

**URL Base de la API (Desarrollo):** `http://localhost:3050`

---

## 2. Endpoints de la API

La ruta base para este módulo es `/agents`.

| Método | Ruta              | Descripción                                                | Roles Requeridos                      |
| :----- | :---------------- | :--------------------------------------------------------- | :------------------------------------ |
| `POST` | `/`               | Crea un nuevo agente (Cliente, Proveedor, etc.).           | `admin`, `superUser`                  |
| `GET`    | `/`               | Lista todos los agentes con paginación y filtros.          | `admin`, `superUser`, `contabilidad`  |
| `GET`    | `/:id`            | Obtiene los detalles de un agente específico.              | `admin`, `superUser`, `contabilidad`  |
| `PATCH`  | `/:id`            | Actualiza parcialmente un agente existente.                | `admin`, `superUser`                  |
| `DELETE` | `/:id`            | Realiza un borrado lógico de un agente (cambia status a `INACTIVO`). | `superUser`                           |
| `GET`    | `/:id/balance`    | Calcula y devuelve el saldo de la cuenta corriente del agente. | `admin`, `superUser`, `contabilidad`  |

**Nota sobre Paginación:** El endpoint `GET /` utiliza el servicio genérico de paginación. Consulta la guía **`PAGINATION_API.md`** para detalles sobre cómo implementar ordenamiento, filtrado y búsqueda avanzada.

---

## 3. Modelo de Datos Detallado (Entidad `Agent`)

Esta tabla describe todos los campos disponibles en la entidad `Agent`. Es la **fuente de verdad** para construir los payloads de `POST` y `PATCH`.

| Campo                   | Tipo                                      | Requerido (Creación) | Descripción                                                                                                |
| :---------------------- | :---------------------------------------- | :------------------- | :--------------------------------------------------------------------------------------------------------- |
| `rol`                   | `AgenteRoles[]` (Array de strings)        | **Sí**               | Define la función del agente. Ver `AgenteRoles` abajo.                                                     |
| `persona_tipo`          | `string` (`'FISICA'` o `'JURIDICA'`)       | **Sí**               | Especifica si el agente es una persona física o una empresa.                                               |
| `nomenclador_fiscal`    | `string` (`'RI'`, `'CF'`, `'MONOTRIBUTO'`) | **Sí**               | Clasificación fiscal del agente.                                                                           |
| `identificador_fiscal`  | `string`                                  | **Sí**               | CUIT/CUIL del agente. Debe ser único.                                                                      |
| `nombre_razon_social`   | `string`                                  | **Sí**               | Nombre completo (si es persona física) o razón social (si es jurídica).                                    |
| `nombres`               | `string`                                  | Opcional             | Solo nombres (para persona física).                                                                        |
| `apellidos`             | `string`                                  | Opcional             | Solo apellidos (para persona física).                                                                      |
| `documento_tipo`        | `string` (`'DNI'`, `'PASAPORTE'`, etc.)    | Opcional             | Tipo de documento de identidad.                                                                            |
| `documento_numero`      | `string`                                  | Opcional             | Número del documento de identidad.                                                                         |
| `email_principal`       | `string`                                  | Opcional             | Email principal de contacto.                                                                               |
| `telefonos`             | `Telefono[]`                              | Opcional             | Array de objetos de teléfono. `{ numero: string, tipo: 'MOVIL' o 'FIJO' }`.                                |
| `direccion_fiscal`      | `Direccion`                               | **Sí**               | Objeto con la dirección fiscal. Ver estructura de `Direccion` abajo.                                       |
| `direccion_real`        | `Direccion`                               | Opcional             | Objeto con la dirección real (si es diferente de la fiscal).                                               |
| `cuentas_bancarias`     | `CuentaBancaria[]`                        | Opcional             | Array de objetos de cuenta bancaria. `{ cbu_alias, cbu_numero, banco, moneda }`.                           |
| `status`                | `string` (`'ACTIVO'` o `'INACTIVO'`)      | No (default `ACTIVO`) | Estado del agente. El borrado lógico lo cambia a `INACTIVO`.                                               |
| `redes_sociales`        | `RedSocial[]`                             | Opcional             | Array de `{ plataforma: string, url: string }`.                                                            |
| `apoderado_id`          | `ObjectId` (string)                       | Opcional             | ID de otro agente que actúa como apoderado.                                                                |
| `apoderado_poder_fecha` | `Date` (string ISO)                       | Opcional             | Fecha de firma del poder del apoderado.                                                                    |
| `apoderado_vigente`     | `boolean`                                 | Opcional             | Indica si el poder del apoderado está vigente.                                                             |
| `password`              | `string`                                  | Opcional             | Si se provee, crea un usuario asociado al agente para que pueda ingresar al sistema.                       |
| `check_automatizado`    | `boolean`                                 | No (default `false`) | **(Solo Proveedores)** Habilita el escaneo automático de emails para este proveedor.                       |
| `dominios_notificacion` | `string[]`                                | Opcional             | **(Solo Proveedores)** Dominios desde los cuales se esperan emails de facturas.                            |
| `servicio_id_regex`     | `string`                                  | Opcional             | **(Solo Proveedores)** Expresión regular para extraer el ID de servicio de un email o PDF.                 |
| `monto_regex`           | `string`                                  | Opcional             | **(Solo Proveedores)** Expresión regular para extraer el monto de una factura.                             |
| `pdf_search_key`        | `string`                                  | Opcional             | **(Solo Proveedores)** Palabra clave a buscar en el PDF para confirmar que es una factura.                 |
| `pdf_attachment_names`  | `string[]`                                | Opcional             | **(Solo Proveedores)** Patrones de nombres de archivos adjuntos a buscar (ej. `factura_*.pdf`).          |

#### Sub-Esquemas

-   **`Direccion`**:
    ```json
    {
      "calle": "Av. Siempre Viva",
      "numero": "742",
      "piso_dpto": "PB",
      "provincia_id": "633c5e9b1e9b7c2b6c8f2d32", // ObjectId de la Provincia
      "localidad_id": "633c5e9b1e9b7c2b6c8f2d33", // ObjectId de la Localidad
      "codigo_postal": "B1602",
      "latitud": -34.5833,
      "longitud": -58.4000
    }
    ```
-   **`AgenteRoles` (Enum)**:
    -   `LOCADOR`, `LOCATARIO`, `FIADOR`, `PROVEEDOR`, `INMOBILIARIA`, `COMPRADOR`, `VENDEDOR`

---

## 4. Payloads de Ejemplo para `POST /agents`

### 4.1. Creación de un Cliente (Locador)

```json
{
  "rol": ["LOCADOR"],
  "persona_tipo": "FISICA",
  "nomenclador_fiscal": "RI",
  "identificador_fiscal": "20304050607",
  "nombre_razon_social": "Pérez, Juan Carlos",
  "nombres": "Juan Carlos",
  "apellidos": "Pérez",
  "documento_tipo": "DNI",
  "documento_numero": "30405060",
  "email_principal": "juan.perez@email.com",
  "telefonos": [
    {
      "numero": "+5491155551234",
      "tipo": "MOVIL"
    }
  ],
  "direccion_fiscal": {
    "calle": "Av. Siempre Viva",
    "numero": "742",
    "piso_dpto": "",
    "provincia_id": "633c5e9b1e9b7c2b6c8f2d32",
    "localidad_id": "633c5e9b1e9b7c2b6c8f2d33",
    "codigo_postal": "B1602"
  },
  "cuentas_bancarias": [
    {
      "cbu_alias": "JUAN.PEREZ.ALIAS",
      "cbu_numero": "0170421840000005555555",
      "banco": "BANCO DE LA PLAZA",
      "moneda": "ARS"
    }
  ]
}
```

### 4.2. Creación de un Proveedor de Servicios

```json
{
  "rol": ["PROVEEDOR"],
  "persona_tipo": "JURIDICA",
  "nomenclador_fiscal": "RI",
  "identificador_fiscal": "30112233445",
  "nombre_razon_social": "Aguas Continentales S.A.",
  "email_principal": "facturacion@aguascontinentales.com",
  "direccion_fiscal": {
    "calle": "Suipacha",
    "numero": "1000",
    "piso_dpto": "Piso 10",
    "provincia_id": "633c5e9b1e9b7c2b6c8f2d32",
    "localidad_id": "633c5e9b1e9b7c2b6c8f2d33",
    "codigo_postal": "C1008AAS"
  },
  "check_automatizado": true,
  "dominios_notificacion": ["aguascontinentales.com", "avisos.aguas.com.ar"],
  "servicio_id_regex": "Nro de Cliente: (\\d+)",
  "monto_regex": "Total a pagar: \\$([\\d,.]+)",
  "pdf_search_key": "Total a Pagar",
  "pdf_attachment_names": ["factura.pdf", "aviso_de_deuda_*.pdf"]
}
```
**Nota Importante:** Aunque el `CreateAgentDto` en el backend no lista todos estos campos, el servicio está diseñado para aceptarlos. El frontend **debe enviar todos los campos relevantes** como se describe en la tabla del Modelo de Datos.

---

## 5. Respuestas de la API

### Respuesta de Creación (`POST /`) o Actualización (`PATCH /:id`) Exitosa (Código `201` o `200`)

El backend devolverá el documento completo del agente creado o actualizado.

```json
{
  "_id": "633c5e9b1e9b7c2b6c8f2d2b",
  "rol": ["LOCADOR"],
  "persona_tipo": "FISICA",
  "nomenclador_fiscal": "RI",
  "identificador_fiscal": "20304050607",
  "nombre_razon_social": "Pérez, Juan Carlos",
  "status": "ACTIVO",
  // ... todos los demás campos ...
  "createdAt": "2023-10-08T10:00:00.000Z",
  "updatedAt": "2023-10-08T10:00:00.000Z"
}
```

### Respuesta de Borrado Lógico (`DELETE /:id`) Exitosa (Código `200`)

```json
{
  "message": "Agent with ID \"633c5e9b1e9b7c2b6c8f2d2b\" has been logically deleted."
}
```

### Respuestas de Error Comunes

-   **`400 Bad Request`**: Generalmente debido a datos de entrada inválidos (ej. un campo requerido falta, un `enum` no es válido, o el `identificador_fiscal` ya existe). El cuerpo de la respuesta contendrá más detalles.
    ```json
    {
      "message": [
        "identificador_fiscal must be a string"
      ],
      "error": "Bad Request",
      "statusCode": 400
    }
    ```
-   **`401 Unauthorized`**: El token JWT no fue provisto o no es válido.
-   **`403 Forbidden`**: El usuario está autenticado pero no tiene los roles necesarios para realizar la acción.
-   **`404 Not Found`**: El agente con el `:id` especificado no fue encontrado (para `GET`, `PATCH`, `DELETE`).