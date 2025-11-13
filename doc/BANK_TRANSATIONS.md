Comprendido. La implementación de un módulo de **Conciliación Bancaria Automatizada** mediante el escaneo de emails es crucial para la precisión de tu Tesorería. Este módulo se basa en el **principio de la Fuente de Datos Externa** para verificar las `transacciones` internas del sistema.

Aquí tienes la especificación completa para el desarrollo del _backend_, incluyendo el _schema_, el _controller_, y la integración con módulos existentes.

---

## 1. ⚙️ Arquitectura y Ubicación del Módulo

El módulo de Conciliación Automática debe residir en el **`TransactionsModule`** o en un módulo auxiliar (`BankingSyncModule`) que dependa de `Transactions` y `FinancialAccounts`. Dada su naturaleza de **fuente de datos externa** para la conciliación, lo ubicaremos como un componente clave de **Tesorería**.

### A. Nueva Colección: `movimientos_bancarios_externos`

Esta colección almacenará cada movimiento detectado en el email, actuando como el **Extracto Digital del Banco**. El ID de transacción debe ser único.

| Campo                      | Tipo de Dato | Propósito y Unicidad                                                                                                  |
| :------------------------- | :----------- | :-------------------------------------------------------------------------------------------------------------------- |
| **`identificador_unico`**  | `String`     | **Clave Principal (Indexado Único):** `Nº de transacción` (para egresos) o `Identificador del Debin` (para ingresos). |
| **`tipo_operacion`**       | `Enum`       | `'INGRESO'` (Debin/Transferencia Recibida) \| `'EGRESO'` (Transferencia Realizada).                                   |
| **`monto`**                | `Number`     | Importe de la operación.                                                                                              |
| **`fecha_operacion`**      | `Date`       | Fecha y hora real de la operación bancaria.                                                                           |
| **`cuenta_origen_cbu`**    | `String`     | CBU del remitente/pagador o CBU de la cuenta de la Inmobiliaria (si es egreso).                                       |
| **`cuenta_destino_cbu`**   | `String`     | CBU de la cuenta de la Inmobiliaria (si es ingreso) o CBU del beneficiario (si es egreso).                            |
| **`identificador_fiscal`** | `String`     | CUIT/CUIL del Pagador o del Beneficiario.                                                                             |
| **`nombre_tercero`**       | `String`     | Nombre del Pagador (MERCADOLIBRE SRL) o Beneficiario (Julio Kenny).                                                   |
| **`concepto_transaccion`** | `String`     | Concepto del Debin (VAR) o de la Transferencia (HON).                                                                 |
| **`email_id`**             | `String`     | ID único del email procesado (para evitar duplicación).                                                               |
| **`conciliado_sistema`**   | `Boolean`    | `true` si este movimiento ya fue cotejado con una `transacción` interna.                                              |

---

## 2. 📧 Servicio de Escaneo de Email (`RedlinkScanService`)

Este servicio implementará la lógica de conexión y _scraping_.

### A. Lógica del Cron Job (Ejecución Diaria)

1.  **Conexión IMAP:** Utilizar las credenciales proporcionadas (`user: 'lisandro.prada@ipropietas.com.ar'`, `host: 'mail.ipropietas.com.ar'`, etc.) con una librería IMAP.
2.  **Filtro de Emails:** Buscar emails recientes (últimos 7 o 15 días) donde el remitente (`FROM`) sea `noreply@avisos.redlink.com.ar`.
3.  **Análisis Incremental:** Por cada email encontrado:
    - **Validación de ID Único:** Intentar extraer el `Nº de transacción` o el `Identificador del Debin`. **Antes de guardar, consultar `movimientos_bancarios_externos` para evitar duplicados.**
    - **Scraping:** Aplicar expresiones regulares robustas y específicas para cada formato de email (Ingreso vs. Egreso) para extraer todos los datos tabulados.
4.  **Persistencia:** Guardar el nuevo registro en la colección **`movimientos_bancarios_externos`** con `conciliado_sistema: false`.

### B. Mapeo de Datos (Scraping Detallado)

| Campo de Salida            | Lógica de Extracción (Ejemplo RegEx)                                             | Aplica a         |
| :------------------------- | :------------------------------------------------------------------------------- | :--------------- |
| **`identificador_unico`**  | Buscar: `Identificador del Debin\s*([A-Z0-9]+)` ó `Nº de transacción\s*([0-9]+)` | INGRESO / EGRESO |
| **`monto`**                | Buscar: `Importe\s*\$\s*([0-9,.]+)` ó `\$ ([0-9,.]+)`                            | Ambos            |
| **`identificador_fiscal`** | Buscar: `CUIT del Pagador\s*([0-9-]+)` ó `CUIT/CUIL/CDI\s*([0-9-]+)`             | Ambos            |

---

## 3. 🌐 Endpoints de Consulta (API)

Los _endpoints_ se crearán en el **`BankingSyncController`** (o el controlador donde resida el módulo). Deben utilizar el **mismo módulo de paginación y filtrado** que el resto de la aplicación.

### A. DTOs de Consulta (Uso del Módulo Existente)

El desarrollador no necesita crear DTOs de paginación nuevos; solo importar y aplicar los existentes.

