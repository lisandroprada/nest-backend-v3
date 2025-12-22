# 🗑️ Plan de Limpieza de Documentación - Carpeta Migración

> **Fecha:** 22 de diciembre de 2025  
> **Objetivo:** Eliminar redundancias y mantener solo documentación esencial

---

## 📊 Análisis de Archivos

### Total de Archivos Markdown: **27 archivos**

---

## ✅ MANTENER (Documentos Esenciales)

### Raíz de `migracion/` (7 archivos)

| Archivo | Propósito | Justificación |
|---------|-----------|---------------|
| **GUIA_MIGRACION_DEFINITIVA.md** | ⭐ Guía principal paso a paso | **CRÍTICO** - Fuente única de verdad |
| **INDICE_MAESTRO.md** | ⭐ Índice de navegación | **CRÍTICO** - Mapa de documentación |
| **CHECKLIST_CONTRATO.md** | ⭐ Validación por contrato | **CRÍTICO** - Control de calidad |
| **README.md** | Especificación técnica | **MANTENER** - Referencia técnica detallada |
| **MAPPING_TABLE.md** | Mapeo de campos | **MANTENER** - Referencia rápida de transformaciones |

**TOTAL MANTENER RAÍZ: 5 archivos**

---

### Carpeta `documentacion/` (11 archivos)

| Archivo | Propósito | Decisión |
|---------|-----------|----------|
| **mapeo-campos-agent.md** | Mapeo detallado agentes | **MANTENER** - Complementa MAPPING_TABLE |
| **mapeo-campos-contract.md** | Mapeo detallado contratos | **MANTENER** - Complementa MAPPING_TABLE |
| **mapeo-campos-property.md** | Mapeo detallado propiedades | **MANTENER** - Complementa MAPPING_TABLE |
| **schemas-legacy.md** | Schemas del sistema Legacy | **MANTENER** - Referencia técnica |
| **schemas-v3.md** | Schemas del sistema V3 | **MANTENER** - Referencia técnica |
| **estructura-contable-legacy-v3.md** | Comparación de estructuras | **MANTENER** - Referencia de arquitectura |

**TOTAL MANTENER DOCUMENTACION: 6 archivos**

---

### READMEs de Scripts (6 archivos)

| Archivo | Decisión |
|---------|----------|
| `scripts/fase-1-agentes/README.md` | **MANTENER** - Documenta scripts específicos |
| `scripts/fase-2-propiedades/README.md` | **MANTENER** - Documenta scripts específicos |
| `scripts/fase-3-contratos/README.md` | **MANTENER** - Documenta scripts específicos |
| `scripts/fase-4-estructura-contable/README.md` | **MANTENER** - Documenta scripts específicos |
| `scripts/fase-5-datos-contables/README.md` | **MANTENER** - Documenta scripts específicos |
| `scripts/fase-5-pagos/README.md` | **MANTENER** - Documenta scripts específicos |

**TOTAL MANTENER SCRIPTS: 6 archivos**

---

### Otros (2 archivos)

| Archivo | Decisión |
|---------|----------|
| `V3/CIRCUITO_CONTABLE.md` | **MANTENER** - Documentación de arquitectura V3 |
| `legacy/CIRCUITO_CONTABLE_LEGACY.md` | **MANTENER** - Documentación de arquitectura Legacy |

**TOTAL MANTENER OTROS: 2 archivos**

---

## ❌ ELIMINAR (Documentos Redundantes/Obsoletos)

### Raíz de `migracion/` (2 archivos)

| Archivo | Razón para Eliminar |
|---------|---------------------|
| ~~GUIA_RAPIDA.md~~ | **REDUNDANTE** - Reemplazado por GUIA_MIGRACION_DEFINITIVA.md |
| ~~PLAN_MAESTRO_ACTUALIZADO.md~~ | **REDUNDANTE** - Información consolidada en GUIA_MIGRACION_DEFINITIVA.md |

---

### Carpeta `documentacion/` (5 archivos)

