Este es el **Documento de Diseño Detallado (DDD)** completo y definitivo, integrando todos los modelos de datos, flujos de negocio y decisiones de arquitectura discutidas. Este documento sirve como la única fuente de verdad para el desarrollo del _backend_ en NestJS y MongoDB.

---

# 📄 Documento de Diseño Detallado (DDD) - Sistema de Gestión Inmobiliaria

**Plataforma:** MongoDB + NestJS (TypeScript)
**Especialista:** DB Developer
**Versión:** 1.0 (Final y Definitiva)

## 1. Arquitectura y Principios Fundamentales

### 1.1 Principios de Diseño del Modelo (MongoDB)

| Principio                 | Aplicación en el Sistema                                                                                                                                 |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inmutabilidad**         | Los campos `monto_original` y `fecha_creacion` en `asientos_contables` nunca se modifican.                                                               |
| **Atomicidad**            | Cada documento en `asientos_contables` es un asiento contable completo y balanceado (Débito = Crédito).                                                  |
| **Orientación a Lectura** | Uso de **referencias** (`agente_id`, `contrato_id`) en `asientos_contables` para optimizar consultas de saldos y reportes (_Aggregation_).               |
| **Proyección Parcial**    | Los asientos futuros (ajustables por ICL) solo se crean hasta el punto de ajuste conocido (ej., 6 meses), manteniendo la base de datos ligera y precisa. |

### 1.2 Estructura de Colecciones Definidas

| Colección                    | Propósito                                           | Relaciones Clave                                           | Indexing (Esencial para Querys)                                                                          |
| :--------------------------- | :-------------------------------------------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| **1. `agentes`**             | Entidades Base (Clientes, Proveedores, etc.).       | Referenciada por todas las colecciones.                    | `identificador_fiscal` (UNIQUE), `rol`, `email`.                                                         |
| **2. `propiedades`**         | Inmuebles.                                          | Referencia a `agentes` (propietarios).                     | `identificador_tributario`, `identificador_interno`.                                                     |
| **3. `contratos`**           | Vínculo legal y motor de la lógica contable.        | Referencia a `propiedades` y `agentes`.                    | `status`, `fecha_final`, `partes.agente_id`.                                                             |
| **4. `plan_de_cuentas`**     | Estructura contable.                                | Referenciada por `asientos_contables`.                     | `codigo`, `tipo_cuenta`.                                                                                 |
| **5. `cuentas_financieras`** | Cajas Chicas y Bancos.                              | Referenciada por `transacciones`.                          | `nombre`, `tipo`.                                                                                        |
| **6. `transacciones`**       | Flujo de Caja (Ingresos/Egresos) y Conciliación.    | Referencia a `cuentas_financieras` y `asientos_contables`. | `fecha_transaccion`, `conciliado`, `cuenta_financiera_id`.                                               |
| **7. `asientos_contables`**  | **Core Contable:** Devengamiento, Pasivos, Ajustes. | Referencia a `contratos` y `agentes`.                      | **`contrato_id`**, **`estado`**, **`fecha_vencimiento`**, **`partidas.agente_id`** (Índices compuestos). |

---

## 2. Modelos de Datos Detallados (Schemas Finales)

### 2.1 Colección `agentes`

| Campo                      | Tipo de Dato    | Detalle y Reglas                                               | Trazabilidad/Seguridad                     |
| :------------------------- | :-------------- | :------------------------------------------------------------- | :----------------------------------------- | ---------------------------- | ----------------- |
| **`rol`**                  | `Array<Enum>`   | Tipos de participación: `LOCADOR`, `LOCATARIO`, `FIADOR`, etc. | Clave para permisos y filtros.             |
| **`persona_tipo`**         | `Enum`          | `FISICA                                                        | JURIDICA`.                                 | Base para validación fiscal. |
| **`nomenclador_fiscal`**   | `Enum`          | Variantes fiscales (e.g., `CF`, `RI`, `MONOTRIBUTO`).          | Requerido para facturación.                |
| **`identificador_fiscal`** | `String`        | CUIT/CUIL. Debe ser **único**.                                 | Indexado.                                  |
| `direccion_legal`          | `Object`        | Dirección fiscal.                                              | Embebido.                                  |
| **`cuentas_bancarias`**    | `Array<Object>` | Embebido. Crucial para Liquidaciones.                          | `{ cbu_alias, cbu_numero, banco, moneda }` |
| `password`                 | `String`        | Hash. Solo para usuarios con acceso a portal.                  | Seguridad (bcrypt).                        |
| `status`                   | `Enum`          | `ACTIVO                                                        | INACTIVO                                   | ...`                         | Estado operativo. |
| `usuario_creacion_id`      | `ObjectId`      | Usuario que creó el registro.                                  | Auditoría.                                 |

### 2.2 Colección `propiedades`

| Campo                          | Tipo de Dato      | Detalle y Reglas                             | Trazabilidad/Estrategia                 |
| :----------------------------- | :---------------- | :------------------------------------------- | :-------------------------------------- | ----------- | ---------------------------------- |
| **`propietarios_ids`**         | `Array<ObjectId>` | Referencia a `agentes`. Permite copropiedad. | Clave para liquidar.                    |
| **`identificador_interno`**    | `String`          | Código único de la inmobiliaria.             | Indexado ÚNICO.                         |
| **`identificador_tributario`** | `String`          | Partida Municipal / Nomenclatura Catastral.  | Indexado.                               |
| `valor_alquiler`               | `Number`          | Monto base para nuevos contratos.            |                                         |
| **`tipo_expensas`**            | `Enum`            | `ORDINARIAS                                  | EXTRAORDINARIAS                         | INCLUIDAS`. | Determina la imputación de gastos. |
| **`contrato_vigente_id`**      | `ObjectId`        | Referencia al contrato activo.               | Optimiza la consulta de disponibilidad. |
| `documentos_digitales`         | `Array<Object>`   | Vínculos a contratos/inventario escaneados.  | Auditoría Legal.                        |

### 2.3 Colección `contratos`

| Campo                                      | Tipo de Dato    | Detalle y Reglas                                                         | Lógica de Negocio                                      |
| :----------------------------------------- | :-------------- | :----------------------------------------------------------------------- | :----------------------------------------------------- | ----------------------------- | ---- | ------------------------------ |
| **`partes`**                               | `Array<Object>` | `{ agente_id, rol }`. Incluye **fiadores**.                              | Vínculo completo del contrato.                         |
| **`fecha_recision_anticipada`**            | `ISODate`       | Fecha de anulación si no llega al `fecha_final`.                         | Activa la **Anulación Masiva** de asientos pendientes. |
| **`terminos_financieros`**                 | `Object`        | **Toda la lógica contable EMBEBIDA.**                                    | Fuente para `MotorAjuste`.                             |
| `terminos_financieros.monto_base_vigente`  | `Number`        | Monto base actual. Se actualiza con cada ajuste ICL.                     | Usado por la **Proyección Parcial**.                   |
| `terminos_financieros.indice_tipo`         | `Enum`          | `ICL                                                                     | IPC                                                    | FIJO                          | ...` | El índice que rige el aumento. |
| `terminos_financieros.interes_mora_diaria` | `Number`        | Tasa para cálculo de intereses.                                          | Usado por el **Servicio de Morosidad**.                |
| **`deposito_monto`**                       | `Number`        | Monto original del depósito.                                             |                                                        |
| **`deposito_tipo_ajuste`**                 | `Enum`          | `AL_ORIGEN                                                               | AL_ULTIMO_ALQUILER`.                                   | Regla para indexar el pasivo. |
| **`ajuste_programado`**                    | `ISODate`       | Próxima fecha en que el **MotorAjuste** debe actuar sobre este contrato. | Clave para el `MotorAjuste`.                           |

### 2.4 Colección `transacciones`

| Campo                      | Tipo de Dato | Detalle y Reglas                                                     | Tesorería y Control                   |
| :------------------------- | :----------- | :------------------------------------------------------------------- | :------------------------------------ |
| `referencia_asiento`       | `ObjectId`   | El débito/crédito que esta transacción cancela.                      | Conciliación Contable.                |
| **`cuenta_financiera_id`** | `ObjectId`   | **El banco o caja chica** que recibió/emitió el dinero.              | Clave para reportes de Flujo de Caja. |
| **`conciliado`**           | `Boolean`    | `true` si se verificó contra el extracto bancario/rendición de caja. | Clave para la Conciliación Bancaria.  |
| `referencia_bancaria`      | `String`     | Código del banco/transferencia.                                      | Matching Automático.                  |

---

## 3. Flujos de Negocio y Lógica en NestJS

### 3.1 Flujo de Devengamiento y Proyección (Método: Proyección Parcial)

1.  **POST /contratos:** El `ContratosService` valida el contrato.
2.  **Lógica de Proyección:** NestJS calcula los períodos desde `fecha_inicio` hasta la fecha de **`ajuste_programado`** y genera un documento en `asientos_contables` por cada mes/período.
    - Cada asiento es balanceado (Débito Locatario = Crédito Locador + Crédito Inmobiliaria) y tiene su `monto_original` igual al `monto_actual`.
3.  **Depósito:** Se genera un asiento separado con `tipo_asiento: "Depósito en Garantía"` (Pasivo) referenciando al Locatario.

### 3.2 Motor de Ajustes y Proyección (Single Cron Job) ⚙️

