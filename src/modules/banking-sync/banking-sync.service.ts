import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BankMovement } from './entities/bank-movement.entity';
import { BankMovementQueryDto } from './dto/bank-movement-query.dto';
import { CreateBankMovementDto } from './dto/create-bank-movement.dto';

@Injectable()
export class BankingSyncService {
  private readonly logger = new Logger(BankingSyncService.name);

  constructor(
    @InjectModel(BankMovement.name)
    private bankMovementModel: Model<BankMovement>,
  ) {}

  /**
   * Crea un nuevo movimiento bancario externo
   * Valida que no exista duplicado por identificador_unico
   */
  async create(createDto: CreateBankMovementDto): Promise<BankMovement | null> {
    try {
      // Verificar si ya existe este movimiento
      const existing = await this.bankMovementModel.findOne({
        identificador_unico: createDto.identificador_unico,
      });

      if (existing) {
        this.logger.warn(
          `Movimiento duplicado detectado: ${createDto.identificador_unico}`,
        );
        return null; // No crear duplicado
      }

      const movement = new this.bankMovementModel(createDto);
      const saved = await movement.save();
      this.logger.log(
        `Nuevo movimiento bancario creado: ${saved.identificador_unico}`,
      );
      return saved;
    } catch (error) {
      this.logger.error(`Error al crear movimiento bancario: ${error.message}`);
      throw new BadRequestException(
        `Error al guardar movimiento bancario: ${error.message}`,
      );
    }
  }

  /**
   * Lista movimientos bancarios con paginación y filtros
   */
  async findAll(query: BankMovementQueryDto) {
    const {
      page = 0,
      pageSize = 10,
      sort = '-fecha_operacion',
      tipo_operacion,
      conciliado_sistema,
      fecha_desde,
      fecha_hasta,
      identificador_fiscal,
      identificador_unico,
      nombre_tercero,
    } = query;

    // Construir filtros
    const filters: any = {};

    if (tipo_operacion) {
      filters.tipo_operacion = tipo_operacion;
    }

    if (conciliado_sistema !== undefined) {
      filters.conciliado_sistema = conciliado_sistema;
    }

    if (fecha_desde || fecha_hasta) {
      filters.fecha_operacion = {};
      if (fecha_desde) {
        filters.fecha_operacion.$gte = new Date(fecha_desde);
      }
      if (fecha_hasta) {
        filters.fecha_operacion.$lte = new Date(fecha_hasta);
      }
    }

    if (identificador_fiscal) {
      filters.identificador_fiscal = {
        $regex: identificador_fiscal,
        $options: 'i',
      };
    }

    if (identificador_unico) {
      filters.identificador_unico = {
        $regex: identificador_unico,
        $options: 'i',
      };
    }

    if (nombre_tercero) {
      filters.nombre_tercero = { $regex: nombre_tercero, $options: 'i' };
    }

    // Ejecutar consulta con paginación
    const [data, total] = await Promise.all([
      this.bankMovementModel
        .find(filters)
        .sort(sort)
        .skip(page * pageSize)
        .limit(pageSize)
        .exec(),
      this.bankMovementModel.countDocuments(filters),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Obtiene un movimiento bancario por ID
   */
  async findOne(id: string): Promise<BankMovement> {
    const movement = await this.bankMovementModel.findById(id);
    if (!movement) {
      throw new NotFoundException(
        `Movimiento bancario con ID ${id} no encontrado`,
      );
    }
    return movement;
  }

  /**
   * Busca un movimiento por identificador único
   */
  async findByIdentificador(identificador: string): Promise<BankMovement> {
    const movement = await this.bankMovementModel.findOne({
      identificador_unico: identificador,
    });
    if (!movement) {
      throw new NotFoundException(
        `Movimiento con identificador ${identificador} no encontrado`,
      );
    }
    return movement;
  }

  /**
   * Marca un movimiento como conciliado
   */
  async markAsConciliado(
    movementId: string,
    transaccionId: string,
  ): Promise<BankMovement> {
    const movement = await this.findOne(movementId);
    movement.conciliado_sistema = true;
    movement.transaccion_id = transaccionId;
    return movement.save();
  }

  /**
   * Obtiene estadísticas de movimientos bancarios
   */
  async getStats() {
    const [total, conciliados, pendientes, porTipo] = await Promise.all([
      this.bankMovementModel.countDocuments(),
      this.bankMovementModel.countDocuments({ conciliado_sistema: true }),
      this.bankMovementModel.countDocuments({ conciliado_sistema: false }),
      this.bankMovementModel.aggregate([
        {
          $group: {
            _id: '$tipo_operacion',
            count: { $sum: 1 },
            total_monto: { $sum: '$monto' },
          },
        },
      ]),
    ]);

    return {
      total,
      conciliados,
      pendientes,
      porcentaje_conciliacion:
        total > 0 ? ((conciliados / total) * 100).toFixed(2) : 0,
      por_tipo: porTipo,
    };
  }
}
