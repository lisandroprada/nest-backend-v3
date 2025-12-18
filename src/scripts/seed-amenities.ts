import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Amenity } from '../modules/shared/amenities/entities/amenity.entity';

interface AmenityData {
  nombre: string;
  categoria: string;
}

const STANDARD_AMENITIES: AmenityData[] = [
  // Comodidades
  { nombre: 'piscina', categoria: 'comodidades' },
  { nombre: 'jardin', categoria: 'comodidades' },
  { nombre: 'terraza', categoria: 'comodidades' },
  { nombre: 'balcon', categoria: 'comodidades' },
  { nombre: 'parrilla', categoria: 'comodidades' },
  
  // Servicios
  { nombre: 'calefaccion', categoria: 'servicios' },
  { nombre: 'aire_acondicionado', categoria: 'servicios' },
  { nombre: 'agua_caliente', categoria: 'servicios' },
  { nombre: 'gas_natural', categoria: 'servicios' },
  
  // Seguridad
  { nombre: 'portero', categoria: 'seguridad' },
  { nombre: 'seguridad_24h', categoria: 'seguridad' },
  { nombre: 'alarma', categoria: 'seguridad' },
  { nombre: 'camaras', categoria: 'seguridad' },
  
  // Espacios
  { nombre: 'cochera', categoria: 'espacios' },
  { nombre: 'baulera', categoria: 'espacios' },
  { nombre: 'lavadero', categoria: 'espacios' },
  { nombre: 'sum', categoria: 'espacios' },
  { nombre: 'quincho', categoria: 'espacios' },
  
  // Otros
  { nombre: 'gimnasio', categoria: 'otros' },
  { nombre: 'ascensor', categoria: 'otros' },
  { nombre: 'acceso_discapacitados', categoria: 'otros' },
  { nombre: 'solarium', categoria: 'otros' },
  { nombre: 'sauna', categoria: 'otros' },
];

async function seedAmenities() {
  console.log('🌱 Starting amenities seed...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const amenityModel = app.get<Model<Amenity>>(getModelToken(Amenity.name));

  try {
    // Check if amenities already exist
    const existingCount = await amenityModel.countDocuments();
    
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing amenities. Skipping seed.`);
      console.log('   To re-seed, first run: db.amenities.deleteMany({})');
      await app.close();
      return;
    }

    // Insert standard amenities
    const inserted = await amenityModel.insertMany(STANDARD_AMENITIES);
    
    console.log(`✅ Successfully seeded ${inserted.length} amenities:`);
    
    // Group by category for display
    const byCategory = inserted.reduce((acc, amenity) => {
      if (!acc[amenity.categoria]) {
        acc[amenity.categoria] = [];
      }
      acc[amenity.categoria].push(amenity.nombre);
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries(byCategory).forEach(([categoria, nombres]) => {
      console.log(`   📁 ${categoria}: ${nombres.join(', ')}`);
    });

    console.log('\n🎉 Amenities seed completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding amenities:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the seed
seedAmenities()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