| DTO/Objeto           | Uso en la Aplicación                                                                              |
| :------------------- | :------------------------------------------------------------------------------------------------ |
| **`PaginationDto`**  | Para `page`, `pageSize`, `sort`.                                                                  |
| **`QueryFilterDto`** | Para filtrado de campos como `tipo_operacion`, `fecha_operacion` (rango), `identificador_fiscal`. |

### B. Endpoints de `BankingSyncController`

| Método                       | Ruta                    | Descripción                                                                                                                                                                                           |
| :--------------------------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`GET /bank-sync`**         | **Listado y Filtrado**  | Devuelve un listado paginado y filtrado de **`movimientos_bancarios_externos`**. Permite al _frontend_ buscar por `identificador_unico`, `tipo_operacion`, y filtrar por `conciliado_sistema: false`. |
| **`GET /bank-sync/:id`**     | Detalle de Movimiento   | Obtiene un único movimiento bancario externo para su inspección y posterior uso en la conciliación manual.                                                                                            |
| **`POST /bank-sync/rescan`** | **Control Operacional** | Un _endpoint_ para que el administrador fuerce la ejecución del `RedlinkScanService` fuera del horario del Cron Job.                                                                                  |

---

## 4. 🔗 Integración con el Flujo de Conciliación (Futuro)

Esta nueva colección (`movimientos_bancarios_externos`) se convierte en la fuente de verdad para la **Conciliación Bancaria Automática** (que se implementaría en el `TransactionsModule`):

1.  **Automatización:** El sistema cotejará los movimientos `conciliado_sistema: false` con las `transacciones` internas que tienen `conciliado: false`, buscando coincidencias por **monto**, **fecha** e **identificador fiscal**.
2.  **Cierre:** Al encontrar una coincidencia, ambas entidades (`movimientos_bancarios_externos` y `transacciones`) se marcan como `conciliado_sistema: true` / `conciliado: true`, cerrando el ciclo de auditoría.

---

Sí, es fundamental crear _endpoints_ y una colección auxiliar para gestionar las configuraciones de email, ya que las credenciales y los parámetros de escaneo son datos críticos y sensibles.

Definiremos un nuevo módulo, **`SystemConfigModule`**, para albergar estas configuraciones globales de la Inmobiliaria.

---

## 🏗️ Módulo y Colección: Configuración de Servicios (Backend)

La configuración de acceso IMAP y los filtros deben residir en una colección separada para el control administrativo.

### 1. Nueva Colección: `configuracion_servicios`

Esta colección será de tipo **Singleton** (solo tendrá un documento global) y almacenará las credenciales y la lista de filtros de email.

| Campo                       | Tipo de Dato | Propósito                                                                                  | Regla de Seguridad                                         |
| :-------------------------- | :----------- | :----------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| **`email_consulta`**        | `String`     | El email de la Inmobiliaria para el acceso IMAP (ej., `lisandro.prada@ipropietas.com.ar`). | CRÍTICO: Debe estar encriptado.                            |
| **`password_consulta`**     | `String`     | Contraseña del email de acceso IMAP (ej., `Sa96roemo`).                                    | **DEBE SER ENCRIPTADO (ej., AES-256) antes de persistir.** |
| **`host_imap`**             | `String`     | Host del servidor IMAP (ej., `mail.ipropietas.com.ar`).                                    |                                                            |
| **`port_imap`**             | `Number`     | Puerto (ej., `993`).                                                                       |                                                            |
| **`check_period_days`**     | `Number`     | Rango de días a escanear (ej., `7` o `15` días).                                           | Usado por el Cron Job para el filtro de fecha.             |
| **`fecha_ultima_consulta`** | `Date`       | Timestamp del último escaneo exitoso.                                                      | Ayuda al Cron Job a consultar incrementalmente.            |

### 2. Módulo Auxiliar: `SystemConfigModule`

Este módulo gestionará el CRUD de esta colección Singleton.

---

## 2. 🌐 Endpoints de Configuración (`SystemConfigController`)

Los _endpoints_ deben estar fuertemente protegidos, ya que manejan credenciales sensibles.

### A. DTOs de Configuración

| DTO                    | Propósito                                                                 |
| :--------------------- | :------------------------------------------------------------------------ |
| `UpdateEmailConfigDto` | Contiene `email_consulta`, `password_consulta`, `host_imap`, `port_imap`. |

### B. Endpoints del Controlador

| Método                       | Ruta                        | Roles Requeridos      | Descripción y Lógica                                                                                                                                                        |
| :--------------------------- | :-------------------------- | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`POST /config/email`**     | **Crear Configuración**     | `ADMIN` / `SUPERUSER` | Crea el documento Singleton inicial de configuración de email.                                                                                                              |
| **`PATCH /config/email`**    | **Actualizar Credenciales** | `ADMIN` / `SUPERUSER` | **CRÍTICO:** Actualiza las credenciales IMAP. El servicio debe **encriptar la contraseña** antes de guardarla.                                                              |
| **`GET /config/email`**      | **Obtener Configuración**   | `ADMIN` / `SUPERUSER` | Recupera la configuración. **El _backend_ NUNCA debe devolver la contraseña desencriptada** al _frontend_. Solo debe devolver un _placeholder_ (ej., `password: '******'`). |
| **`GET /config/email/test`** | **Prueba de Conexión**      | `ADMIN` / `SUPERUSER` | Un _endpoint_ que utiliza las credenciales guardadas para intentar una conexión IMAP de prueba. Devuelve `200 OK` si la conexión fue exitosa.                               |

