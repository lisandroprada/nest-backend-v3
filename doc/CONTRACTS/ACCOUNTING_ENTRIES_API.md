# API de Consultas - Asientos Contables

> **Fecha:** 14 de octubre de 2025  
> **Estado:** ✅ IMPLEMENTADO  
> **Versión:** 1.0.0

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

## 2️⃣ Estado de Cuenta por Agente

### `GET /accounting-entries/estado-cuenta/:agentId`

Obtiene el estado de cuenta completo de un agente específico (propietario o inquilino), mostrando todos los movimientos contables relevantes, agrupados y ordenados cronológicamente.

#### Parámetros de ruta

| Parámetro | Tipo   | Requerido | Descripción   |
| --------- | ------ | --------- | ------------- |
| `agentId` | string | Sí        | ID del agente |

#### Parámetros de consulta

| Parámetro          | Tipo    | Requerido | Descripción                          | Default |
| ------------------ | ------- | --------- | ------------------------------------ | ------- |
| `fecha_desde`      | string  | No        | Fecha desde (ISO 8601)               | -       |
| `fecha_hasta`      | string  | No        | Fecha hasta (ISO 8601)               | -       |
| `incluir_pagados`  | boolean | No        | Incluir asientos pagados             | `true`  |
| `incluir_anulados` | boolean | No        | Incluir asientos anulados/condonados | `false` |

#### Ejemplo de request

```http
GET /api/v1/accounting-entries/estado-cuenta/507f1f77bcf86cd799439011?fecha_desde=2025-01-01
Authorization: Bearer <token>
```

#### Ejemplo de response

```json
{
  "agente_id": "507f1f77bcf86cd799439011",
  "resumen": {
    "total_debe": 5000000,
    "total_haber": 4500000,
    "total_pagado": 2000000,
    "saldo_final": -1500000,
    "asientos_pendientes": 8,
    "asientos_pagados": 15,
    "total_movimientos": 23
  },
  "movimientos": [
    {
      "_id": "670c9f6e5f2e...",
      "fecha_vencimiento": "2025-01-10T00:00:00.000Z",
      "descripcion": "Alquiler 01/2025",
      "tipo_asiento": "Alquiler",
      "estado": "PAGADO",
      "debe": 500000,
      "haber": 0,
      "monto_pagado_acumulado": 500000,
      "saldo_partida": 0,
      "saldo_acumulado": -500000,
      "contrato_codigo": "ALQ-2024-001",
      "asiento_id": "670c9f6e5f2e...",
      "pagado": true
    },
    {
      "_id": "670c9f6e5f2f...",
      "fecha_vencimiento": "2025-02-10T00:00:00.000Z",
      "descripcion": "Alquiler 02/2025",
      "tipo_asiento": "Alquiler",
      "estado": "PENDIENTE",
      "debe": 500000,
      "haber": 0,
      "monto_pagado_acumulado": 0,
      "saldo_partida": 500000,
      "saldo_acumulado": 0,
      "contrato_codigo": "ALQ-2024-001",
      "asiento_id": "670c9f6e5f2f...",
      "pagado": false
    }
  ]
}
```

#### Interpretación del saldo

- **`saldo_final` positivo:** El agente **debe** dinero.
- **`saldo_final` negativo:** El agente tiene **crédito** (se le debe dinero).
- **`saldo_acumulado`:** Evolución del saldo a lo largo del tiempo, útil para mostrar gráficos o alertas de deuda.

#### Consistencia y alcance

- El endpoint está 100% implementado y operativo.
- Permite al frontend mostrar el estado de cuenta, filtrar por fechas y distinguir entre movimientos pendientes, pagados y anulados.
- El cálculo de saldos y agrupamiento de movimientos es consistente con la lógica contable del backend.
- No se documentan parámetros ni campos que no estén presentes en la respuesta real.

---

## 3️⃣ Resumen Global del Sistema

### `GET /accounting-entries/resumen-global`

Obtiene estadísticas generales del sistema contable.

#### Query Parameters

| Parámetro     | Tipo   | Requerido | Descripción            |
| ------------- | ------ | --------- | ---------------------- |
| `fecha_desde` | string | No        | Fecha desde (ISO 8601) |
| `fecha_hasta` | string | No        | Fecha hasta (ISO 8601) |

#### Response

