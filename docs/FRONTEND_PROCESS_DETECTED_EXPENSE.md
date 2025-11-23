# Procesar factura detectada — guía operativa y técnica

Este documento unifica todo lo necesario para que el frontend (y QA) implemente el flujo completo: desde la sincronización de comunicaciones (sync) hasta la creación del asiento contable y el marcado de la factura como procesada.

Objetivo único: convertir una `DetectedExpense` en un `AccountingEntry` PENDIENTE, resolviendo automáticamente el mapping proveedor→cuentas (por proveedor + identificador_servicio) y aplicando fallback a locador cuando el agente propuesto es locatario sin contrato vigente.

Resumen rápido del flujo (one-liner):

- El usuario desencadena sync → se listan facturas → pulsa PROCESAR en una fila → se abre modal con preview y propiedades → el frontend invoca el endpoint de procesado → el backend crea el asiento y marca la factura como procesada.

## Flujo completo paso a paso (detallado)

1. Iniciar sincronización (generar comunicaciones detectadas)

- Endpoint: `POST /api/v1/service-sync/rescan`
  - Query params útiles: `providerCuit`, `autoDuring=true`, `autoBatch=true`, `maxCandidates`.
  - Input: ninguno en body.
  - Output (ejemplo): `{ message: 'Escaneo completado', totalFound: 42, candidates?: [...] }`.
  - Qué hace: el backend escanea (IMAP/servicios), parsea emails y genera/actualiza registros `ServiceCommunication` (las "facturas detectadas").

2. Listar facturas detectadas

- Endpoint: `GET /api/v1/service-sync`
  - Query: filtros por proveedor, estado_procesamiento, fecha, paginado.
  - Output: listado paginado de comunicaciones con campos: `_id`, `identificador_servicio`, `agente_proveedor_id`, `fecha_deteccion`, `monto_estimado`, `estado_procesamiento`, `propuesta_asiento` (si existe), `meta`.
  - UI: mostrar tabla con columnas relevantes y botón `PROCESAR` por fila cuando `estado_procesamiento` sea procesable.

3. Abrir modal de procesado (al pulsar `PROCESAR`)

- Pre-cargas necesarias:
  - `GET /api/v1/service-sync/:id` → devuelve la comunicación completa (incluye `propuesta_asiento`).
  - `GET /api/v1/properties/by-medidor/:identificador_servicio` → propiedades relacionadas (propietarios, contratos vigentes).
  - Opcional (prefetch candidatos): `GET /api/v1/service-account-mappings?provider_agent_id=<id>&identificador_servicio=<id>`.
- Mostrar en modal:
  - Datos de la factura: proveedor, remitente, identificador_servicio, monto, fecha.
  - Preview de `propuesta_asiento`: partidas propuestas (descripcion, monto, agente_propuesto).
  - Propiedades asociadas: `propietarios_ids`, `contrato_vigente_id` (para explicar fallback posible).
  - Mapping detectado (si el backend ya resolvió uno único): mostrar `nombre`, `cuenta_egreso_codigo`, `cuenta_a_pagar_codigo` en modo read-only.

4. Procesar la factura (botón `PROCESAR`)

- Endpoint: `POST /api/v1/accounting-entries/process-detected-expense`
  - Body mínimo: `{ "detectedExpenseId": "<id>" }`
  - Override manual (excepcional): `{ "detectedExpenseId": "<id>", "mappingId": "<mappingId>" }`
- Qué hace el backend (resumen):
  - Si `mappingId` se envía, usa `serviceAccountMappingsService.findOne(mappingId)`.
  - Si no, busca mapping activo por `provider_agent_id` + `identificador_servicio` (y si no, por `provider_agent_id` genérico).
  - Traduce `cuenta_*_codigo` a `cuenta_id` con `ChartOfAccountsService.getAccountIdsByCode`.
  - Para cada `partida_propuesta` aplica fallback de agente: si agente_propuesto es locatario y no figura en ningún contrato vigente asociado a la propiedad, el backend usa el primer `propietarios_ids[0]` (locador).
  - Crea el `AccountingEntry` con partidas DEBE por propiedad y una partida HABER al proveedor.
  - Actualiza el `DetectedExpense`/`ServiceCommunication` con: `estado_procesamiento: 'ASIGNADO'`, `asiento_creado_id`, `estado_final: 'PROCESADO'`.
  - Devuelve el `AccountingEntry` creado.