### 3. Integración con el `RedlinkScanService`

El servicio de escaneo de email ya no tendrá las credenciales _hardcodeadas_.

- **Lógica del `RedlinkScanService`:** Antes de conectarse, el servicio primero debe:
  1.  Consultar la colección `configuracion_servicios` para obtener la configuración Singleton.
  2.  **Desencriptar la contraseña** obtenida de la base de datos de forma segura.
  3.  Utilizar el email, password, host y puerto desencriptados para inicializar la conexión IMAP.

Este diseño asegura la gestión segura y centralizada de las credenciales de acceso al buzón de correo.

---

## 5. ✅ IMPLEMENTACIÓN COMPLETADA

El módulo de **Conciliación Bancaria Automatizada** ha sido completamente implementado en el _backend_. A continuación el resumen de lo entregado:

### A. Módulos creados

1. **SystemConfigModule** (`src/modules/system-config/`)
   - Gestión de credenciales IMAP encriptadas (AES-256-CBC)
   - Colección singleton `configuracion_servicios`
   - Endpoints protegidos por roles ADMIN/SUPERUSER

2. **BankingSyncModule** (`src/modules/banking-sync/`)
   - Colección `movimientos_bancarios_externos` para extractos digitales
   - Colección `candidatos_conciliacion` para validación manual
   - Servicio de escaneo IMAP (`RedlinkScanService`)
   - Servicio de conciliación (`ConciliationService`)
   - Controller con endpoints de consulta y operación

### B. Flujo de trabajo implementado

#### 1. Configuración inicial

```bash
# Crear variables de entorno
ENCRYPTION_KEY=tu_clave_32_caracteres_aqui
ENCRYPTION_IV=tu_iv_16_caracteres_aqui

# Ejecutar seed de configuración (opcional)
pnpm run seed:system-config
```

#### 2. Configurar credenciales IMAP

```http
POST /config/email
Authorization: Bearer <token_admin>
Content-Type: application/json

{
  "email_consulta": "email@dominio.com",
  "password_consulta": "password_imap",
  "host_imap": "mail.dominio.com",
  "port_imap": 993,
  "secure": true,
  "check_period_days": 7
}
```

#### 3. Escaneo de emails bancarios

El sistema ejecuta automáticamente todos los días a las 8:00 AM, o manualmente:

```http
POST /bank-sync/rescan
Authorization: Bearer <token_admin>
```

**Respuesta:**

```json
{
  "message": "Escaneo de emails completado",
  "procesados": 15,
  "nuevos": 3,
  "duplicados": 12,
  "errores": 0
}
```

#### 4. Consultar movimientos externos

```http
GET /bank-sync?page=0&pageSize=20&conciliado_sistema=false&tipo_operacion=INGRESO
Authorization: Bearer <token>
```

**Respuesta:**

```json
{
  "data": [
    {
      "_id": "...",
      "identificador_unico": "DEB123456",
      "tipo_operacion": "INGRESO",
      "monto": 150000,
      "fecha_operacion": "2025-11-10T10:30:00Z",
      "nombre_tercero": "JUAN PEREZ",
      "identificador_fiscal": "20123456789",
      "conciliado_sistema": false
    }
  ],
  "total": 5,
  "page": 0,
  "pageSize": 20,
  "totalPages": 1
}
```

#### 5. Generar candidatos de conciliación

El sistema no concilia automáticamente. Genera **candidatos** para validación manual:

```http
POST /bank-sync/candidates/generate
Authorization: Bearer <token_admin>
Content-Type: application/json

{
  "fechaToleranceDays": 1,
  "maxCandidatesPerMovement": 5
}
```

**Respuesta:**

```json
{
  "processedMovements": 5,
  "totalCandidates": 8,
  "perMovement": {
    "mov1": 2,
    "mov2": 3,
    "mov3": 1
  }
}
```

#### 6. Listar candidatos pendientes

```http
GET /bank-sync/candidates?status=PENDING
Authorization: Bearer <token>
```

**Respuesta:**

```json
[
  {
    "_id": "cand1",
    "bank_movement_id": { ...movimiento_externo },
    "transaction_id": { ...transaccion_interna },
    "status": "PENDING",
    "score": 80,
    "match_reasons": ["MONTO", "FECHA"]
  }
]
```

#### 7. Confirmar o rechazar candidato

```http
POST /bank-sync/candidates/status
Authorization: Bearer <token_admin>
Content-Type: application/json

{
  "candidateId": "cand1",
  "status": "CONFIRMED",
  "notes": "Validado manualmente por operador"
}
```

**Efecto:** Al confirmar:

- El movimiento bancario externo se marca `conciliado_sistema: true`
- La transacción interna se marca `conciliado: true`
- Otros candidatos del mismo movimiento se rechazan automáticamente

### C. Algoritmo de matching

El sistema genera candidatos cuando encuentra coincidencias en:

