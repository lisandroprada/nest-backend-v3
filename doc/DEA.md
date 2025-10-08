Comprendido. La distinción entre la **identidad única** del Agente y sus **múltiples roles contextuales** es fundamental. El diseño actual ya lo soporta, pero requiere documentar el uso preciso de los campos `rol` (en la colección `agentes`) y `partes` (en la colección `contratos`) para evitar ambigüedades.

Este documento de corrección detalla la estandarización y el uso de los roles para el desarrollador.

---

# 🛠️ Documento de Estandarización de Roles de Agentes

## Objetivo

Eliminar cualquier ambigüedad en la definición de roles y asegurar que el desarrollador comprenda:

1.  **La colección `agentes`** define el **historial de roles posibles** del individuo (ej., _Es Locador y ha sido Fiador_).
2.  **La colección `contratos`** define el **rol contextual** en una transacción específica (ej., _En este contrato, juega el rol de Locatario_).

---

## 1\. Colección `agentes` - Identidad Única (Historial de Roles)

El campo `rol` en la colección `agentes` es un **conjunto de todos los roles funcionales** que esa persona o entidad ha desempeñado o puede desempeñar en el sistema.

### A. Definición del Campo `rol`

| Campo     | Tipo          | Propósito                                                                 | Regla de Negocio                                                                                                             |
| :-------- | :------------ | :------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| **`rol`** | `Array<Enum>` | Define la **capacidad** del agente. Usado para filtros de negocio global. | **Acumulativo:** Un rol se añade cuando se utiliza por primera vez y nunca se elimina, a menos que sea un error de registro. |

### B. Listado de Roles Válidos (ENUM)

El `Enum` para los roles en `agentes` debe ser exhaustivo:

```typescript
export enum AgenteRoles {
  // Roles de Negocio
  LOCADOR = 'LOCADOR',
  LOCATARIO = 'LOCATARIO',
  FIADOR = 'FIADOR',

  // Roles Operacionales
  PROVEEDOR = 'PROVEEDOR',
  INMOBILIARIA = 'INMOBILIARIA', // Usado para el agente que representa la empresa.
  COMPRADOR = 'COMPRADOR',
  VENDEDOR = 'VENDEDOR',
}
```

**Ejemplo de Agente:**
Un agente que alquila una propiedad (Locatario) y simultáneamente alquila otra que posee (Locador) tendrá: `rol: ['LOCATARIO', 'LOCADOR']`.

---

## 2\. Colección `contratos` - Contexto de la Transacción

El campo `partes` en la colección `contratos` es el único lugar donde se define el rol que el agente juega en el marco legal del acuerdo.

### A. Definición del Campo `partes`

| Campo        | Tipo            | Propósito                                                                   | Regla de Negocio                                                                                                                           |
| :----------- | :-------------- | :-------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **`partes`** | `Array<Object>` | Define el **rol contractual** que asume el `agente_id` para este documento. | **Contextual:** Un agente es listado múltiples veces aquí, una por cada rol que asume en el contrato (ej., Propietario A y Propietario B). |

### B. Estructura Embebida de `partes`

```json
{
  // Dentro del documento 'contratos'
  "partes": [
    {
      "agente_id": ObjectId("..."),
      "rol": "LOCADOR" // Contexto: En este contrato, es LOCADOR
    },
    {
      "agente_id": ObjectId("..."),
      "rol": "LOCATARIO" // Contexto: En este contrato, es LOCATARIO
    }
  ]
}
```

### C. Consistencia con la Liquidación

El desarrollador debe utilizar el rol definido en **`contratos.partes`** para determinar la lógica contable y de liquidación, **NUNCA** el campo `agentes.rol`.

| Lógica Contable             | Búsqueda                                                                                   |
| :-------------------------- | :----------------------------------------------------------------------------------------- |
| **A quién cobrar (Débito)** | Buscar en `contratos.partes` el rol **`LOCATARIO`** para obtener el `agente_id` a debitar. |
| **A quién pagar (Crédito)** | Buscar en `contratos.partes` el rol **`LOCADOR`** para obtener el `agente_id` a liquidar.  |

---

## 3\. Corrección Específica en `ContractsService`

El desarrollador debe asegurarse de que la lógica de búsqueda de partes para la generación de asientos esté libre de ambigüedad.

- **Identificación en el Código:** En el método `generateInitialAccountingEntries()`, las siguientes líneas son correctas, ya que buscan el rol específico en el contexto del contrato:

  ```typescript
  const locador = partes.find((p) => p.rol === 'LOCADOR');
  const locatario = partes.find((p) => p.rol === 'LOCATARIO');
  ```

- **Regla para el Desarrollador:** Si el desarrollador necesita saber el rol de un agente en un contexto global (ej., listar todos los proveedores), debe consultar el campo **`agentes.rol`**. Para cualquier lógica de contrato o generación de asientos, debe consultar el array **`contratos.partes`**.

Esta estandarización garantiza que el `agente_id` sea la identidad central y el `rol` en el contrato sea la clave para la lógica financiera.
