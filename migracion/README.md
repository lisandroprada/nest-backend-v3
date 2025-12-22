# Especificación Técnica y Guía Maestra de Migración: Legacy a Rentia (V3)

> [!IMPORTANT]
> **📘 GUÍA DEFINITIVA ACTUALIZADA**
> 
> Este documento contiene la especificación técnica original. Para el proceso paso a paso validado y actualizado, consultar:
> 
> **👉 [GUIA_MIGRACION_DEFINITIVA.md](./GUIA_MIGRACION_DEFINITIVA.md)** ⭐
> 
> La guía definitiva incluye:
> - ✅ Proceso validado con Contrato 6902
> - ✅ Lógica de estados contables (LIQUIDADO/COBRADO)
> - ✅ Pasos exactos y replicables
> - ✅ Troubleshooting y validaciones


### Entorno de Trabajo

El desarrollador debe operar en un entorno que tenga acceso simultáneo a ambos motores de base de datos para la ejecución de scripts de migración (ETL).

* **Legacy (Origen):** Proyecto `sistema-be`
    * **Connection String:** `mongodb://127.0.0.1:27017/propietas`
    * **Tecnología:** Node.js / Mongoose (Modelos adjuntos: `MasterAccount`, `Account`, `AccountEntry`).
* **V3 (Destino):** Proyecto `nest-backend-v3`
    * **Connection String:** `mongodb://127.0.0.1:27017/nest-propietasV3`
    * **Tecnología:** NestJS / Mongoose / TypeScript.
    * **API Local:** `http://localhost:3050/api/v1`

### Autenticación y Seguridad

Para interactuar con la API V3 o correr scripts que requieran contexto de usuario, se requiere un **Bearer Token**.

* **Credenciales de Admin:**
    * Email: `lisan@gmail.com`
    * Password: `12345678`
* **Obtención de Token (CURL/Postman):**
  
  ```bash
  POST http://localhost:3050/api/v1/auth/login
  ```
  
  **Body:**
  ```json
  {
    "email": "lisan@gmail.com",
    "password": "12345678",
    "rememberMe": true
  }
  ```
  
  *Respuesta:* Utilizar el campo `access_token` para los headers de autorización.

---

## 2. Estrategia de Migración por Fases

El orden de ejecución es **estricto**. No se debe avanzar a la siguiente fase sin validar la anterior, debido a las dependencias de `_id` (Integridad Referencial).

> [!IMPORTANT]
> **Orden de Ejecución Crítico**
> 
> Cada fase depende del éxito de la anterior. La migración debe ejecutarse en el siguiente orden:
> 1. Fase 1: Agentes
> 2. Fase 2: Propiedades
> 3. Fase 3: Contratos
> 4. Fase 4: Estructura Contable
> 5. Fase 5: Datos Contables Históricos

### Fase 1: Migración de Agentes (Maestros)

**Objetivo:** Migrar la colección `Agents` (Legacy) a `Agents` (V3). Esta es la base de la pirámide de datos.

**Criticidad:** Alta. Si los `_id` cambian, ninguna propiedad, contrato o asiento contable podrá vincularse correctamente.

#### 1.1 Mapeo y Transformación

| Campo Legacy | Campo V3 (Target) | Acción / Transformación |
|:-------------|:------------------|:------------------------|
| `_id` | `_id` | **MANTENER ESTRICTAMENTE**. Convertir string a `ObjectId` si es necesario. |
| `name` / `lastName` | `fullName` / `name` | Concatenar o separar según el esquema de V3. |
| `email` | `email` | **Unique Index**. Verificar duplicados y limpiar espacios (`trim()`). |
| `phone` | `phone` | Normalizar formato (eliminar guiones o espacios). |
| `address` | `address` | Migración directa. |

#### 1.2 Estrategia de Scripting

