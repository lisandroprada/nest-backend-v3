# 🗑️ System Admin Module - Resumen de Implementación

## 📝 Resumen

Se ha implementado un módulo completo de administración del sistema que permite resetear todos los datos operacionales mientras mantiene intactos los datos maestros (plan de cuentas, agentes, propiedades).

## 🎯 Objetivo

Proporcionar una herramienta segura y controlada para limpiar el sistema de datos de prueba o resetear completamente el estado operacional sin perder la configuración base.

## 🏗️ Arquitectura

### Archivos Creados

```
src/modules/system-admin/
├── dto/
│   └── reset-system.dto.ts              # DTOs de entrada y salida
├── system-admin.controller.ts           # Endpoints HTTP
├── system-admin.service.ts              # Lógica de negocio
└── system-admin.module.ts               # Configuración del módulo

doc/
└── SYSTEM_ADMIN_API.md                  # Documentación completa de la API

scripts/
├── test-system-admin.sh                 # Script de pruebas
└── README.md                            # Documentación de scripts (actualizado)
```

### Integración

- ✅ Módulo registrado en `src/app.module.ts`
- ✅ Importa 6 modelos de Mongoose necesarios
- ✅ Requiere autenticación (AuthModule)
- ✅ Protegido con roles: `admin` y `superUser`

## 🔧 Funcionalidades

### 1. POST `/system-admin/reset`

**Resetea el sistema eliminando:**

- ✅ Contratos
- ✅ Asientos contables
- ✅ Transacciones
- ✅ Recibos
- ✅ Movimientos de caja
- ✅ Saldos de cuentas financieras (resetea a 0)

**Mantiene intactos:**

- ✅ Plan de cuentas (ChartOfAccounts)
- ✅ Agentes
- ✅ Propiedades
- ✅ Usuarios
- ✅ Configuraciones (ContractSettings)
- ✅ Índices de actualización
- ✅ Localidades, provincias, amenities

**Características de seguridad:**

- Requiere `confirm: true` obligatorio
- Soporta `dryRun: true` para simulación
- Logs detallados de todo el proceso
- Orden de eliminación respeta dependencias

### 2. GET `/system-admin/stats`

**Obtiene estadísticas del sistema:**

- Conteo de registros operacionales
- Conteo de registros maestros
- Timestamp de la consulta

## 🔐 Seguridad

### Autenticación y Autorización

```typescript
@Controller('system-admin')
@Auth(ValidRoles.admin, ValidRoles.superUser)
export class SystemAdminController {
  // Solo usuarios admin o superUser pueden acceder
}
```

### Confirmación Requerida

```typescript
if (!dto.confirm) {
  throw new BadRequestException(
    'Debe confirmar la operación estableciendo confirm: true',
  );
}
```

## 📊 Orden de Eliminación

El sistema elimina datos en el siguiente orden para respetar dependencias:

1. **Cash Box Movements** (dependen de receipts y transactions)
2. **Transactions** (pueden depender de receipts)
3. **Receipts**
4. **Accounting Entries** (dependen de contracts)
5. **Contracts**
6. **Financial Accounts** (resetea saldos)

## 🧪 Testing

### Script de Pruebas

```bash
./scripts/test-system-admin.sh
```

**Tests incluidos:**

1. ✅ GET `/stats` - Verificar estado actual
2. ✅ POST `/reset` con `dryRun: true` - Simular reseteo
3. ✅ POST `/reset` sin confirmación - Validar error
4. ⚠️ POST `/reset` real - Comentado por seguridad

### Ejemplo de Uso

```bash
# 1. Ver estado actual
curl -X GET http://localhost:3000/api/v1/system-admin/stats \
  -H "Authorization: Bearer $TOKEN"

# 2. Simular reseteo
curl -X POST http://localhost:3000/api/v1/system-admin/reset \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true, "dryRun": true}'

# 3. Reseteo real (CUIDADO!)
curl -X POST http://localhost:3000/api/v1/system-admin/reset \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true, "dryRun": false}'
```

## 📈 Response Examples

### Stats Response

```json
{
  "operationalData": {
    "contracts": 838,
    "accountingEntries": 14285,
    "transactions": 87,
    "receipts": 21,
    "cashBoxMovements": 0,
    "financialAccounts": 3
  },
  "masterData": {
    "agents": 0,
    "properties": 0,
    "chartOfAccounts": 0
  },
  "timestamp": "2025-11-04T15:30:00.000Z"
}
```

### Reset Response (Dry Run)

```json
{
  "success": true,
  "message": "Simulación completada. No se eliminaron datos reales.",
  "deletedCounts": {
    "contracts": 838,
    "accountingEntries": 14285,
    "transactions": 87,
    "receipts": 21,
    "cashBoxMovements": 0,
    "financialAccountsReset": 3
  },
  "timestamp": "2025-11-04T15:25:00.000Z",
  "isDryRun": true
}
```