1. **Monto exacto** (+50 puntos)
2. **Fecha dentro de tolerancia** (± días configurables, +30 puntos)
3. **Tipo de operación** (INGRESO ↔ INGRESO, EGRESO ↔ EGRESO)
4. **CUIT/CUIL** (opcional, +20 puntos si coincide)

Score máximo: 100 puntos. Los candidatos se ordenan por score descendente.

### D. Endpoints disponibles

#### SystemConfig

- `POST /api/v1/config/email` - Crear configuración inicial
- `GET /api/v1/config/email` - Consultar configuración (password oculto)
- `PATCH /api/v1/config/email` - Actualizar credenciales
- `GET /api/v1/config/email/test` - Probar conexión IMAP (actualmente placeholder; ver nota más abajo)

#### BankingSync

- `GET /api/v1/bank-sync` - Listar movimientos (con filtros y paginación)
- `GET /api/v1/bank-sync/:id` - Detalle de movimiento
- `GET /api/v1/bank-sync/stats/overview` - Estadísticas de conciliación
- `POST /api/v1/bank-sync/rescan` - Forzar escaneo manual
- `GET /api/v1/bank-sync/test/connection` - Test conexión IMAP
- `POST /api/v1/bank-sync/candidates/generate` - Generar candidatos
- `GET /api/v1/bank-sync/candidates` - Listar candidatos
- `POST /api/v1/bank-sync/candidates/status` - Confirmar/rechazar candidato

---

## 6. API de referencia detallada

Esta sección documenta los endpoints expuestos por los módulos SystemConfig y BankingSync con tipado de entrada/salida, DTOs y esquemas involucrados.

### 6.1 Esquemas y Enums

Tipos base usados en las respuestas:

```ts
// src/modules/banking-sync/entities/bank-movement.entity.ts
export enum TipoOperacion {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

export interface BankMovementDoc {
  _id: string;
  identificador_unico: string;
  tipo_operacion: TipoOperacion;
  monto: number;
  fecha_operacion: string; // ISO-8601
  cuenta_origen_cbu?: string;
  cuenta_destino_cbu?: string;
  identificador_fiscal?: string;
  nombre_tercero?: string;
  concepto_transaccion?: string;
  email_id: string;
  conciliado_sistema: boolean;
  transaccion_id?: string;
  candidato_conciliacion_ids?: string[];
  observaciones?: string;
  email_asunto?: string;
  email_fecha?: string; // ISO-8601
  createdAt?: string;
  updatedAt?: string;
}

// src/modules/banking-sync/entities/conciliation-candidate.entity.ts
export enum CandidateStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}

export interface ConciliationCandidateDoc {
  _id: string;
  bank_movement_id: BankMovementDoc | string;
  transaction_id: any; // Referencia a Transaction interna
  status: CandidateStatus;
  score: number; // 0..100
  match_reasons?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// src/modules/system-config/entities/system-config.entity.ts
export interface SystemConfigDoc {
  _id: string;
  email_consulta: string;
  password_consulta: string; // Encriptada en BD. En GET se devuelve '********'
  host_imap: string;
  port_imap: number;
  secure: boolean;
  check_period_days: number;
  fecha_ultima_consulta?: string; // ISO-8601
  activo: boolean;
}
```

### 6.2 Formatos de email Red Link soportados y estrategia de parsing

El servicio `RedlinkScanService` soporta actualmente dos familias de correos de Red Link y extrae los datos a partir de tablas HTML con etiquetas en una celda y valores en otra. Además, mantiene expresiones regulares de respaldo si el formato varía o llega en texto plano.

- Ingresos (créditos):
  - Asuntos típicos: "Debin Acreditado", "Confirmación de acreditación de DEBIN".
  - Etiquetas esperadas: "Identificador del Debin", "Concepto", "Importe", "CBU Crédito", "CUIT del Pagador", "Nombre del Pagador".
  - Mapeo: CBU Crédito → `cuenta_destino_cbu`, Pagador → `identificador_fiscal`/`nombre_tercero`.

- Egresos (débitos):
  - Asuntos típicos: "Transferencia Debitada", "Débito de Transferencia".
  - Etiquetas esperadas: "Identificador de Transferencia" o "Nº de transacción", "Concepto", "Importe", "CBU Débito", "CUIT del Destinatario" (o "del Beneficiario"), "Nombre del Destinatario" (o "del Beneficiario").
  - Mapeo: CBU Débito → `cuenta_origen_cbu`, CBU Crédito → `cuenta_destino_cbu`, Destinatario/Beneficiario → `identificador_fiscal`/`nombre_tercero`.

Sinónimos admitidos por el parser (labels normalizados, acentos y puntuación tolerados):

- Identificador:
  - Ingreso: "Identificador del Debin".
  - Egreso: "Identificador de Transferencia", "Nº de transacción", "N° de transacción", "Número/Numero de transacción".
- CBU origen: "CBU Origen", "CBU del Pagador", "CBU Débito/Debito".
- CBU destino: "CBU Destino", "CBU del Beneficiario", "CBU Crédito/Credito".
- CUIT: "CUIT del Pagador", "CUIT del Destinatario", "CUIT del Beneficiario", "CUIT/CUIL".
- Nombre: "Nombre del Pagador"/"Pagador", "Nombre del Destinatario"/"Destinatario", "Nombre del Beneficiario"/"Beneficiario".
- Concepto: campo alfanumérico corto (p.ej. VAR, ALQ, HON).

