# 📋 Módulo de Contratos - Guía Rápida

## 🎯 Descripción

Módulo completo para la gestión de contratos de alquiler con integración automática de contabilidad y dashboard analítico.

---

## 📁 Estructura del Módulo

```
src/modules/contracts/
├── contracts.module.ts          # Módulo principal
├── contracts.controller.ts      # Controlador de endpoints
├── contracts.service.ts         # Servicio de gestión CRUD
├── contract-reports.service.ts  # Servicio de reportes y dashboard
├── dto/
│   ├── create-contract.dto.ts
│   ├── update-contract.dto.ts
│   └── dashboard-summary.dto.ts # DTO del dashboard
└── entities/
    └── contract.entity.ts       # Esquema de MongoDB
```

---

## 🚀 Endpoints Disponibles

### 1. Dashboard de Contratos (NUEVO ✨)

```http
GET /contracts/reports/dashboard-summary
```

**Descripción:** Retorna métricas consolidadas operacionales y financieras.

**Roles:** `admin`, `superUser`, `contabilidad`, `agente`

**Respuesta:** Ver [CONTRACTS_DASHBOARD.md](../../../doc/CONTRACTS_DASHBOARD.md)

**Métricas incluidas:**

- Distribución de estados (VIGENTE, RESCINDIDO, FINALIZADO, PENDIENTE)
- Vencimientos próximos (90 días)
- Promedio financiero mensual
- Distribución de agentes por rol
- Tasa de rescisión
- Distribución de madurez
- Proyección de facturación (12 + 3 meses)
- Lista de 50 contratos más urgentes

---

### 2. Crear Contrato

```http
POST /contracts
```

**Descripción:** Crea un nuevo contrato y genera automáticamente asientos contables.

**Roles:** `admin`, `superUser`

**Body:**

```json
{
  "propiedad_id": "507f1f77bcf86cd799439011",
  "partes": [
    {
      "agente_id": "507f1f77bcf86cd799439012",
      "rol": "LOCADOR"
    },
    {
      "agente_id": "507f1f77bcf86cd799439013",
      "rol": "LOCATARIO"
    }
  ],
  "fecha_inicio": "2024-01-01",
  "fecha_final": "2026-01-01",
  "ajuste_programado": "2024-07-01",
  "terminos_financieros": {
    "monto_base_vigente": 150000,
    "indice_tipo": "ICL",
    "interes_mora_diaria": 0.05,
    "iva_calculo_base": "MAS_IVA"
  },
  "deposito_monto": 150000,
  "deposito_tipo_ajuste": "AL_ORIGEN"
}
```

---

### 3. Listar Contratos

```http
GET /contracts?page=0&pageSize=10&populate=propiedad&sort=-fecha_inicio
```

**Descripción:** Lista contratos con paginación.

**Roles:** `admin`, `superUser`, `contabilidad`, `agente`

**Query params:**

- `page`: Número de página (default: 0)
- `pageSize`: Tamaño de página (default: 10)
- `sort`: Campo de ordenamiento (ej: `-fecha_inicio` para descendente)
- `populate`: Campos a poblar (ej: `propiedad` o `propiedad_id`)

---

### 4. Obtener Contrato por ID

```http
GET /contracts/:id
```

**Descripción:** Obtiene un contrato específico con la propiedad poblada.

**Roles:** `admin`, `superUser`, `contabilidad`, `agente`

---

### 5. Actualizar Contrato

```http
PATCH /contracts/:id
```

**Descripción:** Actualiza un contrato existente.

**Roles:** `admin`, `superUser`

---

## 📊 Servicios

### ContractsService

Gestiona el CRUD de contratos con lógica de negocio:

**Métodos principales:**

- `create()`: Crea contrato y genera asientos contables
- `findAll()`: Lista con paginación
- `findOne()`: Busca por ID
- `update()`: Actualiza contrato
- `generateInitialAccountingEntries()`: Genera asientos mensuales
- `generateDepositEntry()`: Genera asiento de depósito

---

### ContractReportsService (NUEVO ✨)

Genera reportes y métricas del dashboard:

**Métodos públicos:**

- `getDashboardSummary()`: Retorna todas las métricas consolidadas

**Métodos privados:**

- `getStatusDistribution()`: Conteo por estado
- `getDueSoonCount()`: Contratos próximos a vencer
- `getAvgMonthlyValue()`: Promedio financiero
- `getAgentRoleCount()`: Distribución de roles
- `getRescissionData()`: Datos de rescisión
- `getMaturityDistribution()`: Distribución de antigüedad
- `getBillingProjection()`: Proyección de facturación
- `getUpcomingContracts()`: Lista de contratos urgentes
- `calculateLinearRegression()`: Algoritmo de proyección

---

## 🔧 Configuración

### Dependencias del Módulo

```typescript
imports: [
  MongooseModule.forFeature([{ name: Contract.name, schema: ContractSchema }]),
  AccountingEntriesModule, // Para generar asientos
  ChartOfAccountsModule, // Para obtener cuentas contables
  PropertiesModule, // Para actualizar estado de propiedades
  AuthModule, // Para autenticación
  CommonModule, // Para servicios comunes
];
```

### Providers

```typescript
providers: [
  ContractsService, // CRUD de contratos
  ContractReportsService, // Dashboard y reportes
];
```

---

## 🗄️ Esquema de Base de Datos

### Colección: `contracts`

