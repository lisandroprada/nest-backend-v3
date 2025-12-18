# Fase 1: Migración de Agentes

## Descripción

Esta fase migra la colección `Agents` desde Legacy a V3. Es la **fase más crítica** ya que preserva los `_id` originales, que serán referenciados por propiedades, contratos y datos contables.

## Criticidad

🔴 **CRÍTICA** - Si los `_id` cambian, toda la integridad referencial se rompe.

## Dependencias

- ✅ Ninguna (Esta es la primera fase)

## Scripts

### 01-sanity-check.ts

**Propósito:** Validar datos de agentes en Legacy antes de migrar.

**Validaciones:**
- Detectar emails duplicados
- Detectar emails inválidos
- Verificar campos requeridos
- Verificar ObjectIds válidos

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-1-agentes/01-sanity-check.ts
```

**Resultado esperado:**
- ✅ No hay errores críticos
- Reporte generado en `/validacion/reports/`

---

### 02-migrate-agents.ts

**Propósito:** Migrar agentes de Legacy a V3.

**Transformaciones:**
- Preserva `_id` original
- Mapea `name` + `lastName` → `nombre_razon_social`
- Normaliza email (trim + toLowerCase)
- Normaliza teléfono (remueve espacios y caracteres)

**Opciones de ejecución:**

```bash
# Dry-run (no hace cambios, solo muestra qué haría)
npx ts-node migracion/scripts/fase-1-agentes/02-migrate-agents.ts --dry-run

# Migración normal
npx ts-node migracion/scripts/fase-1-agentes/02-migrate-agents.ts

# Truncar primero y luego migrar (¡CUIDADO! Elimina datos)
npx ts-node migracion/scripts/fase-1-agentes/02-migrate-agents.ts --truncate
```

**Resultado esperado:**
- ✅ Todos los agentes insertados
- ✅ Conteo Legacy = Conteo V3

---

### 03-validate-agents.ts

**Propósito:** Validar que la migración fue exitosa.

**Validaciones:**
- Comparar conteos totales
- Verificar que todos los `_id` de Legacy existan en V3
- Verificar integridad de datos (muestra aleatoria)
- Verificar unicidad de emails en V3

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-1-agentes/03-validate-agents.ts
```

**Resultado esperado:**
- ✅ Todos los agentes de Legacy existen en V3
- ✅ No hay emails duplicados
- ✅ Datos coinciden

---

## Mapeo de Campos

| Campo Legacy | Campo V3 | Transformación |
|:-------------|:---------|:---------------|
| `_id` | `_id` | **Preservar estrictamente** |
| `name` | `nombres` | `cleanString()` |
| `lastName` | `apellidos` | `cleanString()` |
| `name + lastName` | `nombre_razon_social` | Concatenar con espacio |
| `email` | `email` | `normalizeEmail()` (trim + toLowerCase) |
| `phone` | `telefono` | `normalizePhone()` (remueve espacios/caracteres) |
| `address` | `direccion` | Directo |

> **Nota:** Ajustar el mapeo según los schemas reales de Legacy y V3.

---

## Checklist de Ejecución

- [ ] Ejecutar `01-sanity-check.ts`
- [ ] Revisar reporte de validación
- [ ] Corregir problemas encontrados (si los hay)
- [ ] Ejecutar `02-migrate-agents.ts --dry-run`
- [ ] Revisar salida del dry-run
- [ ] Ejecutar `02-migrate-agents.ts`
- [ ] Revisar log de migración
- [ ] Ejecutar `03-validate-agents.ts`
- [ ] Confirmar que no hay errores
- [ ] ✅ Fase 1 completada - **Puede proceder a Fase 2**

---

## Problemas Comunes

### Error: Email duplicado

**Síntoma:** Error E11000 al insertar

**Solución:**
1. Revisar reporte de sanity check
2. Identificar emails duplicados en Legacy
3. Limpiar duplicados manualmente o asignar emails únicos
4. Re-ejecutar migración

### Error: ObjectId inválido

**Síntoma:** `BSONTypeError: Argument passed in must be a string of 12 bytes or a string of 24 hex characters`

**Solución:**
1. Verificar que todos los `_id` en Legacy sean ObjectIds válidos
2. Corregir registros con `_id` inválidos
3. Re-ejecutar migración

### Error: Conexión rechazada

**Síntoma:** `MongoServerError: connect ECONNREFUSED`

**Solución:**
1. Verificar que MongoDB esté corriendo
2. Verificar connection strings en `/configuracion/conexiones.config.ts`
3. Re-ejecutar script

---

## Log de Ejecución

Los logs se guardan automáticamente en `/migracion/logs/` con timestamp.

Para ver el log más reciente:
```bash
ls -lt migracion/logs/ | head -2
```
