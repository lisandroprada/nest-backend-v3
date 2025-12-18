# Fase 5: Migración de Datos Contables

## Descripción

Esta es la **fase más compleja**. Inyecta la historia financiera y pagos reales dentro de la estructura creada en Fase 4, conciliando saldos Legacy con V3.

## Criticidad

🔴 **CRÍTICA** - Requiere reconstrucción precisa de la jerarquía contable de Legacy.

## Dependencias

- ✅ **Fase 4 completada** - Estructura contable inicializada

## Scripts

### 01-migrate-master-accounts.ts

**Propósito:** Migrar las obligaciones principales (MasterAccount) a Transaction Headers.

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-5-datos-contables/01-migrate-master-accounts.ts
```

---

### 02-migrate-accounts.ts

**Propósito:** Migrar las partidas (Account) a Line Items dentro de las transacciones.

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-5-datos-contables/02-migrate-accounts.ts
```

---

### 03-migrate-entries.ts

**Propósito:** Migrar los pagos (AccountEntry) a Movements/Payments.

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-5-datos-contables/03-migrate-entries.ts
```

---

### 04-validate-balances.ts

**Propósito:** Validar que los saldos Legacy coincidan con V3.

**Validaciones:**
- `Sum(Legacy.MasterAccount.amount)` ≈ `Sum(V3.Transactions.totalAmount)`
- Auditoría aleatoria de contratos
- Verificación de saldo 0 en cuentas pagadas

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-5-datos-contables/04-validate-balances.ts
```

---

## Jerarquía de Datos

### Legacy (3 niveles)

```
MasterAccount (Cabecera)
├── Account (Partida 1)
│   └── AccountEntry (Pago 1)
│   └── AccountEntry (Pago 2)
└── Account (Partida 2)
    └── AccountEntry (Pago 3)
```

### V3 (1 nivel con subdocumentos)

```
Transaction
├── partidas[] (Line Items)
│   ├── Partida 1
│   └── Partida 2
└── movimientos[] (Payments)
    ├── Pago 1
    ├── Pago 2
    └── Pago 3
```

---

## Mapeo de Equivalencias

| Concepto Legacy | Estructura Legacy | Equivalencia V3 | Lógica |
|:----------------|:------------------|:----------------|:-------|
| Obligación Principal | `MasterAccount` | `Transaction Header` | Operación padre (ej. Alquiler Nov) |
| Partes | `origin` / `target` | `Party Entries` | origin = Debe, target = Haber |
| Sub-cuentas | `Account` | `partidas[]` | Alquiler, Expensas, etc. |
| Pagos | `AccountEntry` | `movimientos[]` | Registros de caja |

---

## Algoritmo de Reconstrucción

```typescript
// 1. Obtener MasterAccounts de un contrato
const masterAccounts = await getLegacyMasterAccountsByContract(contractId);

for (const masterAccount of masterAccounts) {
  // 2. Buscar Transaction V3 (creada en Fase 4 o crear si es histórica)
  let v3Transaction = await findV3Transaction(masterAccount._id);
  
  if (!v3Transaction) {
    v3Transaction = createV3Transaction(masterAccount);
  }
  
  // 3. Buscar Accounts hijos
  const accounts = await getLegacyAccountsByMaster(masterAccount._id);
  
  for (const account of accounts) {
    // 4. Mapear a partida V3
    const partida = mapAccountToPartida(account);
    v3Transaction.partidas.push(partida);
    
    // 5. Buscar AccountEntries (pagos)
    const entries = await getLegacyEntriesByAccount(account._id);
    
    for (const entry of entries) {
      const movimiento = mapEntryToMovimiento(entry);
      v3Transaction.movimientos.push(movimiento);
    }
  }
  
  // 6. Actualizar saldos
  recalcularSaldos(v3Transaction);
  
  // 7. Guardar
  await saveV3Transaction(v3Transaction);
}
```

---

## Controles de Seguridad

### Idempotencia

Usar `updateOne` con `upsert: true` para evitar duplicados si el script se ejecuta múltiples veces.

```typescript
await v3Collection.updateOne(
  { _id: masterAccount._id },
  { $set: v3Transaction },
  { upsert: true }
);
```

### Casting de ObjectIds

Forzar `Types.ObjectId` en todas las referencias.

```typescript
const objectId = new Types.ObjectId(legacyId);
```

### Normalización de Fechas

Eliminar offset manual de Legacy.

```typescript
// ✅ CORRECTO
const v3Date = new Date(legacyEntry.date);

// ❌ INCORRECTO
const v3Date = new Date(legacyEntry.date.getTime() + 3 * 60 * 60 * 1000);
```

---

## Validación de Saldos

### Fórmula de Conciliación

```typescript
// Para cada Account Legacy
const saldoPendiente = account.available;
const saldoCobrado = account.collected;

// En V3 debe cumplirse:
const v3Partida = findPartida(account._id);
v3Partida.debe === account.amount;
v3Partida.monto_pagado_acumulado === account.collected;

// Si en Legacy está pagado (available === 0)
// En V3 debe tener: monto_pagado_acumulado === debe
```

### Auditoría Aleatoria

Seleccionar 10 contratos al azar y verificar manualmente:
1. Saldo total Legacy vs V3
2. Pagos individuales
3. Fechas de pagos

---

## Checklist

- [ ] Ejecutar `01-migrate-master-accounts.ts`
- [ ] Verificar que se crearon Transaction Headers
- [ ] Ejecutar `02-migrate-accounts.ts`
- [ ] Verificar que se agregaron partidas
- [ ] Ejecutar `03-migrate-entries.ts`
- [ ] Verificar que se agregaron movimientos
- [ ] Ejecutar `04-validate-balances.ts`
- [ ] Revisar discrepancias (si las hay)
- [ ] Realizar auditoría manual de 10 contratos
- [ ] ✅ Fase 5 completada - **Migración contable finalizada**

---

## Problemas Comunes

### Saldos no coinciden

**Causa posible:** Diferencia en cálculo de `collected` vs `monto_pagado_acumulado`

**Solución:** Revisar la lógica de recálculo de saldos. Asegurar que se aplica la misma fórmula que Legacy.

### Pagos duplicados

**Causa posible:** Script ejecutado múltiples veces sin idempotencia

**Solución:** Usar `upsert` con filtro por `_id` del pago original.

### Fechas incorrectas

**Causa posible:** No se eliminó el offset de `-3h`

**Solución:** Verificar que no se está aplicando transformación manual a las fechas. MongoDB ya devuelve UTC.
