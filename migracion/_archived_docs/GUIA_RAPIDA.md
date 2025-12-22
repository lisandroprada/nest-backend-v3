# Guía Rápida de Migración - Versión Actualizada

> **Última actualización:** Diciembre 2025  
> **⚠️ DEPRECADA:** Esta guía rápida ha sido reemplazada por la guía definitiva.
> 
> **👉 Ver:** [GUIA_MIGRACION_DEFINITIVA.md](./GUIA_MIGRACION_DEFINITIVA.md) ⭐

---

## Pre-requisitos

```bash
# 1. Backup (OBLIGATORIO)
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ./backups/$BACKUP_DATE

mongodump --uri="mongodb://127.0.0.1:27017/propietas" \
  --out=./backups/$BACKUP_DATE/legacy
  
mongodump --uri="mongodb://127.0.0.1:27017/nest-propietasV3" \
  --out=./backups/$BACKUP_DATE/v3

# 2. Obtener token
TOKEN=$(curl -s -X POST http://localhost:3050/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lisan@gmail.com","password":"12345678","rememberMe":true}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"
```

---

## Fase 1: Agentes (1,625 agentes)

### Corrección Aplicada: Eliminar índice único en `identificador_fiscal`

```bash
# 1. Eliminar índice problemático
mongosh mongodb://127.0.0.1:27017/nest-propietasV3 --eval "
db.agents.dropIndex('identificador_fiscal_1');
print('✅ Índice eliminado');
"

# 2. Migrar agentes
node doc/CONTRACTS/json/migrate-agents-from-legacy.js

# 3. Validar
mongosh --quiet --eval "
const v3 = connect('mongodb://127.0.0.1:27017/nest-propietasV3');
print('Agentes migrados:', v3.agents.countDocuments());
"
```

**✅ Esperado:** ~1,625 agentes migrados con _id preservados

---

## Fase 2: Propiedades (448 propiedades)

### Corrección Aplicada: Búsqueda de equivalencias de provincias/localidades

```bash
# Migrar propiedades (busca equivalencias automáticamente)
node scripts/migrate-properties.js

# Validar
mongosh mongodb://127.0.0.1:27017/nest-propietasV3 --quiet --eval "
print('Propiedades migradas:', db.properties.countDocuments());
print('Con warnings:', db.properties.countDocuments({_migrationNotes: {$exists: true}}));
"
```

**✅ Esperado:** ~448 propiedades, todas con provincia/localidad encontradas

---

## Fase 3: Contratos (862 contratos)

```bash
# Verificar contratos ya migrados
mongosh mongodb://127.0.0.1:27017/nest-propietasV3 --quiet --eval "
print('Contratos total:', db.contracts.countDocuments());
print('Vigentes:', db.contracts.countDocuments({status: 'VIGENTE'}));
"
```

**✅ Esperado:** ~862 contratos (~613 vigentes)

---

## Fase 4: Asientos Contables (18,120+ asientos)

### Correcciones Aplicadas:
- ✅ Estrategia FULL_HISTORY (asientos mes a mes)
- ✅ Honorarios locador/locatario calculados sobre total del contrato
- ✅ Partidas de honorarios en primeras N cuotas

```bash
# 1. Limpiar asientos previos (si existen)
mongosh mongodb://127.0.0.1:27017/nest-propietasV3 --quiet --eval "
db.accountingentries.deleteMany({});
print('✅ Limpiado');
"

# 2. Generar asientos (¡PUEDE TARDAR 5-10 MINUTOS!)
curl -X POST http://localhost:3050/api/v1/contracts/migration/generate-accounting-entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"strategy": "FULL_HISTORY"}' | jq '.'

# 3. Validar estructura
mongosh mongodb://127.0.0.1:27017/nest-propietasV3 --quiet --eval "
print('Total asientos:', db.accountingentries.countDocuments());

// Ver ejemplo
const asiento = db.accountingentries.findOne({tipo_asiento: 'Alquiler'});
print('\nEjemplo de asiento:');
asiento.partidas.forEach(p => {
  const cuenta = db.chartofaccounts.findOne({_id: p.cuenta_id});
  print('  ' + cuenta?.codigo, '|', p.descripcion, 
        '| D:', p.debe, 'H:', p.haber);
});

// Verificar balance
const debe = asiento.partidas.reduce((s,p) => s + (p.debe||0), 0);
const haber = asiento.partidas.reduce((s,p) => s + (p.haber||0), 0);
print('\nBalance - Debe:', debe, 'Haber:', haber, 
      'OK:', Math.abs(debe-haber) < 0.01 ? '✅' : '❌');
"
```

**✅ Esperado:**
- Total: ~19,322 asientos
  - Alquileres: ~18,120 (asientos mensuales)
  - Depósitos cobro: ~601
  - Depósitos devolución: ~601
