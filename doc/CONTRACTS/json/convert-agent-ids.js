/**
 * Script para convertir agente_id de string a ObjectId
 * 
 * Problema: Los IDs de agentes se importaron como strings pero deben ser ObjectId
 * Solución: Convertir todos los agente_id en contratos y asientos a ObjectId
 */

print('🔄 Convirtiendo agente_id de string a ObjectId...\n');

// 1. Convertir en contratos
print('📝 Procesando contratos...');
let contractsUpdated = 0;

db.contracts.find({}).forEach(contract => {
  const updatedPartes = contract.partes.map(parte => ({
    ...parte,
    agente_id: ObjectId(parte.agente_id)
  }));
  
  db.contracts.updateOne(
    { _id: contract._id },
    { $set: { partes: updatedPartes } }
  );
  
  contractsUpdated++;
  if (contractsUpdated % 100 === 0) {
    print(`  Procesados: ${contractsUpdated} contratos...`);
  }
});

print(`✅ Contratos actualizados: ${contractsUpdated}\n`);

// 2. Convertir en asientos contables
print('📝 Procesando asientos contables...');
let entriesUpdated = 0;

db.accountingentries.find({}).forEach(entry => {
  const updatedPartidas = entry.partidas.map(partida => {
    if (partida.agente_id && typeof partida.agente_id === 'string') {
      return {
        ...partida,
        agente_id: ObjectId(partida.agente_id)
      };
    }
    return partida;
  });
  
  db.accountingentries.updateOne(
    { _id: entry._id },
    { $set: { partidas: updatedPartidas } }
  );
  
  entriesUpdated++;
  if (entriesUpdated % 500 === 0) {
    print(`  Procesados: ${entriesUpdated} asientos...`);
  }
});

print(`✅ Asientos actualizados: ${entriesUpdated}\n`);

// 3. Verificar conversión
print('🔍 Verificando conversión...\n');

const sampleContract = db.contracts.findOne({});
print('Ejemplo de contrato:');
print('  agente_id tipo:', typeof sampleContract.partes[0].agente_id);
print('  agente_id valor:', sampleContract.partes[0].agente_id);

const sampleEntry = db.accountingentries.findOne({ 'partidas.agente_id': { $exists: true } });
if (sampleEntry) {
  const partidaConAgente = sampleEntry.partidas.find(p => p.agente_id);
  print('\nEjemplo de asiento:');
  print('  agente_id tipo:', typeof partidaConAgente.agente_id);
  print('  agente_id valor:', partidaConAgente.agente_id);
}

// 4. Verificar si ahora existen en agents
print('\n🔍 Verificando existencia en colección agents...');
const testAgentId = sampleContract.partes[0].agente_id;
const agentExists = db.agents.findOne({ _id: testAgentId });
print('  Agente existe:', agentExists ? '✅ SÍ' : '❌ NO');

if (!agentExists) {
  print('\n⚠️  Los agentes aún no existen en la BD.');
  print('💡 Necesitas importar el JSON de agentes del sistema legacy.');
}

print('\n✨ Conversión completada!\n');