5. Post-procesado en frontend

- Mostrar el resultado y enlace al asiento: `/accounting-entries/:id`.
- En modal/result view mostrar, por partida, `agente_propuesto` vs `agente_asignado` y resaltar si hubo fallback.
- Si hubo error de mapping (404), ofrecer CTA para crear mapping o pedir a soporte.

## Endpoints (entrada/salida) — especificaciones concretas

- POST /api/v1/service-sync/rescan
  - Query: `providerCuit?`, `autoDuring?`, `autoBatch?`, `maxCandidates?`
  - Response: 200 OK with `{ message: string, totalFound?: number, candidates?: any[] }`

- GET /api/v1/service-sync
  - Query: filtros (page, limit, providerAgentId, estado_procesamiento, from, to)
  - Response: `{ items: ServiceCommunication[], total: number, page, limit }` where `ServiceCommunication` contains at least `_id`, `identificador_servicio`, `agente_proveedor_id`, `fecha_deteccion`, `monto_estimado`, `estado_procesamiento`, `propuesta_asiento`.

- GET /api/v1/service-sync/:id
  - Path: `id` (24 hex chars)
  - Response: full `ServiceCommunication` object

- GET /api/v1/properties/by-medidor/:identificador_servicio
  - Path: identificador_servicio
  - Response: `Property[]` with `propietarios_ids`, `contrato_vigente_id`, `identificador_interno`, etc.

- GET /api/v1/service-account-mappings?provider_agent_id=<id>&identificador_servicio=<id>
  - Response: `ServiceAccountMapping[]` (each: `_id`, `nombre`, `cuenta_egreso_codigo`, `cuenta_a_pagar_codigo`, `identificador_servicio`, `activo`)

- POST /api/v1/accounting-entries/process-detected-expense
  - Body: `{ detectedExpenseId: string, mappingId?: string }`
  - Success Response: 200 with `{ accountingEntry, detectedExpense }` where `accountingEntry` is the created asiento and `detectedExpense` is the updated ServiceCommunication/DetectedExpense.
  - Error cases:
    - 404 DetectedExpense not found
    - 404 Mapping not found (when auto-resolve fails and no mappingId provided)
    - 400 Mapping missing account codes
    - 500 internal errors

## Ejemplo de request/response

Request:

```json
{ "detectedExpenseId": "64a1f1f77bcf86cd799439011" }
```

Response (simplificado):

```json
{
  "accountingEntry": {
    "_id": "691c7c83415add06e1d0ebef",
    "tipo_asiento": "Gasto Servicio",
    "monto_original": 100.0,
    "partidas": [
      {
        "cuenta_id": "64d1a1...",
        "debe": 100.0,
        "haber": 0,
        "agente_id": "507f1f..."
      },
      {
        "cuenta_id": "64d1b2...",
        "debe": 0,
        "haber": 100.0,
        "agente_id": "prov1"
      }
    ],
    "estado": "PENDIENTE"
  },
  "detectedExpense": {
    "_id": "64a1f1f77bcf86cd799439011",
    "estado_procesamiento": "ASIGNADO",
    "asiento_creado_id": "691c7c83415add06e1d0ebef",
    "estado_final": "PROCESADO",
    "identificador_servicio": "12345",
    "propuesta_asiento": {
      /* ... */
    }
  }
}
```

## Estados y transiciones (rápida referencia)

- `ServiceCommunication.estado_procesamiento`: valores relevantes
  - `PENDIENTE_VALIDACION` / `PENDIENTE` → candidato a procesar (frontend muestra botón PROCESAR)
  - `ASIGNADO` → ya se creó un `AccountingEntry` (asiento_creado_id presente)
  - `PROCESADO` / `ESTADO_FINAL` → procesamiento finalizado (según políticas internas)

- `AccountingEntry.estado`: típicamente `PENDIENTE` al crear (según implementación actual)

## Recomendaciones UI (minimizar fricción)

- No pedir mapping al operador si el backend resuelve uno único.
- Mostrar selector solo si hay >1 mapping candidato o ninguno.
- Mostrar claramente `agente_propuesto` vs `agente_asignado` después de procesar para auditoría.
- Proveer CTA que lleve a la pantalla de configuración de mappings si ocurre 404 mapping.

