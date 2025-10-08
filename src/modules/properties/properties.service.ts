import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from './entities/property.entity';
import { AgentsService } from '../agents/agents.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { PaginationService } from 'src/common/pagination/pagination.service';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    private readonly agentsService: AgentsService, // Para validar propietarios_ids
    private readonly paginationService: PaginationService,
  ) {}

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