* **Limpieza Previa:** Ejecutar un script de "sanity check" en Legacy para detectar emails duplicados o inválidos antes de intentar insertar en V3.
* **Manejo de Usuarios:** Si V3 separa `User` (login) de `Agent` (entidad comercial), se debe crear primero el `User` y vincular el `Agent` al `userId` correspondiente.

**Scripts relacionados:** Ver carpeta `/scripts/fase-1-agentes/`

---

### Fase 2: Migración de Propiedades

**Objetivo:** Migrar el inventario de inmuebles (`Properties`).

**Dependencia:** Requiere que la Fase 1 (Agentes) esté completa para vincular propietarios.

#### 2.1 Consideraciones de Negocio

* **Vinculación:** Las propiedades en Legacy tienen un campo `owner` (o `agente_id`). Este debe coincidir con un `_id` existente en la colección de Agentes de V3 ya migrada.
* **Direcciones:** Validar estructura. Si V3 usa Google Maps API (`placeId`), migrar los datos de texto plano y marcar como "Geolocalización Pendiente".

#### 2.2 Validación de Huérfanos

```javascript
// Pseudocódigo de validación
const ownerExists = await v3AgentModel.findById(legacyProperty.ownerId);
if (!ownerExists) {
    console.error(`Propiedad ${legacyProperty._id} huérfana. Owner no existe.`);
    // Acción: Asignar a un agente 'System' o reportar error.
}
```

**Scripts relacionados:** Ver carpeta `/scripts/fase-2-propiedades/`

---

### Fase 3: Migración de Contratos (Lease Agreements)

**Objetivo:** Migrar contratos vigentes e históricos.

**Dependencia:** Requiere Agentes y Propiedades.

#### 3.1 Normalización de Fechas (Timezone)

> [!WARNING]
> **Punto Crítico de Fechas**
> 
> Legacy guarda fechas con un *offset* manual (`Date.now() - 3h`).
> 
> * **Acción:** Al leer de Legacy, MongoDB devuelve un objeto Date.
> * **Regla V3:** V3 espera fechas UTC puras. **No aplicar restas manuales**. Dejar que V3 guarde en UTC estándar.

#### 3.2 Status y Referencias

* **Estados:** Mapear `Vigente` -> `ACTIVE` (o enum correspondiente en V3). Migrar también `Finalizado` para mantener historial.
* **Integridad:**
  1. `tenantId` debe existir en Agentes V3.
  2. `propertyId` debe existir en Propiedades V3.
  3. `guarantors` deben existir en Agentes V3.

**Scripts relacionados:** Ver carpeta `/scripts/fase-3-contratos/`

---

### Fase 4: Generación de Estructura Contable (Lógica V3)

**Objetivo:** Inicializar la estructura financiera de los contratos migrados usando la lógica de negocio actual de V3.

**Nota:** En esta fase **no** traemos los saldos viejos ni pagos históricos. Solo creamos los "contenedores" (Transaction Headers) que V3 espera tener para un contrato activo.

#### 4.1 Ejecución del Servicio V3

El desarrollador debe invocar el servicio de V3 encargado de dar de alta un contrato, en lugar de insertar datos crudos.

1. Iterar sobre contratos migrados (`ACTIVE`).
2. Invocar método interno (ej. `LeaseAgreementService.createFinancialStructure()`).
3. **Resultado:** Se generarán cuotas/asientos en la colección `Transactions` (o equivalente) de V3, probablemente con saldo deudor total.
4. **Precaución:** Desactivar notificaciones automáticas (emails de deuda) durante este proceso.

**Scripts relacionados:** Ver carpeta `/scripts/fase-4-estructura-contable/`

---

### Fase 5: Migración de Datos Contables (Legacy a V3)

**Objetivo:** Inyectar la historia financiera y los pagos reales dentro de la estructura creada en la Fase 4, conciliando saldos.

#### 5.1 Análisis de Equivalencias (Mapping)

El sistema Legacy fragmenta la información en tres niveles: `MasterAccount` -> `Account` -> `AccountEntry`. V3 centraliza esto (Libro Diario).

