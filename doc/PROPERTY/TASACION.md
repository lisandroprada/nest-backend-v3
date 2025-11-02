# Módulo de Tasación Inmobiliaria Avanzada (AVM)

## Objetivo

Desarrollar un módulo robusto y escalable para la tasación inmobiliaria (AVM), integrado en el backend NestJS y utilizando MongoDB.

## Estructura del Módulo

- **Schemas:**
  - `Comparable`: Propiedades comparables históricas del mercado.
  - `MarketParams`: Parámetros globales/regionales de mercado (singleton).
- **Servicio:**
  - `ValuationService`: Lógica central de tasación, ajuste por inflación, cálculo de valor de reposición y valor final.
- **Controlador:**
  - `TasacionController`: Endpoint POST `/tasacion/calculate` para calcular la tasación de una propiedad.
- **Script de Migración:**
  - `migrate-comparables.ts`: Permite la carga masiva de comparables históricos desde un archivo JSON.

## Esquemas Principales

### Comparable

- `titulo: string`
- `localidad_id: Types.ObjectId` (referencia a Locality)
- `superficie_m2: number`
- `antiguedad_anos: number`
- `estado_general: string` (enum)
- `valor_transaccion: number`
- `moneda: string`
- `fecha_transaccion: Date`

### MarketParams

- `costo_m2_base_construccion: number`
- `indice_ajuste_mano_obra: number`
- `indice_ajuste_materiales: number`
- `depreciacion_anual: Record<string, number>`
- `inflacion_mensual_mercado: number`
- `sentimiento_mercado_factor: number`
- `fecha_vigencia: Date`

## Servicio de Tasación

- Valida mínimo 3 comparables.
- Ajusta valores históricos por inflación.
- Calcula valor de mercado, valor de reposición y valor final ponderado.
- Devuelve un objeto con los resultados y detalles de cálculo.

## Endpoint

- `POST /tasacion/calculate`
  - Body: `{ propertyId: string, comparableIds: string[] }`
  - Respuesta: `{ V_Mercado, V_Costo, V_T, comparables, marketParams }`

## Migración de Comparables Históricos

A partir de la versión 2, la migración de comparables históricos se realiza mediante un endpoint que permite la carga masiva de datos desde un archivo CSV.

### Endpoint

- **POST** `/tasacion/migrar-comparables`
- Permite subir un archivo CSV con comparables históricos para alimentar la base de datos.

### Formato del archivo CSV

| propietario | direccion | ciudad | provincia | localidad_id | m2_terreno | m2_construidos | m2_semicubiertos | precio_m2_construido | precio_m2_semicubierto | precio_m2_lote | dormitorios | baños  | quincho | garage | patio | antiguedad_anos | avance_construccion | estado_general | ubicacion | moneda | valor_transaccion |
| ----------- | --------- | ------ | --------- | ------------ | ---------- | -------------- | ---------------- | -------------------- | ---------------------- | -------------- | ----------- | ------ | ------- | ------ | ----- | --------------- | ------------------- | -------------- | --------- | ------ | ----------------- |
| string      | string    | string | string    | ObjectId     | number     | number         | number           | number               | number                 | number         | number      | number | bool    | bool   | bool  | number          | number              | enum           | string    | string | number            |

- **Campos obligatorios:** ciudad, provincia, m2_construidos, precio_m2_construido, moneda, valor_transaccion, estado_general.
- **Campos opcionales:** propietario, direccion, localidad_id, m2_terreno, m2_semicubiertos, precio_m2_semicubierto, precio_m2_lote, dormitorios, baños, quincho, garage, patio, antiguedad_anos, avance_construccion, ubicacion.

> **Nota:** Se recomienda homologar `ciudad` y `provincia` con el servicio de location para obtener el `localidad_id` correspondiente. Si no se provee, el sistema intentará mapearlo automáticamente.

#### Consideraciones

- Los campos opcionales pueden venir vacíos o incompletos.
- El endpoint valida y reporta filas con errores, pero procesa las válidas.
- Los valores de `estado_general` deben ser uno de: EXCELENTE, MUY_BUENO, BUENO, REGULAR, MALO.
- Los precios por m2 semicubierto pueden calcularse automáticamente si no se proveen (50% del valor construido).
- Posteriormente se puede hacer un PATCH sobre los comparables para completar o corregir información.

### Formato requerido para el archivo CSV de comparables

El archivo CSV para la carga masiva de comparables debe tener la siguiente estructura de columnas (en este orden):

