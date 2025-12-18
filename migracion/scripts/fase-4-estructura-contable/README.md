# Fase 4: Generación de Estructura Contable

## Descripción

Esta fase **NO migra datos históricos**. En su lugar, inicializa la estructura financiera de V3 para los contratos migrados, invocando la lógica de negocio actual de V3.

## Criticidad

🟢 **MEDIA** - Genera "contenedores" vacíos que se llenarán en Fase 5.

## Dependencias

- ✅ **Fase 3 completada** - Contratos migrados

## Scripts

### 01-generate-financial-structure.ts

**Propósito:** 
- Iterar sobre contratos `ACTIVE` en V3
- Invocar el servicio V3 que crea la estructura contable
- Generar cuotas/asientos según la lógica actual de V3

**⚠️ IMPORTANTE:** Desactivar notificaciones de deuda durante este proceso.

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-4-estructura-contable/01-generate-financial-structure.ts
```

---

### 02-validate-structure.ts

**Propósito:** Verificar que se generó la estructura para todos los contratos activos.

**Ejecución:**
```bash
npx ts-node migracion/scripts/fase-4-estructura-contable/02-validate-structure.ts
```

---

## Proceso

1. **Identificar contratos activos** en V3 (estado `ACTIVE`)
2. **Invocar servicio V3** (ej. `LeaseAgreementService.createFinancialStructure()`)
3. **Resultado:** Se crean asientos/transacciones con saldo deudor total
4. **Nota:** Los saldos estarán "en debe" hasta que la Fase 5 inyecte los pagos históricos

---

## Precauciones

### Desactivar Notificaciones

Antes de ejecutar, asegurarse de que V3 **NO** envíe emails/WhatsApp automáticos por deudas pendientes.

**Opciones:**
1. Comentar temporalmente los hooks `@nestjs/event-emitter` que disparen notificaciones
2. Usar una flag de configuración (ej. `MIGRATION_MODE=true`)
3. Desactivar servicios de notificación en `.env`

---

## Checklist

- [ ] Desactivar notificaciones automáticas de deuda en V3
- [ ] Ejecutar `01-generate-financial-structure.ts`
- [ ] Revisar log de generación
- [ ] Ejecutar `02-validate-structure.ts`
- [ ] Verificar que todos los contratos activos tienen estructura contable
- [ ] ✅ Fase 4 completada - **Puede proceder a Fase 5**

---

## Notas

Esta fase es **preparatoria**. Los saldos quedarán incorrectos hasta que la Fase 5 inyecte los pagos históricos y ajuste los montos.

**Ejemplo:**
- **Post-Fase 4:** Contrato tiene deuda total de $1,000,000
- **Post-Fase 5:** Se inyectan pagos históricos, saldo final $0 (si estaba pagado)
