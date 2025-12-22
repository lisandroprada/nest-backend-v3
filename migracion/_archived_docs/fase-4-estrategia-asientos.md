# Fase 4: Generación de Asientos Contables

## Estrategia

En lugar de migrar asientos desde Legacy, **usaremos la lógica existente en V3** para generar los asientos automáticamente.

## Flujo de Creación Manual de Contratos en V3

Cuando se crea un contrato manualmente en V3:

1. **Creación** (`ContractsService.create()`):
   - Se crea el contrato con `status: 'PENDIENTE'`
   - **NO se generan asientos contables**

2. **Activación** (`ContractsService.update()` → status: 'VIGENTE'):
   - Se validan pre-requisitos (firmas, documentación, inventario, fotos)
   - **Se generan los asientos contables:**
     - `generateInitialAccountingEntries()` - Asientos de alquiler periódicos
     - `generateDepositEntry()` - Asientos de depósito en garantía  
     - `generateHonorariosEntries()` - Asientos de honorarios

## Métodos que Generan Asientos

### 1. `generateInitialAccountingEntries()`
**Genera:** Asientos mensuales de alquiler desde `fecha_inicio` hasta `fecha_final`

**Por cada mes:**
- Calcula monto del alquiler (con ajustes por índice ICL/IPC si aplica)
- Crea partidas:
  - DEBE: `CXC_ALQ` (Alquiler a Cobrar) → Locatario
  - HABER: `CXP_LOC` (Alquiler a Pagar) → Locador
  - HABER: `ING_HNR` (Ingreso Honorarios) → Inmobiliaria

**Fecha vencimiento:** fecha_periodo + 10 días

### 2. `generateDepositEntry()`
**Genera:** 2 asientos de depósito en garantía

**Asiento 1 - Cobro (fecha_inicio):**
- DEBE: `CXC_ALQ` → Cobro al Locatario
- HABER: `ACT_FID` → Ingreso a Caja Fiduciaria

**Asiento 2 - Devolución (fecha_final):**
- DEBE: `ACT_FID` → Egreso de Caja
- HABER: `PAS_DEP` → Devolución al Locador

### 3. `generateHonorariosEntries()`
**Genera:** Asientos de honorarios de inicio de contrato

**Honorarios Locador:**
- Total: `(monto_base * meses_contrato) * porcentaje_locador / 100`
- Distribuido en `honorarios_locador_cuotas`
- DEBE: `CXP_LOC` → Descuento al Locador
- HABER: `ING_HNR_INIC` → Ingreso Inmobiliaria

**Honorarios Locatario:**
- Total: `(monto_base * meses_contrato) * porcentaje_locatario / 100`
- Distribuido en `honorarios_locatario_cuotas`
- DEBE: `CXC_ALQ` → Cargo al Locatario
- HABER: `ING_HNR_INIC` → Ingreso Inmobiliaria

## Cuentas Contables Requeridas

```typescript
const REQUIRED_ACCOUNTS = {
  'CXC_ALQ': // Alquiler a Cobrar (Activo)
  'CXP_LOC': // Alquiler a Pagar a Locador (Pasivo)
  'ING_HNR': // Ingreso por Honorarios (Ingreso)
  'ING_HNR_INIC': // Ingreso por Honorarios de Inicio (Ingreso)
  'PAS_DEP': // Pasivo Depósito en Garantía (Pasivo)
  'ACT_FID': // Activo Fiduciario Caja/Banco (Activo)
}
```

## Script de Migración

El script debe:

1. **Leer** todos los contratos migrados (862 contratos)
2. **Filtrar** solo contratos con `status: 'VIGENTE'`
3. **Para cada contrato:**
   - Hacer un `populate('propiedad_id')` para tener acceso a la propiedad
   - Invocar los mismos 3 métodos que usa `update()`:
     - `generateInitialAccountingEntries(contract, userId)`
     - `generateDepositEntry(contract, userId)`
     - `generateHonorariosEntries(contract, userId)`

4. **Generar reportes:**
   - Total de contratos procesados
   - Total de asientos generados
   - Contratos con errores (si los hay)

## Ventajas de Esta Estrategia

✅ **Reutiliza lógica existente:** No duplicamos código  
✅ **Consistencia garantizada:** Los asientos generados son idénticos a los de un contrato manual  
✅ **Mantenimiento simplificado:** Si cambia la lógica de asientos, solo hay un lugar que actualizar  
✅ **Validación automática:** Los métodos ya tienen validaciones integradas  
✅ **Soporte de índices:** ICL/IPC funcionan automáticamente

## Notas Importantes

- Los contratos migrados **ya están en status 'VIGENTE'**
- **NO necesitamos validar** firmas/documentación/inventario (esos requisitos son para contratos nuevos)
- **SÍ necesitamos** asegurar que todos los participantes (locador/locatario) existan en la BD
- Los asientos se generarán con `fecha_imputacion` histórica (desde  `fecha_inicio`)
- El servicio `AccountingEntriesService` maneja automáticamente la persistencia

## Implementación

Ver: `migracion/scripts/fase-4-asientos/02-generate-accounting-entries.ts`
