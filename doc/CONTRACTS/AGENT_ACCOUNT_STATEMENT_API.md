# Guía para Frontend: API de Estado de Cuenta del Agente

**Objetivo:** Documentar los endpoints necesarios para construir la vista de estado de cuenta de un agente (locador o locatario), permitiendo consultas por fecha y obteniendo el detalle de la deuda.

---

## Visión General del Flujo

Para construir una vista completa del estado de cuenta de un agente, el frontend debe realizar dos llamadas principales:

1.  **Obtener el Saldo Resumido:** Una llamada rápida para obtener el balance total del agente (cuánto debe o cuánto se le debe).
2.  **Obtener el Detalle de Movimientos:** Una segunda llamada para obtener la lista paginada de todos los asientos contables que componen ese saldo.

---

## 1. Obtener el Saldo Resumido

Este endpoint provee el balance consolidado del agente. Es ideal para mostrar en un encabezado o tarjeta de resumen.

- **Endpoint:** `GET /api/v1/accounting-entries/estado-cuenta/:agentId`
- **Descripción:** Calcula el saldo neto de un agente a una fecha de corte. Suma todas sus deudas y resta todos sus créditos.
- **Parámetros de URL:**
    - `agentId`: (Requerido) El ID del agente a consultar.
- **Parámetros de Query:**
    - `fecha_corte`: (Opcional) Fecha en formato `YYYY-MM-DD`. Si no se especifica, se usa la fecha actual.

#### Ejemplo de Uso

Para obtener el saldo de un agente a la fecha de hoy:

```http
GET /api/v1/accounting-entries/estado-cuenta/ff94422a4f362edab22860ba
Authorization: Bearer <token>
```

#### Respuesta

```json
{
  "saldo": 150000,
  "fecha_corte": "2025-10-18T12:00:00.000Z"
}
```

- **Saldo positivo:** El agente debe dinero.
- **Saldo negativo:** El agente tiene crédito a su favor.

---

## 2. Obtener el Detalle de la Deuda (Movimientos)

Este es el endpoint principal para listar los asientos que componen el estado de cuenta. Es potente y permite múltiples filtros.

- **Endpoint:** `GET /api/v1/accounting-entries/search`
- **Descripción:** Devuelve una lista paginada de asientos contables con filtros avanzados.

#### Parámetros de Query Clave para esta Vista

| Parámetro         | Tipo    | Descripción                                                                                             |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `agente_id`       | `string`  | **(Requerido)** Filtra los asientos donde el agente participa.                                          |
| `fecha_hasta`     | `string`  | (Opcional) Muestra asientos con fecha de vencimiento hasta esta fecha (`YYYY-MM-DD`).                   |
| `fecha_desde`     | `string`  | (Opcional) Muestra asientos con fecha de vencimiento desde esta fecha (`YYYY-MM-DD`).                   |
| `solo_pendientes` | `boolean` | (Opcional) Si es `true`, filtra automáticamente por `estado` PENDIENTE, PAGADO_PARCIAL o PENDIENTE_AJUSTE. |
| `page`            | `number`  | (Opcional) Para la paginación. Default: `1`.                                                            |
| `limit`           | `number`  | (Opcional) Cantidad de resultados por página. Default: `20`.                                            |
| `sort`            | `string`  | (Opcional) Campo de ordenamiento. Default: `-fecha_vencimiento` (los más recientes primero).            |

#### Ejemplo de Uso

**Objetivo:** Obtener el detalle de la deuda de un agente a la fecha de hoy.

```http
GET /api/v1/accounting-entries/search?agente_id=ff94422a4f362edab22860ba&fecha_hasta=2025-10-18&solo_pendientes=true
Authorization: Bearer <token>
```

Esta consulta devolverá todos los asientos pendientes de pago para el agente, vencidos a la fecha de hoy.

#### Estructura de la Respuesta

La respuesta de este endpoint es rica e incluye los datos para la tabla, la paginación y los totales.

```json
{
  "data": [
    // ... array de asientos contables que coinciden con el filtro
  ],
  "total": 5, // Cantidad total de asientos que coinciden (para la paginación)
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "totals": {
    "grandTotalDebe": 850000,
    "grandTotalHaber": 0,
    "breakdownByAccount": [
      {
        "cuenta_nombre": "Cuentas por Cobrar - Alquileres",
        "cuenta_codigo": "CXC_ALQ",
        "totalDebe": 850000,
        "totalHaber": 0
      }
      // ... otros desgloses si aplican
    ]
  }
}
```

---

## 💡 Flujo de Implementación en Frontend

```javascript
// 1. Obtener el ID del agente (desde la URL, estado global, etc.)
const agentId = 'ff94422a4f362edab22860ba';

// 2. Definir los filtros (ej. estado inicial de la vista)
const filters = {
  agente_id: agentId,
  solo_pendientes: true,
  // fecha_hasta: new Date().toISOString().split('T')[0] // Opcional
};

// 3. Construir la URL para la búsqueda
const queryParams = new URLSearchParams(filters);
const searchUrl = `/api/v1/accounting-entries/search?${queryParams}`;

// 4. Realizar las llamadas a la API (pueden ser en paralelo)
async function fetchAccountStatement() {
  try {
    const [balanceResponse, detailsResponse] = await Promise.all([
      fetch(`/api/v1/accounting-entries/estado-cuenta/${agentId}`),
      fetch(searchUrl)
    ]);

    const balanceData = await balanceResponse.json();
    const detailsData = await detailsResponse.json();

    // 5. Usar los datos para renderizar la vista
    renderHeader(balanceData); // Muestra el saldo total: -1,700,000 ARS
    renderTable(detailsData.data); // Muestra la lista de asientos
    renderTotals(detailsData.totals); // Muestra los totales y el desglose
    renderPagination(detailsData.total, detailsData.page, detailsData.limit);

  } catch (error) {
    console.error("Error fetching account statement:", error);
  }
}

// 6. Manejar cambios en los filtros
function onDateChange(newDate) {
  // Actualizar el filtro `fecha_hasta`
  filters.fecha_hasta = newDate;
  // Volver a llamar a fetchAccountStatement()
}
```

---

Para una descripción exhaustiva de todos los endpoints y parámetros disponibles, consulta el documento principal: **[ACCOUNTING_ENTRIES_API.md](./ACCOUNTING_ENTRIES_API.md)**.
