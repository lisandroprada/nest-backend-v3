El contrato presentado establece una **cláusula de rescisión anticipada muy específica** y que se ajusta a la libertad de pacto introducida por el DNU 70/2023.

El sistema de _backend_ debe implementar esta lógica sin asumir las penalidades que existían en las leyes anteriores (1 o 1.5 meses), ya que el contrato firmado las anula y establece una fórmula de cálculo distinta y más compleja (el 10% del saldo futuro).

A continuación, se detalla el cuadro de rescisión basado exclusivamente en el **ARTICULO 9º** del contrato.

---

## 📝 Cuadro de Rescisión Anticipada (Según Art. 9º del Contrato)

La penalidad se calcula en función de la **notificación** y el **saldo total pendiente** del contrato, no en función de si se cumplen o no 6 meses de alquiler.

| Acción de la Locataria            | Plazo de Preaviso                                                                    | Penalidad Aplicable (DÉBITO)                                                                                          |
| :-------------------------------- | :----------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Rescisión General**             | Mínimo **30 días corridos** de anticipación (Art. 9.2).                              | **10% del Saldo Total del Canon Locativo Futuro** (desde la fecha de notificación hasta la fecha final del contrato). |
| **Rescisión de Último Momento**   | Menos de 30 días de anticipación.                                                    | **10% del Saldo Total del Canon Locativo Futuro** + Posibles reclamos por daños y perjuicios por falta de preaviso.   |
| **Rescisión con Plazo Extendido** | **3 meses o más** de anticipación a la **fecha de finalización pactada** (Art. 9.3). | **CERO (0)**. No corresponde indemnización alguna.                                                                    |

---

## ⚙️ Lógica de Implementación en el Backend (`ContractsService`)

El servicio de contratos debe implementar una función que calcule la penalidad al momento de registrar la `fecha_recision_anticipada`.

### 1. Detección de Parámetros Clave del Contrato

El sistema debe extraer los siguientes datos al inicio del proceso de rescisión:

| Campo del Contrato       | Valor Extraído                                                                                        | Propósito en el Cálculo                                   |
| :----------------------- | :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------- |
| `fecha_final`            | `05 de octubre de 2027`                                                                               | Límite final para el cálculo del "canon locativo futuro". |
| `monto_base_vigente`     | El último monto ajustado (ej., si rescinde en 2026, el valor vigente luego del ajuste cuatrimestral). | La base de cálculo para el saldo.                         |
| **Fórmula de Penalidad** | **10% del saldo futuro.**                                                                             | El factor fijo de la penalidad.                           |

### 2. Algoritmo de Cálculo de la Penalidad (Débito al Locatario)

El servicio debe seguir esta lógica:

| Paso                             | Descripción de la Lógica                                                                                                                                                                                                                                                        | Asiento Contable Generado                                                                                                 |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------ |
| **A. Verificación de Excepción** | Calcular la diferencia entre la fecha de notificación de rescisión y la `fecha_final` del contrato. Si es $\ge 3$ meses, la penalidad es **$0$**.                                                                                                                               | **NINGÚN DÉBITO** por penalidad. Se procede a la anulación de asientos futuros.                                           |
| **B. Cálculo del Saldo Futuro**  | Si no aplica la excepción: 1. Sumar los **montos originales** de todos los asientos de alquiler (`AccountingEntry`) con `estado: 'PENDIENTE'` posteriores a la fecha de rescisión. 2. **Alternativa (Más Precisa):** Proyectar el `monto_base_vigente` por los meses restantes. | El resultado es el **"Canon Locativo Futuro"** total.                                                                     |
| **C. Generación del Débito**     | Aplicar el **10%** a la suma del Saldo Futuro. Este es el monto de la penalidad.                                                                                                                                                                                                | `AccountingEntriesService.createAccountingEntry()`: **DÉBITO** al Locatario por `tipo_asiento: 'PENALIZACION_RESCISION'`. |

### Ejemplo Práctico (Implementación Backend)

Si la Locataria notifica la rescisión el **6 de octubre de 2026** (exactamente 12 meses restantes) y el alquiler vigente (ajustado) es de **\$500.000**:

1.  **Meses Restantes:** 12 meses.
2.  **Canon Futuro Total:** $12 \times \$500.000 = \$6.000.000$.
3.  **Penalidad (10%):** $\$6.000.000 \times 0.10 = \mathbf{\$600.000}$.
4.  **Acción del Sistema:** Se crea un Débito de \$600.000 en la cuenta corriente del Locatario (Partida $\text{CXC\_ALQ}$).

---

### 🚨 Riesgo Legal Adicional (Contradicción de Uso)

El contrato presenta una grave contradicción:

- **Artículo 1º:** "para instalar en ellos, el local en el cual desarrollará su **actividad comercial**..."
- **Artículo 4º:** "El inmueble locado será utilizado exclusivamente para desarrollar la actividad de **Vivienda Única**..."

**Implicancia para el Sistema:** Esta ambigüedad legal no afecta el cálculo de la penalidad, ya que **Artículo 9 es la cláusula específica firmada**. Sin embargo, en un juicio, un juez podría interpretar la contradicción a favor del Locatario (consumidor), pero la regla contable debe ser fiel a los términos escritos. El sistema debe implementar la fórmula del **10% del saldo futuro**.
