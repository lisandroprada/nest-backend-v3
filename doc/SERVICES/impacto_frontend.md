# Impacto en Frontend - Cambios de Cuentas de Servicios

## Resumen
Los cambios realizados en el backend para corregir la contabilidad de servicios **NO requieren cambios en el frontend**.

## ¿Qué cambió en el backend?

### Antes (Incorrecto)
```typescript
// ServiceAccountMapping
{
  cuenta_egreso_codigo: "EGRESO_SERV_GAS",      // Cuenta genérica de egreso
  cuenta_a_pagar_codigo: "PAS_PROV_GAS"         // Cuenta genérica de pasivo
}
```

### Ahora (Correcto)
```typescript
// ServiceAccountMapping
{
  cuenta_por_cobrar_codigo: "CXC_SERVICIOS",    // Cuenta por Cobrar - Servicios
  cuenta_por_pagar_codigo: "CXP_SERVICIOS"      // Cuenta por Pagar - Servicios
}
```

## Impacto en el Frontend: NINGUNO

### APIs que NO cambian:

1. **GET /api/v1/detected-expenses**
   - Estructura de respuesta: **Sin cambios**
   - Campos: **Sin cambios**
   - Filtros: **Sin cambios**

2. **POST /api/v1/accounting-entries/process-detected-expense**
   - Request body: **Sin cambios**
   - Response: **Sin cambios**

3. **GET /api/v1/accounting-entries**
   - Estructura de respuesta: **Sin cambios**
   - Las partidas ahora usan las cuentas correctas internamente, pero el frontend solo ve los IDs

### Campos internos (no visibles en frontend):

Los siguientes campos son **internos al procesamiento contable** y el frontend nunca los ve:
- `cuenta_por_cobrar_codigo`
- `cuenta_por_pagar_codigo`
- `cuenta_egreso_codigo` (eliminado)
- `cuenta_a_pagar_codigo` (eliminado)

### Campo informativo (opcional):

El campo `suggested_account_code` en `propuesta_asiento.partidas_propuesta` es **solo informativo** y no afecta el procesamiento real. El sistema usa las cuentas configuradas en `ServiceAccountMapping`.

## Conclusión

✅ **No se requieren cambios en el frontend**
✅ **Todas las APIs mantienen su contrato**
✅ **La UI de "Bandeja de Facturas" sigue funcionando igual**
✅ **Los asientos contables ahora se generan correctamente en el backend**

El único cambio visible para el usuario final será que los asientos contables ahora reflejan correctamente:
- **DEBE**: Cuenta por Cobrar del locador/locatario
- **HABER**: Cuenta por Pagar al proveedor

Esto se verá reflejado en los reportes contables y balances de agentes, pero no requiere cambios en la interfaz de usuario.

## Recomendación de UX (Mejora)

Aunque no es estrictamente necesario para que funcione, se recomienda ajustar la visualización en la "Bandeja de Comunicaciones" para priorizar el estado operativo sobre el técnico.

### Prioridad de Estados
El operador necesita saber si la factura ya fue asignada a una propiedad o si fue descartada. El estado `PROCESSED` de la comunicación es técnico (significa "ya lo leí"), pero no dice qué pasó.

**Se sugiere mostrar la columna "Estado" con la siguiente lógica:**

1. Si tiene `gasto_detectado_id`:
   - Mostrar el estado del gasto: **ASIGNADO** (Verde) o **DESCARTADO** (Gris/Rojo).
   - Esto confirma si se vinculó o no.
2. Si NO tiene `gasto_detectado_id`:
   - Mostrar el estado de la comunicación: **PENDIENTE** (Amarillo) o **ERROR** (Rojo).

Esto evita la confusión de ver todo como "PROCESSED" sin saber si realmente se vinculó a algo.