```javascript
{
  _id: ObjectId,
  propiedad_id: ObjectId,          // Ref: Property
  partes: [
    {
      agente_id: ObjectId,          // Ref: Agent
      rol: "LOCADOR" | "LOCATARIO" | "GARANTE"
    }
  ],
  inventario_items: [ObjectId],    // Ref: Asset
  fecha_inicio: Date,
  fecha_final: Date,
  fecha_recision_anticipada: Date,
  status: "VIGENTE" | "FINALIZADO" | "RESCINDIDO" | "PENDIENTE",
  terminos_financieros: {
    monto_base_vigente: Number,
    indice_tipo: "ICL" | "IPC" | "FIJO",
    interes_mora_diaria: Number,
    iva_calculo_base: "INCLUIDO" | "MAS_IVA"
  },
  deposito_monto: Number,
  deposito_tipo_ajuste: "AL_ORIGEN" | "AL_ULTIMO_ALQUILER",
  ajuste_programado: Date,
  usuario_creacion_id: ObjectId,
  usuario_modificacion_id: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Índices Recomendados

```javascript
db.contracts.createIndex({ status: 1 });
db.contracts.createIndex({ fecha_final: 1 });
db.contracts.createIndex({ ajuste_programado: 1 });
db.contracts.createIndex({ status: 1, fecha_final: 1 });
db.contracts.createIndex({ propiedad_id: 1 });
```

---

## 🧪 Testing

### Ejemplo de Test Unitario

```typescript
import { Test } from '@nestjs/testing';
import { ContractReportsService } from './contract-reports.service';

describe('ContractReportsService', () => {
  let service: ContractReportsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ContractReportsService],
    }).compile();

    service = module.get<ContractReportsService>(ContractReportsService);
  });

  it('debe retornar estructura completa del dashboard', async () => {
    const result = await service.getDashboardSummary();

    expect(result).toHaveProperty('statusDistribution');
    expect(result).toHaveProperty('dueSoonCount');
    expect(result).toHaveProperty('avgMonthlyValue');
    expect(result).toHaveProperty('agentRoleCount');
    expect(result).toHaveProperty('rescissionRate');
    expect(result).toHaveProperty('maturityDistribution');
    expect(result).toHaveProperty('billingProjection');
    expect(result).toHaveProperty('upcomingContracts');
    expect(result).toHaveProperty('metadata');
  });
});
```

---

## 📚 Documentación Completa

- **[CONTRACTS_COLLECTION.md](../../../doc/CONTRACTS_COLLECTION.md)**  
  Documentación detallada de la colección de contratos

- **[CONTRACTS_DASHBOARD.md](../../../doc/CONTRACTS_DASHBOARD.md)**  
  Especificación técnica completa del dashboard (Frontend + Backend)

- **[CONTRACTS_DASHBOARD_IMPLEMENTATION.md](../../../doc/CONTRACTS_DASHBOARD_IMPLEMENTATION.md)**  
  Resumen de implementación del dashboard

---

## 🚀 Inicio Rápido

### 1. Probar el endpoint del dashboard

```bash
# Obtener token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@propietas.com", "password": "tu_password"}'

# Llamar al dashboard
curl -X GET http://localhost:3000/contracts/reports/dashboard-summary \
  -H "Authorization: Bearer <TOKEN>"
```

### 2. Crear un contrato

```bash
curl -X POST http://localhost:3000/contracts \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d @contrato.json
```

### 3. Listar contratos

```bash
curl -X GET "http://localhost:3000/contracts?page=0&pageSize=10&populate=propiedad" \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 🔐 Seguridad

### Roles y Permisos

| Endpoint    | admin | superUser | contabilidad | agente |
| ----------- | ----- | --------- | ------------ | ------ |
| Dashboard   | ✅    | ✅        | ✅           | ✅     |
| Crear       | ✅    | ✅        | ❌           | ❌     |
| Listar      | ✅    | ✅        | ✅           | ✅     |
| Ver detalle | ✅    | ✅        | ✅           | ✅     |
| Actualizar  | ✅    | ✅        | ❌           | ❌     |

---

## 💡 Notas Importantes

### Generación Automática de Contabilidad

Al crear un contrato, el sistema **automáticamente**:

1. Proyecta asientos contables mensuales hasta `ajuste_programado` (o `fecha_final` si es FIJO)
2. Genera asiento de depósito en garantía
3. Calcula comisión de la inmobiliaria (3% por defecto)
4. Actualiza el estado de la propiedad a `ALQUILADO`

### Cuentas Contables Utilizadas

- `CXC_ALQ`: Alquiler a Cobrar (del locatario)
- `CXP_LOC`: Alquiler a Pagar al Locador
- `ING_HNR`: Ingreso por Honorarios (comisión)
- `PAS_DEP`: Pasivo por Depósito en Garantía
- `ACT_FID`: Activo Fiduciario (Caja/Banco)

### Performance

- El dashboard ejecuta **8 agregaciones en paralelo** para optimizar tiempo de respuesta
- Tiempo esperado: **200-500ms** dependiendo del tamaño de la base de datos
- Se recomienda implementar **caching** para producciones grandes (> 1000 contratos)

---

## 🐛 Troubleshooting

### Error: "Account codes not found"

**Causa:** Las cuentas contables requeridas no existen en ChartOfAccounts.

**Solución:** Verificar que existan las cuentas: `CXC_ALQ`, `CXP_LOC`, `ING_HNR`, `PAS_DEP`, `ACT_FID`.

### Dashboard retorna arrays vacíos

**Causa:** No hay contratos en la base de datos.

**Solución:** Crear contratos de prueba o verificar filtros aplicados.

### Timeout en el endpoint del dashboard

**Causa:** Base de datos muy grande sin índices.

**Solución:** Crear los índices recomendados en MongoDB.

---

## 📞 Soporte

Para consultas sobre el módulo:

- Revisar documentación completa en `/doc`
- Verificar comentarios en código fuente
- Crear issue en GitHub para bugs o mejoras

---

**Última actualización:** Octubre 2025  
**Versión:** 3.0
