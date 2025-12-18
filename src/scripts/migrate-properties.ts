
import mongoose, { Schema, Types } from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const V2_MONGO_URI = 'mongodb://127.0.0.1:27017/nest-propietasV2';
const V3_MONGO_URI = process.env.MONGODB || 'mongodb://127.0.0.1:27017/nest-propietasV3';
const TARGET_AGENT_ID = new Types.ObjectId('607e050ebd8cb085e6fe9d2b');

console.log('V2 URI:', V2_MONGO_URI);
console.log('V3 URI:', V3_MONGO_URI);

// --- V2 Schema (Source) ---
const PropertyV2Schema = new Schema({
  address: String,
  province: Types.ObjectId,
  locality: Types.ObjectId,
  lat: Number,
  lng: Number,
  consortium: String,
  type: String,
  detailedDescription: {
    title: String,
    brief: String,
    rooms: Number,
    bedrooms: Number,
    bathrooms: Number,
    sqFt: Number,
    buildSqFt: Number,
    age: Number,
    orientation: String,
  },
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
  publishForSale: Boolean,
  publishForRent: Boolean,
  purpose: String,
  status: String,
  img: [{
    name: String,
    thumb: String,
    thumbWeb: String,
    imgSlider: String,
    title: String,
    description: String,
    createdAt: Date,
  }],
  imgCover: {
    thumbWeb: String,
  },
  floorPlans: [{
    name: String,
    url: String,
  }],
  documents: [{
    name: String,
    url: String,
  }],
  satelliteImage: {
    name: String,
    url: String,
  },
  lots: [Schema.Types.Mixed],
  user: Types.ObjectId,
  createdAt: Date,
}, { strict: false });

// --- V3 Schema (Target) ---
// We will use a flexible schema for writing to avoid validation errors during migration,
// but we will try to match the structure defined in the entity.
const PropertyV3Schema = new Schema({
  _id: Types.ObjectId,
  propietarios_ids: [Types.ObjectId],
  identificador_interno: String,
  direccion: {
    calle: String,
    numero: String,
    provincia_id: Types.ObjectId,
    localidad_id: Types.ObjectId,
    latitud: Number,
    longitud: Number,
  },
  consorcio_nombre: String,
  caracteristicas: {
    tipo_propiedad: String,
    ambientes: Number,
    dormitorios: Number,
    banos: Number,
    metraje_total: Number,
    metraje_cubierto: Number,
    antiguedad_anos: Number,
    orientacion: String,
  },
  titulo: String,
  descripcion: String,
  valor_venta: Number,
  valor_venta_detallado: {
    monto: Number,
    moneda: String,
    es_publico: Boolean,
    descripcion: String,
  },
  valor_alquiler: Number,
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
  imagenes: [{
    nombre: String,
    url: String,
    orden: Number,
    es_portada: Boolean,
    versiones: {
      thumb: String,
      slider: String,
      original: String,
    },
  }],
  img_cover_url: String,
  planos: [{
    nombre: String,
    url: String,
  }],
  documentos_digitales: [{
    nombre: String,
    url: String,
  }],
  imagen_satelital: Schema.Types.Mixed,
  lotes: [Schema.Types.Mixed],
  usuario_creacion_id: Types.ObjectId,
  createdAt: Date,
}, { strict: false, timestamps: true });

// --- Mappings ---
const TYPE_MAPPING: Record<string, string> = {
  'departamento': 'departamento',
  'casa': 'casa',
  'ph': 'ph',
  'oficina': 'oficina',
  'local_comercial': 'local_comercial',
  'galpon': 'galpon',
  'lote': 'lote',
  'quinta': 'quinta',
  'chacra': 'chacra',
  'estudio': 'estudio',
  'loft': 'loft',
  'duplex': 'duplex',
  'triplex': 'triplex',
};

const ORIENTATION_MAPPING: Record<string, string> = {
  'norte': 'NORTE',
  'sur': 'SUR',
  'este': 'ESTE',
  'oeste': 'OESTE',
  'noreste': 'NORESTE',
  'noroeste': 'NOROESTE',
  'sureste': 'SURESTE',
  'suroeste': 'SUROESTE',
};

