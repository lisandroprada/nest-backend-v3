import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AccountingEntriesService } from './modules/accounting-entries/accounting-entries.service';
import { ContractsService } from './modules/contracts/contracts.service';
import { AgentsService } from './modules/agents/agents.service';
import { Contract } from './modules/contracts/entities/contract.entity';
import { AccountingEntry } from './modules/accounting-entries/entities/accounting-entry.entity';
import { PaginationService } from './common/pagination/pagination.service';
import { FinancialAccountsService } from './modules/financial-accounts/financial-accounts.service';
import { ChartOfAccountsService } from './modules/chart-of-accounts/chart-of-accounts.service';
import { PropertiesService } from './modules/properties/properties.service';
import { ContractSettingsService } from './modules/contract-settings/contract-settings.service';

describe('Integridad de Asientos Contables', () => {
  let accountingEntriesService: AccountingEntriesService;
  let contractsService: ContractsService;
  // let contractModel: any; // removed unused
  let accountingEntryModel: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        // keep the module compile step lightweight by NOT providing large services
        {
          provide: FinancialAccountsService,
          useValue: {}, // Stub: métodos no requeridos por pruebas actuales
        },
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
          useValue: class {
            constructor(dto: any) {
              Object.assign(this, dto);
            }
            save = jest.fn().mockResolvedValue(this);
            static find = jest.fn();
          },
        },
        {
          provide: PaginationService,
          useValue: {},
        },
        {
          provide: ChartOfAccountsService,
          useValue: {
            getAccountIdsByCode: jest.fn().mockResolvedValue({
              CXC_ALQ: 'id1',
              CXP_LOC: 'id2',
              ING_HNR: 'id3',
              PAS_DEP: 'id4',
              ACT_FID: 'id5',
            }),
          },
        },
        {
          provide: PropertiesService,
          useValue: {},
        },
        {
          provide: ContractSettingsService,
          useValue: {},
        },
      ],
    }).compile();

    // Get lightweight mocks from the test module
    const contractModelMock = module.get(getModelToken(Contract.name));
    accountingEntryModel = module.get(getModelToken(AccountingEntry.name));
    const paginationServiceMock = module.get(PaginationService);
    const financialAccountsServiceMock = module.get(FinancialAccountsService);
    const chartOfAccountsServiceMock = module.get(ChartOfAccountsService);
    const propertiesServiceMock = module.get(PropertiesService);
    const contractSettingsServiceMock = module.get(ContractSettingsService);

    // Create small mocks for other dependencies used by AccountingEntriesService
    const detectedExpensesServiceMock = {} as any;
    const serviceAccountMappingsServiceMock = {} as any;
    const contractsServiceMock = {} as any;

    // Prepare a minimal AgentsService mock for ContractsService
    const agentsServiceMock = {
      findOneByRole: jest.fn(),
      findOne: jest
        .fn()
        .mockImplementation((id: any) => ({ _id: id, nombres: 'Agent Name' })),
    } as any;

    // ModuleRef mock to provide AccountingEntriesService and AgentsService when requested
    const moduleRefMock = {
      get: jest.fn().mockImplementation((token: any) => {
        if (token === ContractsService) return contractsServiceMock;
        if (token === AgentsService) return agentsServiceMock;
        if (token === AccountingEntriesService) return accountingEntriesService;
        return null;
      }),
    } as any;

    // Instantiate AccountingEntriesService directly with mocks to avoid heavy DI
    accountingEntriesService = new AccountingEntriesService(
      accountingEntryModel,
      paginationServiceMock,
      financialAccountsServiceMock,
      detectedExpensesServiceMock,
      propertiesServiceMock,
      moduleRefMock,
      serviceAccountMappingsServiceMock,
      chartOfAccountsServiceMock,
    );

    // Instantiate ContractsService directly with mocks (moduleRef will return accountingEntriesService/agentsService)
    contractsService = new ContractsService(
      contractModelMock,
      chartOfAccountsServiceMock,
      propertiesServiceMock,
      paginationServiceMock,
      contractSettingsServiceMock,
      moduleRefMock,
    );

    // Ensure accountIdsCache is populated as generateInitialAccountingEntries
    // expects it to be set (loadAccountIds is called in create/update flows).
    // Use the same mapping as the ChartOfAccountsService mock above.
    // @ts-expect-error assign test cache
    contractsService.accountIdsCache = {
      CXC_ALQ: new Types.ObjectId(),
      CXP_LOC: new Types.ObjectId(),
      ING_HNR: new Types.ObjectId(),
      PAS_DEP: new Types.ObjectId(),
      ACT_FID: new Types.ObjectId(),
    };

    // Patch save on prototype for test 1 and test 2
    accountingEntryModel.prototype.save = jest.fn().mockResolvedValue({
      partidas: [
        {
          cuenta_id: new Types.ObjectId(),
          descripcion: 'Test',
          debe: 100,
          haber: 0,
          agente_id: new Types.ObjectId(),
          es_iva_incluido: false,
          tasa_iva_aplicada: 0,
          monto_base_imponible: 0,
          monto_iva_calculado: 0,
        },
      ],
    });
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
    // The prototype mock from beforeEach will handle the save
    const asiento = await accountingEntriesService.create({
      contrato_id: new Types.ObjectId(),
      tipo_asiento: 'Alquiler',
      partidas: [partida],
    });
    expect(asiento.partidas.length).toBe(1);
    expect(Types.ObjectId.isValid(asiento.partidas[0].cuenta_id)).toBe(true);
    expect(Types.ObjectId.isValid(asiento.partidas[0].agente_id)).toBe(true);
  });

  it('debe generar asientos con partidas válidas al crear contrato', async () => {
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
    const createMock = jest
      .fn()
      .mockResolvedValue({ partidas: [{ debe: 1000 }] });
    accountingEntriesService.create = createMock;
    // Patch contractSettingsService on contractsService instance
    Object.defineProperty(contractsService, 'contractSettingsService', {
      value: {
        getSettings: jest
          .fn()
          .mockResolvedValue({ comision_administracion_default: 10 }),
      },
    });
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
