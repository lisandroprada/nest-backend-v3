# Guía de Integración para Frontend - Módulo de Agentes

**Fecha:** 2025-10-02
**Versión:** 1.1
**Autor:** Gemini Agent
**Ámbito:** Documento técnico que describe la entidad `Agent`, sus endpoints y la estructura de datos completa para la creación y gestión de Clientes, Proveedores y Empresas de Servicios.

---

## 1. Resumen y Arquitectura

El módulo de `agents` es la base de datos central para todas las entidades (personas físicas o jurídicas) con las que el sistema interactúa. En lugar de tener colecciones separadas para "Clientes" y "Proveedores", utilizamos una única colección `agents` y los diferenciamos a través del campo `rol`.

Este enfoque unificado simplifica la arquitectura y permite que una misma entidad (ej. una persona que es propietaria y también proveedora de servicios) pueda tener múltiples roles sin duplicar datos.

El frontend debe utilizar el endpoint `POST /api/v1/agents` para crear cualquier tipo de agente, simplemente ajustando el `rol` y los campos correspondientes en el payload.

---

## 2. Endpoints de la API

La ruta base para este módulo es `/api/v1/agents`.

| Método | Ruta | Descripción | Roles Requeridos |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Crea un nuevo agente (Cliente, Proveedor, etc.). | `admin`, `superUser` |
| `GET` | `/` | Lista todos los agentes con paginación y filtros. | `admin`, `superUser`, `contabilidad` |
| `GET` | `/:id` | Obtiene los detalles de un agente específico. | `admin`, `superUser`, `contabilidad` |
| `PATCH` | `/:id` | Actualiza parcialmente un agente existente. | `admin`, `superUser` |
| `DELETE` | `/:id` | Realiza un borrado lógico de un agente. | `superUser` |
| `GET` | `/:id/balance` | Calcula y devuelve el saldo de la cuenta corriente del agente. | `admin`, `superUser`, `contabilidad` |

**Nota sobre Paginación:** El endpoint `GET /` utiliza el servicio genérico de paginación. Consulta la guía **`PAGINATION_API.md`** para detalles sobre ordenamiento y filtrado.

---

## 3. Esquemas de Creación (Payloads para `POST /agents`)

A continuación se presentan dos ejemplos de JSON para la creación de los dos tipos principales de agentes que el frontend maneja.

### 3.1. Creación de un Cliente (Locador, Locatario, etc.)

Este payload se utiliza para dar de alta a un cliente que participará en contratos. El `rol` puede ser `LOCADOR`, `LOCATARIO`, `COMPRADOR`, `VENDEDOR`, `FIADOR`, o una combinación.

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
    "codigo_postal": "B1602",
    "latitud": -34.5833,
    "longitud": -58.4000
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

### 3.2. Creación de un Proveedor / Empresa de Servicios

Este payload se utiliza para dar de alta a un proveedor. El `rol` siempre debe incluir `PROVEEDOR`. Los campos para el escaneo de emails son cruciales.

```json
{
  "rol": ["PROVEEDOR"],
  "persona_tipo": "JURIDICA",
  "nomenclador_fiscal": "RI",
  "identificador_fiscal": "30112233445",
  "nombre_razon_social": "Aguas Continentales S.A.",
  "email_principal": "facturacion@aguascontinentales.com",
  "telefonos": [
    {
      "numero": "0800-555-AGUA",
      "tipo": "FIJO"
    }
  ],
  "direccion_fiscal": {
    "calle": "Suipacha",
    "numero": "1000",
    "piso_dpto": "Piso 10",
    "provincia_id": "633c5e9b1e9b7c2b6c8f2d32",
    "localidad_id": "633c5e9b1e9b7c2b6c8f2d33",
    "codigo_postal": "C1008AAS",
    "latitud": -34.6037,
    "longitud": -58.3816
  },
  // --- Configuración para Detección Automática de Facturas ---
  "check_automatizado": true,
  "dominios_notificacion": ["aguascontinentales.com", "avisos.aguas.com.ar"],
  "servicio_id_regex": "Nro de Cliente: (\\d+)",
  "monto_regex": "Total a pagar: \\$([\\d,.]+)",
  "pdf_search_key": "Total a Pagar",
  "pdf_attachment_names": ["factura.pdf", "aviso_de_deuda_*.pdf"]
}
```

