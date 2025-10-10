import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly uploadsPath = join(process.cwd(), 'uploads', 'properties');

  /**
   * Procesa y guarda una imagen en múltiples versiones
   * @param file - Archivo multer
   * @param propertyId - ID de la propiedad
   * @param type - Tipo de imagen (imagenes, planos, satellite)
   * @returns Objeto con las URLs de las diferentes versiones
   */
  async processAndSaveImage(
    file: Express.Multer.File,
    propertyId: string,
    type: 'imagenes' | 'planos' | 'satellite',
  ): Promise<{
    nombre: string;
    versiones: { thumb: string; slider: string; original: string };
    dimensiones?: { ancho: number; alto: number };
  }> {
    try {
      const fileName = `${uuidv4()}-${Date.now()}`;
      const typeFolder = type === 'imagenes' ? 'images' : type;
      const basePath = join(this.uploadsPath, propertyId, typeFolder);

      // Crear directorios si no existen
      await this.ensureDirectoryExists(basePath);

      const image = sharp(file.buffer);
      const metadata = await image.metadata();

      const result: any = {
        nombre: `${fileName}.${metadata.format}`,
        versiones: { thumb: '', slider: '', original: '' },
      };

      // Guardar versión original
      const originalPath = join(basePath, 'original', result.nombre);
      await this.ensureDirectoryExists(join(basePath, 'original'));
      await image.toFile(originalPath);
      result.versiones.original = `/uploads/properties/${propertyId}/${typeFolder}/original/${result.nombre}`;

      // Para imágenes satelitales, solo guardamos el original y las dimensiones
      if (type === 'satellite') {
        result.dimensiones = { ancho: metadata.width, alto: metadata.height };
        return result;
      }

      // Crear versión thumbnail (200x200)
      const thumbPath = join(basePath, 'thumb', result.nombre);
      await this.ensureDirectoryExists(join(basePath, 'thumb'));
      await sharp(file.buffer)
        .resize(200, 200, { fit: 'cover' })
        .toFile(thumbPath);
      result.versiones.thumb = `/uploads/properties/${propertyId}/${typeFolder}/thumb/${result.nombre}`;

      // Crear versión slider (800x600)
      const sliderPath = join(basePath, 'slider', result.nombre);
      await this.ensureDirectoryExists(join(basePath, 'slider'));
      await sharp(file.buffer)
        .resize(800, 600, { fit: 'inside' })
        .toFile(sliderPath);
      result.versiones.slider = `/uploads/properties/${propertyId}/${typeFolder}/slider/${result.nombre}`;

      return result;
    } catch (error) {
      throw new BadRequestException(
        `Error procesando imagen: ${error.message}`,
      );
    }
  }

  /**
   * Elimina una imagen y todas sus versiones
   * @param propertyId - ID de la propiedad
   * @param fileName - Nombre del archivo
   * @param type - Tipo de imagen
   */
  async deleteImage(
    propertyId: string,
    fileName: string,
    type: 'imagenes' | 'planos' | 'satellite',
  ): Promise<void> {
    try {
      const typeFolder = type === 'imagenes' ? 'images' : type;
      const basePath = join(this.uploadsPath, propertyId, typeFolder);

      const versions = ['original', 'thumb', 'slider'];

      for (const version of versions) {
        const filePath = join(basePath, version, fileName);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // Ignorar si el archivo no existe
        }
      }
    } catch (error) {
      throw new BadRequestException(
        `Error eliminando imagen: ${error.message}`,
      );
    }
  }

  /**
   * Guarda un documento (PDF, DOC, etc.)
   * @param file - Archivo multer
   * @param propertyId - ID de la propiedad
   * @returns URL del documento
   */
  async saveDocument(
    file: Express.Multer.File,
    propertyId: string,
  ): Promise<{ nombre: string; url: string }> {
    try {
      const fileName = `${uuidv4()}-${Date.now()}-${file.originalname}`;
      const basePath = join(this.uploadsPath, propertyId, 'documentos');

      await this.ensureDirectoryExists(basePath);

      const filePath = join(basePath, fileName);
      await fs.writeFile(filePath, file.buffer);

      return {
        nombre: file.originalname,
        url: `/uploads/properties/${propertyId}/documentos/${fileName}`,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error guardando documento: ${error.message}`,
      );
    }
  }

  /**
   * Elimina un documento
   * @param propertyId - ID de la propiedad
   * @param fileName - Nombre del archivo
   */
  async deleteDocument(propertyId: string, fileName: string): Promise<void> {
    try {
      const filePath = join(
        this.uploadsPath,
        propertyId,
        'documentos',
        fileName,
      );
      await fs.unlink(filePath);
    } catch (error) {
      throw new BadRequestException(
        `Error eliminando documento: ${error.message}`,
      );
    }
  }

  /**
   * Asegura que un directorio exista, creándolo si es necesario
   * @param dirPath - Ruta del directorio
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}
