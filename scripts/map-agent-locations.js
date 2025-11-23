/**
 * Location Mapping Script
 * 
 * This script updates agents' provincia_id and localidad_id fields
 * using the _legacyLocationIds stored during migration.
 * 
 * Run this AFTER populating the provinces and localities collections.
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/nest-propietasV3';
const connection = mongoose.createConnection(DB_URI);

// Schemas
const agentSchema = new mongoose.Schema({}, { strict: false });
const provinceSchema = new mongoose.Schema({
  codigo: String,
  nombre: String,
}, { strict: false });
const localitySchema = new mongoose.Schema({
  codigo: String,
  nombre: String,
  provincia_id: mongoose.Schema.Types.ObjectId,
}, { strict: false });

// Models
const Agent = connection.model('Agent', agentSchema);
const Province = connection.model('Province', provinceSchema);
const Locality = connection.model('Locality', localitySchema);

async function mapLocations() {
  try {
    console.log('🗺️  Starting location mapping...');
    
    await new Promise((resolve) => connection.once('open', resolve));
    console.log('✅ Database connection established');
    
    // Load provinces and localities
    const provinces = await Province.find({}).lean();
    const localities = await Locality.find({}).lean();
    
    console.log(`📍 Found ${provinces.length} provinces and ${localities.length} localities`);
    
    if (provinces.length === 0 && localities.length === 0) {
      console.log('⚠️  No provinces or localities found. Please populate these collections first.');
      return;
    }
    
    // Create lookup maps
    const provinceMap = new Map();
    const localityMap = new Map();
    
    provinces.forEach(prov => {
      if (prov.codigo) provinceMap.set(prov.codigo, prov._id);
      if (prov.nombre) provinceMap.set(prov.nombre.toLowerCase(), prov._id);
    });
    
    localities.forEach(loc => {
      if (loc.codigo) localityMap.set(loc.codigo, loc._id);
      if (loc.nombre) localityMap.set(loc.nombre.toLowerCase(), loc._id);
    });
    
    // Find agents with legacy location IDs
    const agents = await Agent.find({ _legacyLocationIds: { $exists: true } });
    console.log(`👥 Found ${agents.length} agents with legacy location IDs`);
    
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const agent of agents) {
      let updated = false;
      const updates = {};
      
      // Map province
      if (agent._legacyLocationIds?.state) {
        const provinceId = provinceMap.get(agent._legacyLocationIds.state.id) ||
                          provinceMap.get(agent._legacyLocationIds.state.nombre?.toLowerCase());
        
        if (provinceId) {
          if (agent.direccion_fiscal) {
            updates['direccion_fiscal.provincia_id'] = provinceId;
            updated = true;
          }
          if (agent.direccion_real) {
            updates['direccion_real.provincia_id'] = provinceId;
            updated = true;
          }
        } else {
          notFoundCount++;
          console.log(`⚠️  Province not found for agent ${agent.nombre_razon_social}: ${agent._legacyLocationIds.state.id}`);
        }
      }
      
      // Map locality
      if (agent._legacyLocationIds?.city) {
        const localityId = localityMap.get(agent._legacyLocationIds.city.id) ||
                          localityMap.get(agent._legacyLocationIds.city.nombre?.toLowerCase());
        
        if (localityId) {
          if (agent.direccion_fiscal) {
            updates['direccion_fiscal.localidad_id'] = localityId;
            updated = true;
          }
          if (agent.direccion_real) {
            updates['direccion_real.localidad_id'] = localityId;
            updated = true;
          }
        } else {
          notFoundCount++;
          console.log(`⚠️  Locality not found for agent ${agent.nombre_razon_social}: ${agent._legacyLocationIds.city.id}`);
        }
      }
      
      // Update agent if we found mappings
      if (updated) {
        await Agent.updateOne({ _id: agent._id }, { $set: updates });
        updatedCount++;
        console.log(`✅ Updated: ${agent.nombre_razon_social}`);
      }
    }
    
    console.log('\n📊 Mapping Summary:');
    console.log(`   Total agents with legacy IDs: ${agents.length}`);
    console.log(`   ✅ Successfully updated: ${updatedCount}`);
    console.log(`   ⚠️  Locations not found: ${notFoundCount}`);
    
    console.log('\n✨ Location mapping completed!');
    
  } catch (error) {
    console.error('💥 Fatal error during location mapping:', error);
    throw error;
  } finally {
    await connection.close();
    console.log('🔌 Database connection closed');
  }
}

if (require.main === module) {
  mapLocations()
    .then(() => {
      console.log('✅ Location mapping script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Location mapping script failed:', error);
      process.exit(1);
    });
}

module.exports = { mapLocations };
