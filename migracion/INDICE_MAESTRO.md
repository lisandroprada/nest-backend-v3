# 📚 Índice Maestro de Documentación de Migración

> **Última actualización:** 22 de diciembre de 2025  
> **Estado:** Consolidado y Validado

---

## 🎯 Documentos Principales (USAR ESTOS)

### 1. [GUIA_MIGRACION_DEFINITIVA.md](./GUIA_MIGRACION_DEFINITIVA.md) ⭐⭐⭐
**LA FUENTE ÚNICA DE VERDAD**

Guía paso a paso completa y validada para la migración masiva. Incluye:
- ✅ Proceso validado con Contrato 6902
- ✅ Lógica de estados contables (LIQUIDADO/COBRADO)
- ✅ Comandos exactos para cada fase
- ✅ Validaciones y troubleshooting
- ✅ Tiempos estimados

**👉 EMPEZAR AQUÍ**

---

### 2. [CHECKLIST_CONTRATO.md](./CHECKLIST_CONTRATO.md) ⭐⭐
**Checklist de Validación por Contrato**

Plantilla para validar la migración de cada contrato individual. Usar para:
- Auditoría de muestra aleatoria
- Validación de contratos críticos
- Documentación de aprobación

---

### 3. [doc/CONTRACTS/09_LOGICA_PAGOS_Y_LIQUIDACION.md](../doc/CONTRACTS/09_LOGICA_PAGOS_Y_LIQUIDACION.md) ⭐
**Lógica de Estados Contables**

Documentación técnica de la lógica de liquidación:
- Estados: PENDIENTE → PAGADO_PARCIAL → COBRADO → LIQUIDADO
- Campos: `monto_pagado_acumulado` vs `monto_liquidado`
- Principios de seguridad en UX

---

## 📖 Documentos de Referencia

### Especificaciones Técnicas

- [README.md](./README.md) - Especificación técnica original (referencia histórica)
- [MAPPING_TABLE.md](./MAPPING_TABLE.md) - Mapeo de campos Legacy → V3

### Estado del Proyecto

- [doc/CONTRACTS/02_ESTADO_ACTUAL_MIGRACION.md](../doc/CONTRACTS/02_ESTADO_ACTUAL_MIGRACION.md) - Estado de la migración
- [doc/CONTRACTS/CHANGELOG.md](../doc/CONTRACTS/CHANGELOG.md) - Historial de cambios

---

## 🗂️ Estructura de Carpetas

```
migracion/
├── GUIA_MIGRACION_DEFINITIVA.md    ⭐ GUÍA PRINCIPAL
├── CHECKLIST_CONTRATO.md            ⭐ VALIDACIÓN
├── README.md                         (Referencia técnica)
├── MAPPING_TABLE.md                  (Mapeo de campos)
│
├── scripts/                          Scripts de migración
│   ├── fase-1-agentes/
│   ├── fase-2-propiedades/
│   ├── fase-3-contratos/
│   ├── fase-4-asientos/
│   ├── fase-4.5-asientos-adhoc/     (Gastos ad-hoc)
│   ├── fase-5-pagos/                (Pagos y liquidaciones)
│   └── fase-6-verificacion/
│
├── configuracion/                    Configuración de conexiones
├── validacion/                       Scripts de validación
├── documentacion/                    Docs adicionales
└── backups/                          Backups de BD

doc/CONTRACTS/                        Documentación del sistema contable
├── 09_LOGICA_PAGOS_Y_LIQUIDACION.md ⭐ LÓGICA DE ESTADOS
├── 02_ESTADO_ACTUAL_MIGRACION.md
└── CHANGELOG.md
```

---

## ⚠️ Documentos Deprecados (NO USAR)

Los siguientes documentos están desactualizados y se mantienen solo como referencia histórica:

- ~~GUIA_RAPIDA.md~~ → Usar `GUIA_MIGRACION_DEFINITIVA.md`
- ~~PLAN_MAESTRO_ACTUALIZADO.md~~ → Usar `GUIA_MIGRACION_DEFINITIVA.md`

---

## 🚀 Flujo de Trabajo Recomendado

### Para Migración Completa:

1. **Leer:** [GUIA_MIGRACION_DEFINITIVA.md](./GUIA_MIGRACION_DEFINITIVA.md)
2. **Ejecutar:** Seguir pasos de Fase 1 a Fase 6
3. **Validar:** Usar [CHECKLIST_CONTRATO.md](./CHECKLIST_CONTRATO.md) en muestra aleatoria
4. **Verificar:** Ejecutar scripts de `fase-6-verificacion/`

### Para Migración Quirúrgica (Un Contrato):

1. **Leer:** [GUIA_MIGRACION_DEFINITIVA.md](./GUIA_MIGRACION_DEFINITIVA.md) - Sección "Fase 4.5"
2. **Editar:** Scripts quirúrgicos con IDs específicos
3. **Ejecutar:** Solo las fases necesarias
4. **Validar:** Usar [CHECKLIST_CONTRATO.md](./CHECKLIST_CONTRATO.md)

### Para Entender la Lógica Contable:

1. **Leer:** [doc/CONTRACTS/09_LOGICA_PAGOS_Y_LIQUIDACION.md](../doc/CONTRACTS/09_LOGICA_PAGOS_Y_LIQUIDACION.md)
2. **Revisar:** Scripts de `fase-5-pagos/` para ver implementación

---

## 📞 Soporte

- **Email:** lisan@gmail.com
- **Logs:** `./scripts/logs/`
- **Backups:** `./backups/`

---

## ✅ Checklist de Documentación

- [x] Guía definitiva creada
- [x] Checklist de validación creado
- [x] Lógica de estados documentada
- [x] Documentos obsoletos marcados
- [x] Índice maestro creado
- [x] Referencias cruzadas actualizadas

---

**Versión:** 2.0  
**Última actualización:** 22 de diciembre de 2025  
**Estado:** ✅ Consolidado y Listo para Uso
