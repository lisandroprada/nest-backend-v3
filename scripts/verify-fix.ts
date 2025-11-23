import { config as dotenv } from 'dotenv';
import mongoose from 'mongoose';

dotenv();

async function verifyFix() {
  await mongoose.connect(process.env.MONGODB!);
  const db = mongoose.connection.db;
  console.log(`Conectado a BD: ${db.databaseName}`);

  const expenseId = '6920ee170d59316fef7dbbc3';
  console.log(`=== Verificando Gasto Detectado: ${expenseId} ===`);

  const expense = await db.collection('gastos_detectados').findOne({ 
    _id: new mongoose.Types.ObjectId(expenseId) 
  });

  if (expense) {
    console.log('✅ Gasto Detectado ENCONTRADO');
    console.log(`Identificador Servicio: ${expense.identificador_servicio}`);
    console.log(`Estado: ${expense.estado_procesamiento}`);
    console.log(`Propuesta Asiento: ${expense.propuesta_asiento ? 'SÍ' : 'NO'}`);
    
    if (expense.propuesta_asiento) {
      console.log('\n--- Propuesta de Asiento ---');
      console.log(JSON.stringify(expense.propuesta_asiento, null, 2));
    }
  } else {
    console.log('❌ Gasto Detectado NO ENCONTRADO');
  }

  await mongoose.disconnect();
}

verifyFix().catch(console.error);
