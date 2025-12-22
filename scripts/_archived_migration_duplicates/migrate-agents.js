/**
 * Migration Script: Legacy Agents to New Agent Schema
 * 
 * Source DB: mongodb://127.0.0.1:27017/propietas (Legacy)
 * Target DB: mongodb://127.0.0.1:27017/nest-propietasV3 (New)
 * 
 * This script migrates agent data from the legacy database schema to the new NestJS schema.
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
}, { timestamps: true, strict: false });

// Models
const LegacyAgent = legacyConnection.model('Agent', legacyAgentSchema);
const NewAgent = newConnection.model('Agent', newAgentSchema);

/**
 * Map legacy agent type to new role
 */
function mapAgentTypeToRole(agentType) {
  const roleMapping = {
    'Cliente': 'PROPIETARIO', // Assuming Cliente maps to PROPIETARIO
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
 */
function mapGender(gender, personType) {
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
 * Safely convert a string to ObjectId, return null if invalid
 */
function safeObjectId(id) {
  if (!id) return null;
  
  try {
    // Check if it's already an ObjectId
    if (id instanceof mongoose.Types.ObjectId) {
      return id;
    }
    
    // Check if it's a valid ObjectId string (24 hex characters)
    if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
      return new mongoose.Types.ObjectId(id);
    }
    
    // Invalid format, return null
    return null;
  } catch (error) {
    return null;
  }
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
  
  const newAgent = {
    // Role mapping
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
    
    // Gender
    genero: mapGender(legacyAgent.gender, personaTipo),
    
    // Document
    documento_tipo: 'DNI', // Default to DNI
    documento_numero: legacyAgent.identityCard || '',
    
    // Addresses
    direccion_real: addressReal ? {
      ...addressReal,
      provincia_id: safeObjectId(legacyAgent.state?.id),
      localidad_id: safeObjectId(legacyAgent.city?.id),
      codigo_postal: legacyAgent.postalCode || '',
    } : undefined,
    
    direccion_fiscal: addressFiscal ? {
      ...addressFiscal,
      provincia_id: safeObjectId(legacyAgent.state?.id),
      localidad_id: safeObjectId(legacyAgent.city?.id),
      codigo_postal: legacyAgent.postalCode || '',
    } : {
      calle: '',
      numero: '',
      piso_dpto: '',
      provincia_id: null,
      localidad_id: null,
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
    
    // Preserve legacy fields for reference
    _legacyId: legacyAgent._id,
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
    console.log('🚀 Starting agent migration...');
    console.log(`📖 Source: ${LEGACY_DB_URI}`);
    console.log(`📝 Target: ${NEW_DB_URI}`);
    
    // Wait for connections
    await Promise.all([
      new Promise((resolve) => legacyConnection.once('open', resolve)),
      new Promise((resolve) => newConnection.once('open', resolve)),
    ]);
    
    console.log('✅ Database connections established');
    
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
    const errors = [];
    
    // Migrate each agent
    for (const legacyAgent of legacyAgents) {
      try {
        const transformedAgent = transformAgent(legacyAgent);
        
        // Check if agent already exists (by identificador_fiscal or legacy ID)
        const existingAgent = await NewAgent.findOne({
          $or: [
            { identificador_fiscal: transformedAgent.identificador_fiscal },
            { _legacyId: legacyAgent._id },
          ],
        });
        
        if (existingAgent) {
          console.log(`⏭️  Skipping agent ${legacyAgent.fullName} (already exists)`);
          continue;
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
    console.log(`   ❌ Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors details:');
      errors.forEach(err => {
        console.log(`   - ${err.agent} (ID: ${err.legacyId}): ${err.error}`);
      });
    }
    
    console.log('\n✨ Migration completed!');
    
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
