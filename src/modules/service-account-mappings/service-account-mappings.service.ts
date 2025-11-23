import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ServiceAccountMapping } from './entities/service-account-mapping.entity';
import { CreateServiceAccountMappingDto } from './dto/create-service-account-mapping.dto';
import { UpdateServiceAccountMappingDto } from './dto/update-service-account-mapping.dto';

@Injectable()
export class ServiceAccountMappingsService {
  constructor(
    @InjectModel(ServiceAccountMapping.name)
    private readonly mappingModel: Model<ServiceAccountMapping>,
  ) {}

  create(createDto: CreateServiceAccountMappingDto) {
    // Normalizar posibles claves camelCase enviadas por frontend
    const body: any = { ...createDto } as any;
    if (
      !body.provider_cuit &&
      (body.providerCuit || body.providerCuit === '')
    ) {
      body.provider_cuit = body.providerCuit;
    }
    if (
      !body.identificador_servicio &&
      (body.identificadorServicio || body.identificadorServicio === '')
    ) {
      body.identificador_servicio = body.identificadorServicio;
    }

    // Log incoming body to help debug missing fields during requests
    // (kept lightweight to avoid leaking secrets in production logs)
    // eslint-disable-next-line no-console
    console.debug('ServiceAccountMappings.create body:', {
      provider_agent_id: body.provider_agent_id,
      provider_cuit: body.provider_cuit,
      identificador_servicio: body.identificador_servicio,
      cuenta_egreso_codigo: body.cuenta_egreso_codigo,
    });

    const doc = new this.mappingModel({
      ...body,
      provider_agent_id: new Types.ObjectId(body.provider_agent_id),
    });

    try {
      return doc.save();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error saving ServiceAccountMapping:', err?.message || err);
      throw err;
    }
  }

  findAll() {
    // Populate provider basic info for frontend listing (but keep internal methods
    // that return raw mappings unchanged to avoid breaking server-side flows).
    return this.mappingModel
      .find()
      .populate(
        'provider_agent_id',
        'nombre_razon_social identificador_fiscal email_principal',
      )
      .lean()
      .exec()
      .then((docs: any[]) =>
        docs.map((d) => {
          const provider = d.provider_agent_id as any;
          return {
            ...d,
            provider_name: provider ? provider.nombre_razon_social : null,
            // normalize provider_agent_id to id string if populate returned object
            provider_agent_id:
              provider && provider._id ? provider._id : d.provider_agent_id,
          };
        }),
      );
  }

  findOne(id: string) {
    return this.mappingModel.findById(id).exec();
  }

  async update(id: string, updateDto: UpdateServiceAccountMappingDto) {
    // Normalizar claves camelCase en updates también
    const body: any = { ...updateDto } as any;
    if (
      !body.provider_cuit &&
      (body.providerCuit || body.providerCuit === '')
    ) {
      body.provider_cuit = body.providerCuit;
    }
    if (
      !body.identificador_servicio &&
      (body.identificadorServicio || body.identificadorServicio === '')
    ) {
      body.identificador_servicio = body.identificadorServicio;
    }

    const updated = await this.mappingModel
      .findByIdAndUpdate(id, body, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Mapping ${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const res = await this.mappingModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException(`Mapping ${id} not found`);
    return { deleted: true };
  }

  /**
   * Resolve a mapping by provider identifier. The first parameter can be either
   * a provider Agent ObjectId (24 hex chars) or a provider CUIT string.
   * If an identificadorServicio is provided, prefer a specific mapping for it.
   */
  async findByProviderAgentId(
    agentIdOrCuit: string,
    identificadorServicio?: string,
  ) {
    const isObjectId = Types.ObjectId.isValid(agentIdOrCuit);

    const buildQuery = (byAgentId: boolean) => {
      const q: any = { enabled: true };
      if (identificadorServicio)
        q.identificador_servicio = identificadorServicio;
      if (byAgentId) q.provider_agent_id = new Types.ObjectId(agentIdOrCuit);
      else q.provider_cuit = agentIdOrCuit;
      return q;
    };

    // Prefer a specific mapping (identificador_servicio) if matches
    if (isObjectId) {
      const specific = await this.mappingModel
        .findOne(buildQuery(true))
        .lean()
        .exec();
      if (specific) return specific;
      return this.mappingModel.findOne(buildQuery(true)).lean().exec();
    }

    // Not an ObjectId -> treat as CUIT
    const specificByCuit = await this.mappingModel
      .findOne(buildQuery(false))
      .lean()
      .exec();
    if (specificByCuit) return specificByCuit;
    return this.mappingModel
      .findOne({ provider_cuit: agentIdOrCuit, enabled: true })
      .lean()
      .exec();
  }
}