```json
{
  "periodo": {
    "fecha_desde": "2025-01-01",
    "fecha_hasta": "2025-12-31"
  },
  "totales": {
    "contratos_activos": 838,
    "asientos_generados": 3556,
    "monto_total": 1800000000,
    "saldo_pendiente": 450000000
  },
  "por_tipo": [
    {
      "tipo": "Alquiler",
      "cantidad": 3000,
      "monto": 1500000000
    },
    {
      "tipo": "Deposito",
      "cantidad": 315,
      "monto": 200000000
    },
    {
      "tipo": "Apertura",
      "cantidad": 241,
      "monto": 100000000
    }
  ],
  "por_estado": [
    {
      "estado": "PENDIENTE",
      "cantidad": 2500,
      "monto": 1250000000
    },
    {
      "estado": "PAGADO",
      "cantidad": 1000,
      "monto": 500000000
    },
    {
      "estado": "PAGADO_PARCIAL",
      "cantidad": 56,
      "monto": 50000000
    }
  ]
}
```

---

## 📚 Ejemplos de Uso

### Ejemplo 1: Buscar asientos pendientes de un contrato

```bash
GET /api/v1/accounting-entries/search?contrato_id=68ed72f084229ed30655d6ea&solo_pendientes=true
```

### Ejemplo 2: Estado de cuenta de un inquilino en 2025

```bash
GET /api/v1/accounting-entries/estado-cuenta/507f1f77bcf86cd799439011?fecha_desde=2025-01-01&fecha_hasta=2025-12-31
```

### Ejemplo 3: Asientos de alquiler pagados en el último trimestre

```bash
GET /api/v1/accounting-entries/search?tipo_asiento=Alquiler&estado=PAGADO&fecha_desde=2025-07-01&fecha_hasta=2025-09-30&sort=-fecha_vencimiento&limit=50
```

### Ejemplo 4: Resumen global del sistema

```bash
GET /api/v1/accounting-entries/resumen-global
```

### Ejemplo 5: Asientos de un propietario (todos sus contratos)

```bash
GET /api/v1/accounting-entries/search?agente_id=507f1f77bcf86cd799439011&page=1&limit=100
```

### Ejemplo 6: Vencimientos próximos (próximos 30 días)

```bash
GET /api/v1/accounting-entries/search?fecha_desde=2025-10-14&fecha_hasta=2025-11-14&solo_pendientes=true&sort=fecha_vencimiento
```

---

## 🧪 Testing con cURL

### 1. Buscar asientos con filtros

```bash
curl -X GET \
  "http://localhost:3000/api/v1/accounting-entries/search?solo_pendientes=true&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Estado de cuenta

```bash
curl -X GET \
  "http://localhost:3000/api/v1/accounting-entries/estado-cuenta/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Resumen global

```bash
curl -X GET \
  "http://localhost:3000/api/v1/accounting-entries/resumen-global" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## ⚙️ Optimizaciones Implementadas

### Índices MongoDB

Los siguientes índices están activos para mejorar el rendimiento:

```javascript
// En AccountingEntry
{ contrato_id: 1, estado: 1, fecha_vencimiento: 1 }
{ 'partidas.agente_id': 1, estado: 1 }
{ fecha_vencimiento: 1 }
{ estado: 1 }
```

### Populate Estratégico

Solo se populan las referencias necesarias:

- `contrato_id` → código, propiedad, fechas
- `partidas.agente_id` → nombre, apellido, tipo
- `partidas.cuenta_id` → código, nombre

### Agregaciones Eficientes

- Uso de pipelines de agregación para cálculos complejos
- Filtrado temprano con `$match`
- Proyección de campos específicos con `$project`

---

## 🔄 Próximos Pasos

### Backend

- [ ] Endpoint para marcar asiento como pagado
- [ ] Endpoint para anular asiento
- [ ] Exportación a PDF/Excel de estados de cuenta
- [ ] Webhooks para vencimientos próximos

### Frontend

- [ ] Componente tabla de asientos (paginada, ordenable)
- [ ] Dashboard con resumen global
- [ ] Vista de estado de cuenta por agente
- [ ] Filtros avanzados en sidebar
- [ ] Exportación de reportes

---

## 📞 Soporte

**Documentos relacionados:**

- [Sistema Contable - Estado Actual](./SISTEMA_CONTABLE_ESTADO_ACTUAL.md)
- [Resumen Ejecutivo](./RESUMEN_EJECUTIVO.md)

**Archivos principales:**

- Service: `src/modules/accounting-entries/accounting-entries.service.ts`
- Controller: `src/modules/accounting-entries/accounting-entries.controller.ts`
- DTOs: `src/modules/accounting-entries/dto/`

---

**Última actualización:** 14/10/2025  
**Autor:** Sistema de Migración Contable  
**Estado:** ✅ OPERATIVO