### Reset Response (Real)

```json
{
  "success": true,
  "message": "Sistema reseteado exitosamente. Se eliminaron 15234 registros en total.",
  "deletedCounts": {
    "contracts": 838,
    "accountingEntries": 14285,
    "transactions": 87,
    "receipts": 21,
    "cashBoxMovements": 0,
    "financialAccountsReset": 3
  },
  "timestamp": "2025-11-04T15:30:00.000Z",
  "isDryRun": false
}
```

## 📝 Logs

Ejemplo de logs durante el reseteo:

```
🚨 INICIO DE RESETEO DEL SISTEMA (REAL)
📊 Registros a eliminar:
   - Contratos: 838
   - Asientos contables: 14285
   - Transacciones: 87
   - Recibos: 21
   - Movimientos de caja: 0
   - Cuentas financieras a resetear: 3
🗑️  Eliminando movimientos de caja...
🗑️  Eliminando transacciones...
🗑️  Eliminando recibos...
🗑️  Eliminando asientos contables...
🗑️  Eliminando contratos...
🔄 Reseteando saldos de cuentas financieras a saldo_inicial original...
✅ Reseteo completado exitosamente
⏱️  Tiempo de ejecución: 2340ms (2.34s)
```

## ⚙️ Dependencias

### Modelos Inyectados

```typescript
@Injectable()
export class SystemAdminService {
  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<Contract>,
    @InjectModel(AccountingEntry.name)
    private readonly accountingEntryModel: Model<AccountingEntry>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    @InjectModel(Receipt.name)
    private readonly receiptModel: Model<Receipt>,
    @InjectModel(CashBoxMovement.name)
    private readonly cashBoxMovementModel: Model<CashBoxMovement>,
    @InjectModel(FinancialAccount.name)
    private readonly financialAccountModel: Model<FinancialAccount>,
  ) {}
}
```

### Módulos Importados

- `MongooseModule.forFeature()` - Acceso a modelos
- `AuthModule` - Autenticación y autorización

## 🛡️ Mejores Prácticas

### Antes de Resetear

1. **Hacer backup de MongoDB:**

   ```bash
   mongodump --db nest-propietasV3 --out ./backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **Usar dry run primero:**

   ```bash
   POST /system-admin/reset
   { "confirm": true, "dryRun": true }
   ```

3. **Verificar estadísticas:**

   ```bash
   GET /system-admin/stats
   ```

4. **Coordinar con el equipo** si es en producción

### Después de Resetear

1. **Verificar estadísticas:**

   ```bash
   GET /system-admin/stats
   ```

2. **Verificar que datos maestros están intactos:**
   - GET `/agents`
   - GET `/properties`
   - GET `/chart-of-accounts`

3. **Re-generar asientos si es necesario:**
   ```bash
   POST /contracts/migration/generate-accounting-entries
   ```

## 🚀 Próximas Mejoras

### Corto Plazo

- [ ] Agregar estadísticas de agentes, propiedades y plan de cuentas en `/stats`
- [ ] Mejorar el reseteo de saldos de FinancialAccounts (usar valor original)

### Medio Plazo

- [ ] Backup automático antes de resetear
- [ ] Reseteo selectivo por rango de fechas
- [ ] Reseteo selectivo por tipo de datos

### Largo Plazo

- [ ] Soft delete con posibilidad de restauración
- [ ] Confirmación por email en producción
- [ ] Auditoría completa de operaciones destructivas

## 📚 Documentación

- **API Documentation:** [doc/SYSTEM_ADMIN_API.md](../doc/SYSTEM_ADMIN_API.md)
- **Scripts README:** [scripts/README.md](../scripts/README.md)
- **Test Script:** [scripts/test-system-admin.sh](../scripts/test-system-admin.sh)

## ✅ Estado del Módulo

- ✅ **Implementación completada**
- ✅ **Código formateado con Prettier**
- ✅ **Sin errores de compilación**
- ✅ **Documentación completa**
- ✅ **Scripts de prueba incluidos**
- ⚠️ **Pendiente: Testing en servidor activo**

## 🎓 Conceptos Aplicados

- **NestJS Modules** - Arquitectura modular
- **Dependency Injection** - Inyección de modelos
- **Guards y Decorators** - Autenticación y autorización
- **DTOs y Validation** - Validación de entrada
- **Mongoose Models** - Operaciones de base de datos
- **Logging** - Trazabilidad de operaciones
- **Error Handling** - Manejo robusto de errores

---

**Fecha de implementación:** Noviembre 2025  
**Versión:** 1.0.0  
**Autor:** Sistema automatizado