| Campo                  | Tipo     | Obligatorio | Descripción                                                                                  |
| ---------------------- | -------- | ----------- | -------------------------------------------------------------------------------------------- |
| propietario            | string   | No          | Nombre del propietario (si se conoce)                                                        |
| direccion              | string   | No          | Dirección de la propiedad                                                                    |
| ciudad                 | string   | Sí          | Ciudad (preferentemente homologada con el sistema de location)                               |
| provincia              | string   | Sí          | Provincia (preferentemente homologada con el sistema de location)                            |
| localidad_id           | ObjectId | No          | ID de localidad (si se conoce, se recomienda mapear con location)                            |
| m2_terreno             | number   | No          | Metros cuadrados de terreno                                                                  |
| m2_construidos         | number   | Sí          | Metros cuadrados construidos                                                                 |
| m2_semicubiertos       | number   | No          | Metros cuadrados semicubiertos                                                               |
| precio_m2_construido   | number   | Sí          | Precio por metro cuadrado construido                                                         |
| precio_m2_semicubierto | number   | No          | Precio por metro cuadrado semicubierto (si no se provee, se calcula como 50% del construido) |
| precio_m2_lote         | number   | No          | Precio por metro cuadrado de lote                                                            |
| dormitorios            | number   | No          | Cantidad de dormitorios                                                                      |
| baños                  | number   | No          | Cantidad de baños                                                                            |
| quincho                | bool     | No          | ¿Tiene quincho? (true/false)                                                                 |
| garage                 | bool     | No          | ¿Tiene garage? (true/false)                                                                  |
| patio                  | bool     | No          | ¿Tiene patio? (true/false)                                                                   |
| antiguedad_anos        | number   | No          | Antigüedad de la propiedad en años                                                           |
| avance_construccion    | number   | No          | Porcentaje de avance de construcción (0-100)                                                 |
| estado_general         | enum     | Sí          | Estado general: EXCELENTE, MUY_BUENO, BUENO, REGULAR, MALO                                   |
| ubicacion              | string   | No          | Descripción de la ubicación                                                                  |
| moneda                 | string   | Sí          | Moneda de la tasación (ej: USD, ARS)                                                         |
| valor_transaccion      | number   | Sí          | Valor total de la tasación                                                                   |

- Los campos booleanos deben ser `true` o `false` (sin comillas).
- Los campos numéricos deben estar en formato decimal o entero, sin separadores de miles.
- Los campos opcionales pueden dejarse vacíos.
- El archivo debe estar en formato UTF-8 y separado por comas.

#### Ejemplo de archivo CSV válido

```csv
propietario,direccion,ciudad,provincia,localidad_id,m2_terreno,m2_construidos,m2_semicubiertos,precio_m2_construido,precio_m2_semicubierto,precio_m2_lote,dormitorios,baños,quincho,garage,patio,antiguedad_anos,avance_construccion,estado_general,ubicacion,moneda,valor_transaccion
Juan Perez,Calle Falsa 123,CABA,Buenos Aires,,200,150,30,1200,,300,3,2,true,true,true,10,100,EXCELENTE,Centro,USD,180000
,,Rosario,Santa Fe,,300,180,40,1000,500,250,4,3,false,true,true,5,100,BUENO,Sur,USD,220000
```

> Se recomienda validar los datos antes de la carga y homologar ciudad/provincia con el sistema de location para evitar rechazos automáticos.

---

### Cambios importantes en la gestión de parámetros de mercado (MarketParams)

- Ahora el sistema utiliza una **colección versionada** de parámetros de mercado (`MarketParams`).
- Cada vez que se actualizan los parámetros, se crea un nuevo documento con su propia `fecha_vigencia`.
- El endpoint de cálculo `/tasacion/calculate` acepta un campo opcional `fechaTasacion` (ISO string o Date). Si no se envía, se usa la fecha actual.
- El backend selecciona automáticamente la versión de parámetros vigente a la fecha de tasación.
- El resultado de la tasación incluye el `_id` y la `fecha_vigencia` de los MarketParams utilizados, para trazabilidad y reportes.

#### Ejemplo de request al endpoint de cálculo

```json
POST /tasacion/calculate
{
  "propertyId": "...",
  "comparableIds": ["...", "...", "..."],
  "fechaTasacion": "2025-10-01"
}
```

#### Ejemplo de respuesta relevante

```json
{
  "V_Mercado": 123456,
  "V_Costo": 120000,
  "V_T": 121728,
  "marketParams": {
    "_id": "6531f...",
    "fecha_vigencia": "2025-09-01T00:00:00.000Z",
    ...otros campos...
  },
  "fecha_tasacion": "2025-10-01T00:00:00.000Z"
}
```

- El frontend debe permitir seleccionar la fecha de tasación y mostrar en el reporte la versión de parámetros utilizada.
- La gestión de parámetros en `/admin/tasacion/parametros` debe crear siempre un nuevo registro, nunca editar el anterior.
- El historial de parámetros puede consultarse para transparencia y auditoría.

> Para dudas o mejoras, contactar al equipo de backend.
