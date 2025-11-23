### Arquitectura Sugerida: Módulo de Empresas de Servicios e Impuestos

En lugar de trabajar directamente con el endpoint genérico de `agents`, se recomienda crear un **módulo frontend especializado** para la gestión de empresas de servicios públicos e impuestos. Este módulo actuará como capa de abstracción sobre los agentes con rol `PROVEEDOR_SERVICIO_PUBLICO`.

---

## 🏢 Módulo Frontend: "Empresas de Servicios e Impuestos"

## Testing

### Endpoints de Prueba

> Nota: Todas las peticiones a estos endpoints deben incluir un token de autorización
> (roles permitidos: admin, superUser, contabilidad). Ejemplo: `-H "Authorization: Bearer <TOKEN>"`.

```bash
# Health check
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/v1/service-sync/health

# Listar sin procesar
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/api/v1/service-sync?solo_sin_procesar=true"

# Test conexión IMAP
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/v1/service-sync/test/connection

# Forzar re-scan (opciones: providerCuit, autoDuring, autoBatch)
curl -H "Authorization: Bearer <TOKEN>" -X POST "http://localhost:3000/api/v1/service-sync/rescan"

# Generar candidatos
curl -H "Authorization: Bearer <TOKEN>" -X POST "http://localhost:3000/api/v1/service-sync/candidates/generate" \
  -H "Content-Type: application/json" \
  -d '{"maxPerRun": 10}'

# Actualizar estado
curl -H "Authorization: Bearer <TOKEN>" -X POST "http://localhost:3000/api/v1/service-sync/communications/status" \
  -H "Content-Type: application/json" \
  -d '{
    "communicationId": "675abc123def456789012345",
    "status": "IGNORED",
    "notes": "Test"
  }'
```

```

---

### 1. Vista Principal: Listado de Empresas

**Página:** `ServiceCompaniesListPage.tsx`

**Funcionalidad:**

- Grid/lista de tarjetas, una por empresa
- Cada tarjeta muestra:
  - Logo/icono de la empresa
  - Nombre y CUIT
  - Estado de sincronización (✅ Activa / ⚠️ Error / ⏸️ Pausada)
  - Métricas rápidas:
    - Comunicaciones del mes
    - Pendientes de clasificar
    - Última sincronización
  - Botones rápidos: "Ver comunicaciones", "Configurar", "Re-escanear"

**Flujo de trabajo:**

```

1. Usuario entra a "Empresas de Servicios"
2. Ve grid con Camuzzi, CPE, Municipalidad, etc.
3. Click en tarjeta → va a detalle de empresa
4. Botón "+" → wizard para agregar nueva empresa

````

**Datos desde backend:**

