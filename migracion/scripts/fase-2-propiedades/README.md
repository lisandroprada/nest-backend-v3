# Fase 2: Migración de Propiedades

## Descripción

Esta fase migra la colección `Properties` desde Legacy a V3.

## Criticidad

🟡 **ALTA** - Las propiedades son referenciadas por contratos y datos contables.

## Dependencias

- ✅ **Fase 1 completada** - Todos los agentes deben estar migrados (propietarios)

## Scripts

### 01-validate-dependencies.ts

**Propósito:** Verificar que todos los propietarios existen en V3.

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-2-propiedades/01-validate-dependencies.ts
```

---

### 02-migrate-properties.ts

**Propósito:** Migrar propiedades de Legacy a V3.

**Opciones:**
```bash
# Dry-run
npx ts-node migracion/scripts/fase-2-propiedades/02-migrate-properties.ts --dry-run

# Migración normal
npx ts-node migracion/scripts/fase-2-propiedades/02-migrate-properties.ts

# Truncar primero
npx ts-node migracion/scripts/fase-2-propiedades/02-migrate-properties.ts --truncate
```

---

### 03-validate-properties.ts

**Propósito:** Validar que la migración fue exitosa.

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-2-propiedades/03-validate-properties.ts
```

---

## Mapeo de Campos

| Campo Legacy | Campo V3 | Notas |
|:-------------|:---------|:------|
| `_id` | `_id` | **Preservar** |
| `owner` / `agente_id` | `propietario_id` | Debe existir en Agents V3 |
| `address` | `direccion` | Texto plano |
| `type` | `tipo_propiedad` | Casa, Departamento, etc. |

---

## Checklist

- [ ] Ejecutar `01-validate-dependencies.ts`
- [ ] Corregir propietarios huérfanos (si los hay)
- [ ] Ejecutar `02-migrate-properties.ts --dry-run`
- [ ] Ejecutar `02-migrate-properties.ts`
- [ ] Ejecutar `03-validate-properties.ts`
- [ ] ✅ Fase 2 completada - **Puede proceder a Fase 3**
