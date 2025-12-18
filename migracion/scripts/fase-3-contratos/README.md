# Fase 3: Migración de Contratos

## Descripción

Esta fase migra los contratos (Lease Agreements) desde Legacy a V3.

## Criticidad

🟡 **ALTA** - Los contratos son la base para la estructura contable.

## Dependencias

- ✅ **Fase 1 completada** - Agentes (inquilinos, propietarios, garantes)
- ✅ **Fase 2 completada** - Propiedades

## Scripts

### 01-validate-dependencies.ts

**Propósito:** Verificar que todas las referencias existen (inquilinos, propietarios, propiedades, garantes).

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-3-contratos/01-validate-dependencies.ts
```

---

### 02-migrate-contracts.ts

**Propósito:** Migrar contratos de Legacy a V3.

**⚠️ CRÍTICO - FECHAS:** Las fechas Legacy tienen offset de `-3h`. V3 usa UTC puro.

**Opciones:**
```bash
# Dry-run
npx ts-node migracion/scripts/fase-3-contratos/02-migrate-contracts.ts --dry-run

# Migración normal
npx ts-node migracion/scripts/fase-3-contratos/02-migrate-contracts.ts

# Truncar primero
npx ts-node migracion/scripts/fase-3-contratos/02-migrate-contracts.ts --truncate
```

---

### 03-validate-contracts.ts

**Propósito:** Validar que la migración fue exitosa.

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-3-contratos/03-validate-contracts.ts
```

---

## Mapeo de Campos

| Campo Legacy | Campo V3 | Transformación |
|:-------------|:---------|:---------------|
| `_id` | `_id` | **Preservar** |
| `propertyId` | `propiedad_id` | Verificar existencia |
| `tenantId` | `locatario_id` | Verificar existencia |
| `landLordId` | `locador_id` | Verificar existencia |
| `guarantors[]` | `garantes[]` | Verificar existencia |
| `startDate` | `fecha_inicio` | **Normalizar a UTC** (sin offset) |
| `endDate` | `fecha_fin` | **Normalizar a UTC** (sin offset) |
| `Vigente` | `ACTIVE` | Mapeo de estado |
| `Finalizado` | `COMPLETED` | Mapeo de estado |

---

## Normalización de Fechas

**⚠️ CRÍTICO:** Legacy guarda fechas con offset manual de `-3h`.

```typescript
// ❌ Legacy (INCORRECTO)
const date = new Date(Date.now() - 3 * 60 * 60 * 1000);

// ✅ V3 (CORRECTO)
const date = new Date(); // UTC puro, sin manipulación
```

**En la migración:**
```typescript
// MongoDB devuelve Date UTC automáticamente
const legacyDate = legacyContract.startDate; // Ya es Date UTC
const v3Date = new Date(legacyDate); // Simplemente copiar
```

---

## Checklist

- [ ] Ejecutar `01-validate-dependencies.ts`
- [ ] Corregir referencias huérfanas (si las hay)
- [ ] Ejecutar `02-migrate-contracts.ts --dry-run`
- [ ] Verificar normalización de fechas en dry-run
- [ ] Ejecutar `02-migrate-contracts.ts`
- [ ] Ejecutar `03-validate-contracts.ts`
- [ ] ✅ Fase 3 completada - **Puede proceder a Fase 4**
