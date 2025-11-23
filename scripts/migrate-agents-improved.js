/**
 * IMPROVED Migration Script: Legacy Agents to New Agent Schema
 * 
 * Source DB: mongodb://127.0.0.1:27017/propietas (Legacy)
 * Target DB: mongodb://127.0.0.1:27017/nest-propietasV3 (New)
 * 
 * Improvements:
 * 1. Fixed role mapping - "Cliente" no longer maps to "PROPIETARIO"
 * 2. Province/Locality lookup from NEW database collections
 * 3. Fixed gender mapping for PERSONA_JURIDICA
 * 4. Preserves original legacy _id for relationships
 * 5. Stores legacy location IDs for later mapping
 */

const mongoose = require('mongoose');

// Database connection strings
const LEGACY_DB_URI = 'mongodb://127.0.0.1:27017/propietas';
const NEW_DB_URI = 'mongodb://127.0.0.1:27017/nest-propietasV3';

// Create separate connections
const legacyConnection = mongoose.createConnection(LEGACY_DB_URI);
const newConnection = mongoose.createConnection(NEW_DB_URI);

// Legacy Agent Schema (simplified for reading)
const legacyAgentSchema = new mongoose.Schema({
  agentType: String,
  personType: String,
  name: String,
  lastName: String,
  fullName: String,
  gender: String,
  maritalStatus: String,
  postalCode: String,
  city: {
    id: String,
    nombre: String,
  },
  state: {
    id: String,
    nombre: String,
  },
  email: String,
  bankAccount: [{
    bank: String,
    cbu: String,
    bankId: mongoose.Schema.Types.ObjectId,
    description: String,
  }],
  photo: String,
  uid: String,
  identityCard: String,
  taxId: String,
  taxType: String,
  taxIdType: String,
  taxAddress: String,
  address: String,
  workAddress: String,
  iva: String,
  billing: Boolean,
  supplierMask: String,
  consortiumDetails: Array,
  phone: Array,
  active: Boolean,
  createdAt: Date,
  apoderado: {
    _id: mongoose.Schema.Types.ObjectId,
    fullName: String,
    address: String,
    email: String,
    city: { id: String, nombre: String },
    state: { id: String, nombre: String },
    gender: String,
    identityCard: String,
  },
  user: mongoose.Schema.Types.ObjectId,
}, { strict: false });

// New Agent Schema (simplified for writing)
const newAgentSchema = new mongoose.Schema({
  rol: [String],
  persona_tipo: String,
  nomenclador_fiscal: String,
  identificador_fiscal: String,
  cuit_validado: Boolean,
  cuit_validado_en: Date,
  cuit_datos_afip: {
    nombre: String,
    tipoPersona: String,
    ganancias: String,
    iva: String,
  },
  nombre_razon_social: String,
  nombres: String,
  apellidos: String,
  genero: String,
  documento_tipo: String,
  documento_numero: String,
  direccion_real: {
    calle: String,
    numero: String,
    piso_dpto: String,
    provincia_id: mongoose.Schema.Types.ObjectId,
    localidad_id: mongoose.Schema.Types.ObjectId,
    codigo_postal: String,
    latitud: Number,
    longitud: Number,
  },
  direccion_fiscal: {
    calle: String,
    numero: String,
    piso_dpto: String,
    provincia_id: mongoose.Schema.Types.ObjectId,
    localidad_id: mongoose.Schema.Types.ObjectId,
    codigo_postal: String,
    latitud: Number,
    longitud: Number,
  },
  telefonos: [{
    numero: String,
    tipo: String,
  }],
  email_principal: String,
  redes_sociales: [{
    plataforma: String,
    url: String,
  }],
  apoderado_id: mongoose.Schema.Types.ObjectId,
  apoderado_poder_fecha: Date,
  apoderado_vigente: Boolean,
  check_automatizado: Boolean,
  dominios_notificacion: [String],
  servicio_id_regex: String,
  monto_regex: String,
  pdf_search_key: String,
  pdf_attachment_names: [String],
  cuentas_bancarias: [{
    cbu_alias: String,
    cbu_numero: String,
    bank_id: mongoose.Schema.Types.ObjectId,
    moneda: String,
    cbu_tipo: String,
  }],
  password: String,
  status: String,
  usuario_creacion_id: mongoose.Schema.Types.ObjectId,
  usuario_modificacion_id: mongoose.Schema.Types.ObjectId,
  _legacyLocationIds: {
    state: {
      id: String,
      nombre: String,
    },
    city: {
      id: String,
      nombre: String,
    },
  },
  _legacyData: mongoose.Schema.Types.Mixed,
  _migrationNotes: [String],
}, { timestamps: true, strict: false });

