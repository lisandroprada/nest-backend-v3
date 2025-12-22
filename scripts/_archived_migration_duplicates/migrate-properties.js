/**
 * Property Migration Script: Legacy Properties to New Property Schema
 * 
 * Source DB: mongodb://127.0.0.1:27017/propietas (Legacy)
 * Target DB: mongodb://127.0.0.1:27017/nest-propietasV3 (New)
 * 
 * Features:
 * 1. Province/Locality lookup from NEW database (consistent with agents)
 * 2. Preserves original legacy _id for relationships
 * 3. Migrates associatedServices → servicios_impuestos
 * 4. Maps property characteristics and details
 */

const mongoose = require('mongoose');

// Database connection strings
const LEGACY_DB_URI = 'mongodb://127.0.0.1:27017/propietas';
const NEW_DB_URI = 'mongodb://127.0.0.1:27017/nest-propietasV3';

// Create separate connections
const legacyConnection = mongoose.createConnection(LEGACY_DB_URI);
const newConnection = mongoose.createConnection(NEW_DB_URI);

// Legacy Property Schema (simplified for reading)
const legacyPropertySchema = new mongoose.Schema({
  address: String,
  state: {
    id: String,
    nombre: String,
  },
  city: {
    id: String,
    nombre: String,
  },
  lat: Number,
  lng: Number,
  owner: [{
    _id: mongoose.Schema.Types.ObjectId,
    fullName: String,
  }],
  tenant: {
    _id: mongoose.Schema.Types.ObjectId,
    fullName: String,
  },
  leaseAgreement: mongoose.Schema.Types.ObjectId,
  consortium: {
    _id: mongoose.Schema.Types.ObjectId,
    fullName: String,
  },
  type: String,
  purpose: String,
  status: String,
  availableForSale: Boolean,
  publishForRent: Boolean,
  publishForSale: Boolean,
  valueForSale: {
    amount: Number,
    currency: String,
    pricePublic: Boolean,
    description: String,
  },
  valueForRent: {
    amount: Number,
    currency: String,
    pricePublic: Boolean,
    description: String,
  },
  associatedServices: Array,
  detailedDescription: {
    sqFt: Number,
    buildSqFt: Number,
    age: Number,
    rooms: Number,
    bathrooms: Number,
    orientation: String,
    title: String,
    brief: String,
  },
  expensesType: {
    _id: mongoose.Schema.Types.ObjectId,
    expenseName: String,
  },
  img: Array,
  imgCover: {
    name: String,
    thumbWeb: String,
  },
  user: mongoose.Schema.Types.ObjectId,
  createdAt: Date,
}, { strict: false });

// New Property Schema (simplified for writing)
const newPropertySchema = new mongoose.Schema({
  propietarios_ids: [mongoose.Schema.Types.ObjectId],
  identificador_interno: String,
  identificador_tributario: String,
  titulo: String,
  descripcion: String,
  direccion: {
    calle: String,
    numero: String,
    piso_dpto: String,
    provincia_id: mongoose.Schema.Types.ObjectId,
    localidad_id: mongoose.Schema.Types.ObjectId,
    codigo_postal: String,
    latitud: Number,
    longitud: Number,
  },
  caracteristicas: {
    tipo_propiedad: String,
    dormitorios: Number,
    banos: Number,
    metraje_total: Number,
    metraje_cubierto: Number,
    antiguedad_anos: Number,
    orientacion: String,
  },
  servicios_impuestos: [{
    proveedor_id: mongoose.Schema.Types.ObjectId,
    identificador_servicio: String,
    porcentaje_aplicacion: Number,
    origen: String,
    destino: String,
  }],
  consorcio_nombre: String,
  tipo_expensas: String,
  img_cover_url: String,
  valor_venta: Number,
  valor_alquiler: Number,
  valor_venta_detallado: {
    monto: Number,
    moneda: String,
    es_publico: Boolean,
    descripcion: String,
  },
  valor_alquiler_detallado: {
    monto: Number,
    moneda: String,
    es_publico: Boolean,
    descripcion: String,
  },
  publicar_para_venta: Boolean,
  publicar_para_alquiler: Boolean,
  proposito: String,
  status: String,
  estado_ocupacional: String,
  contrato_vigente_id: mongoose.Schema.Types.ObjectId,
  imagenes: Array,
  usuario_creacion_id: mongoose.Schema.Types.ObjectId,
  _legacyLocationIds: mongoose.Schema.Types.Mixed,
  _legacyData: mongoose.Schema.Types.Mixed,
  _migrationNotes: [String],
}, { timestamps: true, strict: false });

