Comprendido. La corrección es crítica porque implica el uso de **IDs de prueba** en lugar de **IDs reales** del Plan de Cuentas, lo cual rompe la integridad del diseño contable.

A continuación, se presenta un **Documento de Corrección Detallado (DCD)** que especifica los cambios de arquitectura y código necesarios para que el `ContractsService` obtenga los IDs de las cuentas contables de forma dinámica y correcta, según el DDD.

---

# 🛠️ Documento de Corrección Detallado (DCD) - Integración de Plan de Cuentas

## Objetivo

Eliminar el uso de `Types.ObjectId('...')` estáticos (placeholders) en el `ContractsService` y reemplazarlo con la obtención **dinámica** y **real** de los `ObjectId` de las cuentas contables desde el `ChartOfAccountsModule`. Esto garantiza la **Integridad Contable** del sistema.

## 1\. Contexto del Problema

El código actual está _hardcodeando_ los IDs de las cuentas contables requeridas (Deuda Locatario, Crédito Locador, Honorarios Inmobiliaria, Depósito Pasivo, etc.).

- **Líneas afectadas (Ejemplo):**
  ```typescript
  const cuentaDeudaLocatarioId = new Types.ObjectId('60c72b9f9b1d8e001f8e8b8b');
  ```
- **Riesgo:** Si el usuario final modifica el Plan de Cuentas, los asientos generados por el contrato apuntarán a IDs de cuentas inexistentes, causando un fallo catastrófico en la contabilidad.

---

## 2\. Indicaciones de Implementación y Arquitectura

### 2.1 Módulo `ChartOfAccounts` (Plan de Cuentas)

El desarrollador debe asegurar que el `ChartOfAccountsService` exponga un método eficiente para buscar IDs de cuentas por su **código único** (nomenclatura interna).

#### A. Nuevo Método Requerido en `ChartOfAccountsService`

| Método                                 | Propósito                                                                   | Salida                                    |
| :------------------------------------- | :-------------------------------------------------------------------------- | :---------------------------------------- |
| `getAccountIdsByCode(codes: string[])` | Busca un lote de cuentas por sus códigos y retorna un mapa para uso rápido. | `Promise<Record<string, Types.ObjectId>>` |

**Ejemplo de Uso:**

```typescript
// { 'C4000': ObjectId('...'), 'I5010': ObjectId('...') }
```

### 2.2 Modificaciones en `ContractsModule`

#### A. Inyección de Dependencia

El `ContractsService` debe inyectar el servicio del Plan de Cuentas para poder acceder a los IDs requeridos.

**Modificación en `contracts.service.ts`:**

```typescript
// Importar el servicio
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
// ...

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<Contract>,
    private readonly accountingEntriesService: AccountingEntriesService,
    // INYECTAR EL SERVICIO DEL PLAN DE CUENTAS
    private readonly chartOfAccountsService: ChartOfAccountsService, // ⬅️ AGREGADO
  ) {}
  // ...
}
```

#### B. Obtención de IDs Reales (Pre-Bucle)

La obtención de los IDs debe realizarse **antes** de que comience el bucle de proyección (`while`). Esto evita consultas repetitivas a la base de datos dentro del ciclo, optimizando el rendimiento.

| Identificador (Código Interno) | Propósito Contable                             |
| :----------------------------- | :--------------------------------------------- |
| `CXC_ALQ`                      | Cuentas por Cobrar (Débito Locatario)          |
| `CXP_LOC`                      | Cuentas por Pagar (Crédito Locador)            |
| `ING_HNR`                      | Ingresos por Honorarios (Crédito Inmobiliaria) |
| `PAS_DEP`                      | Pasivo Depósito en Garantía                    |
| `ACT_FID`                      | Activo Fiduciario (Caja/Banco Depósito)        |

**Ejemplo de Lógica a agregar a `ContractsService` (Fuera de los métodos):**

```typescript
// Definición de las cuentas requeridas para el contrato
private readonly REQUIRED_ACCOUNTS = [
    'CXC_ALQ',  // Alquiler a Cobrar
    'CXP_LOC',  // Alquiler a Pagar a Locador
    'ING_HNR',  // Ingreso por Honorarios
    'PAS_DEP',  // Pasivo Depósito
    'ACT_FID',  // Activo Fiduciario (Caja/Banco)
];

// Variable de servicio para cachear los IDs después de la consulta inicial
private accountIdsCache: Record<string, Types.ObjectId>;
```

---

## 3\. Modificación de Métodos Clave

### 3.1 Corrección de `generateDepositEntry()`

El desarrollador debe reemplazar los IDs _hardcodeados_ con IDs obtenidos del caché o del servicio.

**Cambio Requerido:**

```typescript
  private async generateDepositEntry(contract: Contract): Promise<void> {
    // ... validaciones

    // ➡️ OBTENCIÓN DINÁMICA DE IDS
    if (!this.accountIdsCache) {
      this.accountIdsCache = await this.chartOfAccountsService.getAccountIdsByCode(this.REQUIRED_ACCOUNTS);
    }

    const cuentaPasivoDepositoId = this.accountIdsCache['PAS_DEP'];
    const cuentaActivoFiduciarioId = this.accountIdsCache['ACT_FID'];

    const partidas = [
      {
        // Crédito al Locatario, registrando el pasivo
        cuenta_id: cuentaPasivoDepositoId, // ⬅️ CORREGIDO
        descripcion: 'Recepción de depósito en garantía',
        debe: 0,
        haber: contract.deposito_monto,
        agente_id: locatario.agente_id,
      },
      // ... (partida de Activo Fiduciario)
    ];
    // ... (llamada a createEntry)
  }
```

### 3.2 Corrección de `generateInitialAccountingEntries()`

El bucle de proyección ya no usará IDs estáticos.

**Cambio Requerido:**

```typescript
  private async generateInitialAccountingEntries(
    contract: Contract,
  ): Promise<void> {
    // ... (desestructuración, cálculo de fecha fin, y variables)

    // ➡️ OBTENCIÓN DINÁMICA DE IDS (Fuera del bucle 'while')
    if (!this.accountIdsCache) {
      this.accountIdsCache = await this.chartOfAccountsService.getAccountIdsByCode(this.REQUIRED_ACCOUNTS);
    }

    const cuentaDeudaLocatarioId = this.accountIdsCache['CXC_ALQ'];
    const cuentaIngresoLocadorId = this.accountIdsCache['CXP_LOC'];
    const cuentaIngresoInmoId = this.accountIdsCache['ING_HNR'];

    while (fechaActual < fechaFinProyeccion) {
      // ... (cálculos de montos)

      const partidas = [
        {
          cuenta_id: cuentaDeudaLocatarioId, // ⬅️ CORREGIDO
          descripcion: `Alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          // ...
        },
        {
          cuenta_id: cuentaIngresoLocadorId, // ⬅️ CORREGIDO
          // ...
        },
        {
          cuenta_id: cuentaIngresoInmoId, // ⬅️ CORREGIDO
          // ...
        },
      ];

      // ... (llamada a createEntry)
    }
  }
```

Esta implementación corrige la fuente del error, cumple con el DDD de utilizar el Plan de Cuentas, y mantiene el alto rendimiento al consultar los IDs una única vez por cada nuevo contrato.