```typescript
// GET /api/agents?rol=PROVEEDOR_SERVICIO_PUBLICO
// Transformar respuesta a formato frontend
interface ServiceCompany {
  id: string;
  nombre: string;
  cuit: string;
  logo?: string; // URL del logo (puede ser estático frontend)
  tipo: 'GAS' | 'ELECTRICIDAD' | 'AGUA' | 'MUNICIPALIDAD' | 'OTRO';
  email: string;

  // Configuración de sincronización
  sincronizacionActiva: boolean; // check_automatizado
  dominios: string[]; // dominios_notificacion

  // Regex (mostrar solo si usuario es admin)
  configuracionAvanzada?: {
    regexCuenta: string; // servicio_id_regex
    regexMonto: string; // monto_regex
    palabraClavePdf: string; // pdf_search_key
  };

  // Stats (desde /service-sync?proveedor_cuit=XXX)
  stats: {
    totalComunicaciones: number;
    pendientes: number;
    procesadas: number;
    ultimaSincronizacion: Date;
  };
}
````

**Sugerencias de UI:**

- Filtros: tipo de servicio, estado de sincronización
- Ordenar por: nombre, última sincronización, pendientes
- Vista compacta (lista) vs vista cards
- Badge de color según tipo: 🔥 Gas, ⚡ Electricidad, 💧 Agua, 🏛️ Municipalidad

---

### 2. Detalle de Empresa: Vista de 360°

**Página:** `ServiceCompanyDetailPage.tsx`

**Secciones/Tabs:**

#### Tab 1: Información General

- Datos básicos (nombre, CUIT, email, teléfono)
- Dirección fiscal
- Estado: Activo/Inactivo
- Botón "Editar" → abre formulario

#### Tab 2: Configuración de Sincronización

- Toggle: Sincronización automática ON/OFF
- Lista de dominios de email configurados
  - Input para agregar nuevo dominio
  - Botón eliminar por dominio
  - Validación: debe ser dominio válido
- Frecuencia: "Diaria a las 7 AM" (info, no editable desde aquí)

#### Tab 3: Configuración Avanzada (Solo Admins)

- **Regex para número de cuenta/servicio**
  - Input con el regex actual
  - Componente `RegexTester` en vivo
  - Botón "Probar" con ejemplos reales
- **Regex para monto**
  - Similar al anterior
- **Palabras clave PDF**
  - Input con palabra clave
- **Patrones de adjuntos**
  - Lista de patrones (ej: "factura\_\*.pdf")
  - Agregar/eliminar patrones

#### Tab 4: Comunicaciones Recientes

- Tabla de comunicaciones (últimas 50)
- Filtros: fecha, estado, tipo
- Link "Ver todas" → `ServiceCommunicationsPage.tsx` filtrada por esta empresa
- Acciones rápidas: Clasificar, Ignorar, Ver detalle

#### Tab 5: Estadísticas

- Gráfico de comunicaciones por mes (últimos 6 meses)
- Distribución por tipo de alerta (pie chart)
- Tasa de clasificación exitosa
- Tiempo promedio de procesamiento

**Flujo de trabajo:**

```
1. Usuario click en empresa Camuzzi
2. Ve tabs con toda la info
3. Si quiere ajustar dominios → Tab 2 → agrega "notificaciones.camuzzi.com"
4. Si es admin y quiere mejorar regex → Tab 3 → usa RegexTester
5. Si quiere ver qué llegó este mes → Tab 4
6. Guarda cambios → PUT /api/agents/:id con campos actualizados
```

---

### 3. Wizard de Creación: Nueva Empresa de Servicios

**Página:** `ServiceCompanyCreatePage.tsx`

**Pasos del wizard:**

#### Paso 1: Información Básica

- Nombre de la empresa
- CUIT (con validación AFIP si está disponible)
- Tipo de servicio (dropdown: Gas, Electricidad, Agua, Municipalidad, Otro)
- Email principal
- Teléfono (opcional)

#### Paso 2: Dirección Fiscal

- Selector de provincia → selector de localidad
- Calle, número, piso/dpto
- Código postal

#### Paso 3: Configuración de Sincronización

- ¿Habilitar sincronización automática? (toggle)
- Si SÍ → mostrar:
  - Input para dominios de email (puede agregar varios)
  - Ejemplo: "Si la empresa envía facturas desde avisos@empresa.com, agrega: empresa.com"
  - Validación en tiempo real

#### Paso 4: Configuración Avanzada (Opcional)

- "¿Desea configurar extracción automática de datos?" (checkbox)
- Si SÍ → mostrar:
  - Campo regex para cuenta
  - Campo regex para monto
  - Palabra clave PDF
  - Componente `RegexTester` con ejemplos

#### Paso 5: Revisión y Confirmación

- Resumen de todo lo configurado
- Botón "Crear Empresa"
- POST /api/agents con rol `PROVEEDOR_SERVICIO_PUBLICO`

**Flujo de trabajo:**

```
1. Usuario click en "+ Nueva Empresa"
2. Completa wizard paso a paso
3. Si es Camuzzi:
   - Nombre: "Camuzzi Gas Pampeana S.A."
   - CUIT: 30657864427
   - Tipo: GAS
   - Dominios: ["avisos.camuzzigas.com.ar", "camuzzigas.com"]
4. Confirma → se crea el agente
5. Redirección a detalle de empresa creada
```

---

### 4. Vista de Comunicaciones por Empresa

**Página:** `ServiceCommunicationsPage.tsx`

**Contexto:** Esta página se accede desde:

- Click en "Ver comunicaciones" en card de empresa
- Tab "Comunicaciones" del detalle de empresa
- Menú principal con filtro pre-aplicado por empresa

**Funcionalidad:**

- Tabla de comunicaciones **filtradas por empresa** (proveedor_cuit)
- Todas las features del endpoint `/service-sync`:
  - Paginación
  - Filtros: estado, tipo de alerta, fecha
  - Ordenamiento
  - Búsqueda por asunto/identificador
- Acciones masivas:
  - Seleccionar múltiples → "Clasificar seleccionadas"
  - "Ignorar seleccionadas"
- Acciones individuales:
  - Ver detalle (modal)
  - Clasificar
  - Ignorar
  - Ver gasto generado (si existe)

**Diferencia clave vs vista global:**

- En vista global de comunicaciones: todas las empresas mezcladas
- En vista por empresa: solo comunicaciones de ESA empresa
- Contexto visual: "Comunicaciones de Camuzzi Gas" (con logo y nombre)

**Llamada al backend:**

```typescript
  // Filtrar por empresa
GET /api/v1/service-sync?proveedor_cuit=30657864427&page=0&pageSize=10

// Nota: actualmente NO existe un endpoint de "stats por proveedor".
// Use `GET /api/v1/service-sync/stats/overview` para estadísticas globales.
```

---

### 5. Componente: RegexTester

**Componente:** `RegexTester.tsx`

**Propósito:** Permitir a administradores probar regex en tiempo real antes de guardar.

**UI sugerida:**

```
┌─────────────────────────────────────────────────┐
│ Regex: /Cuenta:\s+(\d+\/\d+-\d+-\d+-\d+\/\d+)/  │
├─────────────────────────────────────────────────┤
│ Texto de prueba:                                 │
│ [Camuzzi] Te acercamos tu factura               │
│ Cuenta: 9103/0-21-08-0023608/4                  │
│ Monto: $45,000.50                                │
├─────────────────────────────────────────────────┤
│ ✅ Coincidencia encontrada:                      │
│    Grupo 1: 9103/0-21-08-0023608/4              │
│                                                  │
│ [Botón: Probar otro texto]                      │
└─────────────────────────────────────────────────┘
```

**Lógica:**

- Input con regex
- Textarea con texto de ejemplo
- Ejecuta regex en frontend (JS nativo)
- Muestra matches encontrados con highlighting
- Permite cargar ejemplos predefinidos por tipo de empresa

---

### 6. Hooks Sugeridos

#### `useServiceCompanies.ts`

```typescript
// Wrapper sobre GET /api/agents?rol=PROVEEDOR_SERVICIO_PUBLICO
// Incluye transformación de datos a formato frontend
// Cache con react-query

const { data: companies, isLoading } = useServiceCompanies({
  filter: { tipo: 'GAS' },
  includeStats: true,
});
---
```

### 6. Hooks y Queries Sugeridos

#### Listar empresas de servicios

GET /api/agents?rol=PROVEEDOR_SERVICIO_PUBLICO

#### Obtener comunicaciones de una empresa específica

```
GET /api/v1/service-sync?proveedor_cuit=30657864427&page=0&pageSize=10
```

#### Obtener estadísticas de una empresa

```
GET /api/v1/service-sync/stats?proveedor_cuit=30657864427
```

---

### 7. Navegación Sugerida

**Estructura de rutas:**

```

/service-companies → Listado de empresas
/service-companies/new → Crear nueva empresa
/service-companies/:id → Detalle de empresa
/service-companies/:id/communications → Comunicaciones de empresa

/communications → Vista global de comunicaciones
/communications/:id → Detalle de una comunicación
```

---

### 8. Casos de Uso

#### Caso 1: Agregar nueva cooperativa eléctrica

1. Crear agente con rol `PROVEEDOR_SERVICIO_PUBLICO`
2. Configurar dominios: `["cpe.coop", "avisos.cpe.coop"]`
3. Configurar regex (opcional): `/Socio:\s+(\d+)/`
4. Sistema escanea automáticamente en próxima ejecución (7 AM)

#### Caso 2: Revisar comunicaciones de una empresa

1. Consultar: `GET /api/v1/service-sync?proveedor_cuit=30657864427`
2. Filtrar por estado si es necesario
3. Clasificar pendientes: `POST /api/v1/service-sync/candidates/generate`

#### Caso 3: Configurar regex para extracción

1. Actualizar agente: `PUT /agents/:id`
2. Incluir campos: `servicio_id_regex`, `monto_regex`
3. Probar regex con ejemplos de texto reales

#### Caso 4: Pausar sincronización

1. Actualizar agente: `PUT /agents/:id`
2. Cambiar: `check_automatizado: false`
3. Para reactivar: `check_automatizado: true`

---

### 9. Ventajas del Enfoque Modular

✅ **Abstracción clara:** Frontend trabaja con concepto "empresas de servicios" en lugar de "agentes genéricos"

✅ **Contexto específico:** Cada acción está en contexto de una empresa (Camuzzi, CPE, etc.)

✅ **Escalabilidad:** Agregar nueva empresa mediante wizard simplificado

✅ **Monitoreo:** Stats y comunicaciones agrupadas por empresa

✅ **Separación de responsabilidades:**

- Módulo "Agentes" → clientes, locadores, locatarios, proveedores genéricos
- Módulo "Empresas de Servicios" → Camuzzi, CPE, municipalidades"

---

### 10. Integración con Otros Módulos

#### Con Módulo de Propiedades

- Al editar propiedad → configurar servicios e impuestos
- Vincular número de cuenta con empresa proveedora
- Sistema vincula automáticamente comunicaciones con propiedades

#### Con Módulo de Gastos Detectados

- Filtrar gastos por empresa origen
- Navegar desde gasto a comunicación original

#### Con Módulo de Contabilidad

- Generar asientos contables al confirmar gastos
- Reportes por empresa de servicios

---

### 11. Validaciones Recomendadas

- **CUIT**: Formato válido y checksum
- **Dominios**: Formato de dominio válido (ej: `ejemplo.com`)
- **Regex**: Validar que sea regex válida antes de guardar
- **Fechas**: No permitir fechas futuras

---

### 12. Cronograma de Implementación Sugerido

**Fase 1: MVP (2 semanas)**

- Listado de empresas
- Crear nueva empresa
- Vista de comunicaciones por empresa

**Fase 2: Configuración (1 semana)**

- Gestión de dominios
- Toggle sincronización
  **Fase 3: Avanzado (1 semana)**
- Configuración de regex para extracción automática
- Estadísticas y métricas por empresa

**Fase 4: Integración (1 semana)**

- Integración con módulo de propiedades
- Integración con módulo de gastos detectados
- Testing end-to-end

---

### 13. Componentes Sugeridos

- **ServiceCompanyCard** - Tarjeta con información y stats de empresa
- **ServiceCompanySelector** - Selector dropdown de empresas
- **SyncStatusIndicator** - Indicador de estado de sincronización
- **DomainChip** - Chip para mostrar dominios configurados
- **CommunicationStatusBadge** - Badge de estado de comunicación

---

### 14. Mapeo Frontend ↔ Backend

- RegexTester component
- Configuración avanzada (solo admins)
- Stats y gráficos

**Fase 4: Integración (1 semana)**

- Integración con propiedades
- Integración con gastos detectados
- Testing end-to-end

---

### 13. Componentes Reutilizables Sugeridos

````typescript
import { useState, useEffect } from 'react';

interface Communication {
  _id: string;
  asunto: string;
  estado_procesamiento: string;
  tipo_alerta: string;
  fecha_email: string;
  monto_estimado?: number;
  identificador_servicio?: string;
}

export function ServiceCommunicationsTable() {
  const [data, setData] = useState<Communication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCommunications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10',
        sort: '-fecha_email'
      });

      // Include Authorization header when calling the API (example below uses static token)
      const res = await fetch(`/api/v1/service-sync?${params}`, {
        headers: {
          'Authorization': 'Bearer <TOKEN>',
        },
      });
      const json = await res.json();

      setData(json.data);
      setTotal(json.total);
    } catch (error) {
      console.error('Error fetching communications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunications();
  }, [page]);

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Fecha</th>
            <th>Asunto</th>
            <th>Identificador</th>
            <th>Monto</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map(comm => (
            <tr key={comm._id}>
              <td>
                <Badge status={comm.estado_procesamiento} />
              </td>
              <td>
                <Badge alert={comm.tipo_alerta} />
---

### 14. Mapeo Frontend ↔ Backend

| Concepto Frontend | Endpoint Backend | Campo/Filtro |
|-------------------|------------------|--------------|
| Empresa de Servicios | `GET /api/agents` | `rol: PROVEEDOR_SERVICIO_PUBLICO` |
| Sincronización Activa | Campo en Agent | `check_automatizado: true` |
| Dominios configurados | Campo en Agent | `dominios_notificacion: string[]` |
| Configuración regex | Campos en Agent | `servicio_id_regex`, `monto_regex` |
| Comunicaciones de empresa | `GET /api/v1/service-sync` | `proveedor_cuit=XXX` |
| Stats de empresa | `GET /api/v1/service-sync/stats/overview` (no admite filtro por proveedor) | (no soportado) |

---

### 15. Ejemplo de Transformación de Datos

**Response del backend (Agent):**
```json
{
  "_id": "66f123abc456def789012345",
  "rol": ["PROVEEDOR_SERVICIO_PUBLICO"],
  "identificador_fiscal": "30657864427",
  "nombre_razon_social": "Camuzzi Gas Pampeana S.A.",
  "email_principal": "avisos@camuzzigas.com.ar",
  "check_automatizado": true,
  "dominios_notificacion": ["avisos.camuzzigas.com.ar"],
  "servicio_id_regex": "Cuenta[:\\s]+(\\d+/\\d+-\\d+-\\d+-\\d+/\\d+)",
  "monto_regex": "Total\\s*:\\s*\\$\\s*([\\d,.]+)"
}
````

**Modelo sugerido para frontend:**

```typescript
interface ServiceCompany {
  id: string; // _id del agent
  nombre: string; // nombre_razon_social
  cuit: string; // identificador_fiscal
  email: string; // email_principal
  tipo: ServiceType; // detectar según nombre
  sincronizacionActiva: boolean; // check_automatizado
  dominios: string[]; // dominios_notificacion
  configuracionAvanzada: {
    regexCuenta: string; // servicio_id_regex
    regexMonto: string; // monto_regex
    palabraClavePdf: string; // pdf_search_key
  };
}

type ServiceType = 'GAS' | 'ELECTRICIDAD' | 'AGUA' | 'MUNICIPALIDAD' | 'OTRO';
```

---

## Reglas de Negocio

### 1. Identificador de Servicio Faltante

- Si `identificador_servicio` está vacío → estado automático `ERROR`
- Operador puede forzar re-scan o agregar manualmente

### 2. Duplicados

- El sistema previene duplicados por `email_id`
- Si se escanea el mismo email 2 veces, incrementa contador `duplicados` pero no crea registro

### 3. Propiedades Sugeridas

- Se buscan en `Property.servicios_impuestos.identificador_servicio`
- Puede haber 0, 1 o múltiples matches
- Si 0 matches → no se crea gasto, estado queda `PENDING`
- Si 1+ matches → se crea gasto con todas las propiedades sugeridas

### 4. Gastos Detectados

- Un `ServiceCommunication` solo puede generar 1 `DetectedExpense`
- El gasto hereda: tipo_gasto, monto, fecha_vencimiento, descripcion
- Estado inicial del gasto: `PENDIENTE_VALIDACION`

### 5. Clasificación de Alertas

Lógica implementada en `CamuzziScanService.classifyAlertType()`:

```typescript
private classifyAlertType(subject: string, body: string): CommunicationType {
  const text = `${subject} ${body}`.toLowerCase();

  if (
    text.includes('se interrumpirá') ||
    text.includes('corte de servicio') ||
    text.includes('suspensión del suministro')
  ) {
    return CommunicationType.AVISO_CORTE;
  }

  if (
    text.includes('deuda registrada') ||
    text.includes('inicio de la gestión') ||
    text.includes('gestión de cobro')
  ) {
    return CommunicationType.AVISO_DEUDA;
  }

  if (
    text.includes('vence tu factura') ||
    text.includes('está por vencer') ||
    text.includes('vencimiento próximo')
  ) {
    return CommunicationType.VENCIMIENTO_PROXIMO;
  }

  if (
    text.includes('te acerca tu factura') ||
    text.includes('nueva factura') ||
    text.includes('factura disponible')
  ) {
    return CommunicationType.FACTURA_DISPONIBLE;
  }

  return CommunicationType.OTRO;
}
```

