# ABM (Alta / Baja / Modificación) de Service Account Mappings — Guía para Frontend

Propósito

Este documento define el contrato y la experiencia de usuario recomendada para implementar en el frontend la gestión (ABM) de `ServiceAccountMapping` — el recurso que vincula proveedores de servicios (proveedor agente o CUIT) con códigos de cuenta contable usados por el flujo de facturas detectadas.

Resumen ejecutivo

- Objeto principal: `ServiceAccountMapping` (mapping proveedor → cuentas).
- Campos clave: proveedor (agent id o provider_cuit), identificador_servicio (opcional), cuenta_egreso_codigo, cuenta_a_pagar_codigo, moneda, enabled, prioridad.
- Requisitos UI: listar, filtrar, crear, editar, desactivar/borrar mappings; validar que los códigos de cuenta existen (o manejar respuesta del backend si no existen); explicar prioridad y alcance (global vs por identificador_servicio).

Endpoints (contrato)

Nota: los paths deben existir en la API. Si tu entorno difiere, adapta las rutas. Los ejemplos asumen prefijo `/api/v1/service-account-mappings`.

- GET /api/v1/service-account-mappings
  - Query params: `provider_agent_id?`, `provider_cuit?`, `identificador_servicio?`, `enabled?`
  - Response: 200 OK, body: `ServiceAccountMapping[]`

- GET /api/v1/service-account-mappings/:id
  - Response: 200 OK, body: `ServiceAccountMapping`

- POST /api/v1/service-account-mappings
  - Body (example):
    ```json
    {
      "provider_agent_id": "57f7de5f5c02c36dd2647313", // opcional si se usa provider_cuit
      "provider_cuit": "30657864427", // opcional si se usa provider_agent_id
      "provider_name": "CAMUZZI", // opcional, para display
      "identificador_servicio": "9103/0-04-04-0013178/8", // optional, null = generic
      "cuenta_egreso_codigo": "EGRESO_SERV_GAS",
      "cuenta_a_pagar_codigo": "PAS_PROV_GAS",
      "moneda": "ARS",
      "enabled": true,
      "prioridad": 0
    }
    ```
  - Response: 201 Created, body: created mapping

- PUT /api/v1/service-account-mappings/:id
  - Body: same shape as create, partial updates supported
  - Response: 200 OK, body: updated mapping

- DELETE /api/v1/service-account-mappings/:id
  - Response: 204 No Content (or 200 with message) — prefer soft-delete (enabled=false) in UI patterns

Data shape (fields the frontend should show/edit)

- \_id: string (read-only)
- provider_agent_id: string | null — ObjectId del agente proveedor (si existe)
- provider_cuit: string | null — CUIT del proveedor (si existe); useful cuando no hay agent id
- provider_name: string — display
- identificador_servicio: string | null — si null, mapping aplica a cualquier servicio del proveedor
- cuenta_egreso_codigo: string — código (ej: EGRESO_SERV_GAS)
- cuenta_a_pagar_codigo: string — código (ej: PAS_PROV_GAS)
- moneda: string (ej: ARS)
- enabled: boolean — si false, mapping no se usaría en resolución automática
- prioridad: number — menor = mayor prioridad (0 = default alta prioridad)
- createdAt / updatedAt — lectura

Validaciones que debe aplicar el frontend antes de enviar

- Requeridos: al menos uno de `provider_agent_id` o `provider_cuit` debe estar presente.
- `cuenta_egreso_codigo` y `cuenta_a_pagar_codigo` deben ser strings no vacíos.
- `identificador_servicio` puede estar vacío/null para indicar mapping genérico.
- `prioridad` — entero, default 0.
- `moneda` — validar contra lista permitida (ej: ARS, USD) si existe.

UX / Flujos de pantalla

1. Listado de mappings (index)

- Columns to show: Provider (name + cuit), identificador_servicio (or "genérico"), cuenta_egreso_codigo, cuenta_a_pagar_codigo, moneda, prioridad, enabled, acciones (Editar / Desactivar / Borrar)
- Filters: provider (search by name or CUIT), identificador_servicio, enabled (sí/no)
- Sorting: prioridad asc, provider name asc
- Bulk actions: enable/disable selected

2. Crear mapping (form)

- Fields: Provider selector (see below), identificador_servicio (optional), cuenta_egreso_codigo (typeahead), cuenta_a_pagar_codigo (typeahead), moneda, prioridad, enabled
- Provider selector UX:
  - Prefer a typeahead that lets the user search agents by name or CUIT (GET /api/v1/agents?query=... or use existing providers endpoint). If the provider does not exist in agents, allow entering `provider_cuit` and `provider_name` manually.
  - When a provider is selected and has an `_id`, populate `provider_agent_id` and `provider_cuit` (if agent has identificador_fiscal).
- Account code typeahead:
  - Query `/api/v1/chart-of-accounts?query=...` or a dedicated endpoint to validate codes. If not available, allow free text but show a warning that backend will validate codes on save.
- Validation before submit:
  - Ensure required fields are filled.
  - If server returns 404 for account codes, show error and suggestion to create account.

3. Edit mapping (form)

- Same as create, prefill values. Allow toggling `enabled` and `prioridad`.
- Show history (updatedAt) and who edited (if available).

