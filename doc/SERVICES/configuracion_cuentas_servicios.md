# Configuración de Cuentas para Servicios Públicos

## Nuevas Cuentas Requeridas

Para que el sistema de procesamiento de facturas de servicios funcione correctamente, se deben crear las siguientes cuentas en el Plan de Cuentas:

### 1. Cuenta por Cobrar - Servicios

- **Código**: `CXC_SERVICIOS`
- **Nombre**: Cuentas por Cobrar - Servicios
- **Tipo de Cuenta**: `ACTIVO`
- **Descripción**: Servicios públicos e impuestos a cobrar a propietarios/locatarios
- **Es Imputable**: Sí

### 2. Cuenta por Pagar - Servicios

- **Código**: `CXP_SERVICIOS`
- **Nombre**: Cuentas por Pagar - Servicios
- **Tipo de Cuenta**: `PASIVO`
- **Descripción**: Servicios públicos e impuestos a pagar a proveedores
- **Es Imputable**: Sí

## Actualización de Service Account Mappings

Después de crear las cuentas, actualizar los registros existentes en `service_account_mappings`:

```javascript
// Ejemplo de actualización vía MongoDB
db.service_account_mappings.updateMany(
  {},
  {
    $set: {
      cuenta_por_cobrar_codigo: "CXC_SERVICIOS",
      cuenta_por_pagar_codigo: "CXP_SERVICIOS"
    }
  }
);
```

O bien, actualizar manualmente cada mapping a través de la interfaz de administración.

## Verificación

Después de la configuración, verificar que:

1. Las cuentas `CXC_SERVICIOS` y `CXP_SERVICIOS` existen en el Plan de Cuentas
2. Los `ServiceAccountMapping` tienen configurados los campos `cuenta_por_cobrar_codigo` y `cuenta_por_pagar_codigo`
3. Al procesar una factura de servicio, el asiento contable generado tiene:
   - **DEBE**: Cuenta `CXC_SERVICIOS` con `agente_id` del locador/locatario
   - **HABER**: Cuenta `CXP_SERVICIOS` con `agente_id` del proveedor

## Compatibilidad con Versiones Anteriores

El sistema mantiene compatibilidad con mappings antiguos que solo tienen `cuenta_egreso_codigo` y `cuenta_a_pagar_codigo`. Si los nuevos campos no están configurados, el sistema usará automáticamente las cuentas legacy.
