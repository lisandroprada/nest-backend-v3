# Schemas Legacy

Documentación de los esquemas de datos del sistema Legacy.

## Colección: Agents

**Nombre de colección:** `agents`

### Campos

```typescript
interface LegacyAgent {
  _id: ObjectId;              // ID único del agente
  name?: string;              // Nombre del agente
  lastName?: string;          // Apellido del agente
  email?: string;             // Email (debe ser único)
  phone?: string;             // Teléfono de contacto
  address?: string;           // Dirección física
  createdAt?: Date;           // Fecha de creación
  updatedAt?: Date;           // Última actualización
  
  // TODO: Agregar otros campos según schema real
  // Revisar el modelo en sistema-be/models/Agent.js
}
```

### Índices

- `_id`: Índice primario (automático)
- `email`: Índice único (si aplica)

### Notas

- El campo `email` debe ser único, pero puede haber inconsistencias en Legacy
- Los nombres pueden estar en campos separados (`name`, `lastName`) o concatenados
- **CRÍTICO:** Preservar el `_id` original durante la migración

---

## Colección: Properties

**Nombre de colección:** `properties`

### Campos

```typescript
interface LegacyProperty {
  _id: ObjectId;              // ID único de la propiedad
  owner?: ObjectId;           // Referencia a Agent._id (propietario)
  agente_id?: ObjectId;       // Referencia alternativa a Agent._id
  address?: string;           // Dirección de la propiedad
  type?: string;              // Tipo (casa, departamento, etc.)
  // TODO: Agregar otros campos según schema real
}
```

### Referencias

- `owner` o `agente_id` → `Agent._id`

### Notas

- Verificar qué campo se usa para el propietario (`owner` vs `agente_id`)
- **CRÍTICO:** El propietario debe existir en la colección de Agentes

---

## Colección: Contracts

**Nombre de colección:** `contracts`

### Campos

```typescript
interface LegacyContract {
  _id: ObjectId;              // ID único del contrato
  propertyId?: ObjectId;      // Referencia a Property._id
  tenantId?: ObjectId;        // Referencia a Agent._id (inquilino)
  landLordId?: ObjectId;      // Referencia a Agent._id (propietario)
  guarantors?: ObjectId[];    // Referencias a Agent._id (garantes)
  
  startDate?: Date;           // Fecha de inicio (con offset -3h)
  endDate?: Date;             // Fecha de fin (con offset -3h)
  status?: string;            // Estado (Vigente, Finalizado, etc.)
  
  // TODO: Agregar otros campos según schema real
}
```

### Referencias

- `propertyId` → `Property._id`
- `tenantId` → `Agent._id`
- `landLordId` → `Agent._id`
- `guarantors[]` → `Agent._id`

### Notas

- **CRÍTICO - FECHAS:** Las fechas tienen un offset manual de `-3h` aplicado en Legacy
- Al migrar a V3, NO aplicar el offset. V3 maneja UTC puro
- Mapear estados: `Vigente` → `ACTIVE`, `Finalizado` → `COMPLETED`

---

## Colección: MasterAccount

**Nombre de colección:** `masteraccounts`

### Campos

```typescript
interface LegacyMasterAccount {
  _id: ObjectId;              // ID único de la cuenta maestra
  amount?: number;            // Monto total de la obligación
  description?: string;       // Descripción de la transacción
  origin?: ObjectId;          // Quien paga (Debe) - Referencia a Agent._id
  target?: ObjectId;          // Quien recibe (Haber) - Referencia a Agent._id
  
  createdAt?: Date;           // Fecha de creación
  contractId?: ObjectId;      // Referencia al contrato (si aplica)
  
  // TODO: Agregar otros campos según schema real
}
```

### Referencias

- `origin` → `Agent._id`
- `target` → `Agent._id`
- `contractId` → `Contract._id`

### Notas

- Representa la **obligación principal** (cabecera de transacción)
- Equivale a `Transaction Header` en V3
- El `_id` debe preservarse para vincular con `Account` y `AccountEntry`

---

## Colección: Account

**Nombre de colección:** `accounts`

### Campos

```typescript
interface LegacyAccount {
  _id: ObjectId;              // ID único de la sub-cuenta
  masterAccount?: ObjectId;   // Referencia a MasterAccount._id
  accountType?: string;       // Tipo: 'Debito' o 'Credito'
  amount?: number;            // Monto de esta partida
  description?: string;       // Concepto (Alquiler, Expensas, etc.)
  
  collected?: number;         // Monto cobrado/recaudado
  available?: number;         // Saldo disponible/pendiente
  
  // TODO: Agregar otros campos según schema real
}
```

### Referencias

- `masterAccount` → `MasterAccount._id`

### Notas

- Representa **partidas** o **line items** de una transacción
- `accountType = 'Debito'` → Deuda del inquilino
- `accountType = 'Credito'` → A favor del propietario
- `available` indica el saldo pendiente

---

## Colección: AccountEntry

**Nombre de colección:** `accountentries`

### Campos

```typescript
interface LegacyAccountEntry {
  _id: ObjectId;              // ID único del movimiento
  masterAccountId?: ObjectId; // Referencia a MasterAccount._id
  accountId?: ObjectId;       // Referencia a Account._id
  amount?: number;            // Monto del pago
  date?: Date;                // Fecha del pago (con offset -3h)
  paymentMethod?: string;     // Método de pago
  receiptId?: ObjectId;       // Referencia al recibo (si existe)
  
  // TODO: Agregar otros campos según schema real
}
```

### Referencias

- `masterAccountId` → `MasterAccount._id`
- `accountId` → `Account._id`
- `receiptId` → `Receipt._id` (si aplica)

### Notas

- Representa **pagos realizados** (movimientos de caja)
- Equivale a `Payments/Movements` en V3
- **CRÍTICO - FECHAS:** Tienen offset de `-3h`. Normalizar a UTC en V3

---

## Jerarquía de Datos Contables

```
MasterAccount (Obligación Principal)
└── Account (Partidas/Conceptos)
    └── AccountEntry (Pagos/Movimientos)
```

**Ejemplo:**

```
MasterAccount: Alquiler Noviembre 2024
├── Account: Alquiler ($100,000)
│   └── AccountEntry: Pago 10/11/2024 ($50,000)
│   └── AccountEntry: Pago 20/11/2024 ($50,000)
└── Account: Expensas ($20,000)
    └── AccountEntry: Pago 10/11/2024 ($20,000)
```

---

## Normalización de Fechas

**Problema:** Legacy aplica un offset manual de `-3h` al guardar fechas.

```javascript
// En Legacy (INCORRECTO para estándares)
const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
```

**Solución en V3:** 
- MongoDB devuelve fechas como objetos `Date` UTC
- No aplicar ninguna transformación manual
- Dejar que V3 maneje fechas en UTC estándar

```typescript
// En migración (CORRECTO)
const legacyDate = legacyDoc.date; // MongoDB ya lo devuelve como Date UTC
const v3Date = new Date(legacyDate); // Simplemente copiar
```

---

## TODO: Completar Documentación

Esta documentación es un template inicial. Debe completarse revisando los modelos reales en:

- `/Users/lisandropradatoledo/Documents/dev/Propietas-2025/sistema-be/models/`

**Próximos pasos:**
1. Revisar cada modelo de Mongoose en Legacy
2. Documentar todos los campos con sus tipos exactos
3. Identificar todos los índices y constraints
4. Mapear relaciones entre colecciones
5. Actualizar este documento con la información completa
