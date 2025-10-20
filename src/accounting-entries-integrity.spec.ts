import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AccountingEntriesService } from './modules/accounting-entries/accounting-entries.service';
import { ContractsService } from './modules/contracts/contracts.service';
import { Contract } from './modules/contracts/entities/contract.entity';
import { AccountingEntry } from './modules/accounting-entries/entities/accounting-entry.entity';
import { PaginationService } from './common/pagination/pagination.service';
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
    contractsService = module.get<ContractsService>(ContractsService);
    accountingEntriesService = module.get<AccountingEntriesService>(
      AccountingEntriesService,
    );
    accountingEntryModel = module.get(getModelToken(AccountingEntry.name));
    // Patch save on prototype for test 2
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