// Province and Locality schemas for lookup
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
const LegacyAgent = legacyConnection.model('Agent', legacyAgentSchema);
const NewAgent = newConnection.model('Agent', newAgentSchema);
const Province = newConnection.model('Province', provinceSchema);
const Locality = newConnection.model('Locality', localitySchema);

// Cache for province and locality lookups
const provinceCache = new Map();
const localityCache = new Map();

/**
 * Load provinces and localities into cache
 */
async function loadLocationCaches() {
  console.log('📍 Loading provinces and localities into cache...');
  
  const provinces = await Province.find({}).lean();
  const localities = await Locality.find({}).lean();
  
  provinces.forEach(prov => {
    // Use 'id' field (number) as key
    if (prov.id !== undefined && prov.id !== null) {
      provinceCache.set(prov.id.toString(), prov._id); // Store as string for easy lookup
      provinceCache.set(prov.id, prov._id); // Also store as number
    }
    // Also try matching by name as fallback
    if (prov.nombre) {
      provinceCache.set(prov.nombre.toLowerCase(), prov._id);
    }
  });
  
  localities.forEach(loc => {
    // Use 'id' field (number) as key
    if (loc.id !== undefined && loc.id !== null) {
      localityCache.set(loc.id.toString(), loc._id); // Store as string for easy lookup
      localityCache.set(loc.id, loc._id); // Also store as number
    }
    // Also try matching by name as fallback
    if (loc.nombre) {
      localityCache.set(loc.nombre.toLowerCase(), loc._id);
    }
  });
  
  console.log(`   Loaded ${provinces.length} provinces and ${localities.length} localities`);
}

/**
 * Lookup province ObjectId from NEW database
 */
function lookupProvinceId(stateId, stateName) {
  if (!stateId && !stateName) return null;
  
  // Try by id first (legacy IDs are strings like "26")
  if (stateId) {
    // Try as string first
    if (provinceCache.has(stateId)) {
      return provinceCache.get(stateId);
    }
    // Try converting to number
    const numId = parseInt(stateId, 10);
    if (!isNaN(numId) && provinceCache.has(numId)) {
      return provinceCache.get(numId);
    }
  }
  
  // Try by name as fallback
  if (stateName && provinceCache.has(stateName.toLowerCase())) {
    return provinceCache.get(stateName.toLowerCase());
  }
  
  return null;
}

/**
 * Lookup locality ObjectId from NEW database
 */
function lookupLocalityId(cityId, cityName) {
  if (!cityId && !cityName) return null;
  
  // Try by id first (legacy IDs are strings like "260112")
  if (cityId) {
    // Try as string first
    if (localityCache.has(cityId)) {
      return localityCache.get(cityId);
    }
    // Try converting to number
    const numId = parseInt(cityId, 10);
    if (!isNaN(numId) && localityCache.has(numId)) {
      return localityCache.get(numId);
    }
  }
  
  // Try by name as fallback
  if (cityName && localityCache.has(cityName.toLowerCase())) {
    return localityCache.get(cityName.toLowerCase());
  }
  
  return null;
}

/**
 * Map legacy agent type to new role
 * FIXED: Cliente no longer maps to PROPIETARIO
 */
function mapAgentTypeToRole(agentType) {
  const roleMapping = {
    // 'Cliente': NO SE MAPEA - se deja vacío para asignación manual
    'Proveedor': 'PROVEEDOR',
    'Empresa de Servicios': 'EMPRESA_SERVICIO',
    'Consorcio': 'CONSORCIO',
    'Inmobiliaria': 'INMOBILIARIA',
  };
  
  return roleMapping[agentType] ? [roleMapping[agentType]] : [];
}

/**
 * Map legacy person type to new persona_tipo
 */
