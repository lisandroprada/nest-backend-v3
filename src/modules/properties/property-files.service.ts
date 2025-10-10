import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from './entities/property.entity';
import { StorageService } from './services/storage.service';

@Injectable()
export class PropertyFilesService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Subir imágenes a la propiedad
   */
  async uploadImages(
    propertyId: string,
    files: Express.Multer.File[],
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    const imagenes = property.imagenes || [];
    const currentMaxOrder =
      imagenes.length > 0
        ? Math.max(...imagenes.map((img) => img.orden || 0))
        : 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await this.storageService.processAndSaveImage(
        file,
        propertyId,
        'imagenes',
      );

      imagenes.push({
        nombre: result.nombre,
        url: result.versiones.original,
        orden: currentMaxOrder + i + 1,
        es_portada: imagenes.length === 0 && i === 0, // Primera imagen es portada
        versiones: result.versiones,
      });
    }

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      { imagenes, usuario_modificacion_id: new Types.ObjectId(userId) },
      { new: true },
    );

    return updatedProperty;
  }

  /**
   * Eliminar una imagen
   */
  async deleteImage(
    propertyId: string,
    fileName: string,
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    const imagenes = property.imagenes || [];
    const imageIndex = imagenes.findIndex((img) => img.nombre === fileName);

    if (imageIndex === -1) {
      throw new NotFoundException(`Imagen ${fileName} no encontrada`);
    }

    // Eliminar archivos físicos
    await this.storageService.deleteImage(propertyId, fileName, 'imagenes');

    // Eliminar de la base de datos
    imagenes.splice(imageIndex, 1);

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      { imagenes, usuario_modificacion_id: new Types.ObjectId(userId) },
      { new: true },
    );

    return updatedProperty;
  }

  /**
   * Reordenar imágenes
   */
  async reorderImages(
    propertyId: string,
    ordenImagenes: string[],
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    const imagenes = property.imagenes || [];
    const reorderedImages = ordenImagenes
      .map((fileName, index) => {
        const img = imagenes.find((i) => i.nombre === fileName);
        if (img) {
          return { ...img, orden: index + 1 };
        }
        return null;
      })
      .filter((img) => img !== null);

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      {
        imagenes: reorderedImages,
        usuario_modificacion_id: new Types.ObjectId(userId),
      },
      { new: true },
    );

    return updatedProperty;
  }

  /**
   * Establecer una imagen como portada
   */
  async setImageAsPortada(
    propertyId: string,
    fileName: string,
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    const imagenes = property.imagenes || [];
    let found = false;

    imagenes.forEach((img) => {
      if (img.nombre === fileName) {
        img.es_portada = true;
        found = true;
      } else {
        img.es_portada = false;
      }
    });

    if (!found) {
      throw new NotFoundException(`Imagen ${fileName} no encontrada`);
    }

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      { imagenes, usuario_modificacion_id: new Types.ObjectId(userId) },
      { new: true },
    );

    return updatedProperty;
  }

  /**
   * Subir planos
   */
  async uploadPlanos(
    propertyId: string,
    files: Express.Multer.File[],
    descripciones: string[],
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    const planos = property.planos || [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await this.storageService.processAndSaveImage(
        file,
        propertyId,
        'planos',
      );

      planos.push({
        nombre: result.nombre,
        url: result.versiones.original,
        descripcion: descripciones[i] || '',
      });
    }

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      { planos, usuario_modificacion_id: new Types.ObjectId(userId) },
      { new: true },
    );

    return updatedProperty;
  }

  /**
   * Eliminar un plano
   */
  async deletePlano(
    propertyId: string,
    fileName: string,
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    const planos = property.planos || [];
    const planoIndex = planos.findIndex((p) => p.nombre === fileName);

    if (planoIndex === -1) {
      throw new NotFoundException(`Plano ${fileName} no encontrado`);
    }

    await this.storageService.deleteImage(propertyId, fileName, 'planos');
    planos.splice(planoIndex, 1);

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      { planos, usuario_modificacion_id: new Types.ObjectId(userId) },
      { new: true },
    );

    return updatedProperty;
  }

  /**
   * Subir documentos
   */
  async uploadDocuments(
    propertyId: string,
    files: Express.Multer.File[],
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    const documentos = property.documentos_digitales || [];

    for (const file of files) {
      const result = await this.storageService.saveDocument(file, propertyId);
      documentos.push(result);
    }

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      {
        documentos_digitales: documentos,
        usuario_modificacion_id: new Types.ObjectId(userId),
      },
      { new: true },
    );

    return updatedProperty;
  }

  /**
   * Eliminar un documento
   */
  async deleteDocument(
    propertyId: string,
    fileName: string,
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    const documentos = property.documentos_digitales || [];
    const docIndex = documentos.findIndex((d) => d.url.includes(fileName));

    if (docIndex === -1) {
      throw new NotFoundException(`Documento ${fileName} no encontrado`);
    }

    await this.storageService.deleteDocument(propertyId, fileName);
    documentos.splice(docIndex, 1);

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      {
        documentos_digitales: documentos,
        usuario_modificacion_id: new Types.ObjectId(userId),
      },
      { new: true },
    );

    return updatedProperty;
  }

  /**
   * Subir imagen satelital
   */
  async uploadSatelliteImage(
    propertyId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    // Si ya existe una imagen satelital, eliminarla
    if (property.imagen_satelital) {
      await this.storageService.deleteImage(
        propertyId,
        property.imagen_satelital.nombre,
        'satellite',
      );
    }

    const result = await this.storageService.processAndSaveImage(
      file,
      propertyId,
      'satellite',
    );

    const imagenSatelital = {
      nombre: result.nombre,
      url: result.versiones.original,
      ancho: result.dimensiones.ancho,
      alto: result.dimensiones.alto,
      pixels_por_metro: 0, // Se establecerá con la calibración
    };

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      {
        imagen_satelital: imagenSatelital,
        usuario_modificacion_id: new Types.ObjectId(userId),
      },
      { new: true },
    );

    return updatedProperty;
  }

  /**
   * Calibrar imagen satelital (establecer píxeles por metro)
   */
  async calibrateSatelliteImage(
    propertyId: string,
    pixelsPorMetro: number,
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Propiedad con ID ${propertyId} no encontrada`,
      );
    }

    if (!property.imagen_satelital) {
      throw new BadRequestException('No existe imagen satelital para calibrar');
    }

    property.imagen_satelital.pixels_por_metro = pixelsPorMetro;

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      propertyId,
      {
        imagen_satelital: property.imagen_satelital,
        usuario_modificacion_id: new Types.ObjectId(userId),
      },
      { new: true },
    );

    return updatedProperty;
  }
}
