import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from './entities/property.entity';
import { AgentsService } from '../agents/agents.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PaginationDto } from '../../common/pagination/dto/pagination.dto';
import { PaginationService } from '../../common/pagination/pagination.service';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService, // Para validar propietarios_ids
    private readonly paginationService: PaginationService,
  ) {}

  getModel() {
    return this.propertyModel;
  }

  async findByAddressText(searchText: string) {
    const accentInsensitivePattern = this.accentInsensitive(searchText);
    
    return this.propertyModel
      .find({
        $or: [
          // Nuevo schema
          { 'direccion.calle': { $regex: new RegExp(accentInsensitivePattern, 'i') } },
          { 'direccion.numero': { $regex: new RegExp(accentInsensitivePattern, 'i') } },
          { 'identificador_interno': { $regex: new RegExp(accentInsensitivePattern, 'i') } },
          // Schema viejo (address como string)
          { 'address': { $regex: new RegExp(accentInsensitivePattern, 'i') } },
        ],
      })
      .collation({ locale: 'es', strength: 1 })
      .exec();
  }

  private accentInsensitive(term: string): string {
    return term
      .replace(/a/gi, '[aá]')
      .replace(/e/gi, '[eé]')
      .replace(/i/gi, '[ií]')
      .replace(/o/gi, '[oó]')
      .replace(/u/gi, '[uúü]');
  }

  async findByMedidor(identificador_servicio: string): Promise<Property[]> {
    return this.propertyModel
      .find({
        'servicios_impuestos.identificador_servicio': identificador_servicio,
      })
      .exec();
  }

  async search(filters: any) {
    // TODO: Implementar búsqueda real con filtros de MongoDB
    // Por ahora devolvemos datos mockeados para que el bot funcione
    return [
      {
        id: 'prop_001',
        title: 'Departamento 2 ambientes en Palermo (VERIFICADO)',
        address: 'Av. Santa Fe 3456',
        zone: 'Palermo',
        type: 'apartment',
        rooms: 2,
        price: 500000,
        currency: 'ARS',
        surface: 50,
        url: 'https://propietas.com/prop/001'
      },
      {
        id: 'prop_002',
        title: 'Casa 3 ambientes en Zona Norte',
        address: 'Calle Olivos 789',
        zone: 'Norte',
        type: 'house',
        rooms: 3,
        price: 850000,
        currency: 'ARS',
        surface: 120,
        url: 'https://propietas.com/prop/002'
      },
      {
        id: 'prop_003',
        title: 'Monoambiente en Belgrano',
        address: 'Av. Cabildo 2000',
        zone: 'Belgrano',
        type: 'apartment',
        rooms: 1,
        price: 350000,
        currency: 'ARS',
        surface: 35,
        url: 'https://propietas.com/prop/003'
      }
    ];
  }

  async create(
    createPropertyDto: CreatePropertyDto,
    userId: string,
  ): Promise<Property> {
    // Validación de Integridad: Asegurar que todos los propietarios_ids existan como agentes
    for (const ownerId of createPropertyDto.propietarios_ids) {
      const agentExists = await this.agentsService.findOne(ownerId.toString());
      if (!agentExists) {
        throw new BadRequestException(
          `Propietario ID ${ownerId} no encontrado.`,
        );
      }
    }

    const propertyData = {
      ...createPropertyDto,
      status: 'DISPONIBLE', // Estado inicial por defecto
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    };

    const newProperty = new this.propertyModel(propertyData);
    return newProperty.save();
  }

  async findAll(paginationDto: PaginationDto) {
    if (paginationDto.search?.criteria) {
      paginationDto.search.criteria.forEach((criterion) => {
        if (
          criterion.field === 'propietarios_ids' &&
          criterion.operation === 'eq'
        ) {
          if (Types.ObjectId.isValid(criterion.term)) {
            (criterion as any).term = new Types.ObjectId(criterion.term);
          }
        }
      });
    }
    return this.paginationService.paginate(this.propertyModel, paginationDto);
  }

  async findOne(id: string): Promise<Property> {
    const property = await this.propertyModel.findById(id);
    if (!property) {
      throw new NotFoundException(`Property with ID "${id}" not found.`);
    }
    return property;
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyModel.findById(id);
    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${id} no encontrada.`);
    }

    // Lógica de Integridad de Estado (DDD): No permitir cambio manual si hay contrato vigente
    if (
      property.contrato_vigente_id &&
      updatePropertyDto.status === 'DISPONIBLE'
    ) {
      throw new BadRequestException(
        'El estado de la propiedad debe ser liberado por la finalización del contrato.',
      );
    }

    const updatedData = {
      ...updatePropertyDto,
      usuario_modificacion_id: new Types.ObjectId(userId),
    };

    const updatedProperty = await this.propertyModel.findByIdAndUpdate(
      id,
      updatedData,
      { new: true },
    );

    if (!updatedProperty) {
      throw new NotFoundException(`Property with ID "${id}" not found.`);
    }

    return updatedProperty;
  }

  async remove(id: string): Promise<{ message: string }> {
    const property = await this.findOne(id);
    property.status = 'INACTIVO';
    await property.save();
    return { message: `Property with ID "${id}" has been logically deleted.` };
  }
}
