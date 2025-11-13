# Guía de Integración para Frontend - Módulo de Agentes

**Fecha:** 2025-11-07
**Versión:** 2.1
**Autor:** Gemini Agent
**Ámbito:** Documento técnico que describe la entidad `Agent`, sus endpoints y la estructura de datos completa para la creación y gestión de Clientes, Proveedores y otras entidades.

---

## 1. Arquitectura y Concepto Clave

El módulo de `agents` es la base de datos central para todas las entidades (personas físicas o jurídicas) con las que el sistema interactúa. En lugar de tener colecciones separadas para "Clientes" y "Proveedores", utilizamos una única colección `agents` y los diferenciamos a través del campo `rol`.

Este enfoque unificado simplifica la arquitectura y permite que una misma entidad (ej. una persona que es propietaria y también proveedora de servicios) pueda tener múltiples roles sin duplicar datos.

**URL Base de la API (Desarrollo):** `http://localhost:3050`

---

## 1.1. Populate Opcional (IMPORTANTE)

El endpoint de listado (`GET /agents`) acepta el parámetro opcional `populate` para incluir datos completos de relaciones (por ejemplo, información del banco en las cuentas bancarias).

### ¿Cuándo usar populate?

- **SIN populate (recomendado para listados):** Más rápido, menor transferencia de datos, nunca falla por datos incompletos.

  ```
  GET /api/v1/agents?page=0&pageSize=10
  ```

- **CON populate (para vistas detalle):** Incluye datos completos de bancos, provincias, etc.
  ```
  GET /api/v1/agents?page=0&pageSize=10&populate=cuentas_bancarias.bank_id
  ```

### Ventajas del populate opcional

✅ El frontend decide si necesita datos completos o solo IDs  
✅ Listados rápidos sin populate  
✅ Vistas detalle con populate en una sola consulta  
✅ Nunca falla si el agente no tiene cuentas bancarias (devuelve array vacío)

**Regla general:** No uses populate en listados/tablas. Úsalo solo en vistas detalle o edición donde necesites mostrar el nombre completo del banco.

---

## 2. Endpoints de la API

La ruta base para este módulo es `/agents`.

| Método   | Ruta                | Descripción                                                          | Roles Requeridos                     |
| :------- | :------------------ | :------------------------------------------------------------------- | :----------------------------------- |
| `POST`   | `/`                 | Crea un nuevo agente (Cliente, Proveedor, etc.).                     | `admin`, `superUser`                 |
| `GET`    | `/`                 | Lista todos los agentes con paginación y filtros.                    | `admin`, `superUser`, `contabilidad` |
| `GET`    | `/:id`              | Obtiene los detalles de un agente específico.                        | `admin`, `superUser`, `contabilidad` |
| `PATCH`  | `/:id`              | Actualiza parcialmente un agente existente.                          | `admin`, `superUser`                 |
| `DELETE` | `/:id`              | Realiza un borrado lógico de un agente (cambia status a `INACTIVO`). | `superUser`                          |
| `GET`    | `/:id/balance`      | Calcula y devuelve el saldo de la cuenta corriente del agente.       | `admin`, `superUser`, `contabilidad` |
| `PATCH`  | `/:id/validar-cuit` | Valida el CUIT del agente contra AFIP y marca como validado.         | `admin`, `superUser`                 |

**Nota sobre Paginación:** El endpoint `GET /` utiliza el servicio genérico de paginación. Consulta la guía **`PAGINATION_API.md`** para detalles sobre cómo implementar ordenamiento, filtrado y búsqueda avanzada.

---

## 3. Modelo de Datos Detallado (Entidad `Agent`)

Esta tabla describe todos los campos disponibles en la entidad `Agent`. Es la **fuente de verdad** para construir los payloads de `POST` y `PATCH`.

