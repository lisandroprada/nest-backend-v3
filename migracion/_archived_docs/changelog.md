# Changelog - Migración Legacy → V3

Este archivo registra todos los cambios, decisiones y eventos importantes durante el proceso de migración.

## Formato

```
## [Fase X.Y] - YYYY-MM-DD

### ✅ Cambios
- Descripción del cambio exitoso

### ⚠️ Problemas Encontrados
- Descripción del problema y cómo se resolvió

### 📝 Decisiones Técnicas
- Decisión tomada y justificación

### 📊 Estadísticas
- Números relevantes de la migración
```

---

## [Preparación] - 2025-12-05

### ✅ Estructura Inicial Creada
- ✅ Documento maestro de migración (`README.md`)
- ✅ Configuración de conexiones (`configuracion/conexiones.config.ts`)
- ✅ Configuración de autenticación (`configuracion/auth.config.ts`)
- ✅ Utilidades creadas:
  - `logger.ts` - Sistema de logging con archivos
  - `validators.ts` - Validadores y reportes
  - `db-helpers.ts` - Helpers de base de datos

### ✅ Scripts Template Creados
- ✅ Fase 1 (Agentes): Sanity check, migración y validación
- ✅ READMEs para todas las fases (1-5)
- ✅ Documentación de schemas (Legacy y V3)

### 📝 Decisiones Técnicas
- **Preservación de `_id`:** Todos los `_id` de Legacy se preservarán estrictamente para mantener integridad referencial
- **Normalización de fechas:** V3 usará UTC puro, sin el offset `-3h` de Legacy
- **Emails:** Se normalizarán con `trim()` y `toLowerCase()`
- **Estructura de carpetas:**
  ```
  migracion/
  ├── README.md
  ├── configuracion/
  ├── scripts/
  │   ├── fase-1-agentes/
  │   ├── fase-2-propiedades/
  │   ├── fase-3-contratos/
  │   ├── fase-4-estructura-contable/
  │   ├── fase-5-datos-contables/
  │   └── utils/
  ├── validacion/
  └── documentacion/
  ```

---

## [Fase 1.1 - Sanity Check] - 2025-12-05

### ✅ Cambios
- ✅ Script de sanity check ejecutado exitosamente
- ✅ Emails duplicados tratados como advertencias (warnings) en lugar de errores
- ✅ Validación permite continuar con la migración

### 📝 Decisión Técnica
- **Emails duplicados aceptables:** En Legacy es aceptable que varios agentes compartan el mismo email (ej. `info@ipropietas.com.ar` usado 449 veces)
- **Estrategia:** Los emails duplicados se reportan como warnings pero no bloquean la migración
- **Justificación:** El sistema de agentes en Legacy no requiere emails únicos ya que muchos registros pueden compartir un email de contacto general de la inmobiliaria

### 📊 Estadísticas
- Total agentes Legacy: **1625**
- Errores críticos: **0**
- Advertencias: **59** (emails duplicados)
- Emails únicos duplicados: 59
  - Más duplicado: `info@ipropietas.com.ar` (449 veces)
  - Segundo: `lisandro.prada@gmail.com` (10 veces)
- Emails inválidos: **0**
- ObjectIds inválidos: **0**
- **Estado:** ✅ `canProceed: true`

### 🔍 Observaciones
- La mayoría de duplicados son emails genéricos de inmobiliarias (`info@...`)
- Todos los ObjectIds son válidos
- Todos los emails tienen formato válido
- Los campos requeridos están presentes

### Próximo Paso
- **Fase 1.2:** Ejecutar migración de agentes (dry-run primero)

---

## [Preparación] - 2025-12-05

### 📝 Tareas por Completar
- [ ] Ejecutar sanity check
- [ ] Revisar y ajustar mapeo de campos según schema real
- [ ] Ejecutar migración
- [ ] Validar resultados

### ⚠️ Puntos de Atención
- Verificar si V3 separa `User` (login) de `Agent` (entidad comercial)
- Confirmar el mapeo exacto de campos Legacy → V3
- Revisar si hay emails duplicados en Legacy

---

## [Pendiente] - Fase 2: Migración de Propiedades

### ⚠️ Puntos de Atención
- Verificar cuál campo usa Legacy para propietario (`owner` vs `agente_id`)
- Determinar estrategia para propiedades sin geolocalización
- Confirmar si se deben migrar propiedades inactivas

---

## [Pendiente] - Fase 3: Migración de Contratos

### ⚠️ Puntos de Atención Críticos
- **FECHAS:** Confirmar que Legacy aplica offset de `-3h`
- Verificar mapeo de estados: `Vigente` → `ACTIVE`, `Finalizado` → `COMPLETED`
- Decidir si migrar solo contratos activos o también históricos

---

## [Pendiente] - Fase 4: Generación de Estructura Contable

### ⚠️ Puntos de Atención
- **IMPORTANTE:** Desactivar notificaciones automáticas antes de ejecutar
- Identificar el servicio V3 correcto para generar estructura financiera
- Confirmar si solo se aplica a contratos `ACTIVE` o también históricos

---

## [Pendiente] - Fase 5: Migración de Datos Contables

### ⚠️ Puntos de Atención Críticos
- Esta es la fase más compleja
- Requiere mapeo preciso de 3 colecciones Legacy → 1 colección V3
- Validar exhaustivamente los saldos antes de dar por completada

---

## Plantilla para Nuevas Entradas

Copiar y completar al ejecutar cada fase:

```markdown
## [Fase X.Y] - YYYY-MM-DD

### ✅ Cambios
- 

### ⚠️ Problemas Encontrados
- Problema: 
- Solución: 

### 📝 Decisiones Técnicas
- Decisión: 
- Justificación: 

### 📊 Estadísticas
- Total Legacy: 
- Total V3: 
- Diferencia: 
- Errores: 
- Advertencias: 
- Tiempo de ejecución: 

### 🔍 Observaciones
- 
```

---

## Notas de Uso

1. **Actualizar después de cada ejecución de script**
2. **Registrar TODO problema y su solución**
3. **Documentar decisiones técnicas importantes**
4. **Incluir estadísticas para trazabilidad**
5. **Este archivo es crítico para auditoría y debugging**