El **`MotorAjusteContratosService`** es un **único Cron Job** ejecutándose diariamente (ej., 2:00 AM).

1.  **Barrido:** Consulta `contratos` donde `ajuste_programado` sea inminente.
2.  **Cálculo:** Obtiene el índice (externo) y calcula el **Factor de Ajuste ($F$)**.
3.  **Actualización de Base:** Actualiza `contratos.terminos_financieros.monto_base_vigente` a $\text{Monto Base} \times F$.
4.  **Proyección:** Genera el **siguiente bloque** de asientos (`asientos_contables`) (ej., 6 meses más) utilizando el nuevo `monto_base_vigente` como `monto_original`.
5.  **Actualización del Depósito Indexado:**
    - **Activación:** Se ejecuta solo cuando el contrato está `FINALIZADO` o `RESCINDIDO`.
    - **Cálculo:** Se obtiene el `monto_actual` del último alquiler devengado y se aplica el factor al asiento de depósito (`deposito\_id`) para actualizar su **`monto_actual`**.

### 3.3 Flujo de Cobranza y Gestión de Saldos

| Caso                          | Lógica de NestJS                                                                                                                                            | Modelo de Datos Afectado              |
| :---------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| **Pago (Imputación)**         | El `TransaccionesService` registra el pago. Actualiza el campo **`monto_pagado_acumulado`** en la partida **DEBITO** del `asientos_contables` referenciado. | `transacciones`, `asientos_contables` |
| **Saldos a Favor (Anticipo)** | Si Pago > Deuda: Se genera un **NUEVO asiento CREDITO** al Locatario con `tipo_asiento: "Saldo a Favor"` (Pasivo de la Inmobiliaria).                       | `asientos_contables`                  |
| **Retiros (Caja/Bancos)**     | Se registran como **dos** `transacciones`: `Egreso` de la cuenta de origen, `Ingreso` a la cuenta de destino (`cuentas_financieras`).                       | `transacciones`                       |

### 3.4 Discrecionalidad y Ajustes Contables

| Caso                     | Lógica de NestJS y Trazabilidad                                                                                                                                                                                                                                                   |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Intereses Moratorios** | **Cálculo:** Generación de un **NUEVO asiento DEBITO** con `tipo_asiento: "Intereses Moratorios"`. **Discrecionalidad:** Se crea inicialmente con `estado: "Pendiente Aprobación"`. El administrador debe cambiarlo a **`"Pendiente"`** (cobrar) o **`"Condonado"`** (no cobrar). |
| **Bonificación/Quita**   | Generación de un **NUEVO asiento balanceado**: **CRÉDITO** al Locatario (reduce su deuda) y **DÉBITO** al Locador (el Locador asume el gasto). El asiento original de alquiler queda inmutable.                                                                                   |
| **Anulación/Rescisión**  | Se prohíbe el borrado de asientos. Se ejecuta un `updateMany` sobre los asientos futuros **`Pendientes`**, cambiando su `estado` a **`"Anulado por Rescisión"`**.                                                                                                                 |

---

## 4. Reportes Estratégicos y Cumplimiento

### 4.1 Cálculo de Saldo (Cuenta Corriente)

- **Método:** `Aggregation Pipeline` de MongoDB en tiempo real.
- **Fórmula:** $\text{Saldo Neto} = \sum (\text{DEBITO}_{\text{monto\_actual}} - \text{DEBITO}_{\text{monto\_pagado\_acumulado}}) - \sum (\text{CREDITO}_{\text{monto\_actual}})$.
- **Filtro Clave:** El pipeline siempre excluye asientos con `estado: "Anulado" | "Condonado" | "Liquidado"`.

### 4.2 Reporte de Envejecimiento de Deuda (Aging)

- **Metodología:** `Aggregation Pipeline` en tiempo real que calcula los `dias_mora` (`Fecha Actual` - `fecha_vencimiento`) y utiliza el operador **`$bucket`** para clasificar la deuda en rangos (1-30, 31-60, 60+ días).

### 4.3 Conciliación Bancaria y Flujo de Caja

- **Flujo de Caja:** Reporte en tiempo real de la sumatoria de **`transacciones`** filtradas por `conciliado: true` y agrupadas por `cuenta_financiera_id`.
- **Pendientes de Conciliación:** Reporte de todas las `transacciones` donde `conciliado: false`.

### 4.4 Seguridad y Autorización

- **NestJS Guards:** Utilización de _Guards_ para proteger _endpoints_ basándose en los roles del agente (ej., solo Contabilidad puede acceder a `POST /liquidaciones`).
- **Trazabilidad:** Inclusión de `usuario_creacion_id` y `usuario_modificacion_id` en todas las colecciones principales, gestionado por un _Interceptor_ de NestJS.
