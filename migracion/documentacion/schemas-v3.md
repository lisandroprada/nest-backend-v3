# Schemas V3

Documentación de los esquemas de datos del sistema V3 (NestJS).

## Colección: Agents

**Nombre de colección:** `agents`

**Ruta del Schema:** `/src/modules/agents/schemas/agent.schema.ts`

### Campos

```typescript
interface V3Agent {
  _id: ObjectId;                    // ID único del agente
  nombres?: string;                 // Nombres del agente
  apellidos?: string;               // Apellidos del agente
  nombre_razon_social?: string;     // Nombre completo o razón social
  email?: string;                   // Email único
  telefono?: string;                // Teléfono normalizado
  direccion?: string;               // Dirección física
  tipo_agente?: string[];           // Array: ['LOCADOR', 'LOCATARIO', 'GARANTE', etc.]
  
  // Campos adicionales
  tipo_persona?: 'FISICA' | 'JURIDICA';
  cuit_cuil?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
  
  // TODO: Completar con campos reales del schema de V3
}
```

### Índices

- `_id`: Índice primario (automático)
- `email`: Índice único
- `tipo_agente`: Índice para búsquedas por rol

### Notas

- El campo `tipo_agente` es un array que permite múltiples roles
- `nombre_razon_social` es el campo principal para búsquedas
- **MIGRACIÓN:** El `_id` debe preservarse desde Legacy

---

## Colección: Properties

**Nombre de colección:** `properties`

**Ruta del Schema:** `/src/modules/properties/schemas/property.schema.ts`

### Campos

```typescript
interface V3Property {
  _id: ObjectId;                    // ID único de la propiedad
  propietario_id?: ObjectId;        // Referencia a Agent._id
  direccion?: string;               // Dirección completa
  localidad?: string;               // Ciudad/Localidad
  provincia?: string;               // Provincia
  pais?: string;                    // País
  
  // Geolocalización
  coordenadas?: {
    lat: number;
    lng: number;
  };
  placeId?: string;                 // Google Maps Place ID
  
  // Características
  tipo_propiedad?: string;          // Casa, Departamento, etc.
  superficie?: number;
  ambientes?: number;
  caracteristicas?: {
    amenities?: ObjectId[];         // Referencias a Amenity collection
  };
  
  createdAt?: Date;
  updatedAt?: Date;
  
  // TODO: Completar con campos reales del schema de V3
}
```

### Referencias

- `propietario_id` → `Agent._id`
- `caracteristicas.amenities[]` → `Amenity._id`

### Notas

- V3 usa geolocalización avanzada con Google Maps
- Si Legacy no tiene coordenadas, marcar como "Pendiente de Geolocalización"
- **MIGRACIÓN:** Preservar el `_id` original

---

## Colección: LeaseAgreements (Contratos)

**Nombre de colección:** `leaseagreements`

**Ruta del Schema:** `/src/modules/contracts/schemas/lease-agreement.schema.ts`

### Campos

```typescript
interface V3LeaseAgreement {
  _id: ObjectId;                    // ID único del contrato
  propiedad_id?: ObjectId;          // Referencia a Property._id
  locador_id?: ObjectId;            // Referencia a Agent._id (propietario)
  locatario_id?: ObjectId;          // Referencia a Agent._id (inquilino)
  garantes?: ObjectId[];            // Referencias a Agent._id
  
  // Fechas (UTC puro, sin offsets manuales)
  fecha_inicio?: Date;
  fecha_fin?: Date;
  
  // Estados
  estado?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PENDING';
  
  // Términos financieros
  monto_alquiler?: number;
  dia_vencimiento?: number;         // Día del mes para vencimiento
  
  createdAt?: Date;
  updatedAt?: Date;
  
  // TODO: Completar con campos reales del schema de V3
}
```

### Referencias

- `propiedad_id` → `Property._id`
- `locador_id` → `Agent._id`
- `locatario_id` → `Agent._id`
- `garantes[]` → `Agent._id`

### Notas

- **CRÍTICO:** Las fechas se guardan en UTC puro (sin offset manual)
- Estados mapeados: Legacy `Vigente` → V3 `ACTIVE`
- **MIGRACIÓN:** Preservar el `_id` original del contrato

---

## Colección: Transactions (Asientos Contables)

**Nombre de colección:** `transactions` o `asientoscontables`

**Ruta del Schema:** `/src/modules/accounting/schemas/...`

### Campos (Transaction Header)