## ¿Se necesita cambiar algo en el backend para que esto funcione?

Actualización importante: el backend se actualizó para corregir varios puntos que afectan directamente al frontend. A continuación se listan los cambios relevantes y cómo aprovecharlos desde la UI.

Cambios recientes y comportamiento esperado

- Persistencia de CUIT del proveedor: cuando la comunicación entrante incluye `proveedor_cuit`, el backend lo persiste en `DetectedExpense.provider_cuit`. Esto permite resolver mappings por CUIT si no existe `agente_proveedor_id`.
- Propuesta automática (best-effort): tras crear un `DetectedExpense` el backend intenta generar una `propuesta_asiento` (llamando internamente a `processDetectedUtilityInvoices`). La propuesta ahora se guarda en `DetectedExpense.propuesta_asiento` si se genera correctamente.
- Resolución de mappings mejorada: la búsqueda de mapping por proveedor intentará, en orden, `provider_agent_id` + `identificador_servicio` → `provider_agent_id` genérico → `provider_cuit` + `identificador_servicio` → `provider_cuit` genérico. Si el frontend no provee `mappingId`, el backend aplica esa lógica automáticamente.
- Fallback de origen (locatario → locador): al crear las partidas del asiento definitivo, si la partida propone al locatario pero no existe un contrato vigente que lo vincule a la propiedad, el backend usa el primer `propietarios_ids[0]` (locador) como agente final.
- Respuesta unificada: el endpoint `POST /api/v1/accounting-entries/process-detected-expense` devuelve ahora `{ accountingEntry, detectedExpense }` (el `detectedExpense` es el documento actualizado e incluye `asiento_creado_id`, `estado_final`, y `propuesta_asiento` cuando corresponda).

Impacto para el frontend

- No es obligatorio enviar nuevos campos para el caso básico; sin embargo, mostrar `provider_cuit` en la UI mejora la trazabilidad cuando `agente_proveedor_id` está ausente.
- La UI puede leer `propuesta_asiento` directamente desde el `DetectedExpense` (si existe) para renderizar el preview antes de procesar.
- En caso de error 404 (mapping no encontrado), el frontend debe ofrecer al operador la opción de crear o seleccionar un mapping, o permitir introducir `mappingId` opcional en la llamada a `process-detected-expense`.

Entorno de staging / producción (lectura importante para frontend y QA)

Este documento describe el flujo esperado contra entornos reales (staging/producción). Evitamos en la guía pública indicar pasos que dependan de scripts de seed local — eso confunde a QA y al frontend cuando trabajan con datos reales.

Guía práctica para trabajar con datos reales:

- Asumir que `ServiceCommunication` y `DetectedExpense` provienen del sistema de ingestión real o de un entorno de staging administrado.
- Antes de mostrar la acción `PROCESAR`, verifica el estado y campos del `DetectedExpense` (por ejemplo `estado_procesamiento`, `propuesta_asiento`, `provider_cuit`, `agente_proveedor_id`).
- Si `propuesta_asiento` no existe, el backend puede intentar generarla; en ese caso la UI debe mostrar al operador que la propuesta está siendo generada o pedir confirmación para reintentar.
- En caso de error 404 (mapping no encontrado), mostrar una CTA clara: "Configurar mapping" o "Pedir configuración al soporte". No intentes inferir ni crear cuentas en la UI.
- Para pruebas en staging, solicitá al equipo backend que habilite datos de prueba en el entorno de staging (el equipo backend puede inyectar una comunicación de prueba o habilitar un detectedExpense específico). No usar scripts locales en entornos compartidos.

Si necesitás ayuda para coordinar datos de prueba en staging o para generar un ejemplo de componente React que consuma `propuesta_asiento` y llame a `process-detected-expense`, lo preparo y lo entrego contra el entorno de staging en lugar de usar seeds locales.

---

Si querés, ahora puedo:

- Añadir un pequeño checklist de QA listo para copiar y pegar en un ticket.
- Generar el componente React minimal que implementa exactamente este flujo.
- Ajustar el controller para devolver tanto el `AccountingEntry` como el `DetectedExpense` actualizado en una sola respuesta.

Elige lo que querés que haga a continuación y lo implemento.