---

### Service account mappings (provider → cuenta) API

Breve: este endpoint gestiona mappings entre un proveedor (por ejemplo Camuzzi) y una cuenta contable. Es utilizado por el flujo de contabilidad para convertir gastos detectados en asientos automáticos.

Roles: requiere header Authorization con token de un usuario con rol `admin`, `superUser` o `contabilidad`.

Endpoints:

- GET /api/v1/service-account-mappings
  - Query params: `page`, `pageSize`, `provider_cuit` (opcional)
  - Response: { data: ServiceAccountMapping[], total: number }

- GET /api/v1/service-account-mappings/:id
  - Response: ServiceAccountMapping

- POST /api/v1/service-account-mappings
  - Body (application/json):
    {
    "provider_cuit": "30657864427",
    "identificador_servicio": "9103/0-21-08-0023608/4",
    "account_id": "507f1f77bcf86cd799439011",
    "notes": "opcional"
    }
  - Notes: `provider_cuit` y `identificador_servicio` se persisten tal cual (valida que sean strings). `account_id` debe ser ObjectId válido (24 hex chars).

- PUT /api/v1/service-account-mappings/:id
  - Body: campos actualizables: `provider_cuit`, `identificador_servicio`, `account_id`, `notes`

- DELETE /api/v1/service-account-mappings/:id
  - Borra el mapping por id.

Curl examples (zsh):

```bash
# List mappings (filtrar por proveedor)
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/api/v1/service-account-mappings?provider_cuit=30657864427&page=0&pageSize=20" | jq

# Get single mapping
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/v1/service-account-mappings/507f1f77bcf86cd799439011 | jq

# Create mapping (persistirá provider_cuit e identificador_servicio)
curl -H "Authorization: Bearer <TOKEN>" -X POST http://localhost:3000/api/v1/service-account-mappings \
  -H "Content-Type: application/json" \
  -d '{
    "provider_cuit":"30657864427",
    "identificador_servicio":"9103/0-21-08-0023608/4",
    "account_id":"507f1f77bcf86cd799439011",
    "notes":"Mapping para Camuzzi"
  }' | jq

# Update mapping
curl -H "Authorization: Bearer <TOKEN>" -X PUT http://localhost:3000/api/v1/service-account-mappings/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{"notes":"Actualizado por admin"}' | jq

# Delete mapping
curl -H "Authorization: Bearer <TOKEN>" -X DELETE http://localhost:3000/api/v1/service-account-mappings/507f1f77bcf86cd799439011
```

Schema (ejemplo de respuesta):

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "provider_cuit": "30657864427",
  "identificador_servicio": "9103/0-21-08-0023608/4",
  "account_id": "507f1f77bcf86cd799439011",
  "notes": "Mapping para Camuzzi",
  "created_at": "2025-11-17T10:00:00.000Z"
}
```

Notas de implementación:

- Asegúrate que, al crear/actualizar, el controlador y servicio persistan los campos `provider_cuit` y `identificador_servicio` (camelCase en el body) en la entidad/documento. Si no lo hacen, lo corrijo en `src/modules/service-account-mappings`.
- Validaciones recomendadas: `provider_cuit` string no vacío; `identificador_servicio` opcionalmente requerido según el mapping; `account_id` valid ObjectId.

## Seguridad

### Roles Permitidos

- `admin`: Acceso total
- `superUser`: Acceso total
- `contabilidad`: Acceso total
- Otros roles: 401 Unauthorized

### Decorador Aplicado

```typescript
@Auth('admin', 'superUser', 'contabilidad')
```

### Protección de Datos Sensibles

- `cuerpo_html` no se expone en listados (solo en detalle)
- Credenciales IMAP encriptadas en `SystemConfig`
- No se logean passwords en ningún caso

---

_See the "Endpoints de Prueba" section earlier in this document (includes Authorization header examples and /api/v1 prefix)._

### Tests Unitarios

Ver archivos en `src/modules/service-sync/**/*.spec.ts`

---

## Performance

### Índices MongoDB

```javascript
// service_communications collection
db.service_communications.createIndex({
  estado_procesamiento: 1,
  fecha_email: -1,
});