```typescript
interface V3Transaction {
  _id: ObjectId;                    // ID único del asiento
  contrato_id?: ObjectId;           // Referencia a LeaseAgreement._id
  tipo?: string;                    // Tipo de transacción
  concepto?: string;                // Descripción
  monto_total?: number;             // Monto total del asiento
  
  fecha?: Date;                     // Fecha del asiento (UTC)
  periodo?: {
    mes: number;
    anio: number;
  };
  
  // Partidas (Line Items)
  partidas?: Array<{
    cuenta_id?: ObjectId;           // Referencia al plan de cuentas
    agente_id?: ObjectId;           // Agente relacionado con esta partida
    descripcion?: string;
    debe?: number;
    haber?: number;
    monto_pagado_acumulado?: number;
    monto_liquidado?: number;
  }>;
  
  // Movimientos/Pagos
  movimientos?: Array<{
    fecha?: Date;
    monto?: number;
    metodo_pago?: string;
    recibo_id?: ObjectId;
  }>;
  
  createdAt?: Date;
  updatedAt?: Date;
  
  // TODO: Completar con estructura real de V3
}
```

### Referencias

- `contrato_id` → `LeaseAgreement._id`
- `partidas[].agente_id` → `Agent._id`
- `partidas[].cuenta_id` → `ChartOfAccounts._id`
- `movimientos[].recibo_id` → `Receipt._id`

### Notas

- **V3 centraliza** la información que Legacy tiene fragmentada en 3 colecciones
- El `Transaction Header` contiene las partidas y movimientos anidados
- **MIGRACIÓN:** Se debe reconstruir desde `MasterAccount` + `Account` + `AccountEntry`

---

## Mapeo Legacy → V3 (Contable)

### Estructura de Mapeo

```
Legacy MasterAccount
  └─> V3 Transaction (Header)
       ├─> Legacy Account
       │    └─> V3 Transaction.partidas[] (Line Items)
       └─> Legacy AccountEntry
            └─> V3 Transaction.movimientos[] (Payments)
```

### Ejemplo de Transformación

**Legacy:**
```javascript
// MasterAccount
{
  _id: "123",
  amount: 120000,
  description: "Alquiler Noviembre"
}

// Account #1
{
  _id: "456",
  masterAccount: "123",
  accountType: "Debito",
  amount: 100000,
  description: "Alquiler",
  collected: 100000,
  available: 0
}

// Account #2
{
  _id: "789",
  masterAccount: "123",
  accountType: "Debito",
  amount: 20000,
  description: "Expensas",
  collected: 20000,
  available: 0
}

// AccountEntry
{
  _id: "abc",
  masterAccountId: "123",
  accountId: "456",
  amount: 100000,
  date: "2024-11-10"
}
```

**V3:**
```javascript
{
  _id: "123",  // Preservado
  monto_total: 120000,
  concepto: "Alquiler Noviembre",
  partidas: [
    {
      descripcion: "Alquiler",
      debe: 100000,
      haber: 0,
      monto_pagado_acumulado: 100000
    },
    {
      descripcion: "Expensas",
      debe: 20000,
      haber: 0,
      monto_pagado_acumulado: 20000
    }
  ],
  movimientos: [
    {
      fecha: "2024-11-10T00:00:00Z",  // UTC normalizado
      monto: 100000
    }
  ]
}
```

---

## Diferencias Clave Legacy vs V3

### Fechas
- **Legacy:** Offset manual de `-3h` aplicado
- **V3:** UTC puro, sin manipulación manual

### Emails
- **Legacy:** Pueden tener espacios, mayúsculas
- **V3:** Normalizados (trim + toLowerCase)

### Estructura Contable
- **Legacy:** 3 colecciones separadas (MasterAccount, Account, AccountEntry)
- **V3:** 1 colección unificada (Transactions) con subdocumentos anidados

### Estados de Contratos
- **Legacy:** Strings libres (`Vigente`, `Finalizado`)
- **V3:** Enums estrictos (`ACTIVE`, `COMPLETED`, `CANCELLED`, `PENDING`)

### Tipos de Agentes
- **Legacy:** Campo único o varios campos booleanos
- **V3:** Array de strings (`tipo_agente: ['LOCADOR', 'LOCATARIO']`)

---

## TODO: Completar Documentación

Esta documentación es un template inicial. Debe completarse revisando los schemas reales en:

- `/Users/lisandropradatoledo/Documents/dev/Propietas-2025/nest-backend-v3/src/modules/`

**Próximos pasos:**
1. Revisar cada schema de NestJS en V3
2. Documentar todos los campos con sus tipos exactos
3. Identificar todos los índices y decoradores
4. Mapear las transformaciones necesarias desde Legacy
5. Actualizar este documento con la información completa