| Campo                   | Tipo                                       | Requerido (Creación)  | Descripción                                                                                     |
| :---------------------- | :----------------------------------------- | :-------------------- | :---------------------------------------------------------------------------------------------- |
| `rol`                   | `AgenteRoles[]` (Array de strings)         | **Sí**                | Define la función del agente. Ver `AgenteRoles` abajo.                                          |
| `persona_tipo`          | `string` (`'FISICA'` o `'JURIDICA'`)       | **Sí**                | Especifica si el agente es una persona física o una empresa.                                    |
| `nomenclador_fiscal`    | `string` (`'RI'`, `'CF'`, `'MONOTRIBUTO'`) | **Sí**                | Clasificación fiscal del agente.                                                                |
| `identificador_fiscal`  | `string`                                   | **Sí**                | CUIT/CUIL del agente. Debe ser único.                                                           |
| `nombre_razon_social`   | `string`                                   | **Sí**                | Nombre completo (si es persona física) o razón social (si es jurídica).                         |
| `nombres`               | `string`                                   | Opcional              | Solo nombres (para persona física).                                                             |
| `apellidos`             | `string`                                   | Opcional              | Solo apellidos (para persona física).                                                           |
| `documento_tipo`        | `string` (`'DNI'`, `'PASAPORTE'`, etc.)    | Opcional              | Tipo de documento de identidad.                                                                 |
| `documento_numero`      | `string`                                   | Opcional              | Número del documento de identidad.                                                              |
| `email_principal`       | `string`                                   | Opcional              | Email principal de contacto.                                                                    |
| `telefonos`             | `Telefono[]`                               | Opcional              | Array de objetos de teléfono. `{ numero: string, tipo: 'MOVIL' o 'FIJO' }`.                     |
| `direccion_fiscal`      | `Direccion`                                | **Sí**                | Objeto con la dirección fiscal. Ver estructura de `Direccion` abajo.                            |
| `direccion_real`        | `Direccion`                                | Opcional              | Objeto con la dirección real (si es diferente de la fiscal).                                    |
| `cuentas_bancarias`     | `CuentaBancaria[]`                         | Opcional              | Array de objetos de cuenta bancaria. `{ cbu_alias, cbu_numero, banco, moneda }`.                |
| `status`                | `string` (`'ACTIVO'` o `'INACTIVO'`)       | No (default `ACTIVO`) | Estado del agente. El borrado lógico lo cambia a `INACTIVO`.                                    |
| `redes_sociales`        | `RedSocial[]`                              | Opcional              | Array de `{ plataforma: string, url: string }`.                                                 |
| `apoderado_id`          | `ObjectId` (string)                        | Opcional              | ID de otro agente que actúa como apoderado.                                                     |
| `apoderado_poder_fecha` | `Date` (string ISO)                        | Opcional              | Fecha de firma del poder del apoderado.                                                         |
| `apoderado_vigente`     | `boolean`                                  | Opcional              | Indica si el poder del apoderado está vigente.                                                  |
| `password`              | `string`                                   | Opcional              | Si se provee, crea un usuario asociado al agente para que pueda ingresar al sistema.            |
| `check_automatizado`    | `boolean`                                  | No (default `false`)  | **(Solo Proveedores)** Habilita el escaneo automático de emails para este proveedor.            |
| `dominios_notificacion` | `string[]`                                 | Opcional              | **(Solo Proveedores)** Dominios desde los cuales se esperan emails de facturas.                 |
| `servicio_id_regex`     | `string`                                   | Opcional              | **(Solo Proveedores)** Expresión regular para extraer el ID de servicio de un email o PDF.      |
| `monto_regex`           | `string`                                   | Opcional              | **(Solo Proveedores)** Expresión regular para extraer el monto de una factura.                  |
| `pdf_search_key`        | `string`                                   | Opcional              | **(Solo Proveedores)** Palabra clave a buscar en el PDF para confirmar que es una factura.      |
| `pdf_attachment_names`  | `string[]`                                 | Opcional              | **(Solo Proveedores)** Patrones de nombres de archivos adjuntos a buscar (ej. `factura_*.pdf`). |
| `cuit_validado`         | `boolean`                                  | No (default `false`)  | Indica si el CUIT del agente ha sido validado contra AFIP.                                      |
| `cuit_validado_en`      | `Date` (string ISO)                        | Opcional (Auto)       | Fecha en que se validó el CUIT por última vez.                                                  |
| `cuit_datos_afip`       | `CuitDatosAFIP`                            | Opcional (Auto)       | Datos obtenidos desde AFIP. Ver sub-esquema abajo.                                              |

#### Sub-Esquemas

- **`Direccion`**:
  ```json
  {
    "calle": "Av. Siempre Viva",
    "numero": "742",
    "piso_dpto": "PB",
    "provincia_id": "633c5e9b1e9b7c2b6c8f2d32", // ObjectId de la Provincia
    "localidad_id": "633c5e9b1e9b7c2b6c8f2d33", // ObjectId de la Localidad
    "codigo_postal": "B1602",
    "latitud": -34.5833,
    "longitud": -58.4
  }
  ```
- **`CuitDatosAFIP`**:
  ```json
  {
    "nombre": "PÉREZ, JUAN CARLOS",
    "tipoPersona": "Persona Física (masculino)",
    "ganancias": "Inscripto",
    "iva": "Responsable Inscripto"
  }
  ```
- **`AgenteRoles` (Enum)**:
  - `LOCADOR`, `LOCATARIO`, `FIADOR`, `PROVEEDOR`, `INMOBILIARIA`, `COMPRADOR`, `VENDEDOR`

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

