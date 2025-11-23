### 1. 🛠️ Extensión del Modelo de Datos de Proveedores (`agentes`)

La configuración del proveedor de servicios (Camuzzi, etc.) debe ahora depender exclusivamente de las expresiones regulares que actúan sobre el texto.

| Campo (Actualización)      | Colección                  | Propósito                                                                                               | Regla de Negocio |
| :------------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------ | :--------------- |
| **`servicio_id_regex`**    | `agentes`                  | Expresión regular para extraer el **Número de Cuenta** (`9103/0-21-08-0023608/4`) del cuerpo del email. |
| **`monto_regex`**          | `agentes`                  | Expresión regular para extraer el **Importe Total** del cuerpo del email.                               |
| **`pdf_search_key`**       | _Eliminado / No Requerido_ | No es necesario, ya que no hay análisis de archivos.                                                    |
| **`pdf_attachment_names`** | _Eliminado / No Requerido_ | Se elimina la necesidad de escanear adjuntos.                                                           |

---

## 2. ⚙️ Motor de Tareas: `EmailScanService` (Lógica Simplificada)

El Cron Job ahora se centra únicamente en la **Fase I: Extracción de Texto Simple**.

### A. Lógica del Proceso (Pasos Secuenciales)

1.  **Conexión IMAP:** El servicio se conecta al buzón (Gmail) y filtra los emails recientes por los dominios de los proveedores.
2.  **Extracción Directa del Cuerpo:** Por cada email relevante, el servicio obtiene el texto plano del cuerpo.
3.  **Aplicación de Regex:**
    - **Identificador de Servicio:** Aplica `servicio_id_regex` sobre el cuerpo del email. Si se encuentra un _match_, se registra el ID (ej., `9103/0-...`).
    - **Monto Total:** Aplica `monto_regex` para capturar el valor numérico (ej., `$ 450000.00`).
    - **Tipo de Alerta:** Clasifica la alerta (`AVISO_CORTE`, `FACTURA_DISPONIBLE`) basándose en palabras clave en el Asunto y Cuerpo.
4.  **Persistencia:** Se crea el documento en **`gastos_detectados`** con el `identificador_servicio` y el `monto_estimado` extraídos, estableciendo `estado_procesamiento: 'PENDIENTE_VALIDACION'`.

---

## 3. 🧭 Flujo de Asignación y Carga de Gasto (Mismo Flujo Final)

Los Pasos 3 y 4 de la Operación no cambian, ya que la fuente de datos es la misma (la colección `gastos_detectados`).

1.  **Worklist Frontend:** Muestra el listado de facturas detectadas, lista para la validación del operador.
2.  **Asignación de Responsable:** El operador utiliza el **`identificador_servicio`** (el número de cuenta) para buscar la propiedad vinculada en el _schema_ `propiedades.servicios_asociados`.
3.  **Generación de Asiento (POST /expenses/assign):** El operador aprueba y genera el asiento de Débito/Pasivo, utilizando el monto extraído como base para el prorrateo por `ratio_incidencia`.

La eliminación de la complejidad de PDF/OCR resulta en un código más rápido de escribir, más sencillo de mantener, y menos propenso a fallos en la conexión a servicios externos.
