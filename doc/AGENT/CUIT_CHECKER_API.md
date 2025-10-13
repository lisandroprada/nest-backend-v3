# API de Consulta de CUIT por DNI

Este documento describe el endpoint que permite consultar la información de un CUIT (Clave Única de Identificación Tributaria) a partir de un número de DNI (Documento Nacional de Identidad).

## Funcionalidad

El endpoint realiza un proceso de _web scraping_ sobre el sitio `https://www.cuitonline.com/` para obtener datos fiscales asociados a un DNI.

**Importante:** Dado que esta funcionalidad depende de la estructura de un sitio web externo, puede dejar de funcionar si el sitio cambia su diseño. 

## Endpoint

`GET /cuit/:dni`

### Parámetros

-   `dni` (string): El número de DNI que se desea consultar.

### Respuesta Exitosa (200 OK)

El endpoint devuelve un objeto JSON con la siguiente estructura:

```json
{
  "nombre": "string",
  "cuit": "string",
  "tipoPersona": "string",
  "ganancias": "string",
  "iva": "string"
}
```

-   **nombre**: Nombre y apellido o razón social.
-   **cuit**: Número de CUIT/CUIL en formato `XX-XXXXXXXX-X`.
-   **tipoPersona**: Tipo de persona (ej. "Persona Física (masculino)").
-   **ganancias**: Condición frente al impuesto a las ganancias.
-   **iva**: Condición frente al IVA.

### Ejemplo de Uso

**Petición:**

```http
GET /cuit/25407911
```

**Respuesta:**

```json
{
  "nombre": "PRADA TOLEDO LISANDRO EMANUEL",
  "cuit": "20-25407911-2",
  "tipoPersona": "Persona Física (*masculino*)",
  "ganancias": "Ganancias Personas Fisicas",
  "iva": "Iva Inscripto"
}
```

### Respuesta de Error (500 Internal Server Error)

Si el DNI no se encuentra o si la estructura de la página ha cambiado, el endpoint devolverá un error 500 con un mensaje indicando la causa del problema.
