# Service → Account Mapping (especificación para Frontend)

Este documento explica en detalle el propósito, alcance y uso de los "ServiceAccountMappings" (mapping proveedor → códigos de cuentas contables). Está pensado para que el equipo frontend implemente pantallas de creación/edición y para que el operador entienda cuándo debe elegir o crear un mapping.

Resumen rápido

- Un mapping relaciona un proveedor (provider_agent_id / provider_cuit) y opcionalmente un identificador de servicio (por ejemplo un número de medidor o tipo de servicio) con códigos del Chart of Accounts.
- Campos clave del mapping:
  - `provider_agent_id` (obligatorio preferente): id del agente proveedor en el sistema.
  - `provider_cuit` (opcional): CUIT del proveedor, ayuda en coincidencias.
  - `identificador_servicio` (opcional): por ejemplo un número de medidor o un string que distingue el servicio (p. ej. `medidor_12345` o `GAS`).
  - `cuenta_egreso_codigo` (obligatorio): código en el Chart of Accounts que se utilizará para la(s) partidas DEBE (origen en la propiedad)
  - `cuenta_a_pagar_codigo` (obligatorio): código que representa la cuenta por pagar al proveedor (HABER)
  - `moneda` (opcional): moneda del mapping si aplica
  - `enabled` (boolean, opcional): si está activo (default true)
  - `prioridad` (número, opcional): orden cuando hay múltiples mappings candidatos (mayor prioridad -> menor número)

Por qué existen mappings

- Un mismo proveedor puede facturar diferentes tipos de servicios que deben ir a cuentas distintas (ej. honorarios vs servicios públicos).
- Algunos proveedores facturan por distintas entidades/monedas o con distintos CUITs.
- Algunos detectores (scrapers) no siempre identifican correctamente el tipo de servicio; el mapping permite la intervención humana o reglas más finas.

Comportamiento esperado del backend (resumen)

- Cuando el backend procesa una factura detectada (`processDetectedExpenseToEntry`), resuelve un mapping en este orden aproximado:
  1. Si `mappingId` fue provisto por la llamada, usar ese mapping.
  2. Buscar mappings por `provider_agent_id` + `identificador_servicio` (si `identificador_servicio` está presente en el DetectedExpense).
  3. Si no hay coincidencia por `identificador_servicio`, buscar mappings por `provider_agent_id` solamente.
  4. Si hay múltiples mappings candidatos, seleccionar por `prioridad` (campo numérico) o devolver todos para que el frontend pida una elección.

Qué representa cada campo y cómo usarlo en UI

- `provider_agent_id`: mostrar el nombre del proveedor en el modal y rellenar este campo automáticamente si la factura viene con proveedor identificado.
- `provider_cuit`: autocompletar si el usuario lo provee o si la factura trae CUIT; usarlo para ayudar a distinguir proveedores con nombres similares.
- `identificador_servicio`: IMPORTANTÍSIMO para proveedores que emiten facturas por tipo de servicio (p. ej. electricidad vs gas). Si está presente, el mapping será específico para ese servicio.
- `cuenta_egreso_codigo` y `cuenta_a_pagar_codigo`: estos son códigos humanos del Chart of Accounts (p. ej. `CXP_LOC`, `EG`); el backend los convertirá a ObjectId con `ChartOfAccountsService.getAccountIdsByCode`. En la UI, resuelve y muestra `codigo` y `nombre` de la cuenta (llamar `GET /api/v1/chart-of-accounts/:id` o usar endpoint de búsqueda).
- `prioridad`: si hay más de un mapping para el mismo provider+service, el sistema usa prioridad para decidir el candidato por defecto. Mostrar la prioridad en la lista y ordenar.

Casos de uso y ejemplos

1. Proveedor único por servicio (ej. Camuzzi — GAS)

- Descripción: Camuzzi factura gas; cada factura claramente corresponde a GAS.
- Mapping recomendado: un mapping por provider_agent_id y `identificador_servicio: 'GAS'` o vacío si todas las facturas del provider deben mapearse igual.
- Ejemplo de mapping:

```json
{
  "provider_agent_id": "camuzzi_01",
  "provider_cuit": "30-12345678-9",
  "identificador_servicio": "GAS",
  "cuenta_egreso_codigo": "EG_GAS",
  "cuenta_a_pagar_codigo": "CXP_PROV",
  "moneda": "ARS",
  "enabled": true,
  "prioridad": 10
}
```

2. Proveedor con boleta única (agua + energía + alumbrado) — no discriminado

- Descripción: el proveedor emite una boleta única que agrupa varios servicios sin desglose. En este caso la factura es de un único proveedor y no tenemos partidas separadas por servicio.
- Mapping recomendado: usar un mapping general `cuenta_egreso_codigo` que represente el gasto agregado (p.ej. `EG_SERV_PUBLICOS`) y la `cuenta_a_pagar_codigo` al proveedor.
- Alternativa avanzada: si luego quieres distribuir el gasto entre subcuentas, necesitarás un proceso de imputación posterior que divida el asiento.
- Ejemplo de mapping:

```json
{
  "provider_agent_id": "agua_unica_01",
  "provider_cuit": "30-87654321-0",
  "identificador_servicio": null,
  "cuenta_egreso_codigo": "EG_SERV_PUBLICOS",
  "cuenta_a_pagar_codigo": "CXP_PROV",
  "moneda": "ARS",
  "enabled": true,
  "prioridad": 20
}
```

Qué significa esto en la práctica UI/operador

- Para Camuzzi: el sistema encuentra el mapping por provider+service y automáticamente selecciona la cuenta `EG_GAS` como origen DEBE. El operador no necesita elegir nada salvo que quiera usar un mapping distinto.
- Para la boleta única: el sistema puede auto-seleccionar `EG_SERV_PUBLICOS`, pero es recomendable mostrar al operador la cuenta propuesta porque la imputación es agregada y quizá quieran revisar o asignar manualmente.

Creación/edición de mappings desde el Frontend

- Endpoint existente (controller): `POST /api/v1/service-account-mappings` (crear), `GET /api/v1/service-account-mappings` (listar), `GET /api/v1/service-account-mappings/:id` (detalle), `PATCH /api/v1/service-account-mappings/:id` (editar), `DELETE /api/v1/service-account-mappings/:id`.
- DTO (campos aceptados):
  - `provider_agent_id` (string)
  - `provider_cuit` (string)
  - `identificador_servicio` (string)
  - `cuenta_egreso_codigo` (string)
  - `cuenta_a_pagar_codigo` (string)
  - `moneda` (string)
  - `enabled` (boolean)
  - `prioridad` (number)
  - `created_by` (string)

Ejemplo cURL para crear mapping

```bash
curl -i -X POST "https://<HOST>/api/v1/service-account-mappings" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_agent_id": "camuzzi_01",
    "provider_cuit": "30-12345678-9",
    "identificador_servicio": "GAS",
    "cuenta_egreso_codigo": "EG_GAS",
    "cuenta_a_pagar_codigo": "CXP_PROV",
    "moneda": "ARS",
    "enabled": true,
    "prioridad": 10
  }'
```

Validaciones y recomendaciones programáticas

- Validar que `cuenta_egreso_codigo` y `cuenta_a_pagar_codigo` existan en el Chart of Accounts y que sean imputables (`es_imputable: true`). Mostrar error y sugerir cuentas alternativas si fallan.
- Requerir `provider_agent_id` o `provider_cuit` para no crear mappings huérfanos.
- Al crear mapping desde UI, mostrar al usuario las cuentas resueltas (nombre + código) para confirmar.
- Limitar creación/edición de mappings a roles administrativos o contabilidad (auditoría).

UX: cuándo mostrar selector vs no mostrar

- Si backend devuelve 1 mapping candidato activo -> no mostrar selector (mostrar en read-only y permitir botón "Cambiar mapping" si se desea override).
- Si backend devuelve 0 mappings o >1 mapping candidato -> mostrar selector con motivo y recomendaciones (highlight del mapping con mayor prioridad).

Auditoría y logs

- Registrar en el asiento (o en un log asociado) si el mapping fue: `auto-resuelto` o `override_por_usuario: <userId>`.
- Guardar `created_by` y `updated_by` en el mapping para trazabilidad.

Notas finales y recomendaciones

- Para proveedores single-service (Camuzzi/Gas) — mappings simples y auto-resolución.
- Para proveedores multi-service no discriminados — usar mapping agregado y mostrar advertencia al operador; si se requiere reparto posterior, diseñar un proceso de split.
- Evitar crear mappings genéricos sin `provider_agent_id` salvo cuando sean usados como fallback global (por ejemplo mapping por código de servicio únicamente).

¿Quieres que:

- (A) añada una sección corta en la UI con un formulario React/TSX para crear mappings (autocompletar cuentas y validar), o
- (B) agregue ejemplos adicionales (Camuzzi + boleta única) dentro del doc para que el equipo contable los copie?