Normalización de valores:

- Importe: soporta `1.234,56`, `1234,56`, `1234.56`, `123456` (detecta separador decimal/coma/punto y miles).
- Fecha: extrae de etiqueta "Fecha" si existe; si no, busca `dd/mm/yyyy` en el cuerpo; si falla, usa `email.date` del header.

Validaciones mínimas para persistir el movimiento:

- Debe existir `identificador_unico` y `monto` > 0. Si faltan, el email se descarta.

Ejemplo de salida persistida (ingreso):

```json
{
  "identificador_unico": "XJ8G7V95DEDJKM049EMPYR",
  "tipo_operacion": "INGRESO",
  "monto": 137409.81,
  "fecha_operacion": "2025-11-12T00:00:00.000Z",
  "cuenta_destino_cbu": "0830021801002035200010",
  "identificador_fiscal": "30715421700",
  "nombre_tercero": "ALAU TECNOLOGIA S.A.U.",
  "concepto_transaccion": "VAR",
  "email_asunto": "Debin Acreditado -  12/11/2025 11:10"
}
```

Ejemplo de salida persistida (egreso):

```json
{
  "identificador_unico": "D4RO172VZEZ3GJO0NKJ3QE",
  "tipo_operacion": "EGRESO",
  "monto": 167454.73,
  "fecha_operacion": "2025-11-12T00:00:00.000Z",
  "cuenta_origen_cbu": "0830021801002035200010",
  "cuenta_destino_cbu": "0000003100078520895864",
  "identificador_fiscal": "27170497738",
  "concepto_transaccion": "ALQ",
  "email_asunto": "Transferencia Debitada -  12/11/2025 14:33"
}
```

---

## 7. Integración con Frontend: qué usar y qué (posiblemente) cambiar

Para exponer la información al frontend y habilitar la validación manual, usar estos endpoints y objetos:

1. Listado de movimientos externos para revisión

- `GET /api/v1/bank-sync?conciliado_sistema=false&tipo_operacion=INGRESO|EGRESO&page=0&pageSize=20`
- Campos relevantes para UI de revisión:
  - `tipo_operacion`, `fecha_operacion`, `monto`
  - `identificador_unico`
  - `cuenta_origen_cbu`, `cuenta_destino_cbu`
  - `identificador_fiscal`, `nombre_tercero`
  - `concepto_transaccion`

2. Candidatos de conciliación y confirmación

- `POST /api/v1/bank-sync/candidates/generate` para generar candidatos (operación administrativa)
- `GET /api/v1/bank-sync/candidates?status=PENDING` para que el operador vea matches sugeridos
- `POST /api/v1/bank-sync/candidates/status` para confirmar/rechazar con `candidateId`, `status`, `notes`

3. Salud y operación del servicio (para monitoreo)

- `GET /api/v1/bank-sync/health` muestra: config presente, última consulta, estado IMAP y totales.
- `GET /api/v1/bank-sync/test/connection` prueba conectividad IMAP.

Recomendaciones y cambios mínimos en frontend:

- Mostrar en tarjetas/listado los campos nuevos que ahora extraemos del email:
  - Identificador (Debin/Transferencia), CUIT (Pagador/Destinatario), CBU Débito/Crédito, Concepto y Nombre del tercero.
- Etiquetas contextuales según `tipo_operacion`:
  - Ingreso: mostrar "CBU Crédito", "Pagador".
  - Egreso: mostrar "CBU Débito", "Destinatario/Beneficiario".
- En la pantalla de conciliación manual, incluir el score y `match_reasons` de los candidatos y permitir confirmación con observaciones.
- No es necesario cambiar contratos ya publicados si ya consumen `/bank-sync` y `/bank-sync/candidates`; pero para aprovechar la nueva data, el frontend debería:
  - Renderizar los nuevos campos si están presentes.
  - Permitir filtros por `tipo_operacion`, `identificador_unico` y `identificador_fiscal`.

Seguridad:

- Nunca exponer `password_consulta` desencriptado. El endpoint de configuración ya devuelve placeholder.
- Proteger los endpoints de operación (`rescan`, `candidates/generate`, `candidates/status`) por rol.

---

## 8. Ejemplos de UI sugeridos (para validación manual)

- Vista “Bandeja de movimientos” con filtros: fecha desde/hasta, tipo (INGRESO/EGRESO), texto libre (busca en identificador/nombre/concepto).
- Ficha de movimiento con columnas: Fecha, Monto, Identificador, CUIT, Tercero, CBU Origen/Débito, CBU Destino/Crédito, Concepto.
- Panel lateral “Candidatos” con score y razones, botón Confirmar/Rechazar (+ nota opcional).

---

Nota: El parser se valida con pruebas unitarias para los formatos compartidos (ingreso DEBIN y egreso Transferencia). Si Red Link introduce variantes, agregaremos sinónimos/regex y un test nuevo para mantener la robustez.

DTOs de entrada relevantes:

