# Ajustes de Asientos Contables por Índices

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Tipos de Índices](#tipos-de-índices)
3. [Asientos Ajustables](#asientos-ajustables)
4. [Flujo de Ajuste](#flujo-de-ajuste)
5. [Estructura de Datos](#estructura-de-datos)
6. [Casos de Uso](#casos-de-uso)
7. [Implementación Técnica](#implementación-técnica)

---

## Introducción

El sistema de ajustes de asientos contables permite actualizar automáticamente los montos de ciertos asientos basándose en índices económicos externos. Esto es esencial para contratos de alquiler en Argentina, donde las actualizaciones por índices como ICL (Índice de Contratos de Locación) e IPC (Índice de Precios al Consumidor) son reguladas por ley.

### Principios Fundamentales

1. **Los montos originales nunca se modifican**: Se mantiene trazabilidad histórica
2. **Se crea un campo `monto_actual`**: Refleja el monto ajustado
3. **Se genera un asiento de ajuste**: Documenta la diferencia contablemente
4. **Los ajustes se aplican en períodos específicos**: Según la periodicidad definida en el contrato

---

## Tipos de Índices

### 1. **ICL (Índice de Contratos de Locación)**

- **Fuente**: Banco Central de la República Argentina (BCRA)
- **Uso**: Contratos de locación habitacional (Ley 27.551)
- **Actualización**: Mensual
- **Fórmula**: `nuevo_monto = monto_base * (ICL_actual / ICL_base)`

### 2. **IPC (Índice de Precios al Consumidor)**

- **Fuente**: INDEC (Instituto Nacional de Estadística y Censos)
- **Uso**: Contratos comerciales, ajustes generales
- **Actualización**: Mensual
- **Fórmula**: `nuevo_monto = monto_base * (IPC_actual / IPC_base)`

### 3. **FIJO**

- **Descripción**: Sin ajuste por índice
- **Uso**: Contratos con monto fijo durante toda la vigencia
- **Fórmula**: `monto_actual = monto_original` (sin cambios)

### 4. **CUSTOM (Futuro)**

- **Descripción**: Índices personalizados o combinados
- **Uso**: Casos especiales negociados

---

## Asientos Ajustables

### 1. **Asientos de Alquiler Mensual**

**Campos relevantes:**

```typescript
{
  tipo_asiento: "Alquiler",
  estado: "PENDIENTE_AJUSTE",
  es_ajustable: true,
  monto_original: 1000000,
  monto_actual: 1000000, // Se actualiza tras el ajuste
  fecha_imputacion: "2025-01-01",
  fecha_ultimo_ajuste: null, // Se actualiza al aplicar ajuste
  metadata: {
    indice_base_valor: 2.5,      // ICL al inicio del contrato
    indice_actual_valor: null,   // Se actualiza al ajustar
    porcentaje_ajuste: null      // Se calcula al ajustar
  }
}
```

**Proceso:**

1. Al crear el contrato, los primeros N meses tienen `estado: "PENDIENTE"`
2. Al llegar al mes de ajuste, cambian a `estado: "PENDIENTE_AJUSTE"`
3. El sistema busca el ICL/IPC correspondiente
4. Se genera un asiento de ajuste
5. Se actualiza `monto_actual` y cambia a `estado: "PENDIENTE"`

---

### 2. **Depósito en Garantía (AL_ULTIMO_ALQUILER)**

**Campos relevantes:**

```typescript
{
  tipo_asiento: "Deposito en Garantia - Devolucion",
  monto_original: 1000000,
  monto_actual: 1000000, // Se ajusta al final del contrato
  metadata: {
    deposito_tipo_ajuste: "AL_ULTIMO_ALQUILER",
    monto_estimado_devolucion: null, // Se calcula dinámicamente
    es_estimado: true
  }
}
```

**Proceso:**

1. Al crear el contrato, se genera con `monto_original`
2. Durante la vigencia, `monto_estimado_devolucion` se calcula consultando el último alquiler ajustado
3. Al momento de liquidar la devolución:
   - Se busca el último asiento de alquiler
   - Se calcula la diferencia: `diferencia = ultimo_alquiler.monto_actual - deposito_original`
   - Se genera un **asiento de ajuste del depósito**
   - El locador absorbe la diferencia (se descuenta de sus liquidaciones)

**Asiento de Ajuste del Depósito:**

```javascript
{
  tipo_asiento: "Ajuste Deposito en Garantia",
  descripcion: "Ajuste de depósito por índice AL_ULTIMO_ALQUILER",
  partidas: [
    {
      cuenta_id: "PAS_DEP",  // Pasivo Depósito
      debe: 500000,          // Diferencia por ajuste
      haber: 0,
      agente_id: LOCADOR_ID
    },
    {
      cuenta_id: "CXP_LOC",  // Cuentas por Pagar Locador
      debe: 0,
      haber: 500000,         // Deuda adicional del locador
      agente_id: LOCADOR_ID
    }
  ],
  metadata: {
    deposito_original: 1000000,
    ultimo_alquiler_ajustado: 1500000,
    diferencia_ajuste: 500000,
    contrato_id: "..."
  }
}
```

---

### 3. **Honorarios Iniciales (Futuro)**

Si se define que los honorarios iniciales también se ajustan por índice:

```typescript
{
  tipo_asiento: "Honorarios Locador",
  es_ajustable: true, // Si aplica ajuste
  monto_original: 500000,
  monto_actual: 500000
}
```

---

## Flujo de Ajuste

### Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────┐
│  1. JOB SCHEDULER (Cron diario)                             │
│     - Busca asientos con estado="PENDIENTE_AJUSTE"          │
│     - Filtra por fecha_vencimiento <= hoy + 7 días          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  2. OBTENER ÍNDICE EXTERNO                                  │
│     - Consulta módulo de índices económicos                 │
│     - Parámetros: tipo_indice, fecha_base, fecha_actual     │
│     - Retorna: {indice_base, indice_actual, porcentaje}     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3. CALCULAR AJUSTE                                         │
│     - nuevo_monto = monto_original * (indice_actual/base)   │
│     - diferencia = nuevo_monto - monto_original             │
│     - Validar: diferencia > 0                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  4. GENERAR ASIENTO DE AJUSTE                               │
│     - tipo_asiento: "Ajuste por Indice"                     │
│     - DEBE: CXC_ALQ (diferencia) [agente: LOCATARIO]        │
│     - HABER: CXP_LOC (parte locador) [agente: LOCADOR]      │
│     - HABER: ING_HNR (comisión inmo)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  5. ACTUALIZAR ASIENTO ORIGINAL                             │
│     - monto_actual = nuevo_monto                            │
│     - estado = "PENDIENTE"                                  │
│     - fecha_ultimo_ajuste = hoy                             │
│     - metadata.indice_actual_valor = indice_actual          │
│     - metadata.porcentaje_ajuste = porcentaje               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  6. NOTIFICAR                                               │
│     - Email/notificación a admin inmobiliaria               │
│     - Generar reporte de ajustes aplicados                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Estructura de Datos

### Schema: AccountingEntry

```typescript
interface AccountingEntry {
  _id: ObjectId;
  tipo_asiento: string;
  estado: 'PENDIENTE' | 'PENDIENTE_AJUSTE' | 'PAGADO' | 'LIQUIDADO' | 'ANULADO';

  // Montos
  monto_original: number; // Nunca cambia
  monto_actual: number; // Se actualiza con ajustes

  // Fechas
  fecha_imputacion: Date;
  fecha_vencimiento: Date;
  fecha_ultimo_ajuste?: Date; // Última vez que se ajustó

  // Control de ajustes
  es_ajustable: boolean; // Si permite ajuste por índice
  indice_tipo?: 'ICL' | 'IPC' | 'FIJO' | 'CUSTOM';
  ajuste_periodicidad_meses?: number; // Cada cuántos meses se ajusta

  // Partidas
  partidas: Partida[];

  // Metadata extendida
  metadata?: {
    // Índices
    indice_base_valor?: number; // ICL/IPC base (al inicio)
    indice_base_fecha?: Date; // Fecha del índice base
    indice_actual_valor?: number; // ICL/IPC actual (tras ajuste)
    indice_actual_fecha?: Date; // Fecha del índice actual
    porcentaje_ajuste?: number; // % de incremento aplicado

    // Depósitos
    deposito_tipo_ajuste?: 'AL_ORIGEN' | 'AL_ULTIMO_ALQUILER';
    monto_estimado_devolucion?: number;
    es_estimado?: boolean;

    // Trazabilidad
    asiento_ajuste_id?: ObjectId; // Link al asiento de ajuste generado
    historial_ajustes?: AjusteHistorial[];
  };

  // Historial
  historial_cambios: HistorialCambio[];
}

interface AjusteHistorial {
  fecha_ajuste: Date;
  monto_antes: number;
  monto_despues: number;
  indice_valor: number;
  porcentaje: number;
  asiento_ajuste_id: ObjectId;
  usuario_id: ObjectId;
}
```

---

## Casos de Uso

### Caso 1: Alquiler con Ajuste Semestral por ICL

**Contrato:**

- Fecha inicio: 2025-01-01
- Monto base: $1,000,000
- Índice: ICL
- Periodicidad ajuste: 6 meses
- ICL base (enero 2025): 2.50

**Timeline:**

| Mes     | Acción                    | Monto      | Estado           |
| ------- | ------------------------- | ---------- | ---------------- |
| 01/2025 | Crear asiento             | $1,000,000 | PENDIENTE        |
| 02/2025 | -                         | $1,000,000 | PENDIENTE        |
| ...     | -                         | $1,000,000 | PENDIENTE        |
| 06/2025 | Marcar ajustable          | $1,000,000 | PENDIENTE_AJUSTE |
| 07/2025 | Aplicar ajuste (ICL=2.75) | $1,100,000 | PENDIENTE        |
| 08/2025 | -                         | $1,100,000 | PENDIENTE        |
| ...     | -                         | $1,100,000 | PENDIENTE        |
| 12/2025 | Marcar ajustable          | $1,100,000 | PENDIENTE_AJUSTE |
| 01/2026 | Aplicar ajuste (ICL=3.00) | $1,200,000 | PENDIENTE        |

**Asiento de Ajuste (Julio 2025):**

```javascript
{
  tipo_asiento: "Ajuste por Indice",
  descripcion: "Ajuste semestral por ICL - Julio 2025",
  fecha_imputacion: "2025-07-01",
  partidas: [
    {
      cuenta_id: "CXC_ALQ",
      debe: 100000,  // Diferencia
      haber: 0,
      agente_id: LOCATARIO_ID,
      descripcion: "Ajuste alquiler por ICL (10%)"
    },
    {
      cuenta_id: "CXP_LOC",
      debe: 0,
      haber: 92000,  // 92% para locador
      agente_id: LOCADOR_ID,
      descripcion: "Ajuste liquidación locador"
    },
    {
      cuenta_id: "ING_HNR",
      debe: 0,
      haber: 8000,   // 8% comisión inmobiliaria
      descripcion: "Ajuste comisión inmobiliaria"
    }
  ],
  metadata: {
    asiento_original_id: "...",
    indice_tipo: "ICL",
    indice_base: 2.50,
    indice_actual: 2.75,
    porcentaje_ajuste: 10.0,
    monto_original: 1000000,
    monto_ajustado: 1100000
  }
}
```

---

### Caso 2: Depósito en Garantía - AL_ULTIMO_ALQUILER

**Contrato:**

- Fecha inicio: 2025-01-01
- Fecha fin: 2028-01-01
- Depósito inicial: $1,000,000
- Tipo ajuste: AL_ULTIMO_ALQUILER
- Último alquiler (12/2027): $1,500,000

**Proceso de Devolución:**

1. **Consultar último alquiler:**

```javascript
const ultimoAlquiler = await accountingEntriesService
  .findByContractAndType(contrato_id, 'Alquiler')
  .sort({ fecha_imputacion: -1 })
  .limit(1);

const montoDevolucion = ultimoAlquiler.monto_actual; // 1,500,000
const diferencia = montoDevolucion - 1000000; // 500,000
```

2. **Generar asiento de ajuste:**

```javascript
{
  tipo_asiento: "Ajuste Deposito en Garantia",
  descripcion: "Ajuste depósito por último alquiler",
  fecha_imputacion: "2028-01-01",
  partidas: [
    {
      cuenta_id: "PAS_DEP",
      debe: 500000,
      haber: 0,
      agente_id: LOCADOR_ID,
      descripcion: "Incremento pasivo depósito"
    },
    {
      cuenta_id: "CXP_LOC",
      debe: 0,
      haber: 500000,
      agente_id: LOCADOR_ID,
      descripcion: "Deuda locador por ajuste depósito"
    }
  ],
  metadata: {
    deposito_original: 1000000,
    ultimo_alquiler: 1500000,
    diferencia: 500000,
    porcentaje_ajuste: 50.0
  }
}
```

3. **Actualizar asiento de devolución:**

```javascript
asientoDevolucion.monto_actual = 1500000;
asientoDevolucion.metadata.monto_estimado_devolucion = 1500000;
asientoDevolucion.metadata.es_estimado = false;
asientoDevolucion.metadata.asiento_ajuste_id = asientoAjuste._id;
```

4. **Efecto en estado de cuenta del locador:**

```javascript
// El locador verá:
{
  tipo: "A recibir",
  concepto: "Devolución depósito",
  monto: 1500000
},
{
  tipo: "A pagar",
  concepto: "Ajuste depósito",
  monto: -500000
}
// Neto a recibir: 1,000,000 (del saldo disponible en ACT_FID)
```

---

### Caso 3: Depósito en Garantía - AL_ORIGEN

**Contrato:**

- Depósito inicial: $1,000,000
- Tipo ajuste: AL_ORIGEN

**Proceso:**

- **No requiere ajuste**
- `monto_actual` permanece en $1,000,000
- Se devuelve exactamente lo cobrado inicialmente

---

## Implementación Técnica

### 1. Servicio de Ajustes

**Ubicación:** `src/modules/accounting-entries/services/ajustes.service.ts`

```typescript
@Injectable()
export class AjustesService {
  constructor(
    private accountingEntriesService: AccountingEntriesService,
    private indicesEconomicosService: IndicesEconomicosService,
    private contractsService: ContractsService,
  ) {}

  /**
   * Procesa todos los asientos pendientes de ajuste
   * Se ejecuta diariamente por cron job
   */
  async procesarAjustesPendientes(): Promise<AjusteResultado[]> {
    const asientosPendientes = await this.accountingEntriesService.find({
      estado: 'PENDIENTE_AJUSTE',
      fecha_vencimiento: {
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const resultados = [];

    for (const asiento of asientosPendientes) {
      try {
        const resultado = await this.ajustarAsiento(asiento);
        resultados.push(resultado);
      } catch (error) {
        resultados.push({
          asiento_id: asiento._id,
          success: false,
          error: error.message,
        });
      }
    }

    return resultados;
  }

  /**
   * Ajusta un asiento individual
   */
  private async ajustarAsiento(
    asiento: AccountingEntry,
  ): Promise<AjusteResultado> {
    // 1. Obtener contrato para configuración
    const contrato = await this.contractsService.findOne(asiento.contrato_id);

    // 2. Obtener índices
    const indiceBase = await this.indicesEconomicosService.getIndiceValue(
      contrato.terminos_financieros.indice_tipo,
      contrato.fecha_inicio,
    );

    const fechaAjuste = this.calcularFechaAjuste(asiento, contrato);
    const indiceActual = await this.indicesEconomicosService.getIndiceValue(
      contrato.terminos_financieros.indice_tipo,
      fechaAjuste,
    );

    // 3. Calcular ajuste
    const ratio = indiceActual / indiceBase;
    const montoAjustado = Math.round(asiento.monto_original * ratio);
    const diferencia = montoAjustado - asiento.monto_actual;

    if (diferencia <= 0) {
      return {
        success: true,
        ajuste_aplicado: false,
        motivo: 'Sin incremento',
      };
    }

    // 4. Generar asiento de ajuste
    const asientoAjuste = await this.generarAsientoAjuste(asiento, diferencia, {
      indiceBase,
      indiceActual,
      ratio,
    });

    // 5. Actualizar asiento original
    await this.accountingEntriesService.update(asiento._id, {
      monto_actual: montoAjustado,
      estado: 'PENDIENTE',
      fecha_ultimo_ajuste: new Date(),
      'metadata.indice_actual_valor': indiceActual,
      'metadata.porcentaje_ajuste': (ratio - 1) * 100,
      'metadata.asiento_ajuste_id': asientoAjuste._id,
      $push: {
        'metadata.historial_ajustes': {
          fecha_ajuste: new Date(),
          monto_antes: asiento.monto_actual,
          monto_despues: montoAjustado,
          indice_valor: indiceActual,
          porcentaje: (ratio - 1) * 100,
          asiento_ajuste_id: asientoAjuste._id,
        },
      },
    });

    return {
      success: true,
      ajuste_aplicado: true,
      monto_antes: asiento.monto_actual,
      monto_despues: montoAjustado,
      diferencia,
      porcentaje: (ratio - 1) * 100,
      asiento_ajuste_id: asientoAjuste._id,
    };
  }

  /**
   * Genera el asiento contable de ajuste
   */
  private async generarAsientoAjuste(
    asientoOriginal: AccountingEntry,
    diferencia: number,
    indices: { indiceBase: number; indiceActual: number; ratio: number },
  ): Promise<AccountingEntry> {
    const contrato = await this.contractsService.findOne(
      asientoOriginal.contrato_id,
    );
    const porcentajeComision =
      contrato.terminos_financieros.comision_administracion_porcentaje / 100;

    const montoLocador = diferencia * (1 - porcentajeComision);
    const montoInmobiliaria = diferencia * porcentajeComision;

    // Buscar agentes
    const locatario = asientoOriginal.partidas.find(
      (p) => p.debe > 0,
    )?.agente_id;
    const locador = asientoOriginal.partidas.find(
      (p) => p.haber > 0 && p.agente_id,
    )?.agente_id;

    return await this.accountingEntriesService.create({
      contrato_id: asientoOriginal.contrato_id,
      tipo_asiento: 'Ajuste por Indice',
      descripcion: `Ajuste por ${contrato.terminos_financieros.indice_tipo} - ${indices.ratio.toFixed(2)}x`,
      fecha_imputacion: new Date(),
      fecha_vencimiento: asientoOriginal.fecha_vencimiento,
      partidas: [
        {
          cuenta_id: 'CXC_ALQ',
          debe: diferencia,
          haber: 0,
          agente_id: locatario,
          descripcion: `Ajuste alquiler por ${contrato.terminos_financieros.indice_tipo}`,
        },
        {
          cuenta_id: 'CXP_LOC',
          debe: 0,
          haber: montoLocador,
          agente_id: locador,
          descripcion: 'Ajuste liquidación locador',
        },
        {
          cuenta_id: 'ING_HNR',
          debe: 0,
          haber: montoInmobiliaria,
          descripcion: 'Ajuste comisión inmobiliaria',
        },
      ],
      monto_original: diferencia,
      monto_actual: diferencia,
      metadata: {
        asiento_original_id: asientoOriginal._id,
        indice_tipo: contrato.terminos_financieros.indice_tipo,
        indice_base: indices.indiceBase,
        indice_actual: indices.indiceActual,
        porcentaje_ajuste: (indices.ratio - 1) * 100,
        monto_original_asiento: asientoOriginal.monto_original,
        monto_ajustado_asiento: asientoOriginal.monto_actual + diferencia,
      },
    });
  }

  /**
   * Ajusta depósito en garantía al momento de liquidar
   */
  async ajustarDepositoGarantia(
    contratoId: string,
  ): Promise<AjusteDepositoResultado> {
    const contrato = await this.contractsService.findOne(contratoId);

    if (contrato.deposito_tipo_ajuste !== 'AL_ULTIMO_ALQUILER') {
      return { ajuste_requerido: false };
    }

    // Buscar asiento de devolución
    const asientoDevolucion =
      await this.accountingEntriesService.findByContractAndType(
        contratoId,
        'Deposito en Garantia - Devolucion',
      );

    // Buscar último alquiler
    const ultimosAlquileres =
      await this.accountingEntriesService.findByContractAndType(
        contratoId,
        'Alquiler',
      );
    ultimosAlquileres.sort(
      (a, b) => b.fecha_imputacion.getTime() - a.fecha_imputacion.getTime(),
    );
    const ultimoAlquiler = ultimosAlquileres[0];

    const depositoOriginal = asientoDevolucion.monto_original;
    const montoDevolucion = ultimoAlquiler.monto_actual;
    const diferencia = montoDevolucion - depositoOriginal;

    if (diferencia <= 0) {
      return { ajuste_requerido: false };
    }

    // Generar asiento de ajuste
    const locador = contrato.partes.find((p) => p.rol === 'LOCADOR');

    const asientoAjuste = await this.accountingEntriesService.create({
      contrato_id: contratoId,
      tipo_asiento: 'Ajuste Deposito en Garantia',
      descripcion: 'Ajuste depósito por último alquiler',
      fecha_imputacion: new Date(),
      fecha_vencimiento: contrato.fecha_final,
      partidas: [
        {
          cuenta_id: 'PAS_DEP',
          debe: diferencia,
          haber: 0,
          agente_id: locador.agente_id,
          descripcion: 'Incremento pasivo depósito',
        },
        {
          cuenta_id: 'CXP_LOC',
          debe: 0,
          haber: diferencia,
          agente_id: locador.agente_id,
          descripcion: 'Deuda locador por ajuste depósito',
        },
      ],
      monto_original: diferencia,
      monto_actual: diferencia,
      metadata: {
        deposito_original: depositoOriginal,
        ultimo_alquiler: montoDevolucion,
        diferencia,
        porcentaje_ajuste: (diferencia / depositoOriginal) * 100,
      },
    });

    // Actualizar asiento de devolución
    await this.accountingEntriesService.update(asientoDevolucion._id, {
      monto_actual: montoDevolucion,
      'metadata.monto_estimado_devolucion': montoDevolucion,
      'metadata.es_estimado': false,
      'metadata.asiento_ajuste_id': asientoAjuste._id,
    });

    return {
      ajuste_requerido: true,
      deposito_original: depositoOriginal,
      monto_devolucion: montoDevolucion,
      diferencia,
      asiento_ajuste_id: asientoAjuste._id,
    };
  }
}
```

---

### 2. Cron Job para Ajustes Automáticos

**Ubicación:** `src/modules/accounting-entries/tasks/ajustes.task.ts`

```typescript
@Injectable()
export class AjustesCronTask {
  private readonly logger = new Logger(AjustesCronTask.name);

  constructor(private ajustesService: AjustesService) {}

  @Cron('0 2 * * *') // Ejecutar a las 2 AM todos los días
  async procesarAjustesDiarios() {
    this.logger.log('Iniciando procesamiento de ajustes diarios...');

    try {
      const resultados = await this.ajustesService.procesarAjustesPendientes();

      const exitosos = resultados.filter((r) => r.success).length;
      const fallidos = resultados.filter((r) => !r.success).length;

      this.logger.log(
        `Ajustes procesados: ${exitosos} exitosos, ${fallidos} fallidos`,
      );

      // Enviar notificación si hubo ajustes
      if (exitosos > 0) {
        // TODO: Enviar email/notificación
      }
    } catch (error) {
      this.logger.error('Error procesando ajustes:', error);
    }
  }
}
```

---

### 3. Endpoint para Ajuste Manual

**Ubicación:** `src/modules/accounting-entries/accounting-entries.controller.ts`

```typescript
@Post(':id/ajustar')
async ajustarAsientoManual(
  @Param('id') asientoId: string,
  @Body() dto: AjustarAsientoDto,
  @Request() req
) {
  return this.ajustesService.ajustarAsiento(asientoId, {
    usuario_id: req.user._id,
    motivo: dto.motivo
  });
}

@Post('contratos/:id/ajustar-deposito')
async ajustarDepositoManual(
  @Param('id') contratoId: string,
  @Request() req
) {
  return this.ajustesService.ajustarDepositoGarantia(contratoId);
}
```

---

## Validaciones y Errores

### Errores Comunes

1. **Índice no disponible para la fecha**
   - Error: `INDICE_NO_DISPONIBLE`
   - Solución: Esperar a que se publique el índice oficial

2. **Asiento ya ajustado**
   - Error: `ASIENTO_YA_AJUSTADO`
   - Validar: `fecha_ultimo_ajuste` reciente

3. **Diferencia negativa (deflación)**
   - Error: `AJUSTE_NEGATIVO_NO_PERMITIDO`
   - Requiere: Aprobación manual de admin

4. **Contrato finalizado sin ajuste de depósito**
   - Warning: `DEPOSITO_SIN_AJUSTAR`
   - Acción: Notificar a admin

---

## Reportes y Auditoría

### Reporte de Ajustes Aplicados

```typescript
interface ReporteAjustes {
  periodo: { desde: Date; hasta: Date };
  total_asientos_ajustados: number;
  total_diferencia_monto: number;
  por_indice: {
    ICL: { cantidad: number; monto_total: number };
    IPC: { cantidad: number; monto_total: number };
  };
  por_tipo_asiento: {
    Alquiler: { cantidad: number; monto_total: number };
    Deposito: { cantidad: number; monto_total: number };
  };
  detalle: AjusteDetalle[];
}
```

---

## Notas Finales

- **Todos los ajustes deben ser auditables**: Mantener historial completo
- **Los montos originales nunca cambian**: Solo `monto_actual`
- **Generar siempre asientos de ajuste**: No modificar partidas existentes
- **Validar balances contables**: DEBE = HABER en todos los asientos
- **Notificar cambios importantes**: Email a admins cuando se aplican ajustes
- **Backup antes de ajustes masivos**: Por seguridad

---

## Referencias

- Ley 27.551 (Contratos de Locación - Argentina)
- BCRA - Índice de Contratos de Locación (ICL)
- INDEC - Índice de Precios al Consumidor (IPC)
- Documentación interna: `doc/CONTRACTS/`
