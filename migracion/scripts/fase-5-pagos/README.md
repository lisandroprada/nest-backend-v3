# Migración Fase 5: Ecosistema Financiero V3

## Nueva Estrategia: 2 Subfases Independientes

Esta fase se divide en dos subfases que pueden ejecutarse en momentos diferentes:

### **Fase 5A: Migración de Recibos** (✅ Ejecutable AHORA)
Migra todos los recibos legacy (~25,913) como documentos independientes en V3, preservando el `_id` original.  
**NO requiere** que existan contratos o asientos contables.

### **Fase 5B: Vinculación de Movimientos** (Después de Fases 3-4)
Vincula los `receiptEntries` a asientos contables, actualiza montos pagados y crea Transactions.  
**Requiere** que contratos y asientos contables ya estén migrados.

---

## Arquitectura

### Recibo Legacy
```json
{
  "_id": "608f50b15a21c05b6c80418d",
  "date": "2021-05-03",
  "amount": -62560,
  "agentId": "60704ac812718ddc16521406",
  "receiptEntries": [
    {
      "_id": "608f49e25a21c05b6c803982",
      "account": "Deposito en Garantía",
      "amount": 23000,
      "origin": "608f49e25a21c05b6c80395a" // contract_id
    },
    // ... más entries
  ]
}
```

### Recibo V3 (Después de Fase 5A)
```json
{
  "_id": "608f50b15a21c05b6c80418d", // ✅ ID preservado
  "numero_recibo": 1,
  "fecha_emision": "2021-05-03",
  "monto_total": 62560,
  "metodo_pago": "efectivo",
  "asientos_afectados": [], // ⚠️ Vacío (se llenará en 5B)
  "_legacy_data": {
    "receiptEntries": [...] // Guardado para Fase 5B
  }
}
```

### Recibo V3 (Después de Fase 5B)
```json
{
  "_id": "608f50b15a21c05b6c80418d",
  "numero_recibo": 1,
  "asientos_afectados": [ // ✅ Vinculado
    {
      "asiento_id": "...",
      "monto_imputado": 23000,
      "tipo_operacion": "COBRO"
    }
  ]
  // _legacy_data eliminado
}
```

---

## Scripts Disponibles

### 00-reset-migration.ts
Limpia migración anterior (elimina Receipts, Transactions, resetea asientos).

```bash
npx ts-node 00-reset-migration.ts
```

### 01-migrate-receipts.ts (Fase 5A)
Migra todos los recibos legacy a V3.

```bash
npx ts-node 01-migrate-receipts.ts
```

**Características:**
- Procesa en lotes de 1,000 recibos
- Preserva `_id` original
- Guarda metadata `_legacy_data` para Fase 5B
- Tiempo estimado: ~30 minutos para 25,913 recibos

### 02-link-accounting-entries.ts (Fase 5B)
**🚧 Por implementar**  
Vincula receiptEntries a asientos contables.

**Prerequisitos:**
- Fase 3: Contratos migrados
- Fase 4: Asientos contables generados

### 03-validate-migration.ts
Valida consistencia post-migración.

```bash
npx ts-node 03-validate-migration.ts
```

### 04-generate-inconsistency-report.ts
**🚧 Por implementar**  
Genera reporte de recibos con problemas de vinculación.

---

## Flujo de Ejecución

### Ahora (Fase 5A)
```bash
cd migracion/scripts/fase-5-pagos

# 1. Reset (si necesario)
npx ts-node 00-reset-migration.ts

# 2. Migrar recibos
npx ts-node 01-migrate-receipts.ts

# 3. Verificar
mongosh nest-propietasV3 --eval "
  print('Receipts migrados:', db.receipts.countDocuments());
  print('Con _legacy_data:', db.receipts.countDocuments({_legacy_data: {\$exists: true}}));
"
```

**Resultado esperado:**
- Receipts migrados: 25,913
- Con _legacy_data: 25,913
- Con asientos_afectados vacíos: 25,913

### Después (Fase 5B)
```bash
# 1. Verificar prerequisitos
mongosh nest-propietasV3 --eval "
  print('Contratos:', db.contracts.countDocuments());
  print('Asientos:', db.accountingentries.countDocuments());
"

# 2. Vincular entries
npx ts-node 02-link-accounting-entries.ts

# 3. Generar reporte de inconsistencias
npx ts-node 04-generate-inconsistency-report.ts

# 4. Validar
npx ts-node 03-validate-migration.ts
```

---

## Validaciones

### Post Fase 5A
- ✅ Total receipts = 25,913
- ✅ Todos tienen `_id` preservado
- ✅ Todos tienen `_legacy_data`
- ✅ Todos tienen `asientos_afectados` vacío

### Post Fase 5B
- ✅ No quedan `_legacy_data`
- ✅ Transactions creadas
- ✅ Regla de oro: `Receipt.monto_total ≥ Σ(asientos_afectados.monto_imputado)`
- ✅ Estados de asientos actualizados

---

## Ventajas de la Nueva Estrategia

1. **Independencia:** Fase 5A ejecutable sin contratos/asientos
2. **Trazabilidad:** IDs preservados permiten mapeo perfecto
3. **Progreso incremental:** Ejecutar ahora, vincular después
4. **Rollback simple:** Cada fase es reversible

---

## Troubleshooting

### Error: "No se encontró cuenta financiera activa"
```bash
# Verificar cuentas financieras
mongosh nest-propietasV3 --eval "db.financialaccounts.find({status: 'ACTIVA'})"
```

### Receipts duplicados
El script verifica automáticamente duplicados y los omite.

### Re-ejecutar migración
Si la migración se interrumpe, puede re-ejecutarse. Los recibos ya migrados se omitirán automáticamente.

---

## Logs

Cada ejecución genera un log en:
```
logs/migrate-receipts-YYYY-MM-DDTHH-mm-ss-sssZ.log
```

Consultar logs para detalles de errores y progreso.