| Concepto Legacy | Estructura Legacy | Equivalencia V3 (Target) | Lógica de Transformación |
|:----------------|:------------------|:-------------------------|:-------------------------|
| **Obligación Principal** | `MasterAccount` | **Transaction Header** | El `_id` del `MasterAccount` define la operación padre (ej. Alquiler Noviembre). |
| **Partes** | `origin` / `target` | **Party Entries** | `origin` (Legacy) = Quien paga (Debe).<br>`target` (Legacy) = Quien recibe (Haber). |
| **Sub-cuentas** | `Account` | **Line Items** | Desglose (Alquiler, Expensas). Si `accountType == 'Debito'` es deuda; `Credito` es a favor del propietario. |
| **Pagos** | `AccountEntry` | **Movements/Payments** | Los registros de caja. Deben migrarse al array de movimientos dentro del asiento V3. |

#### 5.2 Mapeo de Campos Críticos

**A. De `MasterAccount` a `V3_Transaction`**

* `_id` -> `_id` (Preservar para trazabilidad).
* `amount` -> `totalAmount`.
* `description` -> `concept`.

**B. De `Account` a `V3_Allocations`**

* **Cálculo de Saldos:** V3 debe recalcular el estado de deuda basándose en los campos Legacy `collected` y `available`.
* *Regla:* El saldo pendiente en V3 debe coincidir matemáticamente con el `available` de Legacy (considerando si es Crédito o Débito).

**C. De `AccountEntry` a `V3_Payments`**

* Vincular `receiptId` si existe migración de recibos.
* Normalizar fechas (eliminar el offset de 3 horas manual).

#### 5.3 Algoritmo de Migración (Script)

1. **Iteración por Contrato:** Buscar todas las `MasterAccount` asociadas a los agentes del contrato.
2. **Reconstrucción:**
    * Buscar hijos (`Account` donde `masterAccount: _id`).
    * Buscar nietos (`AccountEntry` donde `masterAccountId: _id`).
3. **Actualización V3:**
    * Buscar la Transacción V3 creada en la Fase 4 (o crearla si es histórica y no existe).
    * Insertar los movimientos (`AccountEntry`) como pagos realizados.
    * Actualizar los saldos (`collected`, `pending`) para que reflejen la realidad: Si en Legacy estaba pagado, en V3 debe figurar saldo 0.

#### 5.4 Controles de Seguridad

* **Idempotencia:** Usar `updateOne` con `upsert: true` o manejo de errores `E11000` para evitar duplicar asientos si el script se corre dos veces.
* **Casting:** Forzar `Types.ObjectId` en todas las referencias.
* **Validación Post-Migración:**
    * `Sum(Legacy.MasterAccount.amount)` ≈ `Sum(V3.Transactions.totalAmount)`
    * Auditoría aleatoria de 5 contratos: ¿Coincide el "Saldo a Pagar" en ambos sistemas?

**Scripts relacionados:** Ver carpeta `/scripts/fase-5-datos-contables/`

---

## 3. Checklist Final para el Desarrollador

### Pre-Migración

- [ ] Backup completo de la base de datos Legacy (`mongodump`).
- [ ] Snapshot de V3 previo a la ejecución.
- [ ] Desactivar `pre('save')` hooks en V3 que envíen emails/WhatsApp.
- [ ] Confirmar que todos los `_id` de Agentes y Propiedades son idénticos en ambos sistemas.
- [ ] Verificar conectividad a ambas bases de datos.
- [ ] Obtener token de autenticación válido.

### Durante Migración

- [ ] Ejecutar Fase 1: Migración de Agentes
- [ ] Validar integridad de Agentes migrados
- [ ] Ejecutar Fase 2: Migración de Propiedades
- [ ] Validar integridad de Propiedades migradas
- [ ] Ejecutar Fase 3: Migración de Contratos
- [ ] Validar integridad de Contratos migrados
- [ ] Ejecutar Fase 4: Generación de Estructura Contable
- [ ] Validar creación de estructura contable
- [ ] Ejecutar Fase 5: Migración de Datos Contables
- [ ] Validar conciliación de saldos

