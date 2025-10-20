# 🌱 Seed Contract Settings

## Descripción

Script para inicializar la configuración por defecto de contratos en MongoDB.

## ¿Qué hace este script?

1. **Verifica** si ya existe configuración en la base de datos
2. **Crea automáticamente** el documento de configuración si no existe
3. **Muestra** todos los valores configurados
4. **Valida** que los 5 tipos de contrato estén presentes

## ¿Cuándo ejecutarlo?

- **Primera instalación** del sistema
- **Después de restaurar** una base de datos
- **Para verificar** la configuración actual
- **No es necesario** ejecutarlo múltiples veces (es idempotente)

## Uso

```bash
# Ejecutar el seed
npm run seed:contract-settings
```

## Salida Esperada

```
🌱 Iniciando seed de Contract Settings...

✅ Configuración encontrada:
   _id: 67af123456789abcdef01234
   Activa: true
   Comisión admin: 7 %
   Honorarios locador: 2 %
   Honorarios locatario: 5 %
   Tipos de contrato: 5

✨ La configuración está lista para usar.

📋 Tipos de Contrato Configurados:
────────────────────────────────────────────────────────────────────────────────
   • VIVIENDA_UNICA        → 36m, ICL, ajuste cada 12m
   • VIVIENDA              → 24m, ICL, ajuste cada 12m
   • COMERCIAL             → 36m, IPC, ajuste cada 6m
   • TEMPORARIO            → 6m, FIJO, ajuste cada 6m
   • OTROS                 → 12m, FIJO, ajuste cada 12m
────────────────────────────────────────────────────────────────────────────────

📊 Valores por Defecto:
   Comisión administración: 7 %
   Honorarios locador: 2 % en 1 cuota(s)
   Honorarios locatario: 5 % en 2 cuota(s)
   Interés mora diaria: 0.05 %
   Días de mora: 10 días
   Depósito: 1 mes(es) de alquiler en 1 cuota(s)

🔔 Notificaciones:
   Aviso vencimiento: 60 días antes
   Aviso ajuste: 30 días antes
   Recordatorios de pago: Sí

✅ Seed completado exitosamente!
```

## ¿Qué se crea en MongoDB?

### Colección: `contractsettings`

Un único documento con:

- **Configuración financiera**: interés mora, días de gracia, IVA
- **Honorarios**: comisión admin, honorarios locador/locatario
- **5 tipos de contrato**: VIVIENDA_UNICA, VIVIENDA, COMERCIAL, TEMPORARIO, OTROS
- **Depósitos**: cuotas, tipo de ajuste, meses de alquiler
- **Ajustes**: periodicidad, porcentaje
- **Notificaciones**: días de aviso, recordatorios

## Comportamiento

### Primera Ejecución

- ✅ Crea el documento de configuración
- ✅ Inserta valores por defecto de fábrica
- ✅ Muestra resumen completo

### Ejecuciones Posteriores

- ℹ️ Detecta que ya existe configuración
- ℹ️ Muestra la configuración actual
- ℹ️ No modifica valores existentes

## Auto-inicialización

> **Nota:** El servicio `ContractSettingsService` tiene auto-inicialización.
>
> Si consultas `GET /contract-settings` y no existe configuración, se creará automáticamente.
>
> Este script es **opcional** pero recomendado para:
>
> - Verificar la configuración después del deploy
> - Documentar los valores iniciales
> - Troubleshooting

## Resetear Configuración

Si necesitas volver a los valores de fábrica:

```bash
# Opción 1: Usar endpoint (requiere auth admin)
curl -X PATCH http://localhost:3000/contract-settings/reset \
  -H "Authorization: Bearer YOUR_TOKEN"

# Opción 2: Eliminar documento manualmente en MongoDB
# y volver a ejecutar el seed
```

## Verificación

Para verificar que la configuración fue creada correctamente:

```bash
# Usando MongoDB Compass o mongosh
db.contractsettings.findOne()

# O usando la API
curl http://localhost:3000/contract-settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Error: Cannot connect to MongoDB

**Problema:** El servidor de MongoDB no está corriendo.

**Solución:**

```bash
# Verificar que MongoDB esté corriendo
mongosh

# O iniciar MongoDB
brew services start mongodb-community
```

### Error: Module not found

**Problema:** Falta compilar el proyecto.

**Solución:**

```bash
npm run build
npm run seed:contract-settings
```

### La configuración no se crea

**Problema:** Puede haber un error de validación.

**Solución:**

```bash
# Revisar los logs del script
npm run seed:contract-settings

# Verificar el schema en:
# src/modules/contract-settings/entities/contract-settings.entity.ts
```

## Archivos Relacionados

- **Script:** `scripts/seed-contract-settings.ts`
- **Servicio:** `src/modules/contract-settings/contract-settings.service.ts`
- **Entity:** `src/modules/contract-settings/entities/contract-settings.entity.ts`
- **Docs:** `doc/CONTRACTS/CONTRACT_SETTINGS_API.md`

---

**Última actualización:** 14 de octubre de 2025  
**Versión:** 1.0