function mapPersonType(personType) {
  const typeMapping = {
    'Física': 'FISICA',
    'Jurídica': 'JURIDICA',
  };
  
  return typeMapping[personType] || 'FISICA';
}

/**
 * Map legacy gender to new genero
 * FIXED: Always return PERSONA_JURIDICA for juridical persons
 */
function mapGender(gender, personType) {
  // ALWAYS return PERSONA_JURIDICA for juridical persons
  if (personType === 'JURIDICA') {
    return 'PERSONA_JURIDICA';
  }
  
  const genderMapping = {
    'Femenino': 'FEMENINO',
    'Masculino': 'MASCULINO',
  };
  
  return genderMapping[gender] || null;
}

/**
 * Map legacy tax type to nomenclador_fiscal
 */
function mapTaxType(taxType, iva) {
  // Try to determine from taxType or iva field
  if (taxType) {
    const upperTaxType = taxType.toUpperCase();
    if (upperTaxType.includes('RESPONSABLE INSCRIPTO') || upperTaxType.includes('RI')) {
      return 'RI';
    }
    if (upperTaxType.includes('CONSUMIDOR FINAL') || upperTaxType.includes('CF')) {
      return 'CF';
    }
    if (upperTaxType.includes('MONOTRIBUTO')) {
      return 'MONOTRIBUTO';
    }
  }
  
  if (iva) {
    const upperIva = iva.toUpperCase();
    if (upperIva.includes('RESPONSABLE INSCRIPTO') || upperIva.includes('RI')) {
      return 'RI';
    }
    if (upperIva.includes('CONSUMIDOR FINAL') || upperIva.includes('CF')) {
      return 'CF';
    }
    if (upperIva.includes('MONOTRIBUTO')) {
      return 'MONOTRIBUTO';
    }
  }
  
  // Default to MONOTRIBUTO if not specified
  return 'MONOTRIBUTO';
}

/**
 * Parse address string into components
 */
function parseAddress(addressString) {
  if (!addressString) return null;
  
  // Simple parsing - you may need to adjust based on your address format
  const parts = addressString.split(',').map(p => p.trim());
  
  return {
    calle: parts[0] || '',
    numero: '',
    piso_dpto: '',
  };
}

/**
 * Map phone array to new telefonos format
 */
function mapPhones(phones) {
  if (!phones || !Array.isArray(phones) || phones.length === 0) {
    return [];
  }
  
  return phones.map(phone => {
    // Assuming phone could be a string or object
    const phoneNumber = typeof phone === 'string' ? phone : (phone.numero || phone.number || '');
    
    return {
      numero: phoneNumber,
      tipo: 'MOVIL', // Default to MOVIL, adjust if you have type info
    };
  }).filter(p => p.numero);
}

/**
 * Map bank accounts to new format
 */
function mapBankAccounts(bankAccounts) {
  if (!bankAccounts || !Array.isArray(bankAccounts) || bankAccounts.length === 0) {
    return [];
  }
  
  return bankAccounts.map(account => ({
    cbu_alias: account.description || '',
    cbu_numero: account.cbu || '',
    bank_id: account.bankId || null,
    moneda: 'ARS', // Default to ARS
    cbu_tipo: 'Caja de Ahorro', // Default, adjust if you have this info
  })).filter(a => a.cbu_numero);
}

/**
 * Transform legacy agent to new agent format
 */
