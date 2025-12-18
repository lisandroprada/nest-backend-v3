import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB || 'mongodb://127.0.0.1:27017/nest-propietasV3';

const PropertySchema = new mongoose.Schema({
  imagenes: [{
    url: String,
    versiones: {
      thumb: String,
      slider: String,
      original: String,
    }
  }],
  img_cover_url: String,
}, { strict: false });

async function checkUrls() {
  const conn = await mongoose.createConnection(MONGO_URI).asPromise();
  const Property = conn.model('Property', PropertySchema, 'properties');

  const properties = await Property.find({ identificador_interno: /^LEGACY-/ }).limit(5);
  const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'properties');

  console.log('Checking URLs for 5 migrated properties:');
  for (const p of properties) {
    console.log(`Property ID: ${p._id}`);
    const coverUrl = p.get('img_cover_url');
    console.log('Cover URL:', coverUrl);
    
    if (coverUrl) {
      // /uploads/properties/ID/images/slider/filename
      // Remove /uploads/properties/ to get relative path
      const relativePath = coverUrl.replace('/uploads/properties/', '');
      const fullPath = path.join(UPLOADS_DIR, relativePath);
      console.log(`Cover File Exists: ${fs.existsSync(fullPath)}`);
    }

    const imgs = p.get('imagenes');
    if (imgs && imgs.length > 0) {
      const firstImg = imgs[0];
      console.log('First Image URL:', firstImg.url);
      
      if (firstImg.url) {
        const relativePath = firstImg.url.replace('/uploads/properties/', '');
        const fullPath = path.join(UPLOADS_DIR, relativePath);
        console.log(`First Image File Exists: ${fs.existsSync(fullPath)}`);
      }
    }
    console.log('---');
  }

  await conn.close();
}

checkUrls().catch(console.error);
