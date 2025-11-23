# Chart of Accounts (Plan de Cuentas)

## Descripción General

El módulo **Chart of Accounts** gestiona el plan de cuentas contables del sistema, permitiendo la creación, consulta, actualización y eliminación de cuentas contables organizadas jerárquicamente.

## Entidad Principal: `ChartOfAccount`

### Campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `codigo` | String | Código único de la cuenta (ej: "1.1.01") - **Requerido, Único, Indexado** |
| `nombre` | String | Nombre descriptivo de la cuenta - **Requerido** |
| `tipo_cuenta` | Enum | Tipo de cuenta contable - **Requerido, Indexado** |
| `descripcion` | String | Descripción adicional de la cuenta |
| `cuenta_padre_id` | ObjectId | Referencia a cuenta padre (estructura jerárquica) |
| `es_imputable` | Boolean | Indica si se pueden registrar asientos en esta cuenta (default: `true`) |
| `tasa_iva_aplicable` | Number | Tasa de IVA aplicable (default: `0`) |
| `es_facturable` | Boolean | Indica si la cuenta es facturable (default: `false`) |
| `usuario_creacion_id` | ObjectId | Usuario que creó la cuenta |
| `usuario_modificacion_id` | ObjectId | Usuario que modificó la cuenta |

### Tipos de Cuenta (`tipo_cuenta`)

- `ACTIVO` - Bienes y derechos de la empresa
- `PASIVO` - Obligaciones y deudas
- `PATRIMONIO_NETO` - Capital y resultados
- `INGRESO` - Ingresos y ganancias
- `EGRESO` - Gastos y pérdidas

## Funcionalidades

### Endpoints REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/chart-of-accounts` | Crear nueva cuenta contable |
| `GET` | `/chart-of-accounts` | Listar todas las cuentas |
| `GET` | `/chart-of-accounts/:id` | Obtener cuenta por ID |
| `PATCH` | `/chart-of-accounts/:id` | Actualizar cuenta |
| `DELETE` | `/chart-of-accounts/:id` | Eliminar cuenta |

### Métodos del Servicio

#### CRUD Básico
- `create(createDto)` - Crear cuenta
- `findAll()` - Listar todas las cuentas
- `findOne(id)` - Buscar por ID
- `update(id, updateDto)` - Actualizar cuenta
- `remove(id)` - Eliminar cuenta

#### Métodos Especializados
- `getAccountIdsByCode(codes[])` - Obtener ObjectIds de cuentas por sus códigos
  - Valida que todas las cuentas existan
  - Retorna un mapa `{ codigo: ObjectId }`
  - Útil para asignación masiva de cuentas

- `find(filter, session?)` - Búsqueda con filtros personalizados
  - Soporta transacciones MongoDB

## Estructura Jerárquica

Las cuentas pueden organizarse en una estructura de árbol mediante el campo `cuenta_padre_id`:

```
1. ACTIVO (padre)
  ├─ 1.1 Activo Corriente (hijo)
  │   ├─ 1.1.01 Caja (nieto)
  │   └─ 1.1.02 Banco (nieto)
  └─ 1.2 Activo No Corriente (hijo)
```

## Características Especiales

### Cuentas Imputables
- `es_imputable: true` → Permite registrar asientos contables
- `es_imputable: false` → Solo agrupa otras cuentas (cuentas de resumen)

### Integración con IVA
- Campo `tasa_iva_aplicable` permite configurar la tasa de IVA por cuenta
- Útil para cálculos automáticos en facturación

### Facturación
- Campo `es_facturable` identifica cuentas que pueden aparecer en facturas

## Validaciones

- **Código único**: No pueden existir dos cuentas con el mismo código
- **Tipo de cuenta**: Debe ser uno de los 5 tipos definidos
- **Búsqueda por ID**: Lanza `NotFoundException` si no existe

## Archivos del Módulo

```
src/modules/chart-of-accounts/
├── chart-of-accounts.controller.ts    # Controlador REST
├── chart-of-accounts.service.ts       # Lógica de negocio
├── chart-of-accounts.module.ts        # Módulo NestJS
├── entities/
│   └── chart-of-account.entity.ts     # Schema Mongoose
└── dto/
    ├── create-chart-of-account.dto.ts # DTO creación
    └── update-chart-of-account.dto.ts # DTO actualización
```

## Uso Típico

### Crear Cuenta
```typescript
POST /chart-of-accounts
{
  "codigo": "1.1.01",
  "nombre": "Caja",
  "tipo_cuenta": "ACTIVO",
  "descripcion": "Efectivo en caja",
  "cuenta_padre_id": "66a25a8e1f1570568e03e1d8",
  "es_imputable": true,
  "tasa_iva_aplicable": 0,
  "es_facturable": false
}
```

### Obtener IDs por Códigos
```typescript
const accountIds = await chartOfAccountsService.getAccountIdsByCode([
  'CXC_ALQ',       // Cuentas por Cobrar - Alquileres
  'CXP_LOC',       // Cuentas por Pagar - Locador
  'ING_HNR',       // Ingresos por Honorarios
  'CXC_SERVICIOS', // Cuentas por Cobrar - Servicios
  'CXP_SERVICIOS'  // Cuentas por Pagar - Servicios
]);
// Retorna: { 'CXC_ALQ': ObjectId(...), 'CXC_SERVICIOS': ObjectId(...), ... }
```

### Cuentas Estándar del Sistema

El sistema utiliza las siguientes cuentas predefinidas:

#### Cuentas de Alquileres
- `CXC_ALQ` - Cuentas por Cobrar - Alquileres (ACTIVO)
- `CXP_LOC` - Cuentas por Pagar - Locador (PASIVO)
- `ING_HNR` - Ingresos por Honorarios (INGRESO)

#### Cuentas de Servicios Públicos
- `CXC_SERVICIOS` - Cuentas por Cobrar - Servicios (ACTIVO)
  - Registra los servicios públicos e impuestos a cobrar a propietarios/locatarios
- `CXP_SERVICIOS` - Cuentas por Pagar - Servicios (PASIVO)
  - Registra los servicios públicos e impuestos a pagar a proveedores

> **Nota**: Estas cuentas deben crearse manualmente a través de la interfaz de administración antes de procesar facturas de servicios.

## Relaciones con Otros Módulos

- **Accounting Entries**: Las cuentas se usan en asientos contables
- **Invoices**: Cuentas facturables se vinculan con facturación
- **Users**: Auditoría de creación/modificación

## Índices de Base de Datos

- `codigo` - Único e indexado para búsquedas rápidas
- `tipo_cuenta` - Indexado para filtrado por tipo
