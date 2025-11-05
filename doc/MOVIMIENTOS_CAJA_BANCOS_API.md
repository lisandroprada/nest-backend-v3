# API de Movimientos de Caja y Bancos

## Endpoint: Movimientos de Cuentas Financieras

**Propósito:** Obtener el listado de movimientos (transacciones) de caja y bancos entre un rango de fechas con paginación y filtros.

**Caso de uso principal:** Ver todos los ingresos y egresos de efectivo del día, semana o mes para control de caja diario.

### Request

```http
GET /api/v1/financial-accounts/movements
Authorization: Bearer <token>
```

### Query Parameters

Todos los parámetros son **opcionales**:

| Parámetro              | Tipo     | Descripción                                          | Ejemplo                    |
| ---------------------- | -------- | ---------------------------------------------------- | -------------------------- |
| `cuenta_financiera_id` | MongoId  | Filtrar por cuenta específica                        | `507f1f77bcf86cd799439011` |
| `fecha_desde`          | ISO Date | Fecha inicial del rango                              | `2025-11-01`               |
| `fecha_hasta`          | ISO Date | Fecha final del rango (incluye todo el día)          | `2025-11-30`               |
| `tipo`                 | enum     | Tipo de movimiento: `INGRESO` o `EGRESO`             | `INGRESO`                  |
| `conciliado`           | string   | Filtrar por estado de conciliación: `true` o `false` | `false`                    |
| `page`                 | number   | Número de página (0-indexed)                         | `0`                        |
| `pageSize`             | number   | Cantidad de registros por página                     | `10`                       |
| `sort`                 | string   | Campo de ordenamiento                                | `-fecha_transaccion`       |

### Ejemplos de Request

**1. ⭐ Obtener todos los movimientos del día (caso más común):**

```bash
curl -X GET 'http://localhost:3050/api/v1/financial-accounts/movements?fecha_desde=2025-11-05&fecha_hasta=2025-11-05&pageSize=100' \
  -H 'Authorization: Bearer eyJ...'
```

> **Nota:** Para ver movimientos entre un rango de fechas, simplemente cambiá `fecha_desde` y `fecha_hasta`. El endpoint retorna **todas las transacciones** que ocurrieron en ese período.

**2. Obtener solo ingresos de una cuenta específica:**

```bash
curl -X GET 'http://localhost:3050/api/v1/financial-accounts/movements?cuenta_financiera_id=507f...&tipo=INGRESO' \
  -H 'Authorization: Bearer eyJ...'
```

**3. Obtener movimientos no conciliados con paginación:**

```bash
curl -X GET 'http://localhost:3050/api/v1/financial-accounts/movements?conciliado=false&page=0&pageSize=20' \
  -H 'Authorization: Bearer eyJ...'
```

**4. Obtener movimientos de un rango de fechas (ejemplo: mes completo):**

```bash
curl -X GET 'http://localhost:3050/api/v1/financial-accounts/movements?fecha_desde=2025-11-01&fecha_hasta=2025-11-30&pageSize=500&sort=-fecha_transaccion' \
  -H 'Authorization: Bearer eyJ...'
```

**5. Obtener movimientos de los últimos 7 días:**

```bash
curl -X GET 'http://localhost:3050/api/v1/financial-accounts/movements?fecha_desde=2025-10-29&fecha_hasta=2025-11-05&pageSize=100' \
  -H 'Authorization: Bearer eyJ...'
```

### Response

