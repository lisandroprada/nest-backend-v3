# 🔍 Auditoría de Scripts - Análisis Completo

> **Fecha:** 22 de diciembre de 2025  
> **Problema:** Dos carpetas de scripts con posible duplicación

---

## 📊 Hallazgos Críticos

### 🚨 PROBLEMA: Duplicación de Carpetas

Existen **DOS carpetas de scripts** en el proyecto:

1. **`/scripts/`** (raíz del proyecto)
   - **49 archivos** (mix de .ts, .js, .sh, .json)
   - Propósito: Scripts de desarrollo, testing, y migraciones ad-hoc
   - Estado: **MEZCLADO** - Scripts de migración + scripts de desarrollo

2. **`/migracion/scripts/`** (carpeta de migración)
   - **27 archivos .ts** organizados por fases
   - Propósito: Scripts de migración estructurados
   - Estado: **ORGANIZADO** - Estructura clara por fases

---

## 🔴 Scripts Duplicados Identificados

### Migración de Agentes

| `/scripts/` | `/migracion/scripts/fase-1-agentes/` | ¿Duplicado? |
|-------------|--------------------------------------|-------------|
| `migrate-agents.js` | `02-migrate-agents.ts` | ✅ SÍ |
| `migrate-agents-improved.js` | `02-migrate-agents.ts` | ✅ SÍ (versión mejorada) |

### Migración de Propiedades

| `/scripts/` | `/migracion/scripts/fase-2-propiedades/` | ¿Duplicado? |
|-------------|------------------------------------------|-------------|
| `migrate-properties.js` | `01-migrate-properties.ts` | ✅ SÍ |
| `migrate-properties-simple.js` | `01-migrate-properties.ts` | ✅ SÍ (versión simple) |

---

## 📁 Análisis por Carpeta

### `/scripts/` (Raíz) - 49 archivos

#### Categorías:

**1. Migración (DUPLICADOS - 4 archivos)**
- ❌ `migrate-agents.js` → Duplicado de `/migracion/scripts/fase-1-agentes/02-migrate-agents.ts`
- ❌ `migrate-agents-improved.js` → Versión obsoleta
- ❌ `migrate-properties.js` → Duplicado de `/migracion/scripts/fase-2-propiedades/01-migrate-properties.ts`
- ❌ `migrate-properties-simple.js` → Versión obsoleta

**2. Testing (MANTENER - 11 archivos)**
- ✅ `test-accounting-api.sh`
- ✅ `test-calculate-payments.sh`
- ✅ `test-contract-settings.sh`
- ✅ `test-estado-cuenta-endpoint.sh`
- ✅ `test-fase-3.sh`
- ✅ `test-honorarios-calculation.sh`
- ✅ `test-mixed-receipts.sh`
- ✅ `test-payment-calculation.js`
- ✅ `test-payment-flow.sh`
- ✅ `test-rescision.sh`
- ✅ `test-system-admin.sh`

**3. Seeding (MANTENER - 8 archivos)**
- ✅ `seed-contract-settings.ts`
- ✅ `seed-financial-accounts.json`
- ✅ `seed-financial-accounts.sh`
- ✅ `seed-service-account-mappings.ts`
- ✅ `seed-service-providers.json`
- ✅ `seed-service-providers.sh`
- ✅ `seed-system-config.ts`
- ✅ `reset-and-seed-dev-db.ts`

**4. Utilidades de Desarrollo (MANTENER - 8 archivos)**
- ✅ `check-indexes.js`
- ✅ `check-messages.js`
- ✅ `check-property-identifiers.ts`
- ✅ `check-recent-communications.ts`
- ✅ `check-service-communications.ts`
- ✅ `verify-cuit-fields.sh`
- ✅ `verify-fix.ts`
- ✅ `verify-sync.js`

**5. Limpieza de Datos (MANTENER - 7 archivos)**
- ✅ `analyze-duplicates.js`
- ✅ `clean-and-rescan-services.ts`
- ✅ `clean-duplicate-messages.ts`
- ✅ `clean-duplicates.js`
- ✅ `cleanup-now.js`
- ✅ `find-duplicates.js`
- ✅ `reset-email-sync.js`

**6. Procesamiento (MANTENER - 3 archivos)**
- ✅ `process-entries.ts`
- ✅ `trigger-processing.ts`
- ✅ `run-with-imap.sh`

**7. Otros (REVISAR - 3 archivos)**
- ⚠️ `create-migration-accounts.js` → Posible duplicado de lógica en `/migracion/`
- ⚠️ `backfill-honorarios-inmobiliaria.js` → Posible one-time script
- ⚠️ `map-agent-locations.js` → Posible one-time script