4. Delete / Disable mapping

- Prefer soft-delete: a Delete action that sets `enabled=false` and keeps history. If API supports hard delete, confirm with user and show consequences. Provide undo (re-enable) for a short time.

Behaviour rules & corner cases

- Prioridad / matching order
  - The backend resolves mappings with the following precedence (frontend should display this as tooltip):
    1. provider_agent_id + identificador_servicio (exact)
    2. provider_agent_id (generic)
    3. provider_cuit + identificador_servicio (exact)
    4. provider_cuit (generic)
  - When creating a mapping for a provider+identificador_servicio, warn if a generic mapping exists with same provider (it may be shadowed by the specific mapping depending on prioridad).

- Validation from backend
  - The server will validate that referenced `cuenta_*_codigo` resolve to `ChartOfAccount` ids. If they don't, API responds with 404 + message. The frontend should display the message and guide the user to create the missing account or change code.

- Multiple active mappings and prioridad
  - If multiple mappings exist for the same provider+identificador_servicio, the backend uses `prioridad` to pick which to apply; frontend should show `prioridad` and allow editing.

- Mapping scope and safety
  - `identificador_servicio` null means generic for the provider. Show a clear badge "GENÉRICO" for such mappings.

API error handling (UX)

- 400 Bad Request — show validation messages returned by API near the relevant form fields.
- 404 Not Found — typically for missing accounts; show message and direct link/CTA to the Chart of Accounts screen or to support instructions.
- 409 Conflict — if API uses for uniqueness conflicts; show message "Mapping already exists" with link to edit.
- 500 Internal — show generic error and option to retry; capture the error details in a client-side log for support.

Integration with process-detected-expense flow

- When the operator opens the detected-expense processing modal, the frontend may prefetch mappings for the detected expense's provider (by `_id` or `provider_cuit`) using GET `/api/v1/service-account-mappings?provider_agent_id=<id>&identificador_servicio=<id>`.
- If the backend returns a single enabled mapping, show it as the default and allow operator to override by selecting a different mapping (send `mappingId` in the process request).
- If backend returns zero mappings, show the CTA "Configurar mapping" and optionally a button to open the mapping create form prefilled with `provider_cuit` and `identificador_servicio`.

Acceptance criteria (QA-ready)

1. List page:
   - [ ] Able to filter mappings by provider (name/cuit) and identificador_servicio.
   - [ ] Able to toggle enabled/disabled status from the list.

2. Create mapping:
   - [ ] Form validates required fields and shows server validation errors.
   - [ ] On success, new mapping appears in the list and can be used by `process-detected-expense`.

3. Edit mapping:
   - [ ] Updates persist and reflected immediately in list and in processing flow.

4. Delete/Disable mapping:
   - [ ] Disabled mappings don't get returned by default in the automatic resolution flow.

5. Integration:
   - [ ] Opening detected-expense modal prefetches candidate mappings.
   - [ ] If a mapping exists and operator processes without override, the mapping used by backend creates the accounting entry successfully.

Developer notes / tips

- Permissions: only roles with access to accounting configuration (e.g., admin, contabilidad) should see ABM screens. Use existing Auth roles used elsewhere in the app.
- If ChartOfAccounts code validation endpoint doesn't exist, implement a thin validation call in backend that returns available codes for typeahead.
- Prefer server-driven validation: frontend should treat chart-of-account validation as advisory and show API errors as authoritative.

Examples (requests/responses)

Create mapping request

POST /api/v1/service-account-mappings

```json
{
  "provider_agent_id": "57f7de5f5c02c36dd2647313",
  "provider_cuit": "30657864427",
  "provider_name": "CAMUZZI",
  "identificador_servicio": null,
  "cuenta_egreso_codigo": "EGRESO_SERV_GAS",
  "cuenta_a_pagar_codigo": "PAS_PROV_GAS",
  "moneda": "ARS",
  "enabled": true,
  "prioridad": 0
}
```

Success response (201): body contains created mapping with `_id` and timestamps.

Get candidate mappings for a detected expense (frontend usage)

GET /api/v1/service-account-mappings?provider_agent_id=57f7de5f5c02c36dd2647313&identificador_servicio=9103/0-04-04-0013178/8

Response (200):

```json
[
  {
    "_id": "691f3a96b417b43e270174a9",
    "provider_agent_id": "57f7de5f5c02c36dd2647313",
    "provider_cuit": "30657864427",
    "identificador_servicio": null,
    "cuenta_egreso_codigo": "EGRESO_SERV_GAS",
    "cuenta_a_pagar_codigo": "PAS_PROV_GAS",
    "moneda": "ARS",
    "enabled": true,
    "prioridad": 0
  }
]
```

Checklist para despliegue a staging

- Verificar que endpoints existan y funcionan con tokens/staging accounts.
- Coordinar con backend para datos de prueba en staging: proveedor con CUIT real o staging CUIT y algunas propiedades con `identificador_servicio` conocidas.

Contacto / seguimiento

Si querés, genero el componente React minimal (form + list + typeahead) siguiendo esta guía y lo subo a `docs/` o a `src/example-mappings/` según prefieras (NO contiene seeds ni modifica datos de staging/producción).

---

Fecha: 2025-11-20