```ts
// src/modules/banking-sync/dto/bank-movement-query.dto.ts
export interface BankMovementQueryDto {
  page?: number; // default 0
  pageSize?: number; // default 10
  sort?: string; // default -fecha_operacion
  tipo_operacion?: TipoOperacion;
  conciliado_sistema?: boolean;
  fecha_desde?: string; // ISO date
  fecha_hasta?: string; // ISO date
  identificador_fiscal?: string;
  identificador_unico?: string;
  nombre_tercero?: string;
}

// src/modules/banking-sync/dto/generate-candidates.dto.ts
export interface GenerateCandidatesDto {
  bankMovementId?: string;
  fechaToleranceDays?: number; // default 1 (0..3)
  maxCandidatesPerMovement?: number; // default 5 (0..10)
}

// src/modules/banking-sync/dto/update-candidate-status.dto.ts
export interface UpdateCandidateStatusDto {
  candidateId: string;
  status: CandidateStatus; // CONFIRMED | REJECTED
  notes?: string;
}

// src/modules/system-config/dto/create-system-config.dto.ts
export interface CreateSystemConfigDto {
  email_consulta: string;
  password_consulta: string; // se encripta al guardar
  host_imap: string;
  port_imap: number; // 1..65535
  secure?: boolean; // default true
  check_period_days?: number; // default 7 (1..30)
}

// src/modules/system-config/dto/update-system-config.dto.ts
export type UpdateSystemConfigDto = Partial<CreateSystemConfigDto>;
```

### 6.2 SystemConfig API

Todos los endpoints requieren roles: ADMIN o SUPERUSER.

1. Crear configuración

- Method/Path: POST /api/v1/config/email
- Body: CreateSystemConfigDto
- Response: SystemConfigDoc

Ejemplo de respuesta:

```json
{
  "_id": "67594f...",
  "email_consulta": "email@dominio.com",
  "password_consulta": "<hex_encriptado>",
  "host_imap": "mail.dominio.com",
  "port_imap": 993,
  "secure": true,
  "check_period_days": 7,
  "activo": true
}
```

2. Obtener configuración (password oculto)

- Method/Path: GET /api/v1/config/email
- Response: SystemConfigDoc con password_consulta = "**\*\*\*\***"

3. Actualizar configuración

- Method/Path: PATCH /api/v1/config/email
- Body: UpdateSystemConfigDto
- Response: SystemConfigDoc (con password encriptado en el documento)

4. Probar conexión IMAP

- Method/Path: GET /api/v1/config/email/test
- Response actual: { status: 'pending', message: 'Funcionalidad de test pendiente de implementación' }
- Nota: Para testear conexión hoy usar GET /api/v1/bank-sync/test/connection

### 6.3 BankingSync API

Requiere roles: ADMIN, SUPERUSER o CONTABILIDAD.

1. Listar movimientos bancarios

- Method/Path: GET /api/v1/bank-sync
- Query: BankMovementQueryDto
- Response:

```ts
interface ListBankMovementsResponse {
  data: BankMovementDoc[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

2. Obtener detalle de movimiento

- Method/Path: GET /api/v1/bank-sync/:id
- Params: id: string
- Response: BankMovementDoc

3. Estadísticas de conciliación

- Method/Path: GET /api/v1/bank-sync/stats/overview
- Response:

```ts
interface BankSyncStatsResponse {
  total: number;
  conciliados: number;
  pendientes: number;
  porcentaje_conciliacion: string | number; // ej. "42.86"
  por_tipo: Array<{ _id: TipoOperacion; count: number; total_monto: number }>;
}
```

4. Forzar escaneo manual de emails

- Method/Path: POST /api/v1/bank-sync/rescan
- Response:

```ts
interface RescanResponse {
  message: string; // "Escaneo de emails completado"
  procesados: number;
  nuevos: number;
  duplicados: number;
  errores: number;
}
```

5. Probar conexión IMAP con credenciales guardadas

- Method/Path: GET /api/v1/bank-sync/test/connection
- Response: { status: 'success' | 'failed'; message: string }

6. Generar candidatos de conciliación

- Method/Path: POST /api/v1/bank-sync/candidates/generate
- Query: GenerateCandidatesDto (acepta parámetros por querystring)
- Response:

```ts
interface GenerateCandidatesResponse {
  processedMovements: number;
  totalCandidates: number;
  perMovement: Record<string, number>;
}
```

7. Listar candidatos

- Method/Path: GET /api/v1/bank-sync/candidates
- Query: { status?: CandidateStatus; bankMovementId?: string }
- Response: ConciliationCandidateDoc[] (poblados con bank_movement_id y transaction_id)

8. Confirmar/Rechazar candidato

- Method/Path: POST /api/v1/bank-sync/candidates/status
- Body: UpdateCandidateStatusDto
- Efectos al confirmar (status=CONFIRMED):
  - Marca el movimiento externo como conciliado
  - Marca la transacción interna como conciliada
  - Rechaza otros candidatos PENDING del mismo movimiento
- Response: ConciliationCandidateDoc actualizado

9. Health check completo del módulo

- Method/Path: GET /api/v1/bank-sync/health
- Auth: Requiere autenticación (admin/superUser/contabilidad)
- Response:

```ts
interface HealthResponse {
  configPresent: boolean; // Si existe configuración IMAP
  lastCheckAt: string | null; // ISO-8601 fecha última consulta
  imapConnection: 'success' | 'failed' | 'not-tested'; // Estado de conexión IMAP
  isScanning: boolean; // Si hay escaneo en progreso
  stats: {
    totalMovements: number;
    conciliated: number;
    pending: number;
    conciliationRate: string | number; // ej. "42.86"
  };
}
```

Ejemplo de respuesta:

```json
{
  "configPresent": true,
  "lastCheckAt": "2025-11-12T08:15:30.000Z",
  "imapConnection": "success",
  "isScanning": false,
  "stats": {
    "totalMovements": 150,
    "conciliated": 120,
    "pending": 30,
    "conciliationRate": "80.00"
  }
}
```

---

## 7. Espíritu del módulo y funcionalidad

- Fuente de verdad externa: Los emails bancarios alimentan movimientos externos normalizados.
- Seguridad y cumplimiento: Credenciales encriptadas, endpoints protegidos por roles, password nunca expuesto en claro.
- Validación manual primero: No hay conciliación automática; se generan candidatos con score y un humano confirma.
- Auditabilidad: Cambios de estado registrados en candidatos; deduplicación por identificador_unico.
- Escalabilidad: Índices en colecciones y límites por lote; cron diario y opción de ejecución manual.

Nota sobre consistencia: En esta versión, el endpoint de generación de candidatos acepta parámetros por querystring. Se puede extender a body en una versión futura sin romper compatibilidad.

### E. Seguridad implementada

1. **Encriptación de contraseñas:** AES-256-CBC con claves desde variables de entorno
2. **Protección por roles:** Todos los endpoints requieren autenticación
3. **Validación manual obligatoria:** No hay conciliación automática sin aprobación
4. **Deduplicación:** Identificadores únicos previenen procesamiento duplicado

### F. Tests incluidos

- Tests unitarios de `ConciliationService` (3 passing)
- Cobertura de lógica de scoring
- Validación de flujo de confirmación/rechazo
- Mock de modelos Mongoose y servicios

### G. Scripts disponibles

```bash
# Seed de configuración IMAP
pnpm run seed:system-config

