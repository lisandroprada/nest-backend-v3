# Propietas Backend: Motor de Gestión Inmobiliaria y Contable

**Versión:** 2.0 🆕
**Tecnología Principal:** NestJS, MongoDB, TypeScript

---

## 🎉 Novedades v2.0 - Property Module Upgrade

El módulo de propiedades ha sido completamente actualizado con funcionalidades avanzadas:

- ✨ **Sistema de Multimedia Avanzado**: Gestión completa de imágenes, planos y documentos
- 🗺️ **Endpoints Públicos Optimizados**: API pública con filtros geoespaciales para mapas
- 🏗️ **Sistema de Lotes**: Herramienta completa para división de terrenos sobre imágenes satelitales
- 💰 **Precios Configurables**: Control granular de visibilidad y monedas
- 📦 **Procesamiento Automático**: Imágenes en 3 versiones (original, slider, thumb)

📚 **Documentación completa del upgrade:**

- [Guía de Inicio Rápido](doc/PROPERTY_UPGRADE_QUICKSTART.md)
- [API Documentation](doc/PROPERTY_MODULE_UPGRADE_IMPLEMENTATION.md)
- [Ejemplos Frontend](doc/FRONTEND_INTEGRATION_EXAMPLES.md)
- [Arquitectura](doc/ARCHITECTURE_DIAGRAM.md)

---

## 1. Visión General del Proyecto

Este proyecto es un sistema de backend robusto y escalable, diseñado para ser el núcleo de una plataforma de gestión inmobiliaria integral. Su propósito es automatizar, centralizar y dar consistencia a todas las operaciones de una inmobiliaria moderna, desde la gestión de clientes y propiedades hasta la contabilidad de doble partida, la facturación y la generación de reportes complejos.

Construido sobre principios de **Diseño Guiado por el Dominio (DDD)**, este backend no es solo una API, sino un motor de negocio que modela con precisión los flujos de trabajo del mundo real, garantizando la integridad de los datos y la trazabilidad de cada operación.

### Bondades y Propuesta de Valor

- **Automatización Inteligente:** Desde la generación de asientos contables futuros hasta la detección proactiva de facturas por email, el sistema está diseñado para minimizar la carga operativa manual.
- **Integridad Contable Garantizada:** Utiliza un sistema de contabilidad de doble partida, asegurando que cada transacción y operación (alquileres, gastos, pagos) se refleje de manera precisa y balanceada en las cuentas.
- **Fuente de Verdad Única:** Centraliza toda la información de agentes (clientes, proveedores), propiedades y contratos en un único lugar, eliminando la duplicidad y la inconsistencia de datos.
- **Arquitectura Escalable:** Construido con NestJS y MongoDB, el sistema está preparado para crecer en volumen de datos y complejidad de negocio sin sacrificar el rendimiento, gracias a una estrategia de indexación y consultas optimizadas.
- **Flexibilidad y Riqueza de Datos:** Los modelos de datos han sido diseñados para capturar un nivel de detalle exhaustivo, permitiendo búsquedas complejas y la generación de cualquier tipo de documento o reporte.

---

## 2. Características Principales

### 2.1. Gestión Unificada de Entidades (`Agents`)

El sistema utiliza un modelo de `Agente` unificado que representa a cualquier persona o empresa. La diferenciación se realiza a través de roles, permitiendo que una entidad sea, por ejemplo, `LOCADOR` y `PROVEEDOR` al mismo tiempo.

- **Roles Soportados:** `LOCADOR`, `LOCATARIO`, `FIADOR`, `PROVEEDOR`, `INMOBILIARIA`, `COMPRADOR`, `VENDEDOR`.
- **Datos Completos:** Almacena información fiscal, de contacto, domicilios, datos de apoderados y configuraciones específicas para proveedores de servicios.

### 2.2. Gestión Integral de Propiedades (`Properties`)

El modelo de propiedades es exhaustivo, diseñado para soportar un catálogo público con filtros avanzados y una gestión interna detallada.