// Province and Locality schemas for lookup
const provinceSchema = new mongoose.Schema({
  id: Number,
  nombre: String,
}, { strict: false });

const localitySchema = new mongoose.Schema({
  id: Number,
  nombre: String,
  provincia_id: mongoose.Schema.Types.ObjectId,
}, { strict: false });

// Models
const LegacyProperty = legacyConnection.model('Property', legacyPropertySchema);
const NewProperty = newConnection.model('Property', newPropertySchema);
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
    if (prov.id !== undefined && prov.id !== null) {
      provinceCache.set(prov.id.toString(), prov._id);
      provinceCache.set(prov.id, prov._id);
    }
    if (prov.nombre) {
      provinceCache.set(prov.nombre.toLowerCase(), prov._id);
    }
  });
  
  localities.forEach(loc => {
    if (loc.id !== undefined && loc.id !== null) {
      localityCache.set(loc.id.toString(), loc._id);
      localityCache.set(loc.id, loc._id);
    }
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
  
  if (stateId) {
    if (provinceCache.has(stateId)) {
      return provinceCache.get(stateId);
    }
    const numId = parseInt(stateId, 10);
    if (!isNaN(numId) && provinceCache.has(numId)) {
      return provinceCache.get(numId);
    }
  }
  
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
  
  if (cityId) {
    if (localityCache.has(cityId)) {
      return localityCache.get(cityId);
    }
    const numId = parseInt(cityId, 10);
    if (!isNaN(numId) && localityCache.has(numId)) {
      return localityCache.get(numId);
    }
  }
  
  if (cityName && localityCache.has(cityName.toLowerCase())) {
    return localityCache.get(cityName.toLowerCase());
  }
  
  return null;
}

/**
 * Map legacy property type to new tipo_propiedad
 */
function mapPropertyType(legacyType) {
  if (!legacyType) return 'departamento';
  
  const typeMapping = {
    'departamento': 'departamento',
    'casa': 'casa',
    'ph': 'ph',
    'oficina': 'oficina',
    'local': 'local_comercial',
    'galpon': 'galpon',
    'galpón': 'galpon',
    'lote': 'lote',
    'quinta': 'quinta',
    'chacra': 'chacra',
    'estudio': 'estudio',
    'loft': 'loft',
    'duplex': 'duplex',
    'triplex': 'triplex',
  };
  
  return typeMapping[legacyType.toLowerCase()] || 'departamento';
}

/**
 * Map legacy purpose to new proposito
 */
function mapPurpose(legacyPurpose) {
  if (!legacyPurpose) return 'VIVIENDA';
  
  const purposeMapping = {
    'comercial': 'COMERCIAL',
    'vivienda': 'VIVIENDA',
    'industrial': 'INDUSTRIAL',
    'mixto': 'MIXTO',
  };
  
  return purposeMapping[legacyPurpose.toLowerCase()] || 'VIVIENDA';
}

/**
 * Map legacy status to new status
 */
function mapStatus(legacyStatus) {
  if (!legacyStatus) return 'DISPONIBLE';
  
  const statusMapping = {
    'disponible': 'DISPONIBLE',
    'no disponible': 'INACTIVO',
    'alquilado': 'ALQUILADO',
    'reservado': 'RESERVADO',
    'inactivo': 'INACTIVO',
  };
  
  return statusMapping[legacyStatus.toLowerCase()] || 'DISPONIBLE';
}

/**
 * Map legacy orientation to new orientacion
 */
function mapOrientation(legacyOrientation) {
  if (!legacyOrientation) return null;
  
  const orientationMapping = {
    'norte': 'NORTE',
    'sur': 'SUR',
    'este': 'ESTE',
    'oeste': 'OESTE',
    'noreste': 'NORESTE',
    'noroeste': 'NOROESTE',
    'sureste': 'SURESTE',
    'suroeste': 'SUROESTE',
  };
  
  return orientationMapping[legacyOrientation.toLowerCase()] || null;
}

/**
 * Map payment source to origen
 */
function mapPaymentSource(source) {
  const mapping = {
    'Locatario': 'LOCATARIO',
    'Locador': 'LOCADOR',
  };
  return mapping[source] || 'LOCADOR';
}

/**
 * Map payment target to destino
 */
function mapPaymentTarget(target) {
  const mapping = {
    'Prestador': 'PRESTADOR',
    'Locador': 'LOCADOR',
  };
  return mapping[target] || 'PRESTADOR';
}

/**
 * Map associatedServices to servicios_impuestos
 */
function mapAssociatedServices(services) {
  if (!services || !Array.isArray(services)) return [];
  
  return services.map(service => ({
    proveedor_id: service.serviceCompany?._id,
    identificador_servicio: service.id || '',
    porcentaje_aplicacion: service.ratio || 100,
    origen: mapPaymentSource(service.paymentSource),
    destino: mapPaymentTarget(service.paymentTarget),
  })).filter(s => s.proveedor_id);
}

/**
 * Parse address string into components
 */
function parseAddress(addressString) {
  if (!addressString) return null;
  
  // Simple parsing
  const parts = addressString.split(',').map(p => p.trim());
  
  return {
    calle: parts[0] || '',
    numero: '',
    piso_dpto: '',
  };
}

/**
 * Map images array
 */
function mapImages(images) {
  if (!images || !Array.isArray(images)) return [];
  
  return images.map((img, index) => ({
    nombre: img.name || '',
    url: img.imgSlider || img.thumbWeb || img.thumb || '',
    orden: index,
    es_portada: index === 0,
    versiones: {
      thumb: img.thumb || '',
      slider: img.imgSlider || '',
      original: img.thumbWeb || '',
    }
  })).filter(img => img.url);
}

/**
 * Transform legacy property to new property format
 */
function transformProperty(legacyProperty) {
  const migrationNotes = [];
  
  // Lookup province and locality IDs
  const provinciaId = lookupProvinceId(legacyProperty.state?.id, legacyProperty.state?.nombre);
  const localidadId = lookupLocalityId(legacyProperty.city?.id, legacyProperty.city?.nombre);
  
  // Add notes if lookups failed
  if (legacyProperty.state?.id && !provinciaId) {
    migrationNotes.push(`Province not found for ID: ${legacyProperty.state.id}`);
  }
  if (legacyProperty.city?.id && !localidadId) {
    migrationNotes.push(`Locality not found for ID: ${legacyProperty.city.id}`);
  }
  
  // Check for missing owners
  if (!legacyProperty.owner || legacyProperty.owner.length === 0) {
    migrationNotes.push('No owner specified - requires manual assignment');
  }
  
  // Parse address
  const parsedAddress = parseAddress(legacyProperty.address);
  
  // Extract owner IDs
  const propietariosIds = legacyProperty.owner?.map(o => o._id).filter(id => id) || [];
  
  // Generate identificador_interno from _id
  const identificadorInterno = `PROP-${legacyProperty._id.toString().slice(-8).toUpperCase()}`;
  
  const newProperty = {
    // IMPORTANT: Use original legacy _id to preserve relationships
    _id: legacyProperty._id,
    
    // Owner IDs
    propietarios_ids: propietariosIds,
    
    // Identifiers
    identificador_interno: identificadorInterno,
    identificador_tributario: '',
    
    // Title and description
    titulo: legacyProperty.detailedDescription?.title || '',
    descripcion: legacyProperty.detailedDescription?.brief || '',
    
    // Address with province/locality lookups
    direccion: parsedAddress ? {
      ...parsedAddress,
      ...(provinciaId && { provincia_id: provinciaId }),
      ...(localidadId && { localidad_id: localidadId }),
      codigo_postal: '',
      latitud: legacyProperty.lat || null,
      longitud: legacyProperty.lng || null,
    } : undefined,
    
    // Characteristics
    caracteristicas: {
      tipo_propiedad: mapPropertyType(legacyProperty.type),
      dormitorios: legacyProperty.detailedDescription?.rooms || null,
      banos: legacyProperty.detailedDescription?.bathrooms || null,
      metraje_total: legacyProperty.detailedDescription?.sqFt || null,
      metraje_cubierto: legacyProperty.detailedDescription?.buildSqFt || null,
      antiguedad_anos: legacyProperty.detailedDescription?.age || null,
      orientacion: mapOrientation(legacyProperty.detailedDescription?.orientation),
    },
    
    // Services and taxes
    servicios_impuestos: mapAssociatedServices(legacyProperty.associatedServices),
    
    // Consortium
    consorcio_nombre: legacyProperty.consortium?.fullName || '',
    tipo_expensas: legacyProperty.expensesType?.expenseName || null,
    
    // Images
    img_cover_url: legacyProperty.imgCover?.thumbWeb || '',
    imagenes: mapImages(legacyProperty.img),
    
    // Prices
    valor_venta: legacyProperty.valueForSale?.amount || null,
    valor_alquiler: legacyProperty.valueForRent?.amount || null,
    
    valor_venta_detallado: legacyProperty.valueForSale ? {
      monto: legacyProperty.valueForSale.amount || 0,
      moneda: legacyProperty.valueForSale.currency || 'USD',
      es_publico: legacyProperty.valueForSale.pricePublic || false,
      descripcion: legacyProperty.valueForSale.description || '',
    } : undefined,
    
    valor_alquiler_detallado: legacyProperty.valueForRent ? {
      monto: legacyProperty.valueForRent.amount || 0,
      moneda: legacyProperty.valueForRent.currency || 'ARS',
      es_publico: legacyProperty.valueForRent.pricePublic || false,
      descripcion: legacyProperty.valueForRent.description || '',
    } : undefined,
    
    // Publication flags
    publicar_para_venta: legacyProperty.publishForSale || false,
    publicar_para_alquiler: legacyProperty.publishForRent || false,
    
    // Purpose and status
    proposito: mapPurpose(legacyProperty.purpose),
    status: mapStatus(legacyProperty.status),
    estado_ocupacional: legacyProperty.tenant?._id ? 'ALQUILADA' : 'DISPONIBLE',
    
    // Contract reference
    contrato_vigente_id: legacyProperty.leaseAgreement || null,
    
    // User reference
    usuario_creacion_id: legacyProperty.user || null,
    
    // Preserve legacy location IDs for later mapping
    _legacyLocationIds: (legacyProperty.state || legacyProperty.city) ? {
      state: legacyProperty.state,
      city: legacyProperty.city,
    } : undefined,
    
    // Preserve legacy fields for reference
    _legacyData: {
      gmaps: legacyProperty.gmaps,
      inventory: legacyProperty.inventory,
      description: legacyProperty.description,
      specs: legacyProperty.specs,
      createdAt: legacyProperty.createdAt,
    },
    
    // Migration notes
    _migrationNotes: migrationNotes.length > 0 ? migrationNotes : undefined,
  };
  
  // Remove undefined fields
  Object.keys(newProperty).forEach(key => {
    if (newProperty[key] === undefined) {
      delete newProperty[key];
    }
  });
  
  return newProperty;
}

/**
 * Main migration function
 */
async function migrateProperties() {
  try {
    console.log('🚀 Starting property migration...');
    console.log(`📖 Source: ${LEGACY_DB_URI}`);
    console.log(`📝 Target: ${NEW_DB_URI}`);
    console.log('');
    
    // Wait for connections
    await Promise.all([
      new Promise((resolve) => legacyConnection.once('open', resolve)),
      new Promise((resolve) => newConnection.once('open', resolve)),
    ]);
    
    console.log('✅ Database connections established');
    
    // Load location caches
    await loadLocationCaches();
    
    // Fetch all legacy properties
    const legacyProperties = await LegacyProperty.find({}).lean();
    console.log(`📊 Found ${legacyProperties.length} properties in legacy database`);
    
    if (legacyProperties.length === 0) {
      console.log('⚠️  No properties to migrate');
      return;
    }
    
    // Statistics
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    const errors = [];
    let provinceNotFoundCount = 0;
    let localityNotFoundCount = 0;
    let noOwnerCount = 0;
    let servicesCount = 0;
    
    // Migrate each property
    for (const legacyProperty of legacyProperties) {
      try {
        const transformedProperty = transformProperty(legacyProperty);
        
        // Check if property already exists by _id
        const existingProperty = await NewProperty.findById(legacyProperty._id);
        
        if (existingProperty) {
          console.log(`⏭️  Skipping property ${transformedProperty.identificador_interno} (already exists)`);
          skipCount++;
          continue;
        }
        
        // Track statistics
        if (transformedProperty._migrationNotes) {
          if (transformedProperty._migrationNotes.some(n => n.includes('Province not found'))) {
            provinceNotFoundCount++;
          }
          if (transformedProperty._migrationNotes.some(n => n.includes('Locality not found'))) {
            localityNotFoundCount++;
          }
          if (transformedProperty._migrationNotes.some(n => n.includes('No owner'))) {
            noOwnerCount++;
          }
        }
        
        if (transformedProperty.servicios_impuestos?.length > 0) {
          servicesCount += transformedProperty.servicios_impuestos.length;
        }
        
        // Create new property
        await NewProperty.create(transformedProperty);
        successCount++;
        console.log(`✅ Migrated: ${transformedProperty.identificador_interno} - ${transformedProperty.titulo || transformedProperty.direccion?.calle || 'Sin título'}`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Error migrating property ${legacyProperty._id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push({
          propertyId: legacyProperty._id,
          address: legacyProperty.address,
          error: error.message,
        });
      }
    }
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   Total properties: ${legacyProperties.length}`);
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ⏭️  Skipped (already exist): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    console.log('\n📍 Location Lookup Summary:');
    console.log(`   ⚠️  Provinces not found: ${provinceNotFoundCount}`);
    console.log(`   ⚠️  Localities not found: ${localityNotFoundCount}`);
    
    console.log('\n📋 Additional Statistics:');
    console.log(`   ⚠️  Properties without owner: ${noOwnerCount}`);
    console.log(`   📦 Total services migrated: ${servicesCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors details:');
      errors.forEach(err => {
        console.log(`   - ${err.address} (ID: ${err.propertyId}): ${err.error}`);
      });
    }
    
    console.log('\n✨ Migration completed!');
    
    if (provinceNotFoundCount > 0 || localityNotFoundCount > 0) {
      console.log('\n⚠️  IMPORTANT: Some provinces/localities were not found.');
      console.log('   Legacy location IDs are stored in _legacyLocationIds field.');
    }
    
    if (noOwnerCount > 0) {
      console.log('\n⚠️  IMPORTANT: Some properties have no owner assigned.');
      console.log('   These properties require manual owner assignment.');
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
  migrateProperties()
    .then(() => {
      console.log('✅ Migration script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateProperties, transformProperty };