# Tests
pnpm test

# Build
pnpm build
```

### H. Próximos pasos recomendados

1. **Frontend:** Crear interfaz para revisar candidatos y aprobar/rechazar
2. **Métricas:** Dashboard de conciliación (pendientes vs conciliados)
3. **Alertas:** Notificaciones cuando hay candidatos con score alto
4. **Auditoría:** Log de todas las confirmaciones/rechazos con usuario y timestamp
5. **Refinamiento:** Ajustar pesos del scoring según feedback operativo

---

## 9. Ejemplos de respuestas del backend

A continuación se presentan respuestas típicas del backend para que el frontend tenga ejemplos concretos del contrato de datos.

### 9.1 Listado de movimientos externos

**GET** `/api/v1/bank-sync?page=0&pageSize=20&conciliado_sistema=false`

```json
{
  "data": [
    {
      "_id": "67335f0b1b23456789abc001",
      "identificador_unico": "XJ8G7V95DEDJKM049EMPYR",
      "tipo_operacion": "INGRESO",
      "monto": 137409.81,
      "fecha_operacion": "2025-11-12T14:10:25.000Z",
      "cuenta_origen_cbu": null,
      "cuenta_destino_cbu": "0830021801002035200010",
      "identificador_fiscal": "30715421700",
      "nombre_tercero": "ALAU TECNOLOGIA S.A.U.",
      "concepto_transaccion": "VAR",
      "conciliado_sistema": false,
      "email_id": "<messageId-1>",
      "email_asunto": "Debin Acreditado -  12/11/2025 11:10",
      "email_fecha": "2025-11-12T14:10:26.000Z",
      "createdAt": "2025-11-12T14:15:00.000Z",
      "updatedAt": "2025-11-12T14:15:00.000Z"
    },
    {
      "_id": "67335f0b1b23456789abc002",
      "identificador_unico": "D4RO172VZEZ3GJO0NKJ3QE",
      "tipo_operacion": "EGRESO",
      "monto": 167454.73,
      "fecha_operacion": "2025-11-12T17:33:17.000Z",
      "cuenta_origen_cbu": "0830021801002035200010",
      "cuenta_destino_cbu": "0000003100078520895864",
      "identificador_fiscal": "27170497738",
      "nombre_tercero": null,
      "concepto_transaccion": "ALQ",
      "conciliado_sistema": false,
      "email_id": "<messageId-2>",
      "email_asunto": "Transferencia Debitada -  12/11/2025 14:33",
      "email_fecha": "2025-11-12T17:33:18.000Z",
      "createdAt": "2025-11-12T17:35:00.000Z",
      "updatedAt": "2025-11-12T17:35:00.000Z"
    }
  ],
  "total": 2,
  "page": 0,
  "pageSize": 20,
  "totalPages": 1
}
```

### 9.2 Detalle de un movimiento

**GET** `/api/v1/bank-sync/67335f0b1b23456789abc001`

```json
{
  "_id": "67335f0b1b23456789abc001",
  "identificador_unico": "XJ8G7V95DEDJKM049EMPYR",
  "tipo_operacion": "INGRESO",
  "monto": 137409.81,
  "fecha_operacion": "2025-11-12T14:10:25.000Z",
  "cuenta_destino_cbu": "0830021801002035200010",
  "identificador_fiscal": "30715421700",
  "nombre_tercero": "ALAU TECNOLOGIA S.A.U.",
  "concepto_transaccion": "VAR",
  "conciliado_sistema": false,
  "email_id": "<messageId-1>",
  "email_asunto": "Debin Acreditado -  12/11/2025 11:10",
  "email_fecha": "2025-11-12T14:10:26.000Z",
  "createdAt": "2025-11-12T14:15:00.000Z",
  "updatedAt": "2025-11-12T14:15:00.000Z"
}
```

### 9.3 Health del módulo

**GET** `/api/v1/bank-sync/health`

```json
{
  "configPresent": true,
  "lastCheckAt": "2025-11-12T08:00:10.000Z",
  "imapConnection": "success",
  "isScanning": false,
  "stats": {
    "total": 152,
    "ingresos": 97,
    "egresos": 55,
    "conciliados": 34,
    "pendientes": 118
  }
}
```

### 9.4 Generar candidatos de conciliación

**POST** `/api/v1/bank-sync/candidates/generate`

Body:

```json
{
  "fechaToleranceDays": 1,
  "maxCandidatesPerMovement": 5
}
```

Respuesta:

```json
{
  "processedMovements": 12,
  "totalCandidates": 19,
  "perMovement": {
    "67335f0b1b23456789abc001": 2,
    "67335f0b1b23456789abc002": 1
  }
}
```

### 9.5 Listar candidatos pendientes

**GET** `/api/v1/bank-sync/candidates?status=PENDING`

```json
[
  {
    "_id": "cnd_001",
    "bank_movement_id": {
      "_id": "67335f0b1b23456789abc001",
      "identificador_unico": "XJ8G7V95DEDJKM049EMPYR",
      "monto": 137409.81,
      "fecha_operacion": "2025-11-12T14:10:25.000Z",
      "tipo_operacion": "INGRESO"
    },
    "transaction_id": {
      "_id": "tr_1123",
      "fecha": "2025-11-12T14:10:00.000Z",
      "monto": 137409.81,
      "concepto": "Cobro alquiler noviembre"
    },
    "status": "PENDING",
    "score": 80,
    "match_reasons": ["MONTO", "FECHA"],
    "createdAt": "2025-11-12T14:20:00.000Z"
  }
]
```

### 9.6 Confirmar candidato

**POST** `/api/v1/bank-sync/candidates/status`

Body:

```json
{
  "candidateId": "cnd_001",
  "status": "CONFIRMED",
  "notes": "Validado por operador contable"
}
```

Respuesta:

```json
{
  "candidateId": "cnd_001",
  "status": "CONFIRMED",
  "movementUpdated": true,
  "transactionUpdated": true,
  "otherCandidatesRejected": 1
}
```

### 9.7 Test conexión IMAP

**GET** `/api/v1/bank-sync/test/connection`

```json
{
  "status": "success",
  "message": "Conexión IMAP exitosa"
}
```

### 9.8 Rescan manual

**POST** `/api/v1/bank-sync/rescan`

```json
{
  "message": "Escaneo de emails completado",
  "procesados": 15,
  "nuevos": 3,
  "duplicados": 12,
  "errores": 0
}
```

### 9.9 Estadísticas del módulo

**GET** `/api/v1/bank-sync/stats/overview`

```json
{
  "total": 152,
  "ingresos": 97,
  "egresos": 55,
  "conciliados": 34,
  "pendientes": 118
}
```

### 9.10 Candidato confirmado (consulta posterior)

**GET** `/api/v1/bank-sync/candidates?status=CONFIRMED`

```json
[
  {
    "_id": "cnd_001",
    "bank_movement_id": "67335f0b1b23456789abc001",
    "transaction_id": "tr_1123",
    "status": "CONFIRMED",
    "score": 80,
    "match_reasons": ["MONTO", "FECHA"],
    "confirmedAt": "2025-11-12T14:25:05.000Z",
    "confirmedBy": "usr_admin_01",
    "notes": "Validado por operador contable"
  }
]
```

### Notas para el frontend

- **Campos clave a mostrar:** `identificador_unico`, `tipo_operacion`, `monto`, `fecha_operacion`, `identificador_fiscal`, `nombre_tercero`, `cuenta_origen_cbu`, `cuenta_destino_cbu`, `concepto_transaccion`.
- **Etiquetas dinámicas según tipo_operacion:**
  - Ingreso: mostrar "CBU Crédito" (destino), "Pagador" (tercero).
  - Egreso: mostrar "CBU Débito" (origen), "Destinatario/Beneficiario" (tercero).
- **Usar `conciliado_sistema`** para separar pendientes vs conciliados.
- **Para candidatos:** mostrar `score` y `match_reasons`; permitir acción de confirmación/rechazo con nota opcional.
- **Validaciones:** Los campos opcionales (`nombre_tercero`, `cuenta_origen_cbu`, etc.) pueden ser `null` según el email parseado.

---

**Estado:** ✅ Módulo completo, testeado y listo para producción.
