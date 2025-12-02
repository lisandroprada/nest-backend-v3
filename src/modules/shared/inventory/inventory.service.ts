import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InventoryItem } from './entities/inventory-item.entity';
import { PropertyInventory } from './entities/property-inventory.entity';
import { InventoryVersion } from './entities/inventory-version.entity';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { CreatePropertyInventoryDto } from './dto/create-property-inventory.dto';
import { CreateInventoryVersionDto } from './dto/create-inventory-version.dto';
import { UpdateInventoryVersionDto } from './dto/update-inventory-version.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name)
    private readonly inventoryItemModel: Model<InventoryItem>,
    @InjectModel(PropertyInventory.name)
    private readonly propertyInventoryModel: Model<PropertyInventory>,
    @InjectModel(InventoryVersion.name)
    private readonly inventoryVersionModel: Model<InventoryVersion>,
  ) {}

  // ============================================
  // Métodos para InventoryItem (catálogo global)
  // ============================================

  create(createInventoryItemDto: CreateInventoryItemDto) {
    const newItem = new this.inventoryItemModel(createInventoryItemDto);
    return newItem.save();
  }

  findAll() {
    return this.inventoryItemModel.find().exec();
  }

  findOne(id: string) {
    return this.inventoryItemModel.findById(id).exec();
  }

  update(id: string, updateInventoryItemDto: UpdateInventoryItemDto) {
    return this.inventoryItemModel
      .findByIdAndUpdate(id, updateInventoryItemDto, { new: true })
      .exec();
  }

  remove(id: string) {
    return this.inventoryItemModel.findByIdAndDelete(id).exec();
  }

  // ============================================
  // Métodos para PropertyInventory (inventarios versionados)
  // ============================================

  async createPropertyInventory(
    createPropertyInventoryDto: CreatePropertyInventoryDto,
  ) {
    // Verificar si ya existe un inventario para esta propiedad
    const existing = await this.propertyInventoryModel
      .findOne({ property_id: createPropertyInventoryDto.property_id })
      .exec();

    if (existing) {
      throw new BadRequestException(
        'Ya existe un inventario para esta propiedad',
      );
    }

    const propertyInventory = new this.propertyInventoryModel({
      property_id: createPropertyInventoryDto.property_id,
      versions: [],
    });

    return propertyInventory.save();
  }

  async getPropertyInventory(propertyId: string) {
    const inventory = await this.propertyInventoryModel
      .findOne({ property_id: propertyId })
      .populate('current_version_id')
      .populate('versions')
      .exec();

    if (!inventory) {
      throw new NotFoundException(
        'No se encontró inventario para esta propiedad',
      );
    }

    return inventory;
  }

  async getOrCreatePropertyInventory(propertyId: string) {
    // Usar findOneAndUpdate con upsert para evitar race conditions
    const inventory = await this.propertyInventoryModel
      .findOneAndUpdate(
        { property_id: propertyId },
        { 
          $setOnInsert: { 
            property_id: propertyId,
            versions: [],
          }
        },
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true,
        }
      )
      .exec();

    return inventory;
  }

  // ============================================
  // Métodos para InventoryVersion
  // ============================================

  async createVersion(
    propertyId: string,
    createVersionDto: CreateInventoryVersionDto,
    userId?: string,
  ) {
    // Obtener o crear el PropertyInventory
    const propertyInventory = await this.getOrCreatePropertyInventory(propertyId);

    // Calcular el número de versión
    const versionCount = await this.inventoryVersionModel
      .countDocuments({ property_inventory_id: propertyInventory._id })
      .exec();

    const newVersion = new this.inventoryVersionModel({
      property_inventory_id: propertyInventory._id,
      version_number: versionCount + 1,
      description: createVersionDto.description,
      items: createVersionDto.items || [],
      status: createVersionDto.status || 'ACTIVE',
      created_by: userId ? new Types.ObjectId(userId) : undefined,
    });

    const savedVersion = await newVersion.save();

    // Agregar la versión al PropertyInventory
    propertyInventory.versions.push(savedVersion._id as Types.ObjectId);

    // Si es la primera versión o no hay versión actual, establecerla como actual
    if (!propertyInventory.current_version_id) {
      propertyInventory.current_version_id = savedVersion._id as Types.ObjectId;
    }

    await propertyInventory.save();

    return savedVersion;
  }

  async getVersions(propertyId: string) {
    const propertyInventory = await this.getPropertyInventory(propertyId);

    return this.inventoryVersionModel
      .find({ property_inventory_id: propertyInventory._id })
      .sort({ version_number: -1 })
      .exec();
  }

  async getVersion(propertyId: string, versionId: string) {
    const propertyInventory = await this.getPropertyInventory(propertyId);

    const version = await this.inventoryVersionModel
      .findOne({
        _id: versionId,
        property_inventory_id: propertyInventory._id,
      })
      .exec();

    if (!version) {
      throw new NotFoundException('Versión de inventario no encontrada');
    }

    return version;
  }

  async updateVersion(
    propertyId: string,
    versionId: string,
    updateVersionDto: UpdateInventoryVersionDto,
  ) {
    const version = await this.getVersion(propertyId, versionId);

    // No permitir editar versiones archivadas
    if (version.status === 'ARCHIVED') {
      throw new BadRequestException(
        'No se pueden editar versiones archivadas',
      );
    }

    Object.assign(version, updateVersionDto);
    return version.save();
  }

  async setCurrentVersion(propertyId: string, versionId: string) {
    const propertyInventory = await this.getPropertyInventory(propertyId);
    const version = await this.getVersion(propertyId, versionId);

    // Solo versiones ACTIVE pueden ser la versión actual
    if (version.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Solo las versiones activas pueden ser la versión actual',
      );
    }

    propertyInventory.current_version_id = version._id as Types.ObjectId;
    return propertyInventory.save();
  }

  async deleteVersion(propertyId: string, versionId: string) {
    const propertyInventory = await this.getPropertyInventory(propertyId);
    const version = await this.getVersion(propertyId, versionId);

    // No permitir eliminar la versión actual
    if (
      propertyInventory.current_version_id &&
      propertyInventory.current_version_id.toString() === versionId
    ) {
      throw new BadRequestException(
        'No se puede eliminar la versión actual',
      );
    }

    // Remover del array de versiones
    propertyInventory.versions = propertyInventory.versions.filter(
      (v) => v.toString() !== versionId,
    );
    await propertyInventory.save();

    // Eliminar la versión
    await this.inventoryVersionModel.findByIdAndDelete(versionId).exec();

    return { message: 'Versión eliminada correctamente' };
  }

  /**
   * Copiar inventario de una propiedad a otra
   */
  async copyInventoryToProperty(
    sourcePropertyId: string,
    targetPropertyId: string,
    versionId?: string,
    description?: string,
    userId?: string,
  ): Promise<InventoryVersion> {
    // 1. Obtener versión a copiar
    let sourceVersion: InventoryVersion;
    
    if (versionId) {
      sourceVersion = await this.getVersion(sourcePropertyId, versionId);
    } else {
      // Si no se especifica versión, copiar la última activa
      const versions = await this.getVersions(sourcePropertyId);
      sourceVersion = versions.find(v => v.status === 'ACTIVE') || versions[0];
    }
    
    if (!sourceVersion) {
      throw new NotFoundException('No se encontró inventario para copiar');
    }
    
    // 2. Crear nueva versión en propiedad destino
    const newVersionDto: CreateInventoryVersionDto = {
      description: description || `Copiado de propiedad ${sourcePropertyId}`,
      items: sourceVersion.items.map(item => {
        const {_id, ...itemWithoutId} = item as any;
        return itemWithoutId;
      }),
      status: 'DRAFT', // Crear como borrador para revisión
    };
    
    // 3. Crear versión en propiedad destino
    return this.createVersion(targetPropertyId, newVersionDto, userId);
  }
}