- **Datos Legales y Catastrales:** Registro de la propiedad, identificadores tributarios, etc.
- **Características Detalladas:** Un modelo híbrido que combina campos estructurados para búsquedas críticas (dormitorios, baños, metraje) con un sistema flexible de `amenities` (etiquetas) para una escalabilidad total.
- **Gestión de Servicios e Impuestos:** Permite asociar múltiples servicios (luz, agua, impuestos) a una propiedad, especificando el proveedor y el porcentaje de aplicación, ideal para unidades compartidas.

### 2.3. Motor de Contratos Inteligente (`Contracts`)

El contrato es el corazón del sistema, actuando como un motor que dispara la lógica contable.

- **Proyección de Asientos:** Al crear un contrato, el sistema genera automáticamente todos los asientos contables de devengamiento de alquiler hasta la próxima fecha de ajuste, asegurando que la deuda futura sea visible de inmediato.
- **Gestión de Inventario Físico:** Se integra con un módulo de `Activos` para llevar un registro histórico del estado de los bienes muebles (heladera, aire acondicionado) en cada contrato, crucial para la gestión de depósitos en garantía.
- **Ajustes Automáticos:** Preparado para un motor de tareas que ajuste automáticamente los montos de alquiler según índices como ICL o IPC.

### 2.4. Motor Contable de Doble Partida (`Accounting`)

Cada operación financiera genera un asiento contable balanceado, garantizando la integridad de los libros.

- **Plan de Cuentas Flexible:** El sistema se basa en un `plan_de_cuentas` configurable que define la naturaleza de cada transacción (Activo, Pasivo, Ingreso, Egreso).
- **Trazabilidad Fiscal:** Las cuentas de ingresos están clasificadas para la facturación, con tasas de IVA y marcadores de facturación, preparando el terreno para la integración con AFIP.
- **Imputación de Pagos:** La lógica de `imputePayment` actualiza el estado de las deudas (asientos de débito) de forma precisa, manejando pagos parciales y totales.

### 2.5. Automatización y Tareas Programadas (`Tasks`)

- **Detección Proactiva de Facturas:** Un servicio programado (Cron Job) está diseñado para escanear una casilla de correo, detectar emails de proveedores de servicios, analizar el contenido (HTML y PDF) y registrar los gastos detectados en una bandeja de entrada para la validación del operador.

### 2.6. Generación de Documentos y Facturación

- **Plantillas Dinámicas:** Un módulo permite crear y gestionar plantillas de documentos (contratos, recibos) en formato HTML con variables dinámicas (ej. `{{locador.name}}`).
- **Generación de Documentos:** Un endpoint puede tomar una plantilla y un contexto (ej. un ID de contrato) para generar el documento final con los datos reales. Actualmente devuelve HTML, preparado para una futura integración con un generador de PDF.
- **Módulo Fiscal:** Se ha implementado la estructura para un módulo de facturación que se conectará con los web services de AFIP, utilizando la información fiscal de los agentes y los asientos contables para emitir comprobantes tipo A o B.

---

## 3. Arquitectura y Principios de Diseño

- **Stack Tecnológico:** NestJS (TypeScript), MongoDB, Mongoose.
- **Diseño Guiado por el Dominio (DDD):** La estructura de módulos y entidades refleja los procesos de negocio del mundo real.
- **Seguridad:** Autenticación basada en JWT y autorización por roles (RBAC) en todos los endpoints críticos.
- **Servicios Reutilizables:** Implementación de servicios genéricos para funcionalidades comunes como la paginación y el filtrado avanzado.
- **Inmutabilidad Contable:** Los registros clave como los asientos de devengamiento no se modifican; en su lugar, se crean nuevos asientos de ajuste o anulación, manteniendo un historial auditable.

---

## 4. Guías de API Detalladas

Para una integración detallada con el frontend, por favor, consulta los siguientes documentos en la carpeta `/doc` de este repositorio:

- `AGENTS_API.md`: Guía completa para el módulo de Agentes.
- `PROPERTIES_API.md`: Guía completa para el módulo de Propiedades.
- `PAGINATION_API.md`: Guía de uso del sistema de paginación y filtrado.
- Y otros documentos de diseño (DDD, DCD, DEA).