- Balance: Debe = Haber en todos los asientos
- Honorarios: Incluidos en primeras N cuotas según configuración

### Ver ejemplo de cálculo de honorarios:

```bash
mongosh mongodb://127.0.0.1:27017/nest-propietasV3 --quiet --eval "
const c = db.contracts.findOne({
  'terminos_financieros.honorarios_locador_porcentaje': {$gt: 0}
});

if (c) {
  const tf = c.terminos_financieros;
  print('Contrato:', c._id);
  print('Comisión admin:', tf.comision_administracion_porcentaje + '%');
  print('Honorarios locador:', tf.honorarios_locador_porcentaje + '% en', 
        tf.honorarios_locador_cuotas, 'cuotas');
  print('Honorarios locatario:', tf.honorarios_locatario_porcentaje + '% en',
        tf.honorarios_locatario_cuotas, 'cuotas');
        
  // Ver primer asiento
  const asiento = db.accountingentries.findOne({
    contrato_id: c._id,
    tipo_asiento: 'Alquiler'
  });
  
  print('\nPrimer asiento:');
  asiento.partidas.forEach(p => {
    if (p.descripcion.includes('Honorarios')) {
      print('  ✓', p.descripcion, ':', p.haber);
    }
  });
}
"
```

---

## Validación Final

```bash
# Script de validación completo
mongosh --quiet --eval "
const legacy = connect('mongodb://127.0.0.1:27017/propietas');
const v3 = connect('mongodb://127.0.0.1:27017/nest-propietasV3');

print('═══════════════════════════════════════');
print('   VALIDACIÓN FINAL');
print('═══════════════════════════════════════\n');

const checks = {
  'Agentes': {
    legacy: legacy.agents.countDocuments(),
    v3: v3.agents.countDocuments()
  },
  'Propiedades': {
    legacy: legacy.properties.countDocuments(),
    v3: v3.properties.countDocuments()
  },
  'Contratos': {
    legacy: legacy.contracts.countDocuments(),
    v3: v3.contracts.countDocuments()
  }
};

Object.keys(checks).forEach(key => {
  const c = checks[key];
  const match = c.legacy === c.v3 ? '✅' : '❌';
  print(key + ':', c.legacy, '->', c.v3, match);
});

print('\nAsientos:', v3.accountingentries.countDocuments());
print('Contratos vigentes:', v3.contracts.countDocuments({status: 'VIGENTE'}));

// Sample balance check
const sample = v3.accountingentries.findOne({tipo_asiento: 'Alquiler'});
if (sample) {
  const d = sample.partidas.reduce((s,p)=>s+(p.debe||0),0);
  const h = sample.partidas.reduce((s,p)=>s+(p.haber||0),0);
  print('Balance asientos:', Math.abs(d-h)<0.01 ? '✅ OK' : '❌ ERROR');  
}

print('\n═══════════════════════════════════════');
"
```

---

## Rollback

```bash
# Restaurar desde backup
RESTORE_DATE="20241211_101030"  # Ajustar fecha

mongorestore \
  --uri="mongodb://127.0.0.1:27017" \
  --db=nest-propietasV3 \
  --drop \
  ./backups/$RESTORE_DATE/v3/nest-propietasV3
```

---

## Resumen de Cambios Críticos

| Fase | Problema Original | Corrección Aplicada |
|------|-------------------|---------------------|
| **1. Agentes** | Índice único en `identificador_fiscal` causaba E11000 | Se elimina el índice antes de migrar |
| **2. Propiedades** | No buscaba equiv. de provincias/localidades | Script busca por ID y nombre en V3 |
| **4. Asientos** | Usaba OPENING_BALANCE (1 asiento consolidado) | Default cambiado a FULL_HISTORY (mes a mes) |
| **4. Asientos** | Honorarios no se calculaban | Cálculo sobre total del contrato / N cuotas |
| **4. Asientos** | Honorarios calculados mal | Ahora: (Total contrato × %) / cuotas |
| **4. Asientos** | No se incluían partidas de honorarios | 2 partidas extra en primeras N cuotas |

---

## Tiempos Estimados

- **Fase 1 (Agentes):** ~2 minutos
- **Fase 2 (Propiedades):** ~3 minutos
- **Fase 3 (Contratos):** Ya migrados
- **Fase 4 (Asientos):** **5-10 minutos** ⚠️

**Total:** ~15-20 minutos

---

## Documentación Adicional

- 📄 **Plan completo:** [PLAN_MAESTRO_ACTUALIZADO.md](./PLAN_MAESTRO_ACTUALIZADO.md)
- 📄 **Especificación técnica:** [README.md](./README.md)
- 📁 **Scripts:** `./scripts/`
- 📁 **Validaciones:** `./validacion/`

---

## Contacto

- **Email:** lisan@gmail.com
- **Backups:** `./backups/`
