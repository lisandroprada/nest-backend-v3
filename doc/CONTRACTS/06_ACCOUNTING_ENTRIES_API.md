# API de Consultas - Asientos Contables

> **Fecha:** 14 de octubre de 2025  
> **Estado:** ✅ IMPLEMENTADO  
> **Versión:** 1.1.0

---

## 📋 Tabla de Contenidos

- [Endpoints Implementados](#endpoints-implementados)
- [Filtros y Búsquedas](#filtros-y-búsquedas)
- [Estado de Cuenta](#estado-de-cuenta)
- [Resumen Global](#resumen-global)
- [Ejemplos de Uso](#ejemplos-de-uso)

---

## 🚀 Endpoints Implementados

### Base URL

```
http://localhost:3000/api/v1/accounting-entries
```

### Autenticación

Todos los endpoints requieren autenticación JWT y rol de usuario:

- `admin`
- `superUser`
- `contabilidad`

**Header requerido:**

```
Authorization: Bearer <token>
```

---

## 1️⃣ Búsqueda con Filtros Avanzados

### `GET /accounting-entries/search`

Busca asientos contables con múltiples filtros y paginación.

#### Query Parameters

| Parámetro         | Tipo    | Requerido | Descripción                                           | Ejemplo                    |
| ----------------- | ------- | --------- | ----------------------------------------------------- | -------------------------- |
| `contrato_id`     | string  | No        | ID del contrato                                       | `68ed72f084229ed30655d6ea` |
| `agente_id`       | string  | No        | ID del agente (propietario/inquilino)                 | `507f1f77bcf86cd799439011` |
| `tipo_asiento`    | string  | No        | Tipo de asiento                                       | `Alquiler`, `Apertura`     |
| `estado`          | string  | No        | Estado del asiento                                    | `PENDIENTE`, `PAGADO`      |
| `fecha_desde`     | string  | No        | Fecha desde (ISO 8601)                                | `2025-01-01`               |
| `fecha_hasta`     | string  | No        | Fecha hasta (ISO 8601)                                | `2025-12-31`               |
| `solo_pendientes` | boolean | No        | Solo asientos pendientes o pagados parcialmente       | `true`                     |
| `page`            | number  | No        | Número de página (default: 1)                         | `1`                        |
| `limit`           | number  | No        | Resultados por página (default: 20, max: 100)         | `20`                       |
| `sort`            | string  | No        | Campo de ordenamiento (default: `-fecha_vencimiento`) | `-monto_original`          |

#### Estados Válidos

- `PENDIENTE`
- `PAGADO`
- `PAGADO_PARCIAL`
- `ANULADO`
- `CONDONADO`
- `PENDIENTE_APROBACION`
- `LIQUIDADO`
- `ANULADO_POR_RESCISION`
- `PENDIENTE_FACTURAR`
- `FACTURADO`

#### Tipos de Asiento Comunes

- `Apertura`
- `Alquiler`
- `Deposito`
- `Expensa`
- `Interes`
- `Ajuste`

#### Ordenamiento

Prefijo `-` para orden descendente:

- `fecha_vencimiento` (ascendente)
- `-fecha_vencimiento` (descendente)
- `monto_original`
- `-monto_original`
- `tipo_asiento`
- `estado`

#### Response

```json
{
  "data": [
    {
      "_id": "670c9f6e5f2e...",
      "contrato_id": {
        "_id": "68ed72f084...",
        "codigo": "ALQ-2024-001",
        "propiedad_id": "...",
        "fecha_inicio": "2024-01-01",
        "fecha_final": "2025-12-31"
      },
      "fecha_vencimiento": "2025-07-10T00:00:00.000Z",
      "descripcion": "Alquiler 07/2025",
      "tipo_asiento": "Alquiler",
      "estado": "PENDIENTE",
      "monto_original": 500000,
      "monto_actual": 500000,
      "partidas": [
        {
          "cuenta_id": {
            "_id": "...",
            "codigo": "CXC_ALQ",
            "nombre": "Cuentas por Cobrar - Alquiler"
          },
          "descripcion": "Alquiler inquilino",
          "debe": 500000,
          "haber": 0,
          "agente_id": {
            "_id": "...",
            "nombre": "Juan",
            "apellido": "Pérez",
            "tipo_agente": "INQUILINO"
          },
          "monto_pagado_acumulado": 0
        },
        {
          "cuenta_id": {
            "_id": "...",
            "codigo": "CXP_LOC",
            "nombre": "Cuentas por Pagar - Locador"
          },
          "descripcion": "Pago propietario",
          "debe": 0,
          "haber": 465000,
          "agente_id": {
            "_id": "...",
            "nombre": "María",
            "apellido": "González",
            "tipo_agente": "PROPIETARIO"
          }
        },
        {
          "cuenta_id": {
            "_id": "...",
            "codigo": "ING_HNR",
            "nombre": "Ingresos - Honorarios"
          },
          "descripcion": "Comisión inmobiliaria",
          "debe": 0,
          "haber": 35000
        }
      ],
      "createdAt": "2025-10-14T01:33:46.123Z",
      "updatedAt": "2025-10-14T01:33:46.123Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3556,
    "totalPages": 178,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## 2️⃣ Registro de Pagos (Unificado)

### `POST /accounting-entries/:id/register-payment`

Registra un pago (total o parcial) para un asiento contable. El backend determina automáticamente si el pago salda la deuda o si es parcial.

#### Parámetros de Ruta

| Parámetro | Tipo   | Requerido | Descripción                |
| --------- | ------ | --------- | -------------------------- |
| `id`      | string | Sí        | ID del asiento a pagar     |

#### Request Body

```json
{
  "fecha_pago": "2025-11-08",
  "monto_pagado": 40000,
  "metodo_pago": "transferencia",
  "comprobante": "TR-5849302",
  "observaciones": "Primer pago parcial del alquiler de Noviembre.",
  "usuario_id": "44c47c6eb8582c27fbc2c7f4"
}
```

#### Lógica del Backend

1.  Calcula el saldo pendiente del asiento.
2.  Valida que el `monto_pagado` no exceda el saldo.
3.  Si el pago cubre el saldo, el estado del asiento cambia a `PAGADO`.
4.  Si el pago es menor al saldo, el estado cambia a `PAGADO_PARCIAL`.
5.  Registra la transacción en el historial del asiento para un tracking detallado.

---

## 3️⃣ Ejemplo de Flujo de Pago: Parcial y Total

Imaginemos un asiento de alquiler por **$100,000**.

### Paso 1: Registrar un Pago Parcial

El inquilino realiza un primer pago de **$40,000**.

**Request:**
```http
POST /api/v1/accounting-entries/{asientoId}/register-payment

{
  "fecha_pago": "2025-11-08",
  "monto_pagado": 40000,
  "metodo_pago": "transferencia",
  "usuario_id": "44c47c6eb8582c27fbc2c7f4"
}
```

**Respuesta (parcial):**
El asiento actualizado con `estado: "PAGADO_PARCIAL"` y el `monto_pagado_acumulado` en la partida correspondiente actualizado a `40000`.

```json
{
  "_id": "{asientoId}",
  "estado": "PAGADO_PARCIAL",
  "partidas": [
    {
      "debe": 100000,
      "monto_pagado_acumulado": 40000
    }
  ],
  "historial_cambios": [
    {
      "accion": "PAGO_PARCIAL",
      "monto": 40000,
      "fecha": "2025-11-08T..."
    }
  ]
}
```

### Paso 2: Registrar el Pago Final

El inquilino paga los **$60,000** restantes.

**Request:**
```http
POST /api/v1/accounting-entries/{asientoId}/register-payment

{
  "fecha_pago": "2025-11-15",
  "monto_pagado": 60000,
  "metodo_pago": "efectivo",
  "usuario_id": "44c47c6eb8582c27fbc2c7f4"
}
```

**Respuesta (final):**
El asiento actualizado con `estado: "PAGADO"`.

```json
{
  "_id": "{asientoId}",
  "estado": "PAGADO",
  "fecha_pago": "2025-11-15T...",
  "partidas": [
    {
      "debe": 100000,
      "monto_pagado_acumulado": 100000
    }
  ],
  "historial_cambios": [
    {
      "accion": "PAGO_PARCIAL",
      "monto": 40000,
      "fecha": "2025-11-08T..."
    },
    {
      "accion": "PAGO_COMPLETO",
      "monto": 60000,
      "fecha": "2025-11-15T..."
    }
  ]
}
```

---

## 4️⃣ Otros Endpoints de Acciones

- **`POST /:id/anular`**: Anula un asiento. No puede estar `PAGADO`.
- **`POST /:id/condonar`**: Perdona una deuda (parcial o total).
- **`POST /:id/liquidar`**: Marca un asiento como liquidado al propietario. Requiere que el estado sea `PAGADO`.
- **`GET /:id/historial`**: Devuelve el historial completo de cambios de un asiento.

Para más detalles sobre estos endpoints, consulta sus DTOs correspondientes en `src/modules/accounting-entries/dto/`.