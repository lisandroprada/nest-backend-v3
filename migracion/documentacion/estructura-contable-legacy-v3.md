# Estructura Contable Legacy → V3 (Documentación Técnica)

## Estructura Legacy: Modelo de 3 Niveles

### Nivel 1: MasterAccount (Cuenta Maestra)
Representa la **operación contable completa** (ej: Alquiler del mes).

```typescript
MasterAccount {
  _id: ObjectId,
  type: "Alquiler Devengado" | "Honorarios" | "Deposito en Garantía",
  origin: ObjectId,  // ID del LeaseAgreement (contrato)
  date: Date,
  dueDate: Date,
  amount: number,    // Monto total de la operación
  fee: number        // Comisión/honorarios
}
```

### Nivel 2: Accounts (Cuentas Individuales)
Cada MasterAccount se descompone en **2-3 Accounts** (una por cada actor involucrado).

```typescript
Account {
  _id: ObjectId,
  masterAccount: ObjectId,  // Referencia al MasterAccount
  accountType: "Debito" | "Credito",
  source: ObjectId,         // ID del agente (actor)
  target: ObjectId,         // ID del agente destino
  account: string,          // Nombre de la cuenta
  accountDescription: string,
  amount: number,           // Monto de esta cuenta específica
  totalBalance: number,     // Saldo pendiente
  collected: number         // Monto cobrado
}
```

**Ejemplo: Alquiler Devengado ($800k)**
```
MasterAccount (Alquiler - Nov 2025)
├── Account 1: DÉBITO  → Locatario   ($800k) - "Debe pagar"
├── Account 2: CRÉDITO → Locador     ($736k) - "Debe cobrar"
└── Account 3: CRÉDITO → Inmobiliaria ($64k) - "Debe cobrar (honorarios)"
```

### Nivel 3: AccountEntry (Movimientos/Pagos)
Cada pago/cobro impacta **UNA SOLA Account**.

```typescript
AccountEntry {
  _id: ObjectId,
  accountId: ObjectId,      // ID de la Account que impacta
  masterAccountId: ObjectId,
  accountType: "Debito" | "Credito",
  agentId: ObjectId,        // Agente al que impacta
  amount: number,           // Monto del pago
  date: Date,
  receiptId: ObjectId,      // Recibo asociado
  description: string
}
```

**Ejemplo: Pagos del Alquiler Nov 2025**
```
AccountEntry 1: Paga Account 1 (Débito Locatario)   → $800k
AccountEntry 2: Paga Account 2 (Crédito Locador)    → $736k
AccountEntry 3: Paga Account 3 (Crédito Inmobiliaria) → $64k
```

---

## Mapeo a V3

### 1 MasterAccount → 1 AccountingEntry

```typescript
AccountingEntry {
  _id: ObjectId,
  contrato_id: ObjectId,
  tipo_asiento: "Alquiler",
  fecha_imputacion: Date,
  partidas: [
    {
      agente_id: "Locatario",
      debe: 800000,
      haber: 0,
      monto_pagado_acumulado: 800000  // Suma de AccountEntries
    },
    {
      agente_id: "Locador",
      debe: 0,
      haber: 736000,
      monto_pagado_acumulado: 736000
    },
    {
      agente_id: "Inmobiliaria",
      debe: 0,
      haber: 64000,
      monto_pagado_acumulado: 64000
    }
  ]
}
```

---

## Reglas de Migración

### Script 04 (Vinculación):
- **Input:** Todas las `Accounts` (Débito + Crédito)
- **Output:** Vincula cada Account a su partida correspondiente en V3
- **Metadata:** Usa `legacy_account_ids_debito` y `legacy_account_ids_credito` separados

### Script 05 (Pagos):
- **Input:** Todos los `AccountEntry`
- **Matching:**
  1. Buscar asiento V3 usando `accountId` (vinculado en script 04)
  2. Dentro del asiento, buscar la partida correcta usando:
     - `accountType` → determina Debe/Haber
     - `agentId` → matchea con `partida.agente_id`
- **Acción:** Incrementar `monto_pagado_acumulado` **SOLO en esa partida**

### Regla Crítica:
**Cada AccountEntry impacta SOLO 1 partida**. La suma de todos los AccountEntries de una Account NO puede exceder el `amount` original de esa Account.

---

## Números Esperados (Ejemplo Real)

- **MasterAccounts:** ~35,000 (operaciones únicas)
- **Accounts:** ~70,000 (2-3 por MasterAccount)
- **AccountEntries:** ~57,000 (pagos/cobros individuales)
- **AccountingEntries V3:** ~47,000 (incluye proyecciones futuras FULL_HISTORY)
