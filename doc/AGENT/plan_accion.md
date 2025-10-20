# Auditoría de condiciones y consistencia (octubre 2025)

# Plan de acción y auditoría

## Hitos realizados

- Generación anticipada de todos los asientos desde el inicio del contrato ✔️
- Segmentación y marcado de asientos de ajuste ✔️
- Estados y flag es_ajustable correctamente asignados ✔️
- Generación de asientos de honorarios y comisiones según contrato ✔️
- Generación de asiento de depósito ✔️
- Endpoints de consulta muestran todos los asientos futuros y su estado ✔️

## Pendientes y próximos pasos

1. Corregir la lógica para que las partidas se generen correctamente en todos los asientos. ❌
2. Corregir la lógica de generación de montos ajustados: los asientos deben reflejar correctamente los aumentos consecutivos en cada período de ajuste según la periodicidad definida en el contrato (por ejemplo, ajustes cuatrimestrales deben mostrar al menos tres valores diferentes en los primeros 10 meses: uno original y dos aumentos). ❌
3. Implementar el cronjob de actualización de asientos "PENDIENTE_AJUSTE" cuando el valor de índice esté disponible. ❌
4. Desacoplar la generación y el ajuste de montos:

- Al crear el contrato, se generan todos los asientos con el monto base y se marcan como "PENDIENTE_AJUSTE" los que requieren ajuste.
- La actualización de montos ajustados se realiza mediante un proceso separado, que puede ejecutarse automáticamente (cronjob) o manualmente bajo demanda.
- Este proceso recorre los asientos "PENDIENTE_AJUSTE", consulta los índices y actualiza los montos y estados.

4. Auditar y validar que los endpoints de consulta de saldo y detalle reflejen correctamente los montos ajustados y pendientes. ❌
5. Mejorar la documentación y los reportes para reflejar el nuevo circuito. ❌
6. Documentación y capacitación. ❌

---

### Contrato

- El contrato está en estado VIGENTE, con todos los hitos completos.
- Fechas, duración, partes, depósito y parámetros de ajuste están correctamente definidos.
- El tipo de índice es ICL y la periodicidad de ajuste es cada 12 meses, como indica el plan.
- El monto base y los parámetros de honorarios/comisiones están presentes.

### Asientos contables

- Se generaron los asientos de alquiler para cada mes del contrato (36 meses), más el asiento de depósito en garantía.
- Cada asiento tiene:
  - Fecha de vencimiento progresiva y descripción del mes correspondiente.
  - Estado "PENDIENTE" para la mayoría, y "PENDIENTE_AJUSTE" en los meses donde corresponde ajuste (por ejemplo, 12/2025 y 12/2026).
  - Monto original y actual igual al monto base, lo que es correcto si aún no hay índice disponible.
  - El campo es_ajustable está en false en todos los asientos; si hay asientos que deberían ser ajustables, este campo debería marcarse como true en los meses de ajuste.
  - Las partidas aparecen vacías en todos los asientos, lo que no es consistente con el plan (deberían incluir locador, locatario, honorarios, etc.).

### Consistencia con el plan

- Generación anticipada: ✔️ Todos los asientos están generados desde el inicio del contrato.
- Segmentación y ajuste: ✔️ Los asientos de ajuste están correctamente marcados como "PENDIENTE_AJUSTE".
- Estados: ✔️ Se usan los estados definidos en el plan y el modelo.
- Partidas: ❌ Las partidas deberían estar presentes en todos los asientos, no solo en algunos. Esto requiere revisión y corrección en la lógica de generación.
- Campo es_ajustable: ❌ Debería estar en true para los asientos que requieren ajuste por índice.
- Depósito: ✔️ El asiento de depósito está generado.

### Recomendaciones

- Marcar el campo es_ajustable como true en los asientos que requieren ajuste.
- Validar que los asientos de honorarios y comisiones se generen si corresponden.

# 8. Estado actual y plan de acción para generación anticipada de asientos programados

- Estado: "PENDIENTE" (si el monto es definitivo) o "PENDIENTE_AJUSTE" (si requiere ajuste futuro por índice)
- Partidas completas: locador, locatario, honorarios y comisiones según corresponda
- Los endpoints de consulta ya pueden mostrar todos los asientos futuros y su estado.

