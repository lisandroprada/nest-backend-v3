import { ConciliationService } from './conciliation.service';
import { CandidateStatus } from './entities/conciliation-candidate.entity';
import { TipoOperacion } from './entities/bank-movement.entity';

// Mocks simples para los modelos de Mongoose
const mockBankMovementModel: any = {
  find: jest.fn(),
  updateOne: jest.fn(),
};

const mockCandidateModel: any = {
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  updateMany: jest.fn(),
  findById: jest.fn(),
};

const mockTransactionsService: any = {
  findUnreconciledTransactions: jest.fn(),
  markAsReconciled: jest.fn(),
};

describe('ConciliationService', () => {
  let service: ConciliationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConciliationService(
      mockBankMovementModel,
      mockCandidateModel,
      mockTransactionsService,
    );
  });

  it('genera candidatos para movimientos con coincidencia de monto y fecha', async () => {
    const movement = {
      _id: { toString: () => 'm1' },
      monto: 1000,
      fecha_operacion: new Date('2025-11-10'),
      tipo_operacion: TipoOperacion.INGRESO,
    } as any;

    mockBankMovementModel.find.mockReturnValue({
      limit: jest.fn().mockResolvedValue([movement]),
    });
    mockTransactionsService.findUnreconciledTransactions.mockResolvedValue([
      {
        _id: 't1',
        monto: 1000,
        fecha_transaccion: new Date('2025-11-10'),
        tipo: 'INGRESO',
        conciliado: false,
      },
    ]);
    mockCandidateModel.findOne.mockResolvedValue(null);
    mockCandidateModel.create.mockResolvedValue({ _id: 'c1' });

    const result = await service.generateCandidates({});

    expect(result.totalCandidates).toBe(1);
    expect(mockCandidateModel.create).toHaveBeenCalledTimes(1);
  });

  it('computeScore asigna puntaje correcto según flags', () => {
    // @ts-expect-error método privado acceso directo para test
    const scoreFull = service.computeScore({
      monto: true,
      fecha: true,
      cuit: true,
    });
    // @ts-expect-error acceso a método privado para verificar cálculo de score sin CUIT
    const scoreMontoFecha = service.computeScore({
      monto: true,
      fecha: true,
      cuit: false,
    });
    // @ts-expect-error acceso a método privado para verificar cálculo sólo monto
    const scoreSoloMonto = service.computeScore({
      monto: true,
      fecha: false,
      cuit: false,
    });

    expect(scoreFull).toBe(100);
    expect(scoreMontoFecha).toBe(80);
    expect(scoreSoloMonto).toBe(50);
  });

  it('confirmación de candidato actualiza estado y entidades relacionadas', async () => {
    const candidate = {
      _id: 'cand1',
      bank_movement_id: 'm1',
      transaction_id: 't1',
      status: CandidateStatus.PENDING,
      save: jest.fn(),
    } as any;

    mockCandidateModel.findById.mockResolvedValue(candidate);
    mockCandidateModel.updateMany.mockResolvedValue({});

    await service.updateCandidateStatus({
      candidateId: 'cand1',
      status: CandidateStatus.CONFIRMED,
    });

    expect(candidate.status).toBe(CandidateStatus.CONFIRMED);
    expect(mockBankMovementModel.updateOne).toHaveBeenCalledWith(
      { _id: candidate.bank_movement_id },
      expect.objectContaining({ $set: expect.any(Object) }),
    );
    expect(mockTransactionsService.markAsReconciled).toHaveBeenCalledWith(
      candidate.transaction_id,
    );
    expect(mockCandidateModel.updateMany).toHaveBeenCalled();
  });
});
