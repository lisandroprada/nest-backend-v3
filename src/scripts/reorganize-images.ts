import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB || 'mongodb://127.0.0.1:27017/nest-propietasV3';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'properties');

const PropertySchema = new mongoose.Schema({
  imagenes: [{
    nombre: String,
    url: String,
    orden: Number,
    es_portada: Boolean,
    versiones: {
      thumb: String,
      slider: String,
      original: String,
    }
  }],
  img_cover_url: String,
}, { strict: false });

async function reorganizeImages() {
  const conn = await mongoose.createConnection(MONGO_URI).asPromise();
  const Property = conn.model('Property', PropertySchema, 'properties');

  const properties = await Property.find({});
  console.log(`Found ${properties.length} properties to check.`);

  let processedCount = 0;
  let movedCount = 0;

  for (const prop of properties) {
    const propId = prop._id.toString();
    let modified = false;

    // Ensure property directory exists
    const propDir = path.join(UPLOADS_DIR, propId);
    
    // Process 'imagenes'
    const images = prop.get('imagenes') || [];
    if (images.length > 0) {
      for (const img of images) {
        // Extract filename from URL (assuming it's the last part)
        // URL format in V2 migration: /uploads/properties/imgSlider/uuid.webp
        const currentUrl = img.url;
        if (!currentUrl || !currentUrl.includes('/uploads/properties/')) continue;

        const filename = path.basename(currentUrl);
        
        // Check if file is already in new structure
        if (currentUrl.includes(`/${propId}/`)) {
          continue; // Already migrated
        }

        // Define source and destination paths
        // V2 Sources
        const srcOriginal = path.join(UPLOADS_DIR, 'original', filename);
        const srcSlider = path.join(UPLOADS_DIR, 'imgSlider', filename);
        const srcThumb = path.join(UPLOADS_DIR, 'thumb', filename);
        
        // V3 Destinations
        const destOriginalDir = path.join(propDir, 'images', 'original');
        const destSliderDir = path.join(propDir, 'images', 'slider');
        const destThumbDir = path.join(propDir, 'images', 'thumb');

        const destOriginal = path.join(destOriginalDir, filename);
        const destSlider = path.join(destSliderDir, filename);
        const destThumb = path.join(destThumbDir, filename);

        // Move files
        let fileMoved = false;

        // Move Original (or Slider if original missing)
        if (fs.existsSync(srcOriginal)) {
          fs.mkdirSync(destOriginalDir, { recursive: true });
          fs.renameSync(srcOriginal, destOriginal);
          fileMoved = true;
        } else if (fs.existsSync(srcSlider)) {
          // If original missing, use slider as original
          fs.mkdirSync(destOriginalDir, { recursive: true });
          fs.copyFileSync(srcSlider, destOriginal); // Copy so we can also use it for slider
        }

        // Move Slider
        if (fs.existsSync(srcSlider)) {
          fs.mkdirSync(destSliderDir, { recursive: true });
          fs.renameSync(srcSlider, destSlider);
          fileMoved = true;
        }

        // Move Thumb
        if (fs.existsSync(srcThumb)) {
          fs.mkdirSync(destThumbDir, { recursive: true });
          fs.renameSync(srcThumb, destThumb);
          fileMoved = true;
        }

        if (fileMoved) {
          // Update DB URLs
          img.url = `/uploads/properties/${propId}/images/original/${filename}`;
          img.versiones = {
            original: `/uploads/properties/${propId}/images/original/${filename}`,
            slider: `/uploads/properties/${propId}/images/slider/${filename}`,
            thumb: `/uploads/properties/${propId}/images/thumb/${filename}`,
          };
          modified = true;
          movedCount++;
        }
      }
    }

    // Process Cover Image (img_cover_url)
    const coverUrl = prop.get('img_cover_url');
    if (coverUrl && !coverUrl.includes(`/${propId}/`)) {
      // Usually cover is one of the images, so it might have been moved already.
      // But we need to update the URL string.
      const filename = path.basename(coverUrl);
      // We point cover to the 'thumb' version in the new structure for consistency with V2 'thumbWeb' usage?
      // Or 'slider'? V2 used 'thumbWeb' for cover. V3 has 'thumb' (200x200) and 'slider' (800x600).
      // Let's use 'slider' for better quality cover, or 'thumb' if it's small.
      // Let's assume 'slider' is best for cover.
      
      const newCoverUrl = `/uploads/properties/${propId}/images/slider/${filename}`;
      prop.set('img_cover_url', newCoverUrl);
      modified = true;
    }

    if (modified) {
      await prop.save();
      processedCount++;
    }
  }

  console.log(`Reorganization finished.`);
  console.log(`Properties updated: ${processedCount}`);
  console.log(`Images moved: ${movedCount}`);

  await conn.close();
}

reorganizeImages().catch(console.error);