- **`400 Bad Request`**: Generalmente debido a datos de entrada inválidos (ej. un campo requerido falta, un `enum` no es válido, o el `identificador_fiscal` ya existe). El cuerpo de la respuesta contendrá más detalles.
  ```json
  {
    "message": ["identificador_fiscal must be a string"],
    "error": "Bad Request",
    "statusCode": 400
  }
  ```
- **`401 Unauthorized`**: El token JWT no fue provisto o no es válido.
- **`403 Forbidden`**: El usuario está autenticado pero no tiene los roles necesarios para realizar la acción.
- **`404 Not Found`**: El agente con el `:id` especificado no fue encontrado (para `GET`, `PATCH`, `DELETE`).

---

## 6. Validación de CUIT de Agente

### Endpoint `PATCH /agents/:id/validar-cuit`

Este endpoint valida el CUIT/CUIL/CDI del agente contra AFIP y actualiza el registro con información fiscal oficial.

#### ¿Cuándo usar este endpoint?

- Después de crear o actualizar un agente con un CUIT
- Para verificar la validez del CUIT antes de generar comprobantes fiscales
- Para obtener datos oficiales de AFIP (nombre, tipo de persona, condición fiscal)

#### Proceso de Validación

1. ✅ Valida el formato del CUIT (11 dígitos, prefijo válido, dígito verificador)
2. 🔍 Extrae el DNI del CUIT (dígitos 3-10)
3. 🌐 Consulta datos en cuitonline.com (web scraping)
4. 💾 Actualiza el agente con:
   - `cuit_validado: true`
   - `cuit_validado_en: [fecha actual]`
   - `cuit_datos_afip: { nombre, tipoPersona, ganancias, iva }`

#### Request

```bash
PATCH /api/v1/agents/633c5e9b1e9b7c2b6c8f2d2b/validar-cuit
Authorization: Bearer <token>
```

No requiere body en el request.

#### Response Success (200 OK)

```json
{
  "_id": "633c5e9b1e9b7c2b6c8f2d2b",
  "rol": ["LOCADOR"],
  "persona_tipo": "FISICA",
  "nomenclador_fiscal": "RI",
  "identificador_fiscal": "20304050607",
  "nombre_razon_social": "Pérez, Juan Carlos",
  "cuit_validado": true,
  "cuit_validado_en": "2025-01-12T14:30:00.000Z",
  "cuit_datos_afip": {
    "nombre": "PÉREZ, JUAN CARLOS",
    "tipoPersona": "Persona Física (masculino)",
    "ganancias": "Inscripto",
    "iva": "Responsable Inscripto"
  },
  "status": "ACTIVO",
  // ... otros campos ...
  "updatedAt": "2025-01-12T14:30:00.000Z"
}
```

---

## 7. Ejemplos de Uso del Endpoint de Listado

### 7.1. Listado Simple (sin populate) - RECOMENDADO

**Uso:** Tablas, grids, listados donde solo necesitas datos básicos.

```bash
curl 'http://localhost:3050/api/v1/agents?page=0&pageSize=10&sort=-createdAt' \
  -H 'Authorization: Bearer TU_TOKEN_JWT'
```

**Respuesta:**

```json
{
  "totalItems": 1575,
  "totalPages": 158,
  "items": [
    {
      "_id": "17cc4123501d2560c74c21a1",
      "rol": ["CLIENTE"],
      "persona_tipo": "FISICA",
      "nombres": "Xiomara Yael",
      "apellidos": "Martin Escobar",
      "nombre_razon_social": null,
      "documento_tipo": "DNI",
      "documento_numero": "36757087",
      "email_principal": "xiomytta_09@hotmail.com",
      "cuentas_bancarias": [],
      "status": "ACTIVO",
      "createdAt": "2021-04-01T21:05:35.682Z"
    }
  ]
}
```

**Ventajas:**

- ✅ Respuesta más rápida
- ✅ Menor carga en base de datos
- ✅ Menor transferencia de datos
- ✅ Nunca falla por datos incompletos

---

### 7.2. Listado con Populate (datos completos de bancos)

**Uso:** Vista detalle, edición, reportes donde necesitas el nombre del banco.

```bash
curl 'http://localhost:3050/api/v1/agents?page=0&pageSize=10&sort=-createdAt&populate=cuentas_bancarias.bank_id' \
  -H 'Authorization: Bearer TU_TOKEN_JWT'
```

**Respuesta:**

