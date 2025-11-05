import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AccountingEntriesService } from '../src/modules/accounting-entries/accounting-entries.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { Contract } from '../src/modules/contracts/entities/contract.entity';
import { AccountingEntry } from '../src/modules/accounting-entries/entities/accounting-entry.entity';
import { PaginationService } from '../src/common/pagination/pagination.service';
import { FinancialAccountsService } from '../src/modules/financial-accounts/financial-accounts.service';

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
        {
          provide: PaginationService,
          useValue: {
            paginate: jest.fn(),
          },
        },
        {
          provide: FinancialAccountsService,
          useValue: {
            updateBalance: jest.fn(),
            getAccountById: jest.fn(),
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
      debe: 1000,
      haber: 0,
      es_iva_incluido: false,
      tasa_iva_aplicada: 0,
      monto_base_imponible: 0,
      monto_iva_calculado: 0,
    };
    // Mock de create para capturar argumentos
    const createMock = jest.fn().mockResolvedValue({ partidas: [partida] });
    accountingEntriesService.create = createMock;
    const asiento = await accountingEntriesService.create({
      contrato_id: new Types.ObjectId(),
      tipo_asiento: 'Alquiler',
      partidas: [partida],
    });
    expect(createMock).toHaveBeenCalled();
    const args = createMock.mock.calls[0][0];
    expect(args.partidas.length).toBeGreaterThan(0);
    expect(args.partidas[0].debe).toBe(1000);
    expect(asiento.partidas[0].debe).toBe(1000);
  });
});