function transformAgent(legacyAgent) {
  const personaTipo = mapPersonType(legacyAgent.personType);
  const addressReal = parseAddress(legacyAgent.address);
  const addressFiscal = parseAddress(legacyAgent.taxAddress || legacyAgent.address);
  const migrationNotes = [];
  
  // Lookup province and locality IDs
  const provinciaId = lookupProvinceId(legacyAgent.state?.id, legacyAgent.state?.nombre);
  const localidadId = lookupLocalityId(legacyAgent.city?.id, legacyAgent.city?.nombre);
  
  // Add notes if lookups failed
  if (legacyAgent.state?.id && !provinciaId) {
    migrationNotes.push(`Province not found for ID: ${legacyAgent.state.id}`);
  }
  if (legacyAgent.city?.id && !localidadId) {
    migrationNotes.push(`Locality not found for ID: ${legacyAgent.city.id}`);
  }
  
  // Check for role mapping
  if (legacyAgent.agentType === 'Cliente') {
    migrationNotes.push('Role "Cliente" left empty for manual assignment');
  }
  
  // Check for missing identificador_fiscal
  if (!legacyAgent.taxId && !legacyAgent.identityCard) {
    migrationNotes.push('Missing identificador_fiscal');
  }
  
  const newAgent = {
    // IMPORTANT: Use original legacy _id to preserve relationships
    _id: legacyAgent._id,
    
    // Role mapping (FIXED: Cliente no longer maps to PROPIETARIO)
    rol: mapAgentTypeToRole(legacyAgent.agentType),
    
    // Person type
    persona_tipo: personaTipo,
    
    // Tax information
    nomenclador_fiscal: mapTaxType(legacyAgent.taxType, legacyAgent.iva),
    identificador_fiscal: legacyAgent.taxId || legacyAgent.identityCard || '',
    cuit_validado: false,
    
    // AFIP data (if available)
    cuit_datos_afip: legacyAgent.iva ? {
      iva: legacyAgent.iva,
    } : undefined,
    
    // Name fields
    nombre_razon_social: legacyAgent.fullName || `${legacyAgent.name} ${legacyAgent.lastName || ''}`.trim(),
    nombres: personaTipo === 'FISICA' ? legacyAgent.name : undefined,
    apellidos: personaTipo === 'FISICA' ? legacyAgent.lastName : undefined,
    
    // Gender (FIXED: Always PERSONA_JURIDICA for juridical persons)
    genero: mapGender(legacyAgent.gender, personaTipo),
    
    // Document
    documento_tipo: 'DNI', // Default to DNI
    documento_numero: legacyAgent.identityCard || '',
    
    // Addresses with province/locality lookups
    direccion_real: addressReal ? {
      ...addressReal,
      ...(provinciaId && { provincia_id: provinciaId }),
      ...(localidadId && { localidad_id: localidadId }),
      codigo_postal: legacyAgent.postalCode || '',
    } : undefined,
    
    direccion_fiscal: addressFiscal ? {
      ...addressFiscal,
      ...(provinciaId && { provincia_id: provinciaId }),
      ...(localidadId && { localidad_id: localidadId }),
      codigo_postal: legacyAgent.postalCode || '',
    } : {
      calle: '',
      numero: '',
      piso_dpto: '',
      ...(provinciaId && { provincia_id: provinciaId }),
      ...(localidadId && { localidad_id: localidadId }),
      codigo_postal: '',
    },
    
    // Contact information
    telefonos: mapPhones(legacyAgent.phone),
    email_principal: legacyAgent.email || '',
    
    // Bank accounts
    cuentas_bancarias: mapBankAccounts(legacyAgent.bankAccount),
    
    // Apoderado (legal representative)
    apoderado_id: legacyAgent.apoderado?._id || null,
    apoderado_vigente: legacyAgent.apoderado?._id ? true : false,
    
    // Status
    status: legacyAgent.active === false ? 'INACTIVO' : 'ACTIVO',
    
    // User reference
    usuario_creacion_id: legacyAgent.user || null,
    
    // Preserve legacy location IDs for later mapping
    _legacyLocationIds: (legacyAgent.state || legacyAgent.city) ? {
      state: legacyAgent.state ? {
        id: legacyAgent.state.id,
        nombre: legacyAgent.state.nombre,
      } : undefined,
      city: legacyAgent.city ? {
        id: legacyAgent.city.id,
        nombre: legacyAgent.city.nombre,
      } : undefined,
    } : undefined,
    
    // Preserve legacy fields for reference
    _legacyData: {
      agentType: legacyAgent.agentType,
      supplierMask: legacyAgent.supplierMask,
      consortiumDetails: legacyAgent.consortiumDetails,
      uid: legacyAgent.uid,
      photo: legacyAgent.photo,
      workAddress: legacyAgent.workAddress,
      maritalStatus: legacyAgent.maritalStatus,
      createdAt: legacyAgent.createdAt,
    },
    
    // Migration notes
    _migrationNotes: migrationNotes.length > 0 ? migrationNotes : undefined,
  };
  
  // Remove undefined fields
  Object.keys(newAgent).forEach(key => {
    if (newAgent[key] === undefined) {
      delete newAgent[key];
    }
  });
  
  return newAgent;
}

