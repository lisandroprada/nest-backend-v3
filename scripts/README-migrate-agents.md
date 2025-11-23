# Agent Migration Script

Este script migra los datos de agentes desde la base de datos legacy (`propietas`) a la nueva base de datos (`nest-propietasV3`).

## 📋 Descripción

El script realiza las siguientes tareas:

1. **Conecta** a ambas bases de datos (legacy y nueva)
2. **Lee** todos los agentes de la base legacy
3. **Transforma** los datos al nuevo formato
4. **Valida** que no existan duplicados
5. **Inserta** los agentes en la nueva base de datos
6. **Reporta** estadísticas y errores

## 🔄 Mapeo de Campos

### Campos Principales

| Legacy | Nuevo | Transformación |
|--------|-------|----------------|
| `agentType` | `rol` | Cliente→PROPIETARIO, Proveedor→PROVEEDOR, etc. |
| `personType` | `persona_tipo` | Física→FISICA, Jurídica→JURIDICA |
| `name` | `nombres` | Directo (solo persona física) |
| `lastName` | `apellidos` | Directo (solo persona física) |
| `fullName` | `nombre_razon_social` | Directo |
| `gender` | `genero` | Femenino→FEMENINO, Masculino→MASCULINO |
| `identityCard` | `documento_numero` | Directo |
| `taxId` | `identificador_fiscal` | Directo |
| `taxType` / `iva` | `nomenclador_fiscal` | Análisis de texto→RI/CF/MONOTRIBUTO |
| `email` | `email_principal` | Directo |
| `active` | `status` | true→ACTIVO, false→INACTIVO |

### Campos Complejos

#### Direcciones
- `address` → `direccion_real`
- `taxAddress` → `direccion_fiscal`
- `city.id` → `localidad_id`
- `state.id` → `provincia_id`
- `postalCode` → `codigo_postal`

#### Teléfonos
- `phone[]` → `telefonos[]` con formato `{numero, tipo}`

#### Cuentas Bancarias
- `bankAccount[]` → `cuentas_bancarias[]`
  - `cbu` → `cbu_numero`
  - `description` → `cbu_alias`
  - `bankId` → `bank_id`

#### Apoderado
- `apoderado._id` → `apoderado_id`
- Se establece `apoderado_vigente: true` si existe

## 🚀 Uso

### Prerequisitos

```bash
# Instalar dependencias
npm install mongoose
```

### Ejecución

```bash
# Ejecutar el script de migración
node scripts/migrate-agents.js
```

### Opciones de Configuración

Puedes modificar las URLs de conexión en el script:

```javascript
const LEGACY_DB_URI = 'mongodb://127.0.0.1:27017/propietas';
const NEW_DB_URI = 'mongodb://127.0.0.1:27017/nest-propietasV3';
```

## 📊 Salida del Script

El script proporciona información detallada durante la ejecución:

```
🚀 Starting agent migration...
📖 Source: mongodb://127.0.0.1:27017/propietas
📝 Target: mongodb://127.0.0.1:27017/nest-propietasV3
✅ Database connections established
📊 Found 150 agents in legacy database
✅ Migrated: Juan Pérez
✅ Migrated: María González
⏭️  Skipping agent Empresa XYZ (already exists)
...

📊 Migration Summary:
   Total agents: 150
   ✅ Successfully migrated: 148
   ❌ Errors: 2

❌ Errors details:
   - Agent ABC (ID: 507f1f77bcf86cd799439011): Missing required field

✨ Migration completed!
🔌 Database connections closed
```

## ⚠️ Consideraciones Importantes

### Datos Preservados

El script preserva los datos legacy en un campo especial `_legacyData` que incluye:
- `agentType`
- `supplierMask`
- `consortiumDetails`
- `uid`
- `photo`
- `workAddress`
- `maritalStatus`
- `createdAt`

También se guarda el `_legacyId` para referencia.

### Validación de Duplicados

El script verifica duplicados usando:
- `identificador_fiscal` (CUIT/CUIL)
- `_legacyId` (ID de la base legacy)

Si encuentra un duplicado, lo omite y continúa con el siguiente.

### Valores por Defecto

Cuando faltan datos, el script usa valores por defecto:

- `nomenclador_fiscal`: "MONOTRIBUTO"
- `documento_tipo`: "DNI"
- `telefonos[].tipo`: "MOVIL"
- `cuentas_bancarias[].moneda`: "ARS"
- `cuentas_bancarias[].cbu_tipo`: "Caja de Ahorro"
- `status`: "ACTIVO"

### Campos Requeridos

Los siguientes campos son **requeridos** en el nuevo schema:
- `persona_tipo`
- `nomenclador_fiscal`
- `identificador_fiscal`
- `nombre_razon_social`
- `direccion_fiscal` (objeto completo)

Si faltan, el agente no se migrará y se reportará un error.

## 🔍 Verificación Post-Migración

Después de ejecutar la migración, verifica:

```javascript
// Conectar a la nueva base de datos
use nest-propietasV3

// Contar agentes migrados
db.agents.countDocuments()

// Ver un ejemplo de agente migrado
db.agents.findOne()

// Verificar agentes con datos legacy
db.agents.find({ _legacyId: { $exists: true } }).count()

// Buscar agentes sin identificador fiscal (posibles errores)
db.agents.find({ identificador_fiscal: "" })
```

## 🛠️ Troubleshooting

### Error: "Connection refused"
- Verifica que MongoDB esté corriendo
- Verifica las URLs de conexión

### Error: "Missing required field"
- Revisa los datos en la base legacy
- Algunos agentes pueden tener datos incompletos
- Considera agregar valores por defecto adicionales

### Error: "Duplicate key"
- Ya existe un agente con el mismo `identificador_fiscal`
- El script debería detectarlo, pero si no, verifica manualmente

## 📝 Notas Adicionales

### Mapeo de Roles

El mapeo de `agentType` a `rol` es:

```javascript
'Cliente' → 'PROPIETARIO'
'Proveedor' → 'PROVEEDOR'
'Empresa de Servicios' → 'EMPRESA_SERVICIO'
'Consorcio' → 'CONSORCIO'
'Inmobiliaria' → 'INMOBILIARIA'
```

**Nota:** El mapeo de "Cliente" a "PROPIETARIO" es una suposición. Verifica que sea correcto para tu caso de uso.

### Parseo de Direcciones

El script hace un parseo simple de direcciones separando por comas. Si tus direcciones tienen un formato específico, considera ajustar la función `parseAddress()`.

### IDs de Provincia y Localidad

El script intenta convertir los IDs de `city.id` y `state.id` a ObjectIds. Si estos IDs no son válidos o no existen en las colecciones de Province/Locality, se establecerán como `null`.

## 🔄 Rollback

Si necesitas revertir la migración:

```javascript
// Conectar a la nueva base de datos
use nest-propietasV3

// Eliminar todos los agentes migrados
db.agents.deleteMany({ _legacyId: { $exists: true } })
```

## 📞 Soporte

Si encuentras problemas durante la migración, revisa:
1. Los logs del script para identificar errores específicos
2. Los datos en la base legacy para agentes problemáticos
3. Las validaciones del schema en `agent.entity.ts`
