import * as fs from 'fs';
import * as path from 'path';

export function ensureUploadDirectories() {
  const dirs = [
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'uploads', 'properties'),
    path.join(process.cwd(), 'uploads', 'properties', 'floorplans'),
    path.join(process.cwd(), 'uploads', 'properties', 'satellite'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  }
}
