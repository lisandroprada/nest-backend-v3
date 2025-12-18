
import mongoose, { Schema, Types } from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const V3_MONGO_URI = process.env.MONGODB || 'mongodb://127.0.0.1:27017/nest-propietasV3';
const TARGET_AGENT_ID = '607e050ebd8cb085e6fe9d2b';

async function verify() {
  const conn = await mongoose.createConnection(V3_MONGO_URI).asPromise();
  console.log('Connected to V3 DB.');

  const Property = conn.model('Property', new Schema({}, { strict: false }), 'properties');

  const count = await Property.countDocuments();
  console.log(`Total properties in V3: ${count}`);

  const migratedProp = await Property.findOne({ identificador_interno: /^LEGACY-/ });
  
  if (migratedProp) {
    console.log('Migrated Property ID:', migratedProp._id);
    console.log('Status:', migratedProp.get('status'));
    console.log('Estado Ocupacional:', migratedProp.get('estado_ocupacional'));
    console.log('Valor Venta Detallado:', JSON.stringify(migratedProp.get('valor_venta_detallado'), null, 2));
    console.log('Valor Alquiler Detallado:', JSON.stringify(migratedProp.get('valor_alquiler_detallado'), null, 2));
    console.log('Descripcion (excerpt):', migratedProp.get('descripcion')?.substring(0, 100) + '...');
    
    const owners = migratedProp.get('propietarios_ids') as Types.ObjectId[];
    const hasAgent = owners.some(id => id.toString() === TARGET_AGENT_ID);
    
    if (hasAgent) {
      console.log('SUCCESS: Target agent found in owners.');
    } else {
      console.error('FAILURE: Target agent NOT found in owners.');
    }
  } else {
    console.log('No migrated properties found (checking for LEGACY- prefix).');
  }

  await conn.close();
}

verify().catch(console.error);
