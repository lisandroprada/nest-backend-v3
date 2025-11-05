# 📜 Scripts del Proyecto

Este directorio contiene scripts utilitarios para gestión y pruebas del sistema.

## 🗑️ System Admin

### `test-system-admin.sh`

Script para probar el módulo de administración del sistema que permite resetear datos operacionales.

**Uso:**

```bash
# 1. Obtener token JWT (hacer login)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"your_password"}'

# 2. Editar el script y reemplazar YOUR_JWT_TOKEN_HERE con el token real

# 3. Ejecutar el script
./scripts/test-system-admin.sh
```

**Tests incluidos:**

- ✅ Obtener estadísticas del sistema
- ✅ Simulación de reseteo (dry run)
- ✅ Validación de confirmación requerida
- ⚠️ Reseteo real (comentado por seguridad)

---

## 📋 Contratos y Asientos

### `test-accounting-api.sh`

Prueba los endpoints de asientos contables.

### `test-calculate-payments.sh`

Prueba el cálculo de pagos iniciales de contratos.

### `test-contract-settings.sh`

Prueba la configuración de contratos.

### `test-rescision.sh`

Prueba el flujo de rescisión de contratos.

### `test-honorarios-calculation.sh`

Prueba el cálculo de honorarios.

### `test-fase-3.sh`

Tests de la fase 3 del proyecto.

---

## 🌱 Seeds y Migraciones

### `seed-contract-settings.ts`

Inicializa la configuración por defecto de contratos en MongoDB.

**Uso:**

```bash
npm run seed:contract-settings
```

Ver más detalles en [README_SEED_CONTRACT_SETTINGS.md](./README_SEED_CONTRACT_SETTINGS.md)

### `migrate-properties.js`

Migra propiedades desde el sistema anterior.

### `create-migration-accounts.js`

Crea cuentas contables necesarias para la migración.

### `verify-cuit-fields.sh`

Verifica los campos CUIT en la base de datos.

---

## 📖 Documentación Adicional

- **System Admin API:** [doc/SYSTEM_ADMIN_API.md](../doc/SYSTEM_ADMIN_API.md)
- **Contract Settings:** [README_SEED_CONTRACT_SETTINGS.md](./README_SEED_CONTRACT_SETTINGS.md)
- **Test Rescisión:** [README_TEST_RESCISION.md](./README_TEST_RESCISION.md)

---

## ⚙️ Configuración

Asegúrate de que el servidor esté corriendo antes de ejecutar los scripts de prueba:

```bash
npm run start:dev
```

La mayoría de los scripts utilizan:

- **Base URL:** `http://localhost:3000/api/v1`
- **Autenticación:** JWT Bearer Token (rol admin/superUser requerido)
