# 🗑️ Módulo System Admin - Documentación

## Descripción General

El módulo **System Admin** proporciona endpoints administrativos para gestionar el estado del sistema, incluyendo la capacidad de resetear completamente todos los datos operacionales mientras mantiene intactos los datos maestros.

## ⚠️ ADVERTENCIA

**Este módulo contiene operaciones DESTRUCTIVAS que eliminan datos de forma permanente.**

- Requiere rol de **admin** o **superUser**
- Se recomienda usar `dryRun: true` antes de ejecutar operaciones reales
- **NO hay forma de recuperar los datos eliminados** (excepto restaurando un backup de MongoDB)

## 📋 Endpoints

### 1. POST `/system-admin/reset`

Resetea el sistema eliminando todos los datos operacionales.

#### Datos que SE ELIMINAN:

- ✅ **Contratos** (`contracts`)
- ✅ **Asientos contables** (`accountingentries`)
- ✅ **Transacciones** (`transactions`)
- ✅ **Recibos** (`receipts`)
- ✅ **Movimientos de caja** (`cashboxmovements`)
- ✅ **Saldos de cuentas financieras** (se resetean a 0)

#### Datos que SE MANTIENEN:

- ✅ **Plan de cuentas** (`chartofaccounts`)
- ✅ **Agentes** (`agents`)
- ✅ **Propiedades** (`properties`)
- ✅ **Usuarios** (`users`)
- ✅ **Configuraciones de contratos** (`contractsettings`)
- ✅ **Localidades, provincias, amenities**
- ✅ **Valores de índices** (`indexvalues`)
- ✅ **Plantillas de documentos**

#### Request Body:

```json
{
  "confirm": true,
  "dryRun": false // Opcional: true para simular sin eliminar
}
```

#### Response (Success):

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

#### Response (Dry Run):

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

#### Errores:

```json
{
  "statusCode": 400,
  "message": "Debe confirmar la operación estableciendo confirm: true",
  "error": "Bad Request"
}
```

---

### 2. GET `/system-admin/stats`

Obtiene estadísticas del sistema actual para verificar el estado.

#### Response:

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

---

## 🔐 Seguridad

### Autenticación y Autorización

Todos los endpoints requieren:

- **Token JWT válido**
- **Rol:** `admin` o `superUser`

### Ejemplo de uso con autenticación:

```bash
curl -X POST http://localhost:3000/api/v1/system-admin/reset \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "confirm": true,
    "dryRun": true
  }'
```

---

## 🧪 Casos de Uso

### 1. Verificar estado del sistema

```bash
GET /system-admin/stats
```

Revisa cuántos registros operacionales existen actualmente.

---

### 2. Simular reseteo (recomendado primero)

```bash
POST /system-admin/reset
{
  "confirm": true,
  "dryRun": true
}
```

Simula la operación sin eliminar datos reales. Muestra cuántos registros se eliminarían.

---

### 3. Reseteo real del sistema

```bash
POST /system-admin/reset
{
  "confirm": true,
  "dryRun": false
}
```

⚠️ **Elimina permanentemente** todos los datos operacionales.

---

## 🔄 Orden de Eliminación

El servicio elimina datos en el siguiente orden para respetar las dependencias:

1. **Cash Box Movements** (dependen de receipts y transactions)
2. **Transactions** (pueden depender de receipts)
3. **Receipts**
4. **Accounting Entries** (dependen de contracts)
5. **Contracts**
6. **Financial Accounts** (resetea saldos a 0)

---

## 📝 Logs

El servicio registra logs detallados durante el reseteo:

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

---

## 🛡️ Recomendaciones

1. **Siempre hacer backup de MongoDB antes de resetear:**

   ```bash
   mongodump --db nest-propietasV3 --out ./backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **Usar `dryRun: true` primero** para verificar qué se eliminará.

3. **Verificar estadísticas antes y después:**

   ```bash
   # Antes
   GET /system-admin/stats

   # Resetear
   POST /system-admin/reset

   # Después
   GET /system-admin/stats
   ```

4. **Coordinar con el equipo** antes de ejecutar en producción.

---

## 🔧 Implementación Técnica

### Estructura del módulo:

```
src/modules/system-admin/
├── dto/
│   └── reset-system.dto.ts          # DTOs de request/response
├── system-admin.controller.ts       # Endpoints HTTP
├── system-admin.service.ts          # Lógica de negocio
└── system-admin.module.ts           # Configuración del módulo
```

### Modelos inyectados:

El servicio tiene acceso a los siguientes modelos de Mongoose:

- `Contract`
- `AccountingEntry`
- `Transaction`
- `Receipt`
- `CashBoxMovement`
- `FinancialAccount`

---

## 🚀 Próximas Mejoras

- [ ] Agregar backup automático antes de resetear
- [ ] Permitir reseteo selectivo (por ejemplo, solo contratos de un período)
- [ ] Agregar estadísticas de agentes, propiedades y plan de cuentas en `/stats`
- [ ] Implementar soft delete con posibilidad de restauración
- [ ] Agregar confirmación por email para reseteos en producción

---

## 📞 Soporte

Para dudas o problemas con este módulo, contactar al equipo de desarrollo.

**Última actualización:** Noviembre 2025
