/**
 * Script para probar manualmente el cálculo proporcional de liquidaciones
 * Simula el flujo sin necesidad de API
 */

// Datos de ejemplo de un asiento típico
const asiento = {
  _id: 'ejemplo123',
  monto_original: 1000000,
  monto_actual: 1000000,
  estado: 'PENDIENTE',
  partidas: [
    {
      cuenta_id: 'cuenta_deudores',
      descripcion: 'Alquiler - Cobro al inquilino',
      debe: 1000000,
      haber: 0,
      monto_pagado_acumulado: 0,
      monto_liquidado: 0,
    },
    {
      cuenta_id: 'cuenta_locador',
      descripcion: 'Alquiler - A pagar al locador',
      debe: 0,
      haber: 900000,
      agente_id: 'locador123',
      monto_pagado_acumulado: 0,
      monto_liquidado: 0,
    },
    {
      cuenta_id: 'cuenta_honorarios',
      descripcion: 'Honorarios de administración',
      debe: 0,
      haber: 100000,
      agente_id: 'inmobiliaria123',
      monto_pagado_acumulado: 0,
      monto_liquidado: 0,
    },
  ],
};

console.log('='.repeat(60));
console.log('TEST: Cálculo Proporcional de Liquidaciones');
console.log('='.repeat(60));
console.log('');

console.log('ASIENTO ORIGINAL:');
console.log(`  Monto total: $${asiento.monto_original.toLocaleString()}`);
console.log(`  Estado: ${asiento.estado}`);
console.log('');

console.log('PARTIDAS:');
asiento.partidas.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.descripcion}`);
  console.log(`     DEBE: $${p.debe.toLocaleString()}`);
  console.log(`     HABER: $${p.haber.toLocaleString()}`);
  if (p.agente_id) console.log(`     Agente: ${p.agente_id}`);
  console.log('');
});

// Simular un cobro parcial de $1,000 (0.1% del total)
const montoCobrado = 1000;

console.log('='.repeat(60));
console.log(`REGISTRAR COBRO PARCIAL: $${montoCobrado.toLocaleString()}`);
console.log('='.repeat(60));
console.log('');

// 1. Actualizar partidas DEBE (solo estas se actualizan con monto_pagado_acumulado)
console.log('1. Actualizando partidas DEBE:');
asiento.partidas.forEach((p) => {
  if (p.debe > 0) {
    p.monto_pagado_acumulado = montoCobrado;
    console.log(
      `   ✓ ${p.descripcion}: monto_pagado_acumulado = $${p.monto_pagado_acumulado.toLocaleString()}`,
    );
  }
});
console.log('');

// 2. Calcular nuevo monto pendiente
const nuevoMontoPagadoTotal = asiento.partidas
  .filter((p) => p.debe > 0)
  .reduce((sum, p) => sum + (p.monto_pagado_acumulado || 0), 0);

asiento.monto_actual = asiento.monto_original - nuevoMontoPagadoTotal;
asiento.estado =
  nuevoMontoPagadoTotal >= asiento.monto_original ? 'PAGADO' : 'PAGADO_PARCIAL';

console.log('2. Nuevo estado del asiento:');
console.log(`   Estado: ${asiento.estado}`);
console.log(
  `   Monto pagado total: $${nuevoMontoPagadoTotal.toLocaleString()}`,
);
console.log(`   Monto pendiente: $${asiento.monto_actual.toLocaleString()}`);
console.log('');

// 3. Calcular disponible para liquidar (CLAVE: cálculo proporcional)
console.log('='.repeat(60));
console.log('CALCULAR DISPONIBLE PARA LIQUIDAR');
console.log('='.repeat(60));
console.log('');

const totalHaber = asiento.partidas
  .filter((p) => p.haber > 0)
  .reduce((sum, p) => sum + p.haber, 0);

console.log(`Total HABER: $${totalHaber.toLocaleString()}`);
console.log(
  `Monto cobrado del inquilino: $${nuevoMontoPagadoTotal.toLocaleString()}`,
);
console.log('');

console.log('CÁLCULO POR PARTIDA HABER:');
asiento.partidas.forEach((partida, i) => {
  if (partida.haber > 0) {
    const proporcion = totalHaber > 0 ? partida.haber / totalHaber : 0;
    const montoLiquidable = nuevoMontoPagadoTotal * proporcion;
    const montoYaLiquidado = partida.monto_liquidado || 0;
    const montoDisponible = montoLiquidable - montoYaLiquidado;

    console.log(`  Partida ${i + 1}: ${partida.descripcion}`);
    console.log(`    HABER original: $${partida.haber.toLocaleString()}`);
    console.log(`    Proporción: ${(proporcion * 100).toFixed(1)}%`);
    console.log(
      `    Monto liquidable: $${nuevoMontoPagadoTotal.toLocaleString()} × ${(proporcion * 100).toFixed(1)}% = $${montoLiquidable.toLocaleString()}`,
    );
    console.log(
      `    Monto ya liquidado: $${montoYaLiquidado.toLocaleString()}`,
    );
    console.log(
      `    ✅ DISPONIBLE PARA LIQUIDAR: $${montoDisponible.toLocaleString()}`,
    );
    console.log('');
  }
});

// 4. Verificación final
console.log('='.repeat(60));
console.log('VERIFICACIÓN:');
console.log('='.repeat(60));
console.log('');

const locadorPartida = asiento.partidas.find(
  (p) => p.haber > 0 && p.agente_id === 'locador123',
);
const honorariosPartida = asiento.partidas.find(
  (p) => p.haber > 0 && p.agente_id === 'inmobiliaria123',
);

if (locadorPartida && honorariosPartida) {
  const proporcionLocador = locadorPartida.haber / totalHaber;
  const proporcionHonorarios = honorariosPartida.haber / totalHaber;

  const liquidableLocador = montoCobrado * proporcionLocador;
  const liquidableHonorarios = montoCobrado * proporcionHonorarios;

  const totalLiquidable = liquidableLocador + liquidableHonorarios;

  console.log(`❓ Se cobró del inquilino: $${montoCobrado.toLocaleString()}`);
  console.log(
    `❓ Se puede liquidar al locador (90%): $${liquidableLocador.toLocaleString()}`,
  );
  console.log(
    `❓ Se puede liquidar en honorarios (10%): $${liquidableHonorarios.toLocaleString()}`,
  );
  console.log(`❓ Total liquidable: $${totalLiquidable.toLocaleString()}`);
  console.log('');

  if (Math.abs(totalLiquidable - montoCobrado) < 0.01) {
    console.log(
      '✅ CORRECTO: El total liquidable coincide con el monto cobrado',
    );
  } else {
    console.log(
      '❌ ERROR: El total liquidable NO coincide con el monto cobrado',
    );
    console.log(
      `   Diferencia: $${(totalLiquidable - montoCobrado).toFixed(2)}`,
    );
  }
  console.log('');

  // Verificar que NO se duplicó
  if (totalLiquidable <= montoCobrado) {
    console.log('✅ CORRECTO: No hay duplicación (liquidable ≤ cobrado)');
  } else {
    console.log('❌ ERROR: HAY DUPLICACIÓN (liquidable > cobrado)');
  }
}

console.log('');
console.log('='.repeat(60));
console.log('TEST COMPLETADO');
console.log('='.repeat(60));
