# Contratos - Documentación

Este directorio contiene toda la documentación relacionada con el módulo de Contratos.

## 📋 Documentos Principales (Ordenados)

### 🚀 Inicio Rápido

1. **[01 - Índice General](./01_INDICE_GENERAL.md)**
   - Navegación completa del sistema
   - Endpoints disponibles
   - Historial de fases del proyecto

2. **[02 - Estado Actual y Migración](./02_ESTADO_ACTUAL_MIGRACION.md)** ⭐
   - Estado operativo del sistema contable
   - Migración pendiente y próximos pasos críticos
   - Diferencias con sistema legacy
   - Plan de acción inmediato

3. **[03 - Schema de Contratos](./03_SCHEMA_CONTRATOS.md)**
   - Estructura de datos completa (838 contratos migrados)
   - Schema de MongoDB
   - Relaciones con otras colecciones

### 📡 APIs Disponibles

4. **[04 - API Asientos Contables](./04_API_ASIENTOS_CONTABLES.md)**
   - Consultas y filtros
   - Estados de cuenta por agente
   - Acciones: pagar, anular, liquidar, condonar

5. **[05 - API Vista Previa de Pagos](./05_API_VISTA_PREVIA_PAGOS.md)**
   - Cálculo de asientos sin persistir
   - Vista previa financiera completa

6. **[06 - API Configuración](./06_API_CONFIGURACION.md)**
   - Honorarios por defecto
   - Parámetros de rescisión
   - Configuración de depósitos

7. **[07 - API Rescisión](./07_API_RESCISION.md)**
   - Cálculo de penalidades
   - Registro de rescisión
   - Anulación de asientos futuros

### 📊 Implementación

8. **[08 - Dashboard de Contratos](./08_DASHBOARD_CONTRATOS.md)**
   - Implementación del dashboard
   - Componentes y métricas

### 📝 Control de Cambios

9. **[CHANGELOG.md](./CHANGELOG.md)**
   - Registro completo de todos los cambios
   - Última actualización: 4 de diciembre de 2025

## ✅ Estado Actual

- **Contratos migrados:** 838/852 (98.4%)
- **Asientos generados:** 3,556 (parcial)
- **Pendiente:** ~19,500 asientos históricos
- **Próxima tarea:** Implementar estrategia FULL_HISTORY

## ⚠️ Información Crítica

### Honorarios v1.1 (BREAKING CHANGE)

Los honorarios se calculan sobre el **monto total del contrato**, no sobre el monto mensual:

```typescript
// Correcto (v1.1)
honorarios = (duracion_meses × monto_base_vigente) × (porcentaje / 100)

// Incorrecto (legacy)
honorarios = monto_mensual × (porcentaje / 100)
```

**Impacto:** Honorarios en V3 son ~24-36x mayores que en legacy.

### Comisiones Variables

Cada contrato tiene su propia comisión de administración:
- 66% contratos: 7%
- 27% contratos: 6%
- 7% contratos: 8%

**NO usar valores fijos.** Siempre leer de `terminos_financieros.comision_administracion_porcentaje`

---

**Última actualización:** 4 de diciembre de 2025