| Archivo | Razón para Eliminar |
|---------|---------------------|
| ~~changelog.md~~ | **REDUNDANTE** - Existe `/doc/CONTRACTS/CHANGELOG.md` más actualizado |
| ~~fase-3.5-plan-inventarios.md~~ | **OBSOLETO** - Plan específico de una fase ya ejecutada |
| ~~fase-4-estrategia-asientos.md~~ | **REDUNDANTE** - Información en GUIA_MIGRACION_DEFINITIVA.md |
| ~~problema-localidades.md~~ | **OBSOLETO** - Problema ya resuelto |
| ~~procedimiento-migracion-contable-final.md~~ | **REDUNDANTE** - Reemplazado por GUIA_MIGRACION_DEFINITIVA.md |

---

### Otros (1 archivo)

| Archivo | Razón para Eliminar |
|---------|---------------------|
| ~~update.specs.md~~ | **OBSOLETO** - Notas de desarrollo temporal |

---

## 📈 Resumen

| Categoría | Cantidad |
|-----------|----------|
| **Total archivos .md** | 27 |
| **MANTENER** | 19 archivos (70%) |
| **ELIMINAR** | 8 archivos (30%) |

---

## 🎯 Estructura Final Propuesta

```
migracion/
├── GUIA_MIGRACION_DEFINITIVA.md    ⭐ GUÍA PRINCIPAL
├── INDICE_MAESTRO.md                ⭐ ÍNDICE
├── CHECKLIST_CONTRATO.md            ⭐ VALIDACIÓN
├── README.md                         (Especificación técnica)
├── MAPPING_TABLE.md                  (Mapeo rápido)
│
├── documentacion/                    (6 archivos)
│   ├── mapeo-campos-agent.md
│   ├── mapeo-campos-contract.md
│   ├── mapeo-campos-property.md
│   ├── schemas-legacy.md
│   ├── schemas-v3.md
│   └── estructura-contable-legacy-v3.md
│
├── V3/
│   └── CIRCUITO_CONTABLE.md
│
├── legacy/
│   └── CIRCUITO_CONTABLE_LEGACY.md
│
└── scripts/
    ├── fase-1-agentes/README.md
    ├── fase-2-propiedades/README.md
    ├── fase-3-contratos/README.md
    ├── fase-4-estructura-contable/README.md
    ├── fase-5-datos-contables/README.md
    └── fase-5-pagos/README.md
```

**Total: 19 archivos .md (reducción del 30%)**

---

## 🚀 Comandos de Limpieza

```bash
cd /Users/lisandropradatoledo/Documents/dev/Propietas-2025/nest-backend-v3/migracion

# Crear carpeta de archivo (por si acaso)
mkdir -p _archived_docs

# Mover documentos obsoletos
mv GUIA_RAPIDA.md _archived_docs/
mv PLAN_MAESTRO_ACTUALIZADO.md _archived_docs/
mv update.specs.md _archived_docs/
mv documentacion/changelog.md _archived_docs/
mv documentacion/fase-3.5-plan-inventarios.md _archived_docs/
mv documentacion/fase-4-estrategia-asientos.md _archived_docs/
mv documentacion/problema-localidades.md _archived_docs/
mv documentacion/procedimiento-migracion-contable-final.md _archived_docs/

echo "✅ Documentos obsoletos archivados en _archived_docs/"
```

---

## ✅ Beneficios de la Limpieza

1. **Claridad:** Solo 3 documentos principales en la raíz
2. **Sin confusión:** No hay múltiples "guías" contradictorias
3. **Mantenibilidad:** Menos archivos = más fácil mantener actualizado
4. **Navegación:** INDICE_MAESTRO.md como punto único de entrada

---

## 📋 Checklist de Ejecución

- [ ] Revisar este plan con el equipo
- [ ] Crear carpeta `_archived_docs/`
- [ ] Mover archivos obsoletos
- [ ] Actualizar INDICE_MAESTRO.md si es necesario
- [ ] Commit de limpieza: "docs: archive obsolete migration documentation"

---

**Preparado por:** Sistema de Auditoría  
**Fecha:** 22 de diciembre de 2025  
**Estado:** Pendiente de aprobación
