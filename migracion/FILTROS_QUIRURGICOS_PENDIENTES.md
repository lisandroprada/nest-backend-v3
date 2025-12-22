# 🚨 CORRECCIÓN URGENTE: Remover Filtros Quirúrgicos

## Scripts con Filtros Quirúrgicos Detectados:

1. ✅ `fase-3-contratos/02-migrate-contracts.ts` - **CORREGIDO**
2. ⚠️ `fase-4-asientos/02-generate-accounting-entries.ts`
3. ⚠️ `fase-4.5-asientos-adhoc/03-migrate-adhoc-surgical.ts` (MANTENER - Es quirúrgico por diseño)
4. ⚠️ `fase-4.6-vinculacion-contractual/04-link-contractual-entries.ts`
5. ⚠️ `fase-5-pagos/01-migrate-receipts.ts`
6. ⚠️ `fase-5-pagos/05-migrate-payments.ts`
7. ⚠️ `fase-5-pagos/07-link-receipts-impact.ts`
8. ⚠️ `fase-6-verificacion/06-verify-accounting-migration.ts`

## Acción Requerida:

### Scripts que DEBEN corregirse (migración masiva):

```bash
# 1. fase-4-asientos/02-generate-accounting-entries.ts
# Línea 31: Comentar TARGET_CONTRACT_ID y usar query vacío

# 2. fase-4.6-vinculacion-contractual/04-link-contractual-entries.ts
# Línea 43: Comentar TARGET_CONTRACT_ID y usar query vacío

# 3. fase-5-pagos/01-migrate-receipts.ts
# Línea 152: Comentar TARGET_CONTRACT_ID y usar query vacío

# 4. fase-5-pagos/05-migrate-payments.ts
# Línea 44: Comentar TARGET_CONTRACT_ID y usar query vacío

# 5. fase-5-pagos/07-link-receipts-impact.ts
# Línea 41: Comentar TARGET_CONTRACT_ID y usar query vacío

# 6. fase-6-verificacion/06-verify-accounting-migration.ts
# Línea 27: Comentar TARGET_CONTRACT_ID y usar query vacío
```

### Scripts que DEBEN MANTENERSE quirúrgicos:

```bash
# fase-4.5-asientos-adhoc/03-migrate-adhoc-surgical.ts
# Este script ES quirúrgico por diseño (gastos ad-hoc específicos)
# MANTENER el filtro
```

## Patrón de Corrección:

**ANTES:**
```typescript
const TARGET_CONTRACT_ID = '6902560abbb2614a30d9d131';
const query = { contrato_id: new ObjectId(TARGET_CONTRACT_ID) };
```

**DESPUÉS:**
```typescript
// FILTRO QUIRÚRGICO (COMENTADO - Para migración masiva usar query vacío)
// const TARGET_CONTRACT_ID = '6902560abbb2614a30d9d131';
// const query = { contrato_id: new ObjectId(TARGET_CONTRACT_ID) };

// Migración masiva: todos los registros
const query = {};
```

## Estado Actual:

- ✅ **fase-3-contratos/02-migrate-contracts.ts** - CORREGIDO
- ⚠️ **6 scripts pendientes** de corrección
- ✅ **1 script quirúrgico** (mantener como está)

## Próximos Pasos:

1. Corregir los 6 scripts restantes
2. Commit con mensaje: "fix: remove surgical filters from mass migration scripts"
3. Actualizar GUIA_MIGRACION_DEFINITIVA.md con advertencia
4. Re-ejecutar migración completa

---

**Fecha:** 22 de diciembre de 2025  
**Criticidad:** 🔴 ALTA - Bloquea migración masiva
