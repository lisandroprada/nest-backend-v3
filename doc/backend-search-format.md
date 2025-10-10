# Formato de Búsqueda Avanzada del Backend

**Versión:** 2.0

Este documento describe el formato para construir consultas de búsqueda complejas y no excluyentes en los endpoints de listado de la API.

---

## Estructura de la URL de Búsqueda

El sistema de búsqueda se basa en un array de "criterios" que se pasa a través de los parámetros de la URL. Cada criterio es un objeto con tres partes: `field`, `term` y `operation`.

**Estructura base:**
`GET /endpoint?search[criteria][0][field]=...&search[criteria][0][term]=...&search[criteria][0][operation]=...`

---

## Lógica de Búsqueda: Combinando AND y OR

El sistema de búsqueda es muy flexible y combina los criterios de la siguiente manera:

-   **Condiciones AND (Y lógico):** Por defecto, cada criterio de búsqueda en el array `search[criteria]` se combina con un `AND`. Por ejemplo, si buscas por `status=ACTIVO` y `rol=LOCADOR`, solo obtendrás resultados que cumplan **ambas** condiciones.

-   **Condiciones OR (O lógico):** Para realizar una búsqueda no excluyente en múltiples campos (ej. "buscar este término en nombres O en apellidos O en email"), puedes agrupar los campos en un solo criterio, **separándolos por comas en el parámetro `field`**.

    -   **Ejemplo de campo para búsqueda OR:** `field=nombres,apellidos,email_principal`

    El backend interpretará esto como `(nombres CONTAINS term) OR (apellidos CONTAINS term) OR (email_principal CONTAINS term)`.

-   **Combinación de AND y OR:** Puedes combinar ambos tipos de búsqueda. El grupo de condiciones `OR` será tratado como un único bloque que luego se combinará con los demás criterios `AND`.

---

## Operaciones Soportadas (`operation`)

- `eq`: Igual (equality).
- `contains`: Contiene (búsqueda parcial, no distingue mayúsculas/minúsculas ni acentos).
- `gt`: Mayor que (greater than).
- `lt`: Menor que (less than).
- `gte`: Mayor o igual que.
- `lte`: Menor o igual que.

---

## Ejemplo Completo de Uso (Búsqueda de Agentes)

Busquemos agentes que cumplan con lo siguiente:
-   Que contengan el término "**juan**" en su nombre, apellido o email.
-   **Y** que además tengan el status "**ACTIVO**".

### 1. Construcción en el Frontend

```typescript
const searchCriteria: SearchCriterion[] = [
  {
    // Criterio OR: busca "juan" en 3 campos diferentes
    field: 'nombres,apellidos,email_principal',
    term: 'juan',
    operation: 'contains'
  },
  {
    // Criterio AND: filtra por status exacto
    field: 'status',
    term: 'ACTIVO',
    operation: 'eq'
  }
];

const params = {
  page: 0,
  pageSize: 10,
  sort: 'apellidos', // Ordena por apellido ascendente
  'search[criteria]': searchCriteria
};

// El servicio se encargará de serializar esto en la URL
const response = await agentsService.getAgents(params);
```

### 2. URL Generada

La lógica del frontend debería generar una URL como la siguiente:

```
GET http://localhost:3050/agents?search[criteria][0][field]=nombres,apellidos,email_principal&search[criteria][0][term]=juan&search[criteria][0][operation]=contains&search[criteria][1][field]=status&search[criteria][1][term]=ACTIVO&search[criteria][1][operation]=eq&page=0&pageSize=10&sort=apellidos
```

### 3. Lógica de Base de Datos Resultante

El backend traducirá esta URL a la siguiente consulta en MongoDB:

```javascript
{
  "$and": [
    {
      "$or": [
        { "nombres": /juan/i },
        { "apellidos": /juan/i },
        { "email_principal": /juan/i }
      ]
    },
    {
      "status": "ACTIVO"
    }
  ]
}
```

Esto asegura que se obtengan solo los resultados que cumplen ambas condiciones de manera correcta.