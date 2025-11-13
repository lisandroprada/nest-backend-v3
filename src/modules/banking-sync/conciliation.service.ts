import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BankMovement, TipoOperacion } from './entities/bank-movement.entity';
import {
  ConciliationCandidate,
  CandidateStatus,
} from './entities/conciliation-candidate.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { GenerateCandidatesDto } from './dto/generate-candidates.dto';
import { UpdateCandidateStatusDto } from './dto/update-candidate-status.dto';

interface MatchingContext {
  fechaToleranceDays: number;
  maxCandidatesPerMovement: number;
}

@Injectable()
export class ConciliationService {
  private readonly logger = new Logger(ConciliationService.name);

  constructor(
    @InjectModel(BankMovement.name)
    private readonly bankMovementModel: Model<BankMovement>,
    @InjectModel(ConciliationCandidate.name)
    private readonly candidateModel: Model<ConciliationCandidate>,
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Genera candidatos de conciliación sin confirmar (PENDING)
   */
  async generateCandidates(dto: GenerateCandidatesDto) {
    const ctx: MatchingContext = {
      fechaToleranceDays: dto.fechaToleranceDays ?? 1,
      maxCandidatesPerMovement: dto.maxCandidatesPerMovement ?? 5,
    };

    const movementFilter: any = { conciliado_sistema: false };
    if (dto.bankMovementId) {
      movementFilter._id = new Types.ObjectId(dto.bankMovementId);
    }

    const movements = await this.bankMovementModel
      .find(movementFilter)
      .limit(200); // protección básica

    let totalCandidates = 0;
    const perMovement: Record<string, number> = {};

    for (const movement of movements) {
      const generated = await this.generateForMovement(movement, ctx);
      perMovement[movement._id.toString()] = generated;
      totalCandidates += generated;
    }

    return {
      processedMovements: movements.length,
      totalCandidates,
      perMovement,
    };
  }

  /**
   * Genera candidatos para un movimiento
   */
  private async generateForMovement(
    movement: BankMovement,
    ctx: MatchingContext,
  ): Promise<number> {
    // Heurísticas de matching:
    // 1. Monto exacto
    // 2. Fecha dentro de tolerancia
    // 3. Tipo compatible (INGRESO <-> INGRESO, EGRESO <-> EGRESO)
    // 4. (Opcional) CUIT/CUIL si existe y coincide en descripción de transacción o referencia

    // Obtener transacciones no conciliadas del mismo tipo dentro de ventana de fechas
    const fechaDesde = new Date(movement.fecha_operacion);
    fechaDesde.setDate(fechaDesde.getDate() - ctx.fechaToleranceDays);
    const fechaHasta = new Date(movement.fecha_operacion);
    fechaHasta.setDate(fechaHasta.getDate() + ctx.fechaToleranceDays);

    const type =
      movement.tipo_operacion === TipoOperacion.INGRESO ? 'INGRESO' : 'EGRESO';

    const candidateTransactions =
      await this.transactionsService.findUnreconciledTransactions({
        tipo: type,
        monto: movement.monto,
        fechaDesde,
        fechaHasta,
        limit: 50,
      });

    let created = 0;
    for (const tx of candidateTransactions) {
      if (created >= ctx.maxCandidatesPerMovement) break;

      // Verificar si ya existe candidato
      const existing = await this.candidateModel.findOne({
        bank_movement_id: movement._id,
        transaction_id: tx._id,
      });
      if (existing) continue;

      const reasons: string[] = ['MONTO', 'FECHA'];

      const score = this.computeScore({
        monto: true,
        fecha: true,
        cuit: false,
      });

      await this.candidateModel.create({
        bank_movement_id: movement._id,
        transaction_id: tx._id,
        status: CandidateStatus.PENDING,
        score,
        match_reasons: reasons,
      });
      created++;
    }

    if (created > 0) {
      await this.bankMovementModel.updateOne(
        { _id: movement._id },
        {
          $addToSet: {
            candidato_conciliacion_ids: { $each: [] }, // reserved; we can later push candidate IDs if needed
          },
        },
      );
    }

    return created;
  }

  /**
   * Cálculo básico de score (podemos refinar luego)
   */
  private computeScore(flags: {
    monto: boolean;
    fecha: boolean;
    cuit: boolean;
  }): number {
    let score = 0;
    if (flags.monto) score += 50;
    if (flags.fecha) score += 30;
    if (flags.cuit) score += 20;
    return score;
  }

  /**
   * Lista candidatos (paginación simple futura si hace falta)
   */
  async listCandidates(filters: {
    status?: CandidateStatus;
    bankMovementId?: string;
  }) {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.bankMovementId)
      query.bank_movement_id = new Types.ObjectId(filters.bankMovementId);

    const candidates = await this.candidateModel
      .find(query)
      .sort('-score')
      .limit(500)
      .populate('bank_movement_id')
      .populate('transaction_id');

    return candidates;
  }

  /**
   * Cambia el estado de un candidato
   */
  async updateCandidateStatus(dto: UpdateCandidateStatusDto) {
    const candidate = await this.candidateModel.findById(dto.candidateId);
    if (!candidate) throw new NotFoundException('Candidato no encontrado');

    if (dto.status === CandidateStatus.PENDING) {
      throw new BadRequestException('No se puede volver a PENDING');
    }

    candidate.status = dto.status;
    if (dto.notes) candidate.notes = dto.notes;
    await candidate.save();

    // Si se confirma, marcar entidades como conciliadas
    if (dto.status === CandidateStatus.CONFIRMED) {
      await this.confirmConciliation(candidate);
    }

    return candidate;
  }

  private async confirmConciliation(candidate: ConciliationCandidate) {
    // Marcar movimiento
    await this.bankMovementModel.updateOne(
      { _id: candidate.bank_movement_id },
      {
        $set: {
          conciliado_sistema: true,
          transaccion_id: candidate.transaction_id,
        },
      },
    );

    // Marcar transacción
    await this.transactionsService.markAsReconciled(candidate.transaction_id);

    // Rechazar otros candidatos del mismo movimiento
    await this.candidateModel.updateMany(
      {
        bank_movement_id: candidate.bank_movement_id,
        _id: { $ne: candidate._id },
        status: CandidateStatus.PENDING,
      },
      {
        $set: {
          status: CandidateStatus.REJECTED,
          notes: 'Confirmado otro candidato',
        },
      },
    );
  }
}
