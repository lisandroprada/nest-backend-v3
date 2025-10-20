He implementado un nuevo endpoint para activar manualmente la actualización de todos los índices (ICL, IPC y CASAPROPIA) y devolver un resumen del proceso.

Aquí está la información para la implementación del frontend:

**Endpoint:** `POST /api/v1/index-value/update/all`

**Method:** `POST`

**Description:** Triggers the update of all indices (ICL, IPC, and CASAPROPIA). This process can take some time, so it is recommended to show a loading indicator in the frontend.

**Success Response:**

-   **Status Code:** `201`
-   **Body:**

```json
{
  "message": "Actualización de todos los índices completada.",
  "summary": {
    "IPC": {
      "newRecords": 10,
      "status": "success"
    },
    "CASAPROPIA": {
      "newRecords": 5,
      "status": "success"
    },
    "ICL": {
      "newRecords": 20,
      "status": "success"
    }
  }
}
```

**Error Response:**

-   **Status Code:** `201` (The controller returns a 201 even on error, but the body contains the error message)
-   **Body:**

```json
{
  "message": "Error al actualizar los índices: <error message>"
}
```

The `summary` object in the success response contains the following information for each index:

-   `newRecords`: The number of new records inserted into the database.
-   `status`: The status of the update process for that index. It can be `success` or `failed`.