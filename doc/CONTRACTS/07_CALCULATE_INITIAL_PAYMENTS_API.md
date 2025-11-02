# 📊 Calculate Initial Payments API - Vista Previa de Asientos Contables

## 📑 Índice

1. [Descripción General](#descripción-general)
2. [Endpoint](#endpoint)
3. [Casos de Uso](#casos-de-uso)
4. [Request Body](#request-body)
5. [Response Structure](#response-structure)
6. [Ejemplos Completos](#ejemplos-completos)
7. [Integración con Frontend](#integración-con-frontend)

---

## Descripción General

El endpoint **`POST /contracts/calculate-initial-payments`** permite calcular y visualizar todos los asientos contables que se generarán al crear un contrato, **sin persistir nada en la base de datos**.

Este endpoint es ideal para mostrar una **vista previa financiera** al usuario antes de confirmar la creación del contrato.

### ✅ Características

- **No persiste datos**: Solo simula y calcula
- **Vista completa**: Muestra todos los asientos que se crearán
- **Resumen financiero**: Totales de alquileres, honorarios y depósito
- **Desglose por tipo**: Alquileres, depósito, honorarios locador/locatario
- **Información de cuentas**: Incluye códigos y nombres de cuentas contables

### 🆕 Novedades incluidas

- Per-asiento: campo `imputaciones` para indicar “a quién se imputa” (LOCADOR/LOCATARIO/GARANTE y su `agente_id`).
- Respuesta: bloque `honorarios_inmobiliaria` con desglose de mensual, locador y locatario.
- Request/Response: `iva_calculo_base` que define si los montos están `INCLUIDO` o son `MAS_IVA` (se adiciona el IVA luego).

### 📋 ¿Qué calcula?

1. **Asientos de Alquiler Mensual**
   - Desde `fecha_inicio` hasta `ajuste_programado` (o `fecha_final` si es FIJO)
   - Devengamiento mensual con honorarios de inmobiliaria
   - Crédito al locador (monto base - comisión)
   - Débito al locatario (monto base completo)

2. **Asiento de Depósito en Garantía** (si aplica)
   - Pasivo por depósito recibido
   - Activo fiduciario (ingreso a caja/banco)

3. **Asientos de Honorarios Locador** (si aplica)
   - **Base de cálculo**: % del monto total del contrato (duración × valor inicial)
   - Distribución en cuotas según configuración
   - Descuento de cuenta del locador
   - Ingreso a honorarios inmobiliaria

4. **Asientos de Honorarios Locatario** (si aplica)
   - **Base de cálculo**: % del monto total del contrato (duración × valor inicial)
   - Distribución en cuotas según configuración
   - Cargo a cuenta del locatario
   - Ingreso a honorarios inmobiliaria

---

## Endpoint

### POST `/contracts/calculate-initial-payments`

**URL Completa:**

```
POST http://localhost:3000/contracts/calculate-initial-payments
```

**Autenticación:** Bearer Token

**Roles Permitidos:**

- `admin`
- `superUser`
- `contabilidad`
- `agente`

**Headers:**

```http
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

---

## Casos de Uso

### 1️⃣ Formulario de Creación de Contrato

El frontend muestra los campos del contrato y, cuando el usuario completa los datos, puede hacer clic en "Vista Previa de Pagos" para ver:

- Cuántos asientos se crearán
- Fechas de vencimiento
- Montos totales
- Desglose detallado

### 2️⃣ Validación de Configuración Financiera

Permite verificar que los porcentajes de honorarios, comisión y depósito generan los asientos esperados antes de confirmar.

### 3️⃣ Cotización al Cliente

Generar un documento o PDF con el detalle de todos los pagos que deberá realizar el locatario durante el contrato.

---

## Request Body

### Estructura Completa

```typescript
{
  propiedad_id: string;           // ObjectId de la propiedad
  partes: Parte[];                // Array con locador y locatario
  fecha_inicio: string;           // ISO 8601 (YYYY-MM-DD)
  fecha_final: string;            // ISO 8601 (YYYY-MM-DD)
  ajuste_programado: string;      // ISO 8601 (YYYY-MM-DD)
  tipo_contrato?: string;         // Enum: 'VIVIENDA_UNICA' | 'COMERCIAL' | etc.
  terminos_financieros: {
    monto_base_vigente: number;
    indice_tipo: string;          // 'ICL' | 'IPC' | 'FIJO'
    interes_mora_diaria?: number;
    iva_calculo_base?: string;    // 'INCLUIDO' | 'MAS_IVA'
    comision_administracion_porcentaje?: number;
    honorarios_locador_porcentaje?: number;
    honorarios_locador_cuotas?: number;
    honorarios_locatario_porcentaje?: number;
    honorarios_locatario_cuotas?: number;
  };
  deposito_monto?: number;
  deposito_tipo_ajuste?: string;  // 'AL_ORIGEN' | 'AL_ULTIMO_ALQUILER'
  deposito_cuotas?: number;
}
```

### Validaciones

- `propiedad_id`: Debe ser un ObjectId válido de MongoDB
- `partes`: Debe incluir al menos 1 locador y 1 locatario
- `fecha_inicio`, `fecha_final`, `ajuste_programado`: Formato ISO 8601 (YYYY-MM-DD)
- `indice_tipo`: 'ICL', 'IPC' o 'FIJO'
- `tipo_contrato`: Enum válido (opcional, default: 'VIVIENDA')

### Defaults desde ContractSettings

Si no se especifican, se usan valores desde `ContractSettings`:

- `comision_administracion_porcentaje`: Default 7%
- `interes_mora_diaria`: Default 0.05% diario
- `deposito_tipo_ajuste`: Default 'AL_ULTIMO_ALQUILER'
- `iva_calculo_base`: Default 'MAS_IVA'

### Notas sobre `iva_calculo_base`

- Valores permitidos: `INCLUIDO` | `MAS_IVA`.
- `INCLUIDO`: Los montos ya incluyen IVA en su presentación final.
- `MAS_IVA`: Los montos son base imponible; el IVA se adiciona al presentar/cobrar.
- Si no se envía en el request, se toma el valor por defecto definido en `ContractSettings`.

### 📊 Cálculo de Honorarios de Creación de Contrato

Los honorarios de locador y locatario se calculan como un **porcentaje del monto total del contrato**, no del monto mensual.

**Fórmula:**

```
Monto Total del Contrato = Duración en meses × Monto Base Vigente
Honorarios Totales = Monto Total del Contrato × Porcentaje
Monto por Cuota = Honorarios Totales ÷ Número de Cuotas
```

**Ejemplo:**

- Contrato de 36 meses
- Monto base: $100,000/mes
- Honorarios locador: 2% en 1 cuota
- Honorarios locatario: 5% en 2 cuotas

```
Monto Total Contrato = 36 × $100,000 = $3,600,000

Honorarios Locador = $3,600,000 × 2% = $72,000 (en 1 cuota)
Honorarios Locatario = $3,600,000 × 5% = $180,000 (en 2 cuotas de $90,000 c/u)
```

**⚠️ Importante:** Para contratos con índice FIJO, la duración es desde `fecha_inicio` hasta `fecha_final`. Para contratos ICL/IPC, se usa la duración completa del contrato (no solo hasta el primer ajuste).

---

## Response Structure

### Estructura de Respuesta

```typescript
{
  asientos_alquiler: AsientoPreview[];
  asiento_deposito?: AsientoPreview;
  asientos_honorarios_locador: AsientoPreview[];
  asientos_honorarios_locatario: AsientoPreview[];
  iva_calculo_base: 'INCLUIDO' | 'MAS_IVA';
  honorarios_inmobiliaria: { ... };
  resumen: { ... };
  pagos_iniciales: Array<{
    agente_id: string;
    rol: 'LOCADOR' | 'LOCATARIO' | 'INMOBILIARIA';
    movimientos: Array<{
      tipo: string; // 'Alquiler' | 'Honorarios' | 'Depósito' | 'Administración'
      cuenta: string; // código de cuenta contable
      debe: number;
      haber: number;
      descripcion: string;
    }>;
  }>;
  totalizadores_por_agente: Array<{
    agente_id: string;
    rol: 'LOCADOR' | 'LOCATARIO' | 'INMOBILIARIA';
    total_debe: number;
    total_haber: number;
  }>;
}
```

### AsientoPreview

```typescript
{
  tipo_asiento: string;            // 'Alquiler' | 'Deposito en Garantia' | 'Honorarios Locador' | 'Honorarios Locatario'
  fecha_vencimiento: string;       // ISO 8601
  descripcion: string;
  partidas: PartidaPreview[];
  total_debe: number;
  total_haber: number;
  imputaciones?: Array<{ rol: 'LOCADOR' | 'LOCATARIO' | 'GARANTE'; agente_id: string }>; // A quién se imputa
}
```

Notas:

- `imputaciones` sirve para que el frontend pueda mostrar a quién corresponde el asiento sin necesidad de inferirlo desde las partidas. No modifica la lógica contable; es información de presentación.
- Cada `PartidaPreview` puede incluir `agente_id`/`agente_nombre` si aplica. No todas las partidas están asociadas a un agente.

### PartidaPreview

```typescript
{
  cuenta_codigo: string;           // Ej: 'CXC_ALQ', 'ING_HNR'
  cuenta_nombre: string;           // Ej: 'Cuentas por Cobrar - Alquileres'
  descripcion: string;
  debe: number;
  haber: number;
  agente_id?: string;              // ObjectId (opcional)
  agente_nombre?: string;          // Nombre del agente (opcional)
}
```

---

## Ejemplos Completos

### Ejemplo 1: Contrato Vivienda con Depósito y Honorarios

**Request:**

```bash
curl -X POST http://localhost:3000/contracts/calculate-initial-payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {
        "agente_id": "6789abcd1234567890abc001",
        "rol": "LOCADOR"
      },
      {
        "agente_id": "6789abcd1234567890abc002",
        "rol": "LOCATARIO"
      }
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2028-11-01",
    "ajuste_programado": "2026-11-01",
    "tipo_contrato": "VIVIENDA_UNICA",
    "terminos_financieros": {
      "monto_base_vigente": 100000,
      "indice_tipo": "ICL",
      "comision_administracion_porcentaje": 7,
      "honorarios_locador_porcentaje": 2,
      "honorarios_locador_cuotas": 1,
      "honorarios_locatario_porcentaje": 5,
      "honorarios_locatario_cuotas": 2
    },
    "deposito_monto": 100000,
    "deposito_tipo_ajuste": "AL_ULTIMO_ALQUILER"
  }'
```

**Response (simplificada):**

```json
{
  "asientos_alquiler": [ ... ],
  "asiento_deposito": { ... },
  "asientos_honorarios_locador": [ ... ],
  "asientos_honorarios_locatario": [ ... ],
  "iva_calculo_base": "MAS_IVA",
  "honorarios_inmobiliaria": { ... },
  "resumen": { ... },
  "pagos_iniciales": [
    {
      "agente_id": "6789abcd1234567890abc002",
      "rol": "LOCATARIO",
      "movimientos": [
        {
          "tipo": "Alquiler",
          "cuenta": "CXC_ALQ",
          "debe": 100000,
          "haber": 0,
          "descripcion": "Alquiler 11/2025"
        },
        {
          "tipo": "Honorarios",
          "cuenta": "ING_HNR",
          "debe": 180000,
          "haber": 0,
          "descripcion": "Honorarios locatario"
        },
        {
          "tipo": "Depósito",
          "cuenta": "PAS_DEP",
          "debe": 100000,
          "haber": 0,
          "descripcion": "Depósito en garantía"
        }
      ]
    },
    {
      "agente_id": "6789abcd1234567890abc001",
      "rol": "LOCADOR",
      "movimientos": [
        {
          "tipo": "Alquiler",
          "cuenta": "CXP_LOC",
          "debe": 0,
          "haber": 93000,
          "descripcion": "Crédito alquiler"
        },
        {
          "tipo": "Honorarios",
          "cuenta": "ING_HNR",
          "debe": 72000,
          "haber": 0,
          "descripcion": "Honorarios locador"
        }
      ]
    },
    {
      "agente_id": "INMOBILIARIA",
      "rol": "INMOBILIARIA",
      "movimientos": [
        {
          "tipo": "Honorarios",
          "cuenta": "ING_HNR",
          "debe": 0,
          "haber": 252000,
          "descripcion": "Crédito honorarios inmobiliaria"
        }
      ]
    }
  ],
  "totalizadores_por_agente": [
    {
      "agente_id": "6789abcd1234567890abc002",
      "rol": "LOCATARIO",
      "total_debe": 380000,
      "total_haber": 0
    },
    {
      "agente_id": "6789abcd1234567890abc001",
      "rol": "LOCADOR",
      "total_debe": 72000,
      "total_haber": 93000
    },
    {
      "agente_id": "INMOBILIARIA",
      "rol": "INMOBILIARIA",
      "total_debe": 0,
      "total_haber": 252000
    }
  ]
}
          "haber": 93000,
          "agente_id": "6789abcd1234567890abc001"
        },
        {
          "cuenta_codigo": "ING_HNR",
          "cuenta_nombre": "Ingresos por Honorarios",
          "descripcion": "Honorarios por alquiler 11/2025",
          "debe": 0,
          "haber": 7000
        }
      ],
      "total_debe": 100000,
      "total_haber": 100000,
      "imputaciones": [
        { "rol": "LOCATARIO", "agente_id": "6789abcd1234567890abc002" },
        { "rol": "LOCADOR", "agente_id": "6789abcd1234567890abc001" }
      ]
    }
    // ... 11 asientos más (hasta octubre 2026)
  ],
  "asiento_deposito": {
    "tipo_asiento": "Deposito en Garantia",
    "fecha_vencimiento": "2028-11-01T00:00:00.000Z",
    "descripcion": "Registro de depósito en garantía",
    "partidas": [
      {
        "cuenta_codigo": "PAS_DEP",
        "cuenta_nombre": "Pasivo - Depósitos en Garantía",
        "descripcion": "Recepción de depósito en garantía",
        "debe": 0,
        "haber": 100000,
        "agente_id": "6789abcd1234567890abc002"
      },
      {
        "cuenta_codigo": "ACT_FID",
        "cuenta_nombre": "Activo Fiduciario - Caja/Banco",
        "descripcion": "Ingreso de depósito en garantía a caja/banco",
        "debe": 100000,
        "haber": 0
      }
    ],
    "total_debe": 100000,
    "total_haber": 100000,
    "imputaciones": [
      { "rol": "LOCATARIO", "agente_id": "6789abcd1234567890abc002" }
    ]
  },
  "asientos_honorarios_locador": [
    {
      "tipo_asiento": "Honorarios Locador",
      "fecha_vencimiento": "2025-11-11T00:00:00.000Z",
      "descripcion": "Honorarios locador - Cuota 1/1",
      "partidas": [
        {
          "cuenta_codigo": "CXP_LOC",
          "cuenta_nombre": "Cuentas por Pagar - Locador",
          "descripcion": "Descuento honorarios locador - Cuota 1",
          "debe": 72000,
          "haber": 0,
          "agente_id": "6789abcd1234567890abc001"
        },
        {
          "cuenta_codigo": "ING_HNR",
          "cuenta_nombre": "Ingresos por Honorarios",
          "descripcion": "Ingreso honorarios locador - Cuota 1",
          "debe": 0,
          "haber": 72000
        }
      ],
      "total_debe": 72000,
      "total_haber": 72000
    }
  ],
  "asientos_honorarios_locatario": [
    {
      "tipo_asiento": "Honorarios Locatario",
      "fecha_vencimiento": "2025-11-11T00:00:00.000Z",
      "descripcion": "Honorarios locatario - Cuota 1/2",
      "partidas": [
        {
          "cuenta_codigo": "CXC_ALQ",
          "cuenta_nombre": "Cuentas por Cobrar - Alquileres",
          "descripcion": "Cargo honorarios locatario - Cuota 1",
          "debe": 180000,
          "haber": 0,
          "agente_id": "6789abcd1234567890abc002"
        },
        {
          "cuenta_codigo": "ING_HNR",
          "cuenta_nombre": "Ingresos por Honorarios",
          "descripcion": "Ingreso honorarios locatario - Cuota 1",
          "debe": 0,
          "haber": 180000
        }
      ],
      "total_debe": 180000,
      "total_haber": 180000
    },
    {
      "tipo_asiento": "Honorarios Locatario",
      "fecha_vencimiento": "2025-12-11T00:00:00.000Z",
      "descripcion": "Honorarios locatario - Cuota 2/2",
      "partidas": [
        {
          "cuenta_codigo": "CXC_ALQ",
          "cuenta_nombre": "Cuentas por Cobrar - Alquileres",
          "descripcion": "Cargo honorarios locatario - Cuota 2",
          "debe": 180000,
          "haber": 0,
          "agente_id": "6789abcd1234567890abc002"
        },
        {
          "cuenta_codigo": "ING_HNR",
          "cuenta_nombre": "Ingresos por Honorarios",
          "descripcion": "Ingreso honorarios locatario - Cuota 2",
          "debe": 0,
          "haber": 180000
        }
      ],
      "total_debe": 180000,
      "total_haber": 180000
    }
  ],
  "iva_calculo_base": "MAS_IVA",
  "honorarios_inmobiliaria": {
    "mensual": {
      "porcentaje": 7,
      "monto_mensual": 7000,
      "meses_proyectados": 12,
      "total": 84000
    },
    "locador": {
      "porcentaje": 2,
      "cuotas": 1,
      "monto_total": 72000,
      "monto_por_cuota": 72000
    },
    "locatario": {
      "porcentaje": 5,
      "cuotas": 2,
      "monto_total": 180000,
      "monto_por_cuota": 90000
    },
    "notas_iva": "Los montos informados son base imponible, el IVA se adiciona según corresponda."
  },
  "resumen": {
    "total_asientos": 16,
    "total_meses_alquiler": 12,
    "monto_total_alquileres": 1200000,
    "monto_deposito": 100000,
    "monto_total_honorarios_locador": 72000,
    "monto_total_honorarios_locatario": 180000,
    "monto_total_honorarios_inmobiliaria": 84000
  }
}
```

### Ejemplo 2: Contrato Comercial sin Depósito ni Honorarios

**Request:**

```bash
curl -X POST http://localhost:3000/contracts/calculate-initial-payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {
        "agente_id": "6789abcd1234567890abc001",
        "rol": "LOCADOR"
      },
      {
        "agente_id": "6789abcd1234567890abc002",
        "rol": "LOCATARIO"
      }
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2028-11-01",
    "ajuste_programado": "2026-11-01",
    "tipo_contrato": "COMERCIAL",
    "terminos_financieros": {
      "monto_base_vigente": 250000,
      "indice_tipo": "ICL",
      "comision_administracion_porcentaje": 5
    }
  }'
```

**Response (simplificada):**

```json
{
  "asientos_alquiler": [
    // 12 asientos de alquiler (noviembre 2025 - octubre 2026)
  ],
  "asiento_deposito": undefined,
  "asientos_honorarios_locador": [],
  "asientos_honorarios_locatario": [],
  "resumen": {
    "total_asientos": 12,
    "total_meses_alquiler": 12,
    "monto_total_alquileres": 3000000,
    "monto_deposito": 0,
    "monto_total_honorarios_locador": 0,
    "monto_total_honorarios_locatario": 0,
    "monto_total_honorarios_inmobiliaria": 150000
  }
}
```

### Ejemplo 3: Contrato FIJO (proyecta hasta fecha_final)

**Request:**

```bash
curl -X POST http://localhost:3000/contracts/calculate-initial-payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {
        "agente_id": "6789abcd1234567890abc001",
        "rol": "LOCADOR"
      },
      {
        "agente_id": "6789abcd1234567890abc002",
        "rol": "LOCATARIO"
      }
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2026-05-01",
    "ajuste_programado": "2026-05-01",
    "tipo_contrato": "TEMPORARIO",
    "terminos_financieros": {
      "monto_base_vigente": 150000,
      "indice_tipo": "FIJO",
      "comision_administracion_porcentaje": 8
    },
    "deposito_monto": 150000
  }'
```

**Resumen esperado:**

- 6 meses de alquiler (noviembre 2025 - abril 2026)
- 1 asiento de depósito
- Total: 7 asientos

---

## Integración con Frontend

### Flujo Recomendado

```typescript
// 1. Usuario completa formulario de contrato
const formData = {
  propiedad_id: selectedProperty.id,
  partes: [
    { agente_id: locadorId, rol: 'LOCADOR' },
    { agente_id: locatarioId, rol: 'LOCATARIO' },
  ],
  fecha_inicio: startDate,
  fecha_final: endDate,
  ajuste_programado: adjustmentDate,
  terminos_financieros: {
    monto_base_vigente: monthlyRent,
    indice_tipo: indexType,
    comision_administracion_porcentaje: commissionRate,
    // ... otros campos
  },
  deposito_monto: depositAmount,
};

// 2. Usuario hace clic en "Vista Previa de Pagos"
async function showPaymentPreview() {
  const response = await fetch('/contracts/calculate-initial-payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  const preview = await response.json();

  // 3. Mostrar modal con resumen
  displayPreviewModal(preview);
}

// 4. Renderizar resumen
function displayPreviewModal(preview) {
  console.log('Total de asientos:', preview.resumen.total_asientos);
  console.log('Meses de alquiler:', preview.resumen.total_meses_alquiler);
  console.log(
    'Total alquileres:',
    formatCurrency(preview.resumen.monto_total_alquileres),
  );
  console.log('Depósito:', formatCurrency(preview.resumen.monto_deposito));
  console.log(
    'Honorarios inmobiliaria:',
    formatCurrency(preview.resumen.monto_total_honorarios_inmobiliaria),
  );

  // Mostrar tablas detalladas por tipo de asiento
  renderTable('Alquileres Mensuales', preview.asientos_alquiler);
  if (preview.asiento_deposito) {
    renderTable('Depósito en Garantía', [preview.asiento_deposito]);
  }
  if (preview.asientos_honorarios_locador.length > 0) {
    renderTable('Honorarios Locador', preview.asientos_honorarios_locador);
  }
  if (preview.asientos_honorarios_locatario.length > 0) {
    renderTable('Honorarios Locatario', preview.asientos_honorarios_locatario);
  }
}

// 5. Usuario confirma y crea el contrato
async function confirmContract() {
  await fetch('/contracts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  showSuccessMessage('Contrato creado exitosamente');
}
```

### Componente Angular (Ejemplo)

```typescript
import { Component } from '@angular/core';
import { ContractsService } from './contracts.service';

@Component({
  selector: 'app-contract-preview',
  template: `
    <button (click)="showPreview()">Vista Previa de Pagos</button>

    <div *ngIf="preview" class="preview-modal">
      <h2>Vista Previa de Asientos Contables</h2>

      <!-- Resumen -->
      <div class="summary">
        <p>
          <strong>Total asientos:</strong> {{ preview.resumen.total_asientos }}
        </p>
        <p>
          <strong>Meses de alquiler:</strong>
          {{ preview.resumen.total_meses_alquiler }}
        </p>
        <p>
          <strong>Total alquileres:</strong>
          {{ preview.resumen.monto_total_alquileres | currency }}
        </p>
        <p>
          <strong>Depósito:</strong>
          {{ preview.resumen.monto_deposito | currency }}
        </p>
        <p>
          <strong>Honorarios inmobiliaria:</strong>
          {{ preview.resumen.monto_total_honorarios_inmobiliaria | currency }}
        </p>
      </div>

      <!-- Tabla de Alquileres -->
      <h3>Alquileres Mensuales</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha Vencimiento</th>
            <th>Descripción</th>
            <th>Total Debe</th>
            <th>Total Haber</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let asiento of preview.asientos_alquiler">
            <td>{{ asiento.fecha_vencimiento | date }}</td>
            <td>{{ asiento.descripcion }}</td>
            <td>{{ asiento.total_debe | currency }}</td>
            <td>{{ asiento.total_haber | currency }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Botones -->
      <button (click)="confirmCreate()">Confirmar y Crear Contrato</button>
      <button (click)="closePreview()">Cancelar</button>
    </div>
  `,
})
export class ContractPreviewComponent {
  preview: any;
  contractData: any;

  constructor(private contractsService: ContractsService) {}

  async showPreview() {
    this.preview = await this.contractsService.calculateInitialPayments(
      this.contractData,
    );
  }

  async confirmCreate() {
    await this.contractsService.create(this.contractData);
    this.closePreview();
  }

  closePreview() {
    this.preview = null;
  }
}
```

---

## Ventajas para el Frontend

### ✅ UX Mejorado

- Usuario ve exactamente qué se creará antes de confirmar
- Reduce errores de configuración
- Transparencia financiera

### ✅ Validación Visual

- Permite detectar errores en porcentajes o montos
- Usuario puede ajustar configuración antes de persistir

### ✅ Generación de Reportes

- Usar los datos para PDF de cotización
- Exportar a Excel para análisis

### ✅ Sin Riesgo

- No crea datos en la BD
- Puede llamarse múltiples veces sin efecto

---

## Errores Comunes

### 400 Bad Request - Faltan partes

```json
{
  "statusCode": 400,
  "message": "Se requiere un locador y un locatario en las partes del contrato"
}
```

**Solución:** Incluir al menos 1 parte con `rol: "LOCADOR"` y 1 con `rol: "LOCATARIO"`.

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solución:** Incluir header `Authorization: Bearer TOKEN` válido.

### 404 Not Found - Cuentas contables no configuradas

Si el backend no tiene las cuentas `CXC_ALQ`, `CXP_LOC`, etc. configuradas en `ChartOfAccounts`, fallará.

**Solución:** Ejecutar el seed de cuentas contables:

```bash
npm run seed:chart-of-accounts
```

---

## Testing con cURL

### Test 1: Contrato básico

```bash
curl -X POST http://localhost:3000/contracts/calculate-initial-payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {"agente_id": "6789abcd1234567890abc001", "rol": "LOCADOR"},
      {"agente_id": "6789abcd1234567890abc002", "rol": "LOCATARIO"}
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2028-11-01",
    "ajuste_programado": "2026-11-01",
    "terminos_financieros": {
      "monto_base_vigente": 100000,
      "indice_tipo": "ICL"
    }
  }'
```

### Test 2: Con honorarios y depósito

```bash
curl -X POST http://localhost:3000/contracts/calculate-initial-payments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propiedad_id": "6789abcd1234567890abcdef",
    "partes": [
      {"agente_id": "6789abcd1234567890abc001", "rol": "LOCADOR"},
      {"agente_id": "6789abcd1234567890abc002", "rol": "LOCATARIO"}
    ],
    "fecha_inicio": "2025-11-01",
    "fecha_final": "2028-11-01",
    "ajuste_programado": "2026-11-01",
    "terminos_financieros": {
      "monto_base_vigente": 100000,
      "indice_tipo": "ICL",
      "comision_administracion_porcentaje": 7,
      "honorarios_locador_porcentaje": 2,
      "honorarios_locador_cuotas": 1,
      "honorarios_locatario_porcentaje": 5,
      "honorarios_locatario_cuotas": 2
    },
    "deposito_monto": 100000
  }' | jq '.'
```

---

## Próximos Pasos

1. **Frontend:** Implementar modal de vista previa
2. **PDF:** Generar documento con los asientos calculados
3. **Validación:** Agregar lógica de negocio adicional (ej. monto mínimo)
4. **Cache:** Cachear cuentas contables para mejorar performance

---

## Referencias

- **Controller:** `src/modules/contracts/contracts.controller.ts`
- **Service:** `src/modules/contracts/contracts.service.ts`
- **DTO:** `src/modules/contracts/dto/calculate-initial-payments.dto.ts`
- **Related:** `CONTRACT_SETTINGS_API.md`, `CONTRACTS_COLLECTION.md`

---

## 📝 Changelog

### Versión 1.1 - 2025-10-15

**🔄 CAMBIO IMPORTANTE: Cálculo de Honorarios**

- **Antes**: Los honorarios de locador/locatario se calculaban como porcentaje del **monto base mensual**
- **Ahora**: Los honorarios se calculan como porcentaje del **monto total del contrato** (duración × monto base)

**Ejemplo del impacto:**

Contrato de 36 meses a $100,000/mes con 2% honorarios locador:

- **Antes**: $100,000 × 2% = $2,000
- **Ahora**: ($100,000 × 36) × 2% = $72,000 ✅

**Justificación**: Los honorarios de creación de contrato representan un % del valor total del negocio inmobiliario, no del alquiler mensual.

**Campos afectados en la respuesta:**

- `honorarios_inmobiliaria.locador.monto_total`
- `honorarios_inmobiliaria.locador.monto_por_cuota`
- `honorarios_inmobiliaria.locatario.monto_total`
- `honorarios_inmobiliaria.locatario.monto_por_cuota`
- `resumen.monto_total_honorarios_locador`
- `resumen.monto_total_honorarios_locatario`

### Versión 1.0 - 2025-10-15

- Release inicial del endpoint
- Soporte para preview de asientos sin persistir
- Integración con ContractSettings para defaults
- Cálculo de alquileres, depósito y honorarios
- Campo `imputaciones` en asientos
- Bloque `honorarios_inmobiliaria` detallado
- Soporte para `iva_calculo_base`

---

**Fecha:** 2025-10-15  
**Versión:** 1.1  
**Autor:** GitHub Copilot + Usuario