/**
 * Main migration function
 */
async function migrateAgents() {
  try {
    console.log('🚀 Starting IMPROVED agent migration...');
    console.log(`📖 Source: ${LEGACY_DB_URI}`);
    console.log(`📝 Target: ${NEW_DB_URI}`);
    console.log('\n✨ Improvements:');
    console.log('   - Fixed role mapping (Cliente ≠ PROPIETARIO)');
    console.log('   - Province/Locality lookup from NEW database');
    console.log('   - Fixed gender mapping for PERSONA_JURIDICA');
    console.log('   - Preserves original legacy _id for relationships');
    console.log('');
    
    // Wait for connections
    await Promise.all([
      new Promise((resolve) => legacyConnection.once('open', resolve)),
      new Promise((resolve) => newConnection.once('open', resolve)),
    ]);
    
    console.log('✅ Database connections established');
    
    // Load location caches
    await loadLocationCaches();
    
    // Fetch all legacy agents
    const legacyAgents = await LegacyAgent.find({}).lean();
    console.log(`📊 Found ${legacyAgents.length} agents in legacy database`);
    
    if (legacyAgents.length === 0) {
      console.log('⚠️  No agents to migrate');
      return;
    }
    
    // Statistics
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    const errors = [];
    const roleStats = {};
    let provinceNotFoundCount = 0;
    let localityNotFoundCount = 0;
    
    // Migrate each agent
    for (const legacyAgent of legacyAgents) {
      try {
        const transformedAgent = transformAgent(legacyAgent);
        
        // Check if agent already exists by _id
        const existingAgent = await NewAgent.findById(legacyAgent._id);
        
        if (existingAgent) {
          console.log(`⏭️  Skipping agent ${legacyAgent.fullName} (already exists)`);
          skipCount++;
          continue;
        }
        
        // Track role statistics
        const agentType = legacyAgent.agentType || 'Unknown';
        roleStats[agentType] = (roleStats[agentType] || 0) + 1;
        
        // Track location lookup failures
        if (transformedAgent._migrationNotes) {
          if (transformedAgent._migrationNotes.some(n => n.includes('Province not found'))) {
            provinceNotFoundCount++;
          }
          if (transformedAgent._migrationNotes.some(n => n.includes('Locality not found'))) {
            localityNotFoundCount++;
          }
        }
        
        // Create new agent
        await NewAgent.create(transformedAgent);
        successCount++;
        console.log(`✅ Migrated: ${legacyAgent.fullName || legacyAgent.name}`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Error migrating agent ${legacyAgent.fullName || legacyAgent.name}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push({
          agent: legacyAgent.fullName || legacyAgent.name,
          error: error.message,
          legacyId: legacyAgent._id,
        });
      }
    }
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   Total agents: ${legacyAgents.length}`);
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ⏭️  Skipped (already exist): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    console.log('\n📍 Location Lookup Summary:');
    console.log(`   ⚠️  Provinces not found: ${provinceNotFoundCount}`);
    console.log(`   ⚠️  Localities not found: ${localityNotFoundCount}`);
    
    console.log('\n👥 Role Distribution (by legacy agentType):');
    Object.entries(roleStats).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    if (errors.length > 0) {
      console.log('\n❌ Errors details:');
      errors.forEach(err => {
        console.log(`   - ${err.agent} (ID: ${err.legacyId}): ${err.error}`);
      });
    }
    
    console.log('\n✨ Migration completed!');
    
    if (provinceNotFoundCount > 0 || localityNotFoundCount > 0) {
      console.log('\n⚠️  IMPORTANT: Some provinces/localities were not found.');
      console.log('   Legacy location IDs are stored in _legacyLocationIds field.');
      console.log('   Run a location mapping script after populating provinces/localities collections.');
    }
    
  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    throw error;
  } finally {
    // Close connections
    await legacyConnection.close();
    await newConnection.close();
    console.log('🔌 Database connections closed');
  }
}

// Run migration
if (require.main === module) {
  migrateAgents()
    .then(() => {
      console.log('✅ Migration script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateAgents, transformAgent };
