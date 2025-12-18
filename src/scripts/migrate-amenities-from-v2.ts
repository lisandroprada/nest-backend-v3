import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Amenity } from '../modules/shared/amenities/entities/amenity.entity';
import { Property } from '../modules/properties/entities/property.entity';

interface V2Property {
  _id: Types.ObjectId;
  specs?: string[];
}

async function migrateAmenitiesFromV2() {
  console.log('🔄 Starting amenities migration from V2 to V3...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const amenityModel = app.get<Model<Amenity>>(getModelToken(Amenity.name));
  const propertyModel = app.get<Model<Property>>(getModelToken(Property.name));

  try {
    // Step 1: Build amenity name -> ObjectId mapping
    console.log('📋 Step 1: Building amenity mapping...');
    const amenities = await amenityModel.find().lean();
    const amenityMap = new Map<string, Types.ObjectId>();
    
    amenities.forEach(amenity => {
      amenityMap.set(amenity.nombre, amenity._id as Types.ObjectId);
    });
    
    console.log(`   Found ${amenityMap.size} amenities in V3 collection\n`);

    // Step 2: Find all V3 properties that came from V2 (have legacy_id or check structure)
    console.log('📋 Step 2: Fetching V3 properties...');
    const v3Properties = await propertyModel.find({}).lean();
    console.log(`   Found ${v3Properties.length} properties in V3\n`);

    // Step 3: Connect to V2 database to get specs
    console.log('📋 Step 3: Fetching V2 properties with specs...');
    const v2Connection = propertyModel.db.useDb('propietas');
    
    // Query V2 properties collection directly without schema to get all fields
    const v2Properties = await v2Connection.collection('properties').find(
      { specs: { $type: 'array', $ne: [] } },
      { projection: { _id: 1, specs: 1, address: 1, lat: 1, lng: 1 } }
    ).toArray() as Array<V2Property & { address?: string; lat?: number; lng?: number }>;
    
    console.log(`   Found ${v2Properties.length} V2 properties with specs\n`);

    // Step 4: Build matching maps
    console.log('📋 Step 4: Building property matching maps...');
    const v2ByAddress = new Map<string, typeof v2Properties[0]>();
    const v2ByCoords = new Map<string, typeof v2Properties[0]>();
    
    v2Properties.forEach(prop => {
      if (prop.address) {
        v2ByAddress.set(prop.address.toLowerCase().trim(), prop);
      }
      if (prop.lat && prop.lng) {
        // Round to 6 decimals for coordinate matching (~0.1m precision)
        const coordKey = `${prop.lat.toFixed(6)},${prop.lng.toFixed(6)}`;
        v2ByCoords.set(coordKey, prop);
      }
    });
    
    console.log(`   Indexed ${v2ByAddress.size} by address, ${v2ByCoords.size} by coordinates\n`);

    // Step 5: Migrate amenities to V3 properties
    console.log('📋 Step 5: Migrating amenities...\n');
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    const unmappedAmenities = new Set<string>();
    const matchStats = { byAddress: 0, byCoords: 0, noMatch: 0 };

    for (const v3Prop of v3Properties) {
      let v2Match: typeof v2Properties[0] | undefined;
      
      // Try to match by address first
      if (v3Prop.direccion?.calle) {
        const v3Address = v3Prop.direccion.calle.toLowerCase().trim();
        v2Match = v2ByAddress.get(v3Address);
        if (v2Match) {
          matchStats.byAddress++;
        }
      }
      
      // If no match by address, try coordinates
      if (!v2Match && v3Prop.direccion?.latitud && v3Prop.direccion?.longitud) {
        const coordKey = `${v3Prop.direccion.latitud.toFixed(6)},${v3Prop.direccion.longitud.toFixed(6)}`;
        v2Match = v2ByCoords.get(coordKey);
        if (v2Match) {
          matchStats.byCoords++;
        }
      }
      
      // Debug: log first few matches
      if (v2Match && (matchStats.byAddress + matchStats.byCoords) <= 3) {
        console.log(`   DEBUG Match found: address="${v2Match.address}", specs=${JSON.stringify(v2Match.specs)}`);
      }
      
      if (!v2Match || !v2Match.specs || v2Match.specs.length === 0) {
        if (!v2Match) matchStats.noMatch++;
        skipped++;
        continue;
      }

      // Map V2 specs to V3 amenity ObjectIds
      const amenityIds: Types.ObjectId[] = [];
      
      for (const spec of v2Match.specs) {
        const amenityId = amenityMap.get(spec);
        if (amenityId) {
          amenityIds.push(amenityId);
        } else {
          unmappedAmenities.add(spec);
        }
      }

      if (amenityIds.length > 0) {
        // Update V3 property with amenity references
        await propertyModel.updateOne(
          { _id: v3Prop._id },
          { $set: { 'caracteristicas.amenities': amenityIds } }
        );
        updated++;
        
        if (updated % 50 === 0) {
          console.log(`   ✓ Migrated ${updated} properties...`);
        }
      } else {
        notFound++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Updated: ${updated} properties`);
    console.log(`   ⏭️  Skipped: ${skipped} properties (no V2 match or specs)`);
    console.log(`   ⚠️  Not found: ${notFound} properties (specs not in amenity map)`);
    console.log(`\n📍 Matching Statistics:`);
    console.log(`   🏠 By address: ${matchStats.byAddress}`);
    console.log(`   📍 By coordinates: ${matchStats.byCoords}`);
    console.log(`   ❌ No match: ${matchStats.noMatch}`);
    
    if (unmappedAmenities.size > 0) {
      console.log(`\n⚠️  Unmapped amenities found in V2 (${unmappedAmenities.size}):`);
      console.log(`   ${Array.from(unmappedAmenities).join(', ')}`);
      console.log('   Consider adding these to the amenities collection.');
    }

    console.log('\n🎉 Amenities migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error migrating amenities:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the migration
migrateAmenitiesFromV2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