```json
{
  "data": [
    {
      "_id": "690a812dbff411728c9e830b",
      "cuenta_financiera_id": {
        "_id": "507f1f77bcf86cd799439011",
        "nombre": "Caja Principal",
        "tipo": "CAJA_EFECTIVO",
        "moneda": "ARS"
      },
      "fecha_transaccion": "2025-11-05T10:30:00.000Z",
      "monto": 1000000,
      "tipo": "INGRESO",
      "descripcion": "Pago alquiler Enero 2025",
      "referencia_asiento": {
        "_id": "690a812dbff411728c9e830c",
        "concepto": "Alquiler Enero",
        "monto_original": 1000000
      },
      "usuario_creacion_id": {
        "_id": "690a2e7a7d1c2a35a077 34a5",
        "username": "admin",
        "email": "admin@example.com"
      },
      "conciliado": false,
      "receipt_id": null,
      "referencia_bancaria": null,
      "createdAt": "2025-11-05T10:30:00.000Z",
      "updatedAt": "2025-11-05T10:30:00.000Z"
    },
    {
      "_id": "690a812dbff411728c9e830d",
      "cuenta_financiera_id": {
        "_id": "507f1f77bcf86cd799439011",
        "nombre": "Caja Principal",
        "tipo": "CAJA_EFECTIVO",
        "moneda": "ARS"
      },
      "fecha_transaccion": "2025-11-05T14:00:00.000Z",
      "monto": 920000,
      "tipo": "EGRESO",
      "descripcion": "Liquidación a locador",
      "referencia_asiento": {
        "_id": "690a812dbff411728c9e830c",
        "concepto": "Alquiler Enero",
        "monto_original": 1000000
      },
      "usuario_creacion_id": {
        "_id": "690a2e7a7d1c2a35a07734a5",
        "username": "admin",
        "email": "admin@example.com"
      },
      "conciliado": false,
      "receipt_id": null,
      "referencia_bancaria": null,
      "createdAt": "2025-11-05T14:00:00.000Z",
      "updatedAt": "2025-11-05T14:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 0,
    "pageSize": 10,
    "totalPages": 5
  },
  "resumen": {
    "total_ingresos": 5000000,
    "total_egresos": 3500000,
    "flujo_neto": 1500000,
    "cantidad_ingresos": 25,
    "cantidad_egresos": 17
  },
  "filtros_aplicados": {
    "cuenta_financiera_id": null,
    "fecha_desde": "2025-11-01",
    "fecha_hasta": "2025-11-30",
    "tipo": null,
    "conciliado": null
  }
}
```

### Campos de la Respuesta

**`data[]`**: Array de transacciones

| Campo                  | Tipo     | Descripción                                           |
| ---------------------- | -------- | ----------------------------------------------------- |
| `_id`                  | MongoId  | ID de la transacción                                  |
| `cuenta_financiera_id` | Object   | Cuenta financiera (populada con nombre, tipo, moneda) |
| `fecha_transaccion`    | ISO Date | Fecha y hora de la transacción                        |
| `monto`                | number   | Monto de la transacción                               |
| `tipo`                 | string   | `INGRESO` o `EGRESO`                                  |
| `descripcion`          | string   | Descripción del movimiento                            |
| `referencia_asiento`   | Object   | Asiento contable relacionado (si existe)              |
| `usuario_creacion_id`  | Object   | Usuario que creó la transacción                       |
| `conciliado`           | boolean  | Si está conciliado con extracto bancario              |
| `receipt_id`           | MongoId  | ID del recibo (si existe)                             |
| `referencia_bancaria`  | string   | Referencia del banco (si aplica)                      |
| `createdAt`            | ISO Date | Fecha de creación del registro                        |
| `updatedAt`            | ISO Date | Fecha de última actualización                         |

**`pagination`**: Información de paginación

| Campo        | Tipo   | Descripción                              |
| ------------ | ------ | ---------------------------------------- |
| `total`      | number | Total de registros que cumplen el filtro |
| `page`       | number | Página actual (0-indexed)                |
| `pageSize`   | number | Registros por página                     |
| `totalPages` | number | Total de páginas                         |

**`resumen`**: Totales del período filtrado

| Campo               | Tipo   | Descripción                       |
| ------------------- | ------ | --------------------------------- |
| `total_ingresos`    | number | Suma de todos los INGRESOS        |
| `total_egresos`     | number | Suma de todos los EGRESOS         |
| `flujo_neto`        | number | Diferencia (ingresos - egresos)   |
| `cantidad_ingresos` | number | Cantidad de transacciones INGRESO |
| `cantidad_egresos`  | number | Cantidad de transacciones EGRESO  |

**`filtros_aplicados`**: Muestra los filtros que se aplicaron en la consulta

---

## Casos de Uso

### 1. Reporte de Caja Diario

**Frontend necesita:** Tabla con todos los movimientos del día actual

