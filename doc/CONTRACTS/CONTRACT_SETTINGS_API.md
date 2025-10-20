# 📋 Contract Settings API - Configuración de Contratos

## 📑 Índice

1. [Descripción General](#descripción-general)
2. [Esquema de la Entidad](#esquema-de-la-entidad)
3. [Tipos de Contrato](#tipos-de-contrato)
4. [Endpoints](#endpoints)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Valores por Defecto](#valores-por-defecto)
7. [Integración con Frontend](#integración-con-frontend)

---

## Descripción General

El módulo **Contract Settings** permite centralizar y parametrizar los valores por defecto utilizados en la creación de contratos. Esto elimina la necesidad de hardcodear valores y facilita su modificación sin tocar código.

**Características principales:**

- ✅ **Configuración centralizada** de parámetros financieros
- ✅ **Valores por defecto por tipo de contrato** (Vivienda, Comercial, Temporario, etc.)
- ✅ **Parametrización de honorarios** (locador, locatario, comisión administración)
- ✅ **Configuración de depósitos** y ajustes
- ✅ **Notificaciones automáticas** configurables
- ✅ **Un solo documento** en la base de datos (singleton pattern)
- ✅ **Reseteo a valores factory** con un endpoint

---

## Esquema de la Entidad

### Colección: `contractsettings`

La colección almacena **un único documento** con toda la configuración del sistema.

### Campos Principales

#### 🔧 Configuración Financiera

| Campo                         | Tipo     | Default     | Descripción                              |
| ----------------------------- | -------- | ----------- | ---------------------------------------- |
| `interes_mora_diaria_default` | `Number` | `0.05`      | % de interés diario por mora (5% = 0.05) |
| `dias_mora_default`           | `Number` | `10`        | Días de gracia antes de aplicar mora     |
| `iva_calculo_base_default`    | `String` | `'MAS_IVA'` | Enum: `'INCLUIDO'` o `'MAS_IVA'`         |

#### 💰 Honorarios por Defecto

| Campo                                     | Tipo     | Default | Descripción                                  |
| ----------------------------------------- | -------- | ------- | -------------------------------------------- |
| `comision_administracion_default`         | `Number` | `7`     | % comisión mensual de la inmobiliaria        |
| `honorarios_locador_porcentaje_default`   | `Number` | `2`     | % honorario que paga el propietario          |
| `honorarios_locador_cuotas_default`       | `Number` | `1`     | Cuotas para pago de honorarios del locador   |
| `honorarios_locatario_porcentaje_default` | `Number` | `5`     | % honorario que paga el inquilino            |
| `honorarios_locatario_cuotas_default`     | `Number` | `2`     | Cuotas para pago de honorarios del locatario |

#### 🏘️ Tipos de Contrato

Array de configuraciones específicas por tipo de contrato:

```typescript
tipos_contrato: [
  {
    tipo_contrato: 'VIVIENDA_UNICA',
    duracion_meses_default: 36,
    indice_tipo_default: 'ICL',
    ajuste_periodicidad_meses_default: 12,
    permite_renovacion_automatica: true,
    // Overrides opcionales de honorarios por tipo
    honorarios_locador_porcentaje_default?: number;
    honorarios_locatario_porcentaje_default?: number;
    descripcion: 'Contrato de vivienda única - Ley 27.551',
  },
  // ... otros tipos
];
```

**Tipos disponibles:**

- `VIVIENDA_UNICA`: Vivienda única (Ley 27.551) - 36 meses, ICL
- `VIVIENDA`: Vivienda estándar - 24 meses, ICL
- `COMERCIAL`: Locales comerciales - 36 meses, IPC
- `TEMPORARIO`: Alquileres temporarios - 6 meses, FIJO
- `OTROS`: Otros tipos - 12 meses, FIJO

Overrides de honorarios por defecto (si no se definen, se aplican reglas de negocio):

- VIVIENDA_UNICA y VIVIENDA: 2% para locador y 2% para locatario
- COMERCIAL: 5% para locatario

#### 💵 Depósitos

| Campo                          | Tipo     | Default                | Descripción                                  |
| ------------------------------ | -------- | ---------------------- | -------------------------------------------- |
| `deposito_cuotas_default`      | `Number` | `1`                    | Cuotas para pago del depósito                |
| `deposito_tipo_ajuste_default` | `String` | `'AL_ULTIMO_ALQUILER'` | Enum: `'AL_ORIGEN'` o `'AL_ULTIMO_ALQUILER'` |
| `deposito_meses_alquiler`      | `Number` | `1`                    | Meses de alquiler para calcular depósito     |

#### 📊 Ajustes

| Campo                       | Tipo      | Default | Descripción                       |
| --------------------------- | --------- | ------- | --------------------------------- |
| `ajuste_es_fijo_default`    | `Boolean` | `false` | Si el ajuste es fijo o por índice |
| `ajuste_porcentaje_default` | `Number`  | `0`     | % de ajuste si es fijo            |

#### 🔔 Notificaciones

| Campo                      | Tipo      | Default | Descripción                               |
| -------------------------- | --------- | ------- | ----------------------------------------- |
| `dias_aviso_vencimiento`   | `Number`  | `60`    | Días antes del vencimiento para notificar |
| `dias_aviso_ajuste`        | `Number`  | `30`    | Días antes del ajuste para notificar      |
| `enviar_recordatorio_pago` | `Boolean` | `true`  | Enviar recordatorios de pago              |

#### ⚠️ Rescisión Anticipada

| Campo                            | Tipo     | Default | Rango       | Descripción                                             |
| -------------------------------- | -------- | ------- | ----------- | ------------------------------------------------------- |
| `rescision_dias_preaviso_minimo` | `Number` | `30`    | 1 - 90 días | Días mínimos de preaviso para rescindir                 |
| `rescision_dias_sin_penalidad`   | `Number` | `90`    | 30 - 180    | Días antes del vencimiento para rescindir sin penalidad |
| `rescision_porcentaje_penalidad` | `Number` | `10`    | 0% - 50%    | % del saldo futuro como penalidad (10% = 0.1 mensual)   |

#### 🔐 Sistema

| Campo                     | Tipo       | Descripción                           |
| ------------------------- | ---------- | ------------------------------------- |
| `usuario_modificacion_id` | `ObjectId` | Usuario que modificó la configuración |
| `activo`                  | `Boolean`  | Si esta configuración está activa     |
| `createdAt`               | `Date`     | Fecha de creación (automático)        |
| `updatedAt`               | `Date`     | Fecha de actualización (automático)   |

---

## Tipos de Contrato

### Configuraciones por Defecto

| Tipo               | Duración | Índice | Ajuste (meses) | Renovación Auto |
| ------------------ | -------- | ------ | -------------- | --------------- |
| **VIVIENDA_UNICA** | 36 meses | ICL    | 12             | ✅ Sí           |
| **VIVIENDA**       | 24 meses | ICL    | 12             | ❌ No           |
| **COMERCIAL**      | 36 meses | IPC    | 6              | ✅ Sí           |
| **TEMPORARIO**     | 6 meses  | FIJO   | 6              | ❌ No           |
| **OTROS**          | 12 meses | FIJO   | 12             | ❌ No           |

### Índices de Ajuste

- **ICL:** Índice de Contratos de Locación (Argentina)
- **IPC:** Índice de Precios al Consumidor / RIPTE
- **FIJO:** Sin índice, ajuste fijo por porcentaje

---

## Endpoints

### 1. GET `/contract-settings`

Obtiene la configuración general de contratos.

**Autenticación:** Bearer token  
**Roles permitidos:** `admin`, `superUser`, `contabilidad`, `agente`

**Respuesta exitosa (200):**

```json
{
  "_id": "67af123456789abcdef01234",
  "interes_mora_diaria_default": 0.05,
  "dias_mora_default": 10,
  "iva_calculo_base_default": "MAS_IVA",
  "comision_administracion_default": 7,
  "honorarios_locador_porcentaje_default": 2,
  "honorarios_locador_cuotas_default": 1,
  "honorarios_locatario_porcentaje_default": 5,
  "honorarios_locatario_cuotas_default": 2,
  "tipos_contrato": [
    {
      "tipo_contrato": "VIVIENDA_UNICA",
      "duracion_meses_default": 36,
      "indice_tipo_default": "ICL",
      "ajuste_periodicidad_meses_default": 12,
      "permite_renovacion_automatica": true,
      "descripcion": "Contrato de vivienda única - Ley 27.551"
    }
    // ... otros tipos
  ],
  "deposito_cuotas_default": 1,
  "deposito_tipo_ajuste_default": "AL_ULTIMO_ALQUILER",
  "deposito_meses_alquiler": 1,
  "ajuste_es_fijo_default": false,
  "ajuste_porcentaje_default": 0,
  "dias_aviso_vencimiento": 60,
  "dias_aviso_ajuste": 30,
  "enviar_recordatorio_pago": true,
  "rescision_dias_preaviso_minimo": 30,
  "rescision_dias_sin_penalidad": 90,
  "rescision_porcentaje_penalidad": 10,
  "activo": true,
  "createdAt": "2025-01-10T12:00:00.000Z",
  "updatedAt": "2025-01-10T12:00:00.000Z"
}
```

**Ejemplo cURL:**

```bash
curl -X GET http://localhost:3000/contract-settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 2. GET `/contract-settings/tipo/:tipoContrato`

Obtiene configuración específica para un tipo de contrato.

**Autenticación:** Bearer token  
**Roles permitidos:** `admin`, `superUser`, `contabilidad`, `agente`

**Parámetros de ruta:**

- `tipoContrato`: Tipo de contrato (`VIVIENDA_UNICA`, `VIVIENDA`, `COMERCIAL`, `TEMPORARIO`, `OTROS`)

**Respuesta exitosa (200):**

```json
{
  "_id": "67af123456789abcdef01234",
  "interes_mora_diaria_default": 0.05,
  "dias_mora_default": 10,
  // ... todos los campos generales
  "tipo_contrato_seleccionado": {
    "tipo_contrato": "VIVIENDA_UNICA",
    "duracion_meses_default": 36,
    "indice_tipo_default": "ICL",
    "ajuste_periodicidad_meses_default": 12,
    "permite_renovacion_automatica": true,
    "honorarios_locador_porcentaje_default": 2,
    "honorarios_locatario_porcentaje_default": 2,
    "descripcion": "Contrato de vivienda única - Ley 27.551"
  },
  "honorarios_efectivos": {
    "locador_porcentaje": 2,
    "locatario_porcentaje": 2
  }
}
```

**Ejemplo cURL:**

```bash
curl -X GET http://localhost:3000/contract-settings/tipo/VIVIENDA_UNICA \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Errores:**

- `404`: Tipo de contrato no encontrado

---

### 3. PATCH `/contract-settings`

Actualiza la configuración de contratos.

**Autenticación:** Bearer token  
**Roles permitidos:** `admin`, `superUser`

**Body (todos los campos son opcionales):**

```json
{
  "comision_administracion_default": 8,
  "honorarios_locador_porcentaje_default": 3,
  "honorarios_locatario_porcentaje_default": 4,
  "deposito_meses_alquiler": 2,
  "dias_aviso_vencimiento": 90
}
```

**Validaciones:**

- `interes_mora_diaria_default`: 0-100
- `dias_mora_default`: 0-30
- `comision_administracion_default`: 0-20
- `honorarios_*_porcentaje_default`: 0-20
- `honorarios_*_cuotas_default`: 1-12
- `deposito_cuotas_default`: 1-12
- `deposito_meses_alquiler`: 1-6
- `dias_aviso_*`: 1-180

**Respuesta exitosa (200):**

Retorna el documento completo actualizado.

**Ejemplo cURL:**

```bash
curl -X PATCH http://localhost:3000/contract-settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comision_administracion_default": 8,
    "dias_aviso_vencimiento": 90
  }'
```

---

### 4. PATCH `/contract-settings/reset`

Resetea la configuración a valores por defecto de fábrica.

**Autenticación:** Bearer token  
**Roles permitidos:** `admin`, `superUser`

**Respuesta exitosa (200):**

Retorna el documento con valores resetados.

**Ejemplo cURL:**

```bash
curl -X PATCH http://localhost:3000/contract-settings/reset \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. PATCH `/contract-settings/tipo/:tipoContrato/honorarios`

Actualiza overrides de honorarios para un tipo de contrato.

Autenticación: Bearer token
Roles permitidos: `admin`, `superUser`

Parámetros de ruta:

- `tipoContrato`: `VIVIENDA_UNICA`, `VIVIENDA`, `COMERCIAL`, `TEMPORARIO`, `OTROS`

Body (todos los campos opcionales):

```json
{
  "honorarios_locador_porcentaje_default": 2,
  "honorarios_locatario_porcentaje_default": 5
}
```

Validaciones:

- `honorarios_*_porcentaje_default`: 0-20

Respuesta exitosa (200):

Retorna el documento completo actualizado.

---

## Ejemplos de Uso

### Ejemplo 1: Obtener Configuración General

```typescript
// Frontend - React/Vue/Angular
const response = await fetch('http://localhost:3000/contract-settings', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const config = await response.json();

console.log('Comisión default:', config.comision_administracion_default);
console.log(
  'Honorarios locador:',
  config.honorarios_locador_porcentaje_default,
);
```

### Ejemplo 2: Obtener Configuración para Contrato de Vivienda Única

```typescript
const response = await fetch(
  'http://localhost:3000/contract-settings/tipo/VIVIENDA_UNICA',
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
);

const config = await response.json();

// Usar valores en formulario de creación de contrato
formData.duracion_meses =
  config.tipo_contrato_seleccionado.duracion_meses_default;
formData.indice_tipo = config.tipo_contrato_seleccionado.indice_tipo_default;
formData.comision_administracion = config.comision_administracion_default;
```

### Ejemplo 3: Actualizar Comisión de Administración

```typescript
const response = await fetch('http://localhost:3000/contract-settings', {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    comision_administracion_default: 8,
    honorarios_locatario_porcentaje_default: 6,
  }),
});

const updated = await response.json();
console.log('Configuración actualizada:', updated);
```

### Ejemplo 4: Resetear a Valores de Fábrica

```typescript
const response = await fetch('http://localhost:3000/contract-settings/reset', {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const reset = await response.json();
console.log('Valores resetados:', reset);
```

---

## Valores por Defecto

### Configuración Financiera

```javascript
interes_mora_diaria_default: 0.05; // 5% diario
dias_mora_default: 10; // 10 días de gracia
iva_calculo_base_default: 'MAS_IVA'; // IVA adicional al monto
```

### Honorarios

```javascript
comision_administracion_default: 7; // 7% mensual
honorarios_locador_porcentaje_default: 2; // 2% sobre total contrato
honorarios_locador_cuotas_default: 1; // 1 cuota (pago único)
honorarios_locatario_porcentaje_default: 5; // 5% sobre total contrato
honorarios_locatario_cuotas_default: 2; // 2 cuotas
```

### Depósitos

```javascript
deposito_cuotas_default: 1; // 1 cuota
deposito_tipo_ajuste_default: 'AL_ULTIMO_ALQUILER';
deposito_meses_alquiler: 1; // 1 mes de alquiler
```

### Ajustes

```javascript
ajuste_es_fijo_default: false; // Ajuste por índice
ajuste_porcentaje_default: 0; // Sin ajuste fijo
```

### Notificaciones

```javascript
dias_aviso_vencimiento: 60; // 60 días antes
dias_aviso_ajuste: 30; // 30 días antes
enviar_recordatorio_pago: true; // Enviar recordatorios
```

### Rescisión Anticipada

```javascript
rescision_dias_preaviso_minimo: 30; // 30 días mínimo de preaviso
rescision_dias_sin_penalidad: 90; // Rescisión sin penalidad si >= 90 días antes vencimiento
rescision_porcentaje_penalidad: 10; // 10% del saldo futuro como penalidad
```

---

## Integración con Frontend

### Flujo Recomendado para Crear Contrato

1. **Al cargar el formulario de nuevo contrato:**

```typescript
// 1. Cargar configuración general
const configGeneral = await fetch('/contract-settings');

// 2. Cuando el usuario selecciona tipo de contrato
const handleTipoChange = async (tipo) => {
  const config = await fetch(`/contract-settings/tipo/${tipo}`);

  // 3. Poblar campos del formulario con valores default
  setFormData({
    duracion_meses: config.tipo_contrato_seleccionado.duracion_meses_default,
    indice_tipo: config.tipo_contrato_seleccionado.indice_tipo_default,
    ajuste_periodicidad_meses:
      config.tipo_contrato_seleccionado.ajuste_periodicidad_meses_default,
    comision_administracion: config.comision_administracion_default,
    honorarios_locador_porcentaje: config.honorarios_locador_porcentaje_default,
    honorarios_locador_cuotas: config.honorarios_locador_cuotas_default,
    honorarios_locatario_porcentaje:
      config.honorarios_locatario_porcentaje_default,
    honorarios_locatario_cuotas: config.honorarios_locatario_cuotas_default,
    deposito_cuotas: config.deposito_cuotas_default,
    deposito_tipo_ajuste: config.deposito_tipo_ajuste_default,
    interes_mora_diaria: config.interes_mora_diaria_default,
    dias_mora: config.dias_mora_default,
  });
};
```

2. **Panel de Administración de Configuración:**

Crear un formulario que permita modificar todos los valores:

```typescript
const AdminConfigPanel = () => {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const response = await fetch('/contract-settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setConfig(await response.json());
  };

  const handleUpdate = async (values) => {
    await fetch('/contract-settings', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(values)
    });

    fetchConfig(); // Recargar
  };

  const handleReset = async () => {
    await fetch('/contract-settings/reset', {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    fetchConfig(); // Recargar
  };

  return (
    <div>
      <h2>Configuración de Contratos</h2>
      <form onSubmit={handleUpdate}>
        <label>Comisión Administración (%)</label>
        <input
          type="number"
          value={config?.comision_administracion_default}
          onChange={...}
        />

        {/* ... más campos ... */}

        <button type="submit">Guardar Cambios</button>
        <button onClick={handleReset}>Resetear a Default</button>
      </form>
    </div>
  );
};
```

---

## Ventajas del Sistema

✅ **Centralización:** Todos los valores en un solo lugar  
✅ **Flexibilidad:** Modificación sin tocar código  
✅ **Auditabilidad:** Se registra quién modificó la configuración  
✅ **Consistencia:** Mismos valores en toda la aplicación  
✅ **Reseteo fácil:** Volver a valores de fábrica con un click  
✅ **Tipado fuerte:** Validaciones en DTO  
✅ **Singleton:** Solo un documento de configuración

---

## Consideraciones de Seguridad

⚠️ **Solo usuarios admin/superUser pueden modificar la configuración**  
⚠️ **Todos los usuarios autenticados pueden consultar (lectura)**  
⚠️ **Validaciones estrictas en los rangos de valores**  
⚠️ **Auditoría automática de cambios**

---

**Última actualización:** 14 de octubre de 2025  
**Versión del módulo:** 1.0  
**Estado:** ✅ Completado y funcional
