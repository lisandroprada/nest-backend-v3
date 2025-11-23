# Fix: Service Identifier Normalization Consistency

## Problem

Service identifiers were being normalized inconsistently:
- **FACTURA_DISPONIBLE**: Identifiers were normalized (e.g., `91030940600032815`)
- **Other alert types**: Identifiers kept symbols (e.g., `9103/0-04-04-0013178/8`)

This inconsistency caused issues when matching service identifiers with properties in the database.

## Root Cause

The normalization logic was located in `ClassificationService.generateCandidateFromCommunication()` (line 121), which meant:
1. Identifiers were extracted with symbols in `CamuzziScanService.parseEmail()`
2. They were stored in `ServiceCommunication` with symbols
3. Only when creating a `DetectedExpense` were they normalized
4. The normalization update was written back to the database

This created a race condition where some communications had normalized IDs and others didn't.

## Solution

**Normalize identifiers immediately upon extraction** in `CamuzziScanService.parseEmail()`:

```typescript
// Before (inconsistent)
const identificadorServicio =
  servicioMatch?.[1] || camuzziData?.cuenta || undefined;

// After (consistent)
const rawIdentificador =
  servicioMatch?.[1] || camuzziData?.cuenta || undefined;

// Normalizar identificador: eliminar guiones, barras, puntos, etc.
const identificadorServicio = rawIdentificador
  ? rawIdentificador.replace(/[^0-9]/g, '')
  : undefined;
```

## Changes Made

### 1. CamuzziScanService (Primary Fix)
**File**: `src/modules/service-sync/services/camuzzi-scan.service.ts`

- **Line ~476**: Added normalization logic to remove all non-numeric characters
- Identifiers are now clean from the moment they're extracted
- Applies to ALL alert types consistently

### 2. ClassificationService (Cleanup)
**File**: `src/modules/service-sync/services/classification.service.ts`

- **Line ~120**: Kept normalization as a safety check
- **Removed**: Database update logic (lines 124-127) since IDs are already clean
- Simplified the code since normalization is now redundant

## Impact

✅ **All service identifiers are now normalized consistently**
✅ **No more database updates needed** - identifiers are clean from the start
✅ **Improved matching accuracy** with property service identifiers
✅ **Reduced database writes** - no more retroactive normalization updates

## Testing

To verify the fix:
1. Process emails with different alert types (FACTURA_DISPONIBLE, AVISO_DEUDA, AVISO_CORTE)
2. Check `ServiceCommunication.identificador_servicio` - should be normalized (numbers only)
3. Check `DetectedExpense.identificador_servicio` - should match exactly
4. Verify property matching works correctly for all alert types

## Example

**Before:**
```json
{
  "tipo_alerta": "AVISO_DEUDA",
  "identificador_servicio": "9103/0-04-04-0013178/8"  // ❌ With symbols
}
```

**After:**
```json
{
  "tipo_alerta": "AVISO_DEUDA",
  "identificador_servicio": "91030040400131788"  // ✅ Normalized
}
```