## Próximos pasos

- Implementar el proceso periódico que recorra los asientos "PENDIENTE_AJUSTE" y, cuando el valor de índice esté disponible, recalcule el monto y actualice el asiento a "PENDIENTE".

2. **Auditoría y validación de endpoints**
   - Validar que los endpoints de consulta de saldo y detalle reflejen correctamente los montos ajustados y pendientes.
   - Mejorar la documentación y los reportes para reflejar el nuevo circuito.

---

## Resumen técnico de la lógica implementada

- **Generación inicial:**
  - Un asiento por cada mes del contrato, desde el inicio hasta el final.
  - Cada asiento se marca como "PENDIENTE" o "PENDIENTE_AJUSTE" según disponibilidad del índice.
  - Segmentación automática por períodos de ajuste (ICL, IPC, etc.).
  - Partidas completas: locador, locatario, honorarios, comisiones.
- **Ajuste futuro:**
  - El cronjob actualizará los asientos "PENDIENTE_AJUSTE" cuando el índice esté disponible.
- **Consultas:**
  - Todos los asientos futuros son visibles y consultables desde la creación del contrato.
  - El saldo y los reportes reflejan el estado y monto actualizado de cada asiento.

Plan de implementación: Generación de asientos con ajuste ICL

## Resumen técnico de la lógica implementada

- Generación inicial: Un asiento por cada mes del contrato, desde el inicio hasta el final. Cada asiento se marca como "PENDIENTE" o "PENDIENTE_AJUSTE" según disponibilidad del índice. Segmentación automática por períodos de ajuste (ICL, IPC, etc.). Partidas completas: locador, locatario, honorarios, comisiones.
- Ajuste futuro: El cronjob actualizará los asientos "PENDIENTE_AJUSTE" cuando el índice esté disponible.
- Consultas: Todos los asientos futuros son visibles y consultables desde la creación del contrato. El saldo y los reportes reflejan el estado y monto actualizado de cada asiento.

1. Parámetros de entrada
   Fecha de inicio del contrato (fecha_inicio)
   Duración en meses (duracion_meses)
   Monto original del alquiler (monto_base)
   Frecuencia de ajuste (por ejemplo, cada 4 meses)
   Tipo de índice: ICL
   Colección de índices: indexvalues (ICL)
   Otros datos del contrato (partes, cuentas, etc.)
2. Obtención de índices
   Leer el valor ICL del día de inicio del contrato (icl_base).
   Para cada inicio de período de ajuste, buscar el valor ICL correspondiente en la colección.
   Si el valor ICL del período no está disponible, marcar los asientos de ese segmento como “pendiente de ajuste”.
3. Segmentación y cálculo de montos
   Dividir el contrato en segmentos según la frecuencia de ajuste (ej: 36 meses / 4 = 9 segmentos).
   Para cada segmento:
   Calcular el monto ajustado:
   monto_ajustado
   =
   monto_base
   ×
   ICL
   inicio_segmento
   ICL
   inicio_contrato
   monto_ajustado=monto_base×
   ICL
   inicio_contrato
   ​

ICL
inicio_segmento
​

​

Si el valor ICL no está disponible, usar el monto original y marcar como pendiente de ajuste. 4. Generación de asientos
Generar un asiento por cada mes del contrato (total: 36).
Para cada asiento:
Fecha de vencimiento: día correspondiente de cada mes.
Monto: el correspondiente al segmento.
Partidas: locador (haber), locatario (debe), honorarios, etc.
Estado: “PENDIENTE” o “PENDIENTE_AJUSTE” si el índice no está disponible. 5. Honorarios y comisiones
Generar partidas de honorarios y comisiones según corresponda, descontando del locador si así lo define el contrato. 6. Cronjob de actualización
Un proceso periódico revisa los asientos marcados como “pendiente de ajuste”.
Cuando el valor ICL del segmento esté disponible, recalcula el monto y actualiza el asiento. 7. Consultas y endpoints
Los endpoints de consulta de saldo y detalle deben reflejar correctamente los montos ajustados y pendientes.
El saldo del locador reflejará los montos ajustados a la fecha.