### Post-Migración

- [ ] Ejecutar scripts de validación de integridad referencial
- [ ] Verificar saldos contables (comparación Legacy vs V3)
- [ ] Auditoría aleatoria de contratos (mínimo 10)
- [ ] Re-activar hooks y notificaciones
- [ ] Documentar cualquier inconsistencia encontrada
- [ ] Generar reporte de migración

---

## 4. Estructura de Archivos del Proyecto

```
migracion/
├── README.md                          (Este documento)
├── configuracion/
│   ├── conexiones.config.ts          (Configuración de conexiones a BD)
│   └── auth.config.ts                (Credenciales y tokens)
├── scripts/
│   ├── fase-1-agentes/
│   │   ├── 01-sanity-check.ts        (Validación previa)
│   │   ├── 02-migrate-agents.ts      (Migración principal)
│   │   └── 03-validate-agents.ts     (Validación post-migración)
│   ├── fase-2-propiedades/
│   │   ├── 01-validate-dependencies.ts
│   │   ├── 02-migrate-properties.ts
│   │   └── 03-validate-properties.ts
│   ├── fase-3-contratos/
│   │   ├── 01-validate-dependencies.ts
│   │   ├── 02-migrate-contracts.ts
│   │   └── 03-validate-contracts.ts
│   ├── fase-4-estructura-contable/
│   │   ├── 01-generate-financial-structure.ts
│   │   └── 02-validate-structure.ts
│   ├── fase-5-datos-contables/
│   │   ├── 01-migrate-master-accounts.ts
│   │   ├── 02-migrate-accounts.ts
│   │   ├── 03-migrate-entries.ts
│   │   └── 04-validate-balances.ts
│   └── utils/
│       ├── logger.ts                 (Utilidad de logging)
│       ├── validators.ts             (Validadores comunes)
│       └── db-helpers.ts             (Helpers de base de datos)
├── validacion/
│   ├── integrity-checks.ts           (Chequeos de integridad)
│   └── reports/                      (Reportes generados)
└── documentacion/
    ├── schemas-legacy.md             (Esquemas de Legacy)
    ├── schemas-v3.md                 (Esquemas de V3)
    └── changelog.md                  (Registro de cambios)
```

---

## 5. Comandos Útiles

### Backup de Bases de Datos

```bash
# Backup Legacy
mongodump --uri="mongodb://127.0.0.1:27017/propietas" --out=./backups/legacy-$(date +%Y%m%d)

# Backup V3
mongodump --uri="mongodb://127.0.0.1:27017/nest-propietasV3" --out=./backups/v3-$(date +%Y%m%d)
```

### Restauración (En caso de error)

```bash
# Restaurar Legacy
mongorestore --uri="mongodb://127.0.0.1:27017/propietas" ./backups/legacy-<fecha>/

# Restaurar V3
mongorestore --uri="mongodb://127.0.0.1:27017/nest-propietasV3" ./backups/v3-<fecha>/
```

### Ejecución de Scripts

```bash
# Desde la raíz del proyecto nest-backend-v3
npx ts-node migracion/scripts/fase-1-agentes/01-sanity-check.ts
```

---

## 6. Contacto y Soporte

Para preguntas o problemas durante la migración, contactar a:

* **Email:** lisan@gmail.com
* **Documentación adicional:** Ver carpeta `/documentacion/`

---

> [!CAUTION]
> **Advertencia Final**
> 
> Esta migración es un proceso crítico que afecta datos financieros y contractuales. Asegúrese de:
> 
> 1. Tener backups completos antes de comenzar
> 2. Ejecutar cada fase en un entorno de prueba primero
> 3. Validar exhaustivamente cada fase antes de continuar
> 4. Mantener registros detallados de cada paso
> 5. No ejecutar en producción sin aprobación explícita
