import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ServiceCommunication,
  CommunicationStatus,
  CommunicationType,
} from './entities/service-communication.entity';
import { ServiceCommunicationQueryDto } from './dto/service-communication-query.dto';

@Injectable()
export class ServiceSyncService {
  private readonly logger = new Logger(ServiceSyncService.name);

  constructor(
    @InjectModel(ServiceCommunication.name)
    private readonly commModel: Model<ServiceCommunication>,
  ) {}

  async create(
    payload: Partial<ServiceCommunication>,
  ): Promise<ServiceCommunication | null> {
    try {
      if (!payload.email_id) {
        throw new BadRequestException('email_id es requerido');
      }

      // Evitar duplicados por email_id
      const exists = await this.commModel.findOne({
        email_id: payload.email_id,
      });
      if (exists) {
        this.logger.warn(
          `Comunicación duplicada detectada: ${payload.email_id}`,
        );
        return null;
      }

      const doc = new this.commModel({
        estado_procesamiento: CommunicationStatus.UNPROCESSED,
        tipo_alerta: CommunicationType.OTRO,
        ...payload,
      });
      const saved = await doc.save();
      return saved;
    } catch (e) {
      this.logger.error(`Error creando comunicación: ${e.message}`);
      throw e;
    }
  }

  async findAll(query: ServiceCommunicationQueryDto) {
    const {
      page = 0,
      pageSize = 10,
      sort = '-fecha_email',
      proveedor_cuit,
      identificador_servicio,
      remitente,
      asunto,
      tipo_alerta,
      estado_procesamiento,
      fecha_desde,
      fecha_hasta,
      solo_sin_procesar,
    } = query;

    const filters: any = {};
    if (proveedor_cuit)
      filters.proveedor_cuit = { $regex: proveedor_cuit, $options: 'i' };
    if (identificador_servicio)
      filters.identificador_servicio = {
        $regex: identificador_servicio,
        $options: 'i',
      };
    if (remitente) filters.remitente = { $regex: remitente, $options: 'i' };
    if (asunto) filters.asunto = { $regex: asunto, $options: 'i' };
    if (tipo_alerta) filters.tipo_alerta = tipo_alerta;
    if (estado_procesamiento)
      filters.estado_procesamiento = estado_procesamiento;
    if (solo_sin_procesar)
      filters.estado_procesamiento = CommunicationStatus.UNPROCESSED;
    if (fecha_desde || fecha_hasta) {
      filters.fecha_email = {};
      if (fecha_desde) filters.fecha_email.$gte = new Date(fecha_desde);
      if (fecha_hasta) filters.fecha_email.$lte = new Date(fecha_hasta);
    }

    const [data, total] = await Promise.all([
      this.commModel
        .find(filters)
        .sort(sort)
        .skip(page * pageSize)
        .limit(pageSize)
        .exec(),
      this.commModel.countDocuments(filters),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string): Promise<ServiceCommunication> {
    // Validate ObjectId early to avoid Mongoose Cast errors for non-objectid strings
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Comunicación ${id} no encontrada`);
    }
    const doc = await this.commModel.findById(id);
    if (!doc) throw new NotFoundException(`Comunicación ${id} no encontrada`);
    return doc;
  }

  async updateStatus(
    id: string,
    status: CommunicationStatus,
    notes?: string,
  ): Promise<ServiceCommunication> {
    const doc = await this.findOne(id);
    doc.estado_procesamiento = status;
    if (notes) doc.notas = notes;
    return doc.save();
  }

  async linkDetectedExpense(
    id: string,
    gastoId: string,
    propertyIds?: string[],
  ): Promise<ServiceCommunication> {
    const doc = await this.findOne(id);
    doc.gasto_detectado_id = new Types.ObjectId(gastoId);
    if (propertyIds && propertyIds.length > 0) {
      doc.propiedades_sugeridas_ids = propertyIds.map(
        (p) => new Types.ObjectId(p),
      );
    }
    doc.estado_procesamiento = CommunicationStatus.PROCESSED;
    return doc.save();
  }

  async getStats() {
    const [total, pendientes, procesadas, ignoradas, porTipo] =
      await Promise.all([
        this.commModel.countDocuments(),
        this.commModel.countDocuments({
          estado_procesamiento: CommunicationStatus.UNPROCESSED,
        }),
        this.commModel.countDocuments({
          estado_procesamiento: CommunicationStatus.PROCESSED,
        }),
        this.commModel.countDocuments({
          estado_procesamiento: CommunicationStatus.IGNORED,
        }),
        this.commModel.aggregate([
          { $group: { _id: '$tipo_alerta', count: { $sum: 1 } } },
        ]),
      ]);

    return {
      total,
      pendientes,
      procesadas,
      ignoradas,
      por_tipo: porTipo,
      // Return processing rate as number with two decimals (previously returned as string)
      tasa_procesamiento:
        total > 0 ? Math.round((procesadas / total) * 10000) / 100 : 0,
    };
  }
}
