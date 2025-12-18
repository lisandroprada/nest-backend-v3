import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Amenity } from '../modules/shared/amenities/entities/amenity.entity';
import { Property } from '../modules/properties/entities/property.entity';
import * as fs from 'fs';
import * as path from 'path';

interface V2PropertyFromJSON {
  _id: { $oid: string };
  specs?: string[];
  address?: string;
  lat?: number;
  lng?: number;
}

async function importAmenitiesFromJSON() {
  console.log('🔄 Starting amenities import from JSON backup...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const amenityModel = app.get<Model<Amenity>>(getModelToken(Amenity.name));
  const propertyModel = app.get<Model<Property>>(getModelToken(Property.name));

  try {
    // Step 1: Load JSON file
    console.log('📋 Step 1: Loading JSON backup...');
    const jsonPath = path.join(__dirname, '../../today-nest-propietasV2.properties.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as V2PropertyFromJSON[];
    console.log(`   Loaded ${jsonData.length} properties from JSON\n`);

    // Step 2: Build amenity name -> ObjectId mapping
    console.log('📋 Step 2: Building amenity mapping...');
    const amenities = await amenityModel.find().lean();
    const amenityMap = new Map<string, Types.ObjectId>();
    
    amenities.forEach(amenity => {
      amenityMap.set(amenity.nombre, amenity._id as Types.ObjectId);
    });
    
    console.log(`   Found ${amenityMap.size} amenities in V3 collection\n`);

    // Step 3: Find all V3 properties
    console.log('📋 Step 3: Fetching V3 properties...');
    const v3Properties = await propertyModel.find({}).lean();
    console.log(`   Found ${v3Properties.length} properties in V3\n`);

    // Step 4: Build matching maps from JSON data
    console.log('📋 Step 4: Building property matching maps from JSON...');
    const jsonByAddress = new Map<string, V2PropertyFromJSON>();
    const jsonByCoords = new Map<string, V2PropertyFromJSON>();
    const propertiesWithSpecs = jsonData.filter(p => p.specs && p.specs.length > 0);
    
    propertiesWithSpecs.forEach(prop => {
      if (prop.address) {
        jsonByAddress.set(prop.address.toLowerCase().trim(), prop);
      }
      if (prop.lat && prop.lng) {
        const coordKey = `${prop.lat.toFixed(6)},${prop.lng.toFixed(6)}`;
        jsonByCoords.set(coordKey, prop);
      }
    });
    
    console.log(`   Found ${propertiesWithSpecs.length} properties with specs in JSON`);
    console.log(`   Indexed ${jsonByAddress.size} by address, ${jsonByCoords.size} by coordinates\n`);

    // Step 5: Migrate amenities to V3 properties
    console.log('📋 Step 5: Migrating amenities...\n');
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    const unmappedAmenities = new Set<string>();
    const matchStats = { byAddress: 0, byCoords: 0, noMatch: 0 };

    for (const v3Prop of v3Properties) {
      let jsonMatch: V2PropertyFromJSON | undefined;
      
      // Try to match by address first
      if (v3Prop.direccion?.calle) {
        const v3Address = v3Prop.direccion.calle.toLowerCase().trim();
        jsonMatch = jsonByAddress.get(v3Address);
        if (jsonMatch) {
          matchStats.byAddress++;
        }
      }
      
      // If no match by address, try coordinates
      if (!jsonMatch && v3Prop.direccion?.latitud && v3Prop.direccion?.longitud) {
        const coordKey = `${v3Prop.direccion.latitud.toFixed(6)},${v3Prop.direccion.longitud.toFixed(6)}`;
        jsonMatch = jsonByCoords.get(coordKey);
        if (jsonMatch) {
          matchStats.byCoords++;
        }
      }
      
      if (!jsonMatch || !jsonMatch.specs || jsonMatch.specs.length === 0) {
        if (!jsonMatch) matchStats.noMatch++;
        skipped++;
        continue;
      }

      // Map JSON specs to V3 amenity ObjectIds
      const amenityIds: Types.ObjectId[] = [];
      
      for (const spec of jsonMatch.specs) {
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
        
        if (updated % 5 === 0) {
          console.log(`   ✓ Migrated ${updated} properties...`);
        }
      } else {
        notFound++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Updated: ${updated} properties`);
    console.log(`   ⏭️  Skipped: ${skipped} properties (no JSON match or specs)`);
    console.log(`   ⚠️  Not found: ${notFound} properties (specs not in amenity map)`);
    console.log(`\n📍 Matching Statistics:`);
    console.log(`   🏠 By address: ${matchStats.byAddress}`);
    console.log(`   📍 By coordinates: ${matchStats.byCoords}`);
    console.log(`   ❌ No match: ${matchStats.noMatch}`);
    
    if (unmappedAmenities.size > 0) {
      console.log(`\n⚠️  Unmapped amenities found in JSON (${unmappedAmenities.size}):`);
      console.log(`   ${Array.from(unmappedAmenities).join(', ')}`);
      console.log('   Consider adding these to the amenities collection.');
    }

    console.log('\n🎉 Amenities import from JSON completed successfully!');
    
  } catch (error) {
    console.error('❌ Error importing amenities:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the import
importAmenitiesFromJSON()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