db.service_communications.createIndex({
  proveedor_cuit: 1,
  estado_procesamiento: 1,
});

db.service_communications.createIndex({
  identificador_servicio: 1,
});

db.service_communications.createIndex({
  tipo_alerta: 1,
  fecha_email: -1,
});

db.service_communications.createIndex(
  {
    email_id: 1,
  },
  { unique: true },
);
```

### Recomendaciones

- Paginación: default 10, máximo 100 items
- Caché frontend: `/health` 5 min, `/providers` 1 hora
- Polling: no hacer si usuario tiene filtros activos

---

## Próximas Funcionalidades

- [ ] Soporte adjuntos PDF (parseo de facturas)
- [ ] Reconocimiento de proveedor por patterns en cuerpo
- [ ] Normalización de montos con impuestos
- [ ] Webhooks para notificaciones en tiempo real
- [ ] Métricas: tiempo promedio de procesamiento, tasa de error
- [ ] Exportación CSV/Excel
- [ ] Búsqueda full-text

---

## Checklist de Implementación Frontend

### Módulo: Empresas de Servicios e Impuestos

- [ ] **Página de listado de empresas** (`ServiceCompaniesListPage`)
  - [ ] Grid/cards con info de cada empresa
  - [ ] Filtros: tipo de servicio, estado sincronización
  - [ ] Stats en cada card (comunicaciones, pendientes, última sync)
  - [ ] Botón "Nueva Empresa"
- [ ] **Wizard de creación** (`ServiceCompanyCreatePage`)
  - [ ] Paso 1: Información básica (nombre, CUIT, tipo)
  - [ ] Paso 2: Dirección fiscal
  - [ ] Paso 3: Configuración de sincronización
  - [ ] Paso 4: Configuración avanzada (opcional)
  - [ ] Paso 5: Revisión y confirmación
- [ ] **Página de detalle de empresa** (`ServiceCompanyDetailPage`)
  - [ ] Tab: Información general
  - [ ] Tab: Configuración de sincronización
  - [ ] Tab: Configuración avanzada (solo admins)
  - [ ] Tab: Comunicaciones recientes
  - [ ] Tab: Estadísticas y gráficos
- [ ] **Vista de comunicaciones por empresa** (`ServiceCommunicationsPage`)
  - [ ] Tabla filtrada por empresa
  - [ ] Paginación y ordenamiento
  - [ ] Filtros: estado, tipo, fecha
  - [ ] Acciones masivas: clasificar, ignorar
  - [ ] Acciones individuales: ver detalle, clasificar
- [ ] **Componentes reutilizables**
  - [ ] `ServiceCompanyCard` - Card con logo y stats
  - [ ] `ServiceCompanySelector` - Dropdown de empresas
  - [ ] `RegexTester` - Probador de regex en vivo
  - [ ] `SyncStatusIndicator` - Semáforo de sincronización
  - [ ] `DomainChip` - Chip de dominio con validación
  - [ ] `CommunicationStatusBadge` - Badge de estado
- [ ] **Hooks y lógica**
  - [ ] `useServiceCompanies` - Query de empresas
  - [ ] `useCompanyCommunications` - Comunicaciones filtradas
  - [ ] `useCompanyStats` - Estadísticas por empresa
  - [ ] Transformación: Agent → ServiceCompany
  - [ ] Detección automática de tipo de servicio
- [ ] **Integraciones**
  - [ ] Integración con módulo de Propiedades
  - [ ] Integración con módulo de Gastos Detectados
  - [ ] Integración con módulo de Contabilidad
  - [ ] Navegación entre módulos (breadcrumbs)

### Vista Global de Comunicaciones (Opcional)

- [ ] Página de listado global (todas las empresas)
- [ ] Dashboard con estadísticas generales
- [ ] Botón "Re-scan" manual
- [ ] Botón "Clasificar Pendientes"
- [ ] Modal de detalle (tabs texto/HTML)
- [ ] Badges de color por estado y tipo
- [ ] Toast notifications
- [ ] Responsive mobile

---

**Última actualización:** 13/11/2025  
**Equipo:** Backend NestJS  
**Contacto:** backend@propietas.com