**8. READMEs (MANTENER - 5 archivos)**
- ✅ `README.md`
- ✅ `README-migrate-agents.md`
- ✅ `README_SEED_CONTRACT_SETTINGS.md`
- ✅ `README_SEED_SERVICE_PROVIDERS.md`
- ✅ `README_TEST_RESCISION.md`

---

### `/migracion/scripts/` - 27 archivos

#### Estructura por Fases (MANTENER TODO):

| Fase | Scripts | Estado |
|------|---------|--------|
| **fase-1-agentes** | 3 scripts | ✅ MANTENER |
| **fase-2-propiedades** | 1 script | ✅ MANTENER |
| **fase-3-contratos** | 1 script | ✅ MANTENER |
| **fase-3.5-inventarios** | 2 scripts | ✅ MANTENER |
| **fase-4-asientos** | 2 scripts | ✅ MANTENER |
| **fase-4.5-asientos-adhoc** | 2 scripts | ✅ MANTENER |
| **fase-4.6-vinculacion-contractual** | 1 script | ✅ MANTENER |
| **fase-5-pagos** | 7 scripts | ✅ MANTENER |
| **fase-6-verificacion** | 2 scripts | ✅ MANTENER |
| **utils** | 4 scripts | ✅ MANTENER |

**Total:** 27 scripts organizados y necesarios

---

## 🎯 Recomendaciones

### Opción 1: Limpieza Mínima (RECOMENDADA)

**Eliminar solo duplicados obvios de `/scripts/`:**

```bash
cd /Users/lisandropradatoledo/Documents/dev/Propietas-2025/nest-backend-v3/scripts

# Mover duplicados a carpeta de archivo
mkdir -p _archived_migration_duplicates

mv migrate-agents.js _archived_migration_duplicates/
mv migrate-agents-improved.js _archived_migration_duplicates/
mv migrate-properties.js _archived_migration_duplicates/
mv migrate-properties-simple.js _archived_migration_duplicates/

echo "✅ 4 duplicados archivados"
```

**Resultado:**
- `/scripts/`: 45 archivos (testing, seeding, utils)
- `/migracion/scripts/`: 27 archivos (migración estructurada)
- **Total reducción:** 4 archivos

---

### Opción 2: Reorganización Completa (MÁS AGRESIVA)

**Separar claramente:**

1. **`/scripts/`** → Solo desarrollo y testing
   - Mantener: testing, seeding, utils
   - Eliminar: todo lo relacionado con migración

2. **`/migracion/scripts/`** → Solo migración
   - Mantener todo (ya está bien organizado)

**Scripts adicionales a mover/archivar:**
- `create-migration-accounts.js` → Mover a `/migracion/scripts/utils/`
- `backfill-honorarios-inmobiliaria.js` → Archivar (one-time)
- `map-agent-locations.js` → Archivar (one-time)

**Resultado:**
- `/scripts/`: ~35 archivos (solo dev/testing)
- `/migracion/scripts/`: ~28 archivos (migración completa)
- **Total reducción:** ~10 archivos

---

## ✅ Propuesta Final

### Acción Inmediata (Opción 1):

```bash
cd /Users/lisandropradatoledo/Documents/dev/Propietas-2025/nest-backend-v3/scripts

mkdir -p _archived_migration_duplicates

# Duplicados obvios
mv migrate-agents.js _archived_migration_duplicates/
mv migrate-agents-improved.js _archived_migration_duplicates/
mv migrate-properties.js _archived_migration_duplicates/
mv migrate-properties-simple.js _archived_migration_duplicates/

# One-time scripts
mv backfill-honorarios-inmobiliaria.js _archived_migration_duplicates/
mv map-agent-locations.js _archived_migration_duplicates/

echo "✅ Limpieza completada"
```

### Estructura Final:

```
nest-backend-v3/
├── scripts/                           (39 archivos - Dev/Testing)
│   ├── test-*.sh                      (Scripts de testing)
│   ├── seed-*.ts                      (Scripts de seeding)
│   ├── check-*.ts                     (Utilidades)
│   └── _archived_migration_duplicates/ (6 archivos archivados)
│
└── migracion/
    └── scripts/                       (27 archivos - Migración)
        ├── fase-1-agentes/
        ├── fase-2-propiedades/
        ├── fase-3-contratos/
        ├── fase-4-asientos/
        ├── fase-4.5-asientos-adhoc/
        ├── fase-5-pagos/
        ├── fase-6-verificacion/
        └── utils/
```

---

## 📋 Checklist de Ejecución

- [ ] Revisar este análisis
- [ ] Aprobar Opción 1 o Opción 2
- [ ] Ejecutar comandos de limpieza
- [ ] Verificar que scripts de testing siguen funcionando
- [ ] Commit: "refactor: remove duplicate migration scripts"

---

**Preparado por:** Sistema de Auditoría  
**Fecha:** 22 de diciembre de 2025  
**Estado:** Pendiente de aprobación