```json
{
  "totalItems": 1575,
  "totalPages": 158,
  "items": [
    {
      "_id": "17cc4123501d2560c74c21a1",
      "rol": ["CLIENTE"],
      "nombres": "Xiomara Yael",
      "apellidos": "Martin Escobar",
      "cuentas_bancarias": [
        {
          "cbu_alias": "alias.cuenta",
          "cbu_numero": "0170099220000012345678",
          "bank_id": {
            "_id": "64f1a9c7e7a1c2b3d4567890",
            "nombre": "Banco Galicia",
            "codigo": "007"
          },
          "moneda": "ARS"
        }
      ],
      "status": "ACTIVO"
    }
  ]
}
```

**Nota:** Si el agente no tiene cuentas bancarias, `cuentas_bancarias` será `[]`.

---

### 7.3. Filtro por Status (solo activos)

```bash
curl 'http://localhost:3050/api/v1/agents?page=0&pageSize=10&search[criteria][0][field]=status&search[criteria][0][term]=ACTIVO&search[criteria][0][operation]=eq' \
  -H 'Authorization: Bearer TU_TOKEN_JWT'
```

---

### 7.4. Búsqueda por Nombre

```bash
curl 'http://localhost:3050/api/v1/agents?search[criteria][0][field]=nombre_razon_social&search[criteria][0][term]=Martin&search[criteria][0][operation]=contains' \
  -H 'Authorization: Bearer TU_TOKEN_JWT'
```

---

### 7.5. Frontend - Listado Angular/React

```typescript
// Servicio Angular
searchAgents(filters: any) {
  const params = new HttpParams()
    .set('page', filters.page || 0)
    .set('pageSize', filters.pageSize || 10)
    .set('sort', filters.sort || '-createdAt');

  // Solo agregar populate si es necesario
  if (filters.needBankData) {
    params = params.set('populate', 'cuentas_bancarias.bank_id');
  }

  return this.http.get('/api/v1/agents', { params });
}
```

---

## 8. Errores Comunes y Soluciones

### Error: Array vacío con totalItems > 0

**Problema:** Antes, enviar `populate=cuentas_bancarias.bank_id` devolvía `{ totalItems: 0, items: [] }` aunque existían agentes.

**Causa:** El populate fallaba si algunos agentes tenían `cuentas_bancarias` vacío.

**Solución:** Actualizado en versión 2.1. Ahora el populate es opcional y nunca bloquea resultados. Si no necesitas datos del banco, no envíes el parámetro `populate`.

---

### Error: Token inválido

**Respuesta:**

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solución:** Renovar token o hacer login nuevamente.

---

## 9. Changelog

- **2025-11-07 (v2.1):** Populate opcional para evitar conflictos con datos vacíos. Agregada sección de ejemplos de uso.
- **2025-10-08 (v2.0):** Versión inicial completa.

---

#### Response Error (400 Bad Request)

**Agente sin CUIT:**

```json
{
  "message": "El agente no tiene CUIT/CUIL/CDI configurado",
  "error": "Bad Request",
  "statusCode": 400
}
```

**CUIT inválido:**

```json
{
  "message": "CUIT inválido: Dígito verificador incorrecto. Esperado: 5, Recibido: 7",
  "error": "Bad Request",
  "statusCode": 400
}
```

#### Notas Importantes

- ⚠️ El endpoint valida el formato del CUIT **incluso si la consulta AFIP falla**
- 🔒 Requiere roles `admin` o `superUser`
- 📝 El campo `cuit_datos_afip` puede ser `null` si no se pudo obtener información de AFIP
- ♻️ Puede ejecutarse múltiples veces - actualiza `cuit_validado_en` en cada ejecución

#### Ejemplo Frontend (Fetch)

```typescript
async function validarCuitAgente(agentId: string) {
  const response = await fetch(`/api/v1/agents/${agentId}/validar-cuit`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const agentActualizado = await response.json();

  console.log('✅ CUIT validado:', agentActualizado.cuit_validado);
  console.log('📅 Validado en:', agentActualizado.cuit_validado_en);
  console.log('📋 Datos AFIP:', agentActualizado.cuit_datos_afip);

  return agentActualizado;
}
```

#### Uso en el Frontend

El campo `cuit_validado` permite mostrar al usuario si el CUIT ha sido verificado:

```tsx
function AgentCuitBadge({ agent }) {
  if (agent.cuit_validado) {
    return (
      <span className="badge badge-success">
        ✓ CUIT Validado
        {agent.cuit_datos_afip && (
          <div className="tooltip">
            <strong>{agent.cuit_datos_afip.nombre}</strong>
            <br />
            {agent.cuit_datos_afip.tipoPersona}
            <br />
            IVA: {agent.cuit_datos_afip.iva}
            <br />
            Ganancias: {agent.cuit_datos_afip.ganancias}
          </div>
        )}
      </span>
    );
  }

  return <span className="badge badge-warning">⚠ CUIT sin validar</span>;
}
```