async function migrate() {
  const connV2 = await mongoose.createConnection(V2_MONGO_URI).asPromise();
  const connV3 = await mongoose.createConnection(V3_MONGO_URI).asPromise();

  console.log('Connected to databases.');

  const PropertyV2 = connV2.model('Property', PropertyV2Schema, 'properties');
  const PropertyV3 = connV3.model('Property', PropertyV3Schema, 'properties');

  const cursor = PropertyV2.find().cursor();
  let count = 0;
  let errors = 0;

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    try {
      const v2Data: any = doc.toObject();
      
      // --- Refined Logic for Status & Availability ---
      let v3Status = 'DISPONIBLE';
      let v3OccupationalStatus = 'DISPONIBLE';

      if (v2Data.status === 'ocupada') {
        v3Status = 'ALQUILADO'; // Or RESERVADO, depending on context, but ALQUILADO is safer for 'ocupada'
        v3OccupationalStatus = 'OCUPADA'; // Or ALQUILADA
      } else if (v2Data.status === 'disponible') {
        if (v2Data.available === false) {
          v3Status = 'INACTIVO';
          v3OccupationalStatus = 'DISPONIBLE';
        } else {
          v3Status = 'DISPONIBLE';
          v3OccupationalStatus = 'DISPONIBLE';
        }
      } else {
        // Fallback
        v3Status = 'INACTIVO'; 
        v3OccupationalStatus = 'DISPONIBLE';
      }

      // Append availableAt to description if present
      let finalDescription = v2Data.detailedDescription?.brief || '';
      if (v2Data.availableAt) {
        const dateStr = new Date(v2Data.availableAt).toLocaleDateString('es-AR');
        finalDescription += `\n\nDisponible a partir de: ${dateStr}`;
      }

      // --- Refined Logic for Pricing ---
      const saleDescription = [
        v2Data.valueForSale?.description,
        v2Data.valueForSale?.paymentMethod ? `Método de pago: ${v2Data.valueForSale.paymentMethod}` : null
      ].filter(Boolean).join('\n');

      const rentDescription = [
        v2Data.valueForRent?.description,
        v2Data.valueForRent?.paymentMethod ? `Método de pago: ${v2Data.valueForRent.paymentMethod}` : null
      ].filter(Boolean).join('\n');

      // Transform V2 -> V3
      const v3Data: any = {
        _id: v2Data._id,
        propietarios_ids: [TARGET_AGENT_ID],
        identificador_interno: `LEGACY-${v2Data._id.toString().slice(-6).toUpperCase()}`,
        direccion: {
          calle: v2Data.address || 'S/N',
          numero: '', // Cannot reliably extract from address string without complex parsing
          provincia_id: v2Data.province,
          localidad_id: v2Data.locality,
          latitud: v2Data.lat,
          longitud: v2Data.lng,
        },
        consorcio_nombre: v2Data.consortium,
        caracteristicas: {
          tipo_propiedad: TYPE_MAPPING[v2Data.type] || 'departamento', // Default fallback
          ambientes: v2Data.detailedDescription?.rooms,
          dormitorios: v2Data.detailedDescription?.bedrooms,
          banos: v2Data.detailedDescription?.bathrooms,
          metraje_total: v2Data.detailedDescription?.sqFt,
          metraje_cubierto: v2Data.detailedDescription?.buildSqFt,
          antiguedad_anos: v2Data.detailedDescription?.age,
          orientacion: v2Data.detailedDescription?.orientation ? ORIENTATION_MAPPING[v2Data.detailedDescription.orientation.toLowerCase()] : undefined,
        },
        titulo: v2Data.detailedDescription?.title,
        descripcion: finalDescription,
        
        valor_venta: v2Data.valueForSale?.amount,
        valor_venta_detallado: v2Data.valueForSale ? {
          monto: v2Data.valueForSale.amount,
          moneda: v2Data.valueForSale.currency,
          es_publico: v2Data.valueForSale.pricePublic,
          descripcion: saleDescription,
        } : undefined,

        valor_alquiler: v2Data.valueForRent?.amount,
        valor_alquiler_detallado: v2Data.valueForRent ? {
          monto: v2Data.valueForRent.amount,
          moneda: v2Data.valueForRent.currency,
          es_publico: v2Data.valueForRent.pricePublic,
          descripcion: rentDescription,
        } : undefined,

        publicar_para_venta: v2Data.publishForSale,
        publicar_para_alquiler: v2Data.publishForRent,
        
        proposito: 'VIVIENDA', // Default
        status: v3Status,
        estado_ocupacional: v3OccupationalStatus,

        imagenes: v2Data.img?.map((img: any, index: number) => ({
          nombre: img.name || img.title || `Imagen ${index + 1}`,
          url: img.imgSlider || img.thumbWeb || img.thumb,
          orden: index,
          es_portada: index === 0,
          versiones: {
            thumb: img.thumb,
            slider: img.imgSlider,
            original: img.imgSlider,
          }
        })) || [],

        img_cover_url: v2Data.imgCover?.thumbWeb,

        planos: v2Data.floorPlans?.map((p: any) => ({
          nombre: p.name,
          url: p.url
        })) || [],

        documentos_digitales: v2Data.documents?.map((d: any) => ({
          nombre: d.name,
          url: d.url
        })) || [],

        imagen_satelital: v2Data.satelliteImage,
        lotes: v2Data.lots,
        
        usuario_creacion_id: v2Data.user,
        createdAt: v2Data.createdAt,
      };

      // Upsert into V3
      await PropertyV3.findByIdAndUpdate(v3Data._id, v3Data, { upsert: true, new: true });
      
      count++;
      if (count % 10 === 0) console.log(`Processed ${count} properties...`);

    } catch (err) {
      console.error(`Error migrating property ${doc._id}:`, err);
      errors++;
    }
  }

  console.log(`Migration finished. Processed: ${count}, Errors: ${errors}`);
  
  await connV2.close();
  await connV3.close();
}

migrate().catch(console.error);