---

## 4. Modelo de Datos Completo (Entidad `Agent`)

Este es un ejemplo de un documento `Agent` completo, con todos los campos posibles, tal como lo devolvería el backend. **Esta es la fuente de verdad para el frontend.**

```json
{
  "_id": "633c5e9b1e9b7c2b6c8f2d2b",
  "rol": ["LOCADOR", "PROVEEDOR"],
  "persona_tipo": "FISICA",
  "nomenclador_fiscal": "MONOTRIBUTO",
  "identificador_fiscal": "27304050608",
  "nombre_razon_social": "García, María Elena",
  "nombres": "María Elena",
  "apellidos": "García",
  "documento_tipo": "DNI",
  "documento_numero": "30405060",
  "direccion_real": {
    "calle": "Av. Rivadavia",
    "numero": "5000",
    "piso_dpto": "3B",
    "provincia_id": "633c5e9b1e9b7c2b6c8f2d32",
    "localidad_id": "633c5e9b1e9b7c2b6c8f2d33",
    "codigo_postal": "C1406GMA",
    "latitud": -34.6175,
    "longitud": -58.4333
  },
  "direccion_fiscal": {
    "calle": "Av. de Mayo",
    "numero": "800",
    "piso_dpto": "Of. 210",
    "provincia_id": "633c5e9b1e9b7c2b6c8f2d32",
    "localidad_id": "633c5e9b1e9b7c2b6c8f2d33",
    "codigo_postal": "C1084AAB",
    "latitud": -34.6083,
    "longitud": -58.3794
  },
  "telefonos": [
    {
      "numero": "+5491155559876",
      "tipo": "MOVIL"
    }
  ],
  "email_principal": "maria.garcia@email.com",
  "redes_sociales": [
    {
      "plataforma": "LinkedIn",
      "url": "https://linkedin.com/in/mariagarcia"
    }
  ],
  "apoderado_id": null,
  "apoderado_poder_fecha": null,
  "apoderado_vigente": false,
  "check_automatizado": false,
  "dominios_notificacion": [],
  "servicio_id_regex": null,
  "monto_regex": null,
  "pdf_search_key": null,
  "pdf_attachment_names": [],
  "cuentas_bancarias": [
    {
      "cbu_alias": "MARIA.G.ALIAS",
      "cbu_numero": "0170421840000005555556",
      "banco": "BANCO DE LA CIUDAD",
      "moneda": "ARS"
    }
  ],
  "status": "ACTIVO",
  "usuario_creacion_id": "633c5e9b1e9b7c2b6c8f2d39",
  "usuario_modificacion_id": "633c5e9b1e9b7c2b6c8f2d3a",
  "createdAt": "2023-09-01T11:00:00.000Z",
  "updatedAt": "2023-09-15T15:45:00.000Z"
}
```

---

## 5. Revisión de Consistencia

Se solicita al equipo de frontend que **revise este documento en comparación con los formularios y módulos existentes de "Clientes" y "Proveedores"**. El objetivo es unificar la lógica de creación y edición para que utilice el endpoint `POST /agents` y `PATCH /agents/:id`, enviando los campos aquí detallados. 

Prestar especial atención a:
*   El envío del `rol` como un array.
*   La estructura de los objetos embebidos como `direccion_fiscal`.
*   Los nuevos campos para la configuración de proveedores de servicios, que deben estar en un formulario separado o una sección de "Configuración Avanzada" en la UI de Proveedores.
