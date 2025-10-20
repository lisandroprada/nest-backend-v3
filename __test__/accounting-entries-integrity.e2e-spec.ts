import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AccountingEntriesService } from '../src/modules/accounting-entries/accounting-entries.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { Contract } from '../src/modules/contracts/entities/contract.entity';
import { AccountingEntry } from '../src/modules/accounting-entries/entities/accounting-entry.entity';

describe('Integridad de Asientos Contables', () => {
  let accountingEntriesService: AccountingEntriesService;
  let contractsService: ContractsService;
  let contractModel: any;
  let accountingEntryModel: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingEntriesService,
        ContractsService,
        {
          provide: getModelToken(Contract.name),
          useValue: {
            save: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
          },
        },
        {
          provide: getModelToken(AccountingEntry.name),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    accountingEntriesService = module.get<AccountingEntriesService>(
      AccountingEntriesService,
    );
    contractsService = module.get<ContractsService>(ContractsService);
    contractModel = module.get(getModelToken(Contract.name));
    accountingEntryModel = module.get(getModelToken(AccountingEntry.name));
  });

  it('debe rechazar asientos sin partidas', async () => {
    await expect(
      accountingEntriesService.create({
        contrato_id: new Types.ObjectId(),
        tipo_asiento: 'Alquiler',
        partidas: [],
      }),
    ).rejects.toThrow('No se puede crear un asiento contable sin partidas.');
  });

  it('debe persistir asientos con partidas válidas y ObjectId', async () => {
    const partida = {
      cuenta_id: new Types.ObjectId(),
      descripcion: 'Test',
      debe: 100,
      haber: 0,
      agente_id: new Types.ObjectId(),
      es_iva_incluido: false,
      tasa_iva_aplicada: 0,
      monto_base_imponible: 0,
      monto_iva_calculado: 0,
    };
    accountingEntryModel.save.mockResolvedValue({ partidas: [partida] });
    const asiento = await accountingEntriesService.create({
      contrato_id: new Types.ObjectId(),
      tipo_asiento: 'Alquiler',
      partidas: [partida],
    });
    expect(asiento.partidas.length).toBe(1);
    expect(Types.ObjectId.isValid(asiento.partidas[0].cuenta_id)).toBe(true);
    expect(Types.ObjectId.isValid(asiento.partidas[0].agente_id)).toBe(true);
  });

  // Test de integración para generación de asientos desde contrato
  it('debe generar asientos con partidas válidas al crear contrato', async () => {
    // Simular contrato con los campos mínimos requeridos
    const contrato = {
      _id: new Types.ObjectId(),
      partes: [
        { rol: 'LOCADOR', agente_id: new Types.ObjectId() },
        { rol: 'LOCATARIO', agente_id: new Types.ObjectId() },
      ],
      terminos_financieros: {
        monto_base_vigente: 1000,
        ajuste_periodicidad_meses: 12,
        comision_administracion_porcentaje: 10,
        indice_tipo: 'ICL',
      },
      fecha_inicio: new Date('2025-01-01'),
      fecha_final: new Date('2026-01-01'),
      firmas_completas: true,
      documentacion_completa: true,
      visita_realizada: true,
      inventario_actualizado: true,
      fotos_inventario: ['test.jpg'],
      status: 'VIGENTE',
    };
    // Mock de create para capturar argumentos
    const createMock = jest
      .fn()
      .mockResolvedValue({ partidas: [{ debe: 1000 }] });
    accountingEntriesService.create = createMock;
    await contractsService['generateInitialAccountingEntries'](
      contrato as any,
      contrato.partes[0].agente_id.toString(),
    );
    expect(createMock).toHaveBeenCalled();
    const args = createMock.mock.calls[0][0];
    expect(args.partidas.length).toBeGreaterThan(0);
    expect(args.partidas[0].debe).toBe(1000);
  });
});
