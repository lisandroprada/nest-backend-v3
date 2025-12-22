# Checklist de Migración - Contrato por Contrato

Este documento sirve como checklist para validar la migración de cada contrato individual, siguiendo el modelo quirúrgico validado en el Contrato 6902.

---

## Información del Contrato

- **ID Contrato:** `_______________________________`
- **Locador:** `_______________________________`
- **Locatario:** `_______________________________`
- **Propiedad:** `_______________________________`
- **Fecha Inicio:** `_______________________________`
- **Estado:** `_______________________________`

---

## Fase 1: Verificación de Dependencias

### Agentes
- [ ] Locador existe en V3 con `_id` preservado
- [ ] Locatario existe en V3 con `_id` preservado
- [ ] Garantes (si aplica) existen en V3

### Propiedad
- [ ] Propiedad existe en V3 con `_id` preservado
- [ ] Propiedad vinculada al locador correcto

---

## Fase 2: Migración del Contrato

- [ ] Contrato migrado a V3
- [ ] `_id` preservado del Legacy
- [ ] Fechas correctas (sin offset manual)
- [ ] `partes` array correctamente poblado
- [ ] `terminos_financieros` mapeados correctamente

---

## Fase 3: Estructura Contable

### Asientos de Alquiler
- [ ] Asientos mensuales generados (FULL_HISTORY)
- [ ] Cantidad esperada: `_____ asientos` (meses desde inicio hasta hoy)
- [ ] Balance Debe = Haber en todos los asientos
- [ ] Partidas correctas:
  - [ ] CXC_ALQ (Debe - Inquilino)
  - [ ] CXP_LOC (Haber - Locador neto)
  - [ ] ING_HNR (Haber - Comisión inmobiliaria)

### Asientos de Depósito
- [ ] Asiento de cobro de depósito generado
- [ ] Asiento de devolución de depósito generado (si aplica)
- [ ] Montos correctos según `terminos_financieros.deposito`

### Honorarios
- [ ] Honorarios locador calculados sobre total del contrato
- [ ] Honorarios locatario calculados sobre total del contrato
- [ ] Distribuidos en primeras N cuotas según configuración

---

## Fase 4: Gastos Ad-Hoc (Si aplica)

- [ ] Gastos de servicios (Camuzzi, Cooperativa, etc.) migrados
- [ ] `agente_id` correcto en partidas DEBE
- [ ] Tipo de asiento correcto (Gasto Proveedor / Pago de Servicios)
- [ ] Vinculados al contrato correcto

---

## Fase 5: Pagos y Liquidaciones

### Validación de Pagos (DEBE)
- [ ] `monto_pagado_acumulado` refleja pagos del inquilino
- [ ] Suma de pagos Legacy = `monto_pagado_acumulado` en V3
- [ ] Estados correctos:
  - [ ] PENDIENTE si no hay pagos
  - [ ] PAGADO_PARCIAL si hay pagos parciales
  - [ ] COBRADO si está 100% cobrado pero no liquidado

### Validación de Liquidaciones (HABER)
- [ ] `monto_liquidado` refleja rendiciones al locador
- [ ] Suma de liquidaciones Legacy = `monto_liquidado` en V3
- [ ] Estado LIQUIDADO solo si:
  - [ ] Inquilino pagó 100% (DEBE)
  - [ ] Locador recibió 100% (HABER)

### Comparación de Saldos

```bash
# Ejecutar para este contrato
mongosh mongodb://127.0.0.1:27017/nest-propietasV3 --eval "
const contratoId = ObjectId('___CONTRATO_ID___');

const asientos = db.accountingentries.find({contrato_id: contratoId}).toArray();

let totalDebe = 0;
let totalPagado = 0;
let totalHaber = 0;
let totalLiquidado = 0;

asientos.forEach(a => {
  a.partidas.forEach(p => {
    totalDebe += p.debe || 0;
    totalPagado += p.monto_pagado_acumulado || 0;
    totalHaber += p.haber || 0;
    totalLiquidado += p.monto_liquidado || 0;
  });
});

print('Total Debe:', totalDebe);
print('Total Pagado:', totalPagado);
print('Saldo Inquilino:', totalDebe - totalPagado);
print('');
print('Total Haber:', totalHaber);
print('Total Liquidado:', totalLiquidado);
print('Saldo Locador:', totalHaber - totalLiquidado);
"
```

**Resultados:**
- Total Debe: `_______________________________`
- Total Pagado: `_______________________________`
- Saldo Inquilino: `_______________________________`
- Total Haber: `_______________________________`
- Total Liquidado: `_______________________________`
- Saldo Locador: `_______________________________`

**Comparación con Legacy:**
- [ ] Saldo Inquilino V3 = Saldo Inquilino Legacy
- [ ] Saldo Locador V3 = Saldo Locador Legacy

---

## Fase 6: Recibos

- [ ] Recibos del contrato migrados
- [ ] `asientos_afectados` correctamente poblado
- [ ] Suma de `monto_imputado` ≤ `monto_total` del recibo
- [ ] Recibos visibles en UI de V3

---

## Validación Final

### Estado de Cuenta Locador
- [ ] Acceder a `/agents/:id` en frontend
- [ ] Pestaña "Finanzas" muestra asientos correctos
- [ ] Saldos coinciden con Legacy
- [ ] Botones de acción visibles:
  - [ ] "Solo cobrado" propone `monto_recaudado_disponible`
  - [ ] "Adelantar" permite liquidar fondos no cobrados
- [ ] Etiqueta correcta: "X% rendido de lo recaudado"

### Estado de Cuenta Locatario
- [ ] Acceder a `/agents/:id` en frontend
- [ ] Pestaña "Finanzas" muestra asientos correctos
- [ ] Saldos coinciden con Legacy
- [ ] Pagos reflejados correctamente

---

## Notas y Observaciones

```
_______________________________________________________________________________
_______________________________________________________________________________
_______________________________________________________________________________
_______________________________________________________________________________
_______________________________________________________________________________
```

---

## Aprobación

- **Migrado por:** `_______________________________`
- **Fecha:** `_______________________________`
- **Validado por:** `_______________________________`
- **Fecha:** `_______________________________`

---

**Estado Final:** 
- [ ] ✅ APROBADO - Listo para producción
- [ ] ⚠️ CON OBSERVACIONES - Requiere ajustes menores
- [ ] ❌ RECHAZADO - Requiere re-migración