```typescript
const hoy = new Date().toISOString().split('T')[0]; // "2025-11-05"

const response = await fetch(
  `/api/v1/financial-accounts/movements?fecha_desde=${hoy}&fecha_hasta=${hoy}&sort=-fecha_transaccion`,
);

const { data, resumen } = await response.json();

// Mostrar en tabla
data.forEach((mov) => {
  console.log(`${mov.tipo}: $${mov.monto} - ${mov.descripcion}`);
});

// Mostrar totales
console.log(`Ingresos del día: $${resumen.total_ingresos}`);
console.log(`Egresos del día: $${resumen.total_egresos}`);
console.log(`Saldo neto: $${resumen.flujo_neto}`);
```

### 2. Filtrar por Cuenta Específica

**Frontend necesita:** Ver solo movimientos de "Caja Principal"

```typescript
const cuentaId = '507f1f77bcf86cd799439011';

const response = await fetch(
  `/api/v1/financial-accounts/movements?cuenta_financiera_id=${cuentaId}&page=0&pageSize=50`,
);
```

### 3. Movimientos Pendientes de Conciliar

**Frontend necesita:** Lista de transacciones sin conciliar para control bancario

```typescript
const response = await fetch(
  `/api/v1/financial-accounts/movements?conciliado=false&tipo=INGRESO&sort=-fecha_transaccion`,
);

const { data } = await response.json();

// Mostrar solo los no conciliados
data.forEach((mov) => {
  console.log(`Pendiente: $${mov.monto} - ${mov.fecha_transaccion}`);
});
```

### 4. Paginación en Tabla

**Frontend necesita:** Tabla paginada con 20 registros por página

```typescript
const [page, setPage] = useState(0);
const pageSize = 20;

const fetchMovements = async () => {
  const response = await fetch(
    `/api/v1/financial-accounts/movements?page=${page}&pageSize=${pageSize}&fecha_desde=2025-11-01&fecha_hasta=2025-11-30`,
  );

  const { data, pagination } = await response.json();

  // Actualizar tabla
  setMovements(data);
  setTotalPages(pagination.totalPages);
};

// Cambiar página
const nextPage = () => setPage(page + 1);
const prevPage = () => setPage(page - 1);
```

---

## Diferencia con `/financial-reports/cash-flow`

| Característica        | `/movements`                 | `/cash-flow`                  |
| --------------------- | ---------------------------- | ----------------------------- |
| **Propósito**         | Operaciones diarias          | Reportes financieros          |
| **Datos**             | Transacciones reales         | Análisis contable consolidado |
| **Paginación**        | ✅ Sí                        | ❌ No                         |
| **Filtro por cuenta** | ✅ Sí                        | ❌ No (todas las cuentas)     |
| **Saldos**            | ❌ No                        | ✅ Sí (inicial/final)         |
| **Detalle**           | Registro por registro        | Agregado por tipo             |
| **Uso típico**        | Tabla de movimientos diarios | Reporte mensual/anual         |

---

## Notas Importantes

1. **⭐ Filtro por rango de fechas:** Para ver movimientos entre dos fechas, usá `fecha_desde` y `fecha_hasta`. Por ejemplo:
   - Movimientos del día: `fecha_desde=2025-11-05&fecha_hasta=2025-11-05`
   - Movimientos de la semana: `fecha_desde=2025-10-29&fecha_hasta=2025-11-05`
   - Movimientos del mes: `fecha_desde=2025-11-01&fecha_hasta=2025-11-30`

2. **Fecha hasta incluye todo el día**: `fecha_hasta=2025-11-05` incluye movimientos hasta las 23:59:59 del día 5.

3. **Sort por defecto**: `-fecha_transaccion` (más recientes primero). Prefijo `-` para descendente.

4. **Populate automático**: Los campos `cuenta_financiera_id`, `referencia_asiento` y `usuario_creacion_id` vienen populados.

5. **Resumen siempre presente**: Aunque no haya datos, el resumen retorna valores en 0.

6. **Performance**: Para rangos muy grandes, considerar aumentar el `pageSize` o usar filtros adicionales.

7. **⚠️ Importante:** Las transacciones se crean automáticamente cuando usás el endpoint `/process-receipt`. Si hiciste pagos/liquidaciones con métodos antiguos, no aparecerán aquí.
