import { AccountingEntriesService } from './accounting-entries.service';
import { ContractsService } from '../contracts/contracts.service';

// Minimal mock implementations
const mockAccountingModel = {} as any;
const mockPaginationService = {} as any;
const mockFinancialAccountsService = {} as any;

describe('AccountingEntriesService - processDetectedUtilityInvoices', () => {
  let service: AccountingEntriesService;

  const mockDetectedExpensesService = {
    findAll: jest.fn(),
    update: jest.fn(),
  } as any;

  const mockPropertiesService = {
    findByMedidor: jest.fn(),
  } as any;

  const mockServiceAccountMappingsService = {} as any;
  const mockChartOfAccountsService = {} as any;
  const mockContractsService = {} as any;

  beforeEach(() => {
    // Create instance manually because constructor expects injected models
    service = new AccountingEntriesService(
      mockAccountingModel,
      mockPaginationService,
      mockFinancialAccountsService,
      mockDetectedExpensesService,
      mockPropertiesService,
      mockContractsService,
      mockServiceAccountMappingsService,
      mockChartOfAccountsService,
    );
  });

  it('should propose an accounting entry for a pending detected expense (dryRun)', async () => {
    const detected = [
      {
        _id: 'd1',
        estado_procesamiento: 'PENDIENTE_VALIDACION',
        identificador_servicio: '12345',
        monto_estimado: 1000,
        fecha_deteccion: new Date('2025-11-01'),
        tipo_alerta: 'FACTURA_DISPONIBLE',
      },
    ];

    const property = [
      {
        identificador_interno: 'P-1',
        propietarios_ids: ['agent1'],
        servicios_impuestos: [
          { identificador_servicio: '12345', porcentaje_aplicacion: 100 },
        ],
      },
    ];

    mockDetectedExpensesService.findAll.mockResolvedValue(detected);
    mockPropertiesService.findByMedidor.mockResolvedValue(property);

    const result = await service.processDetectedUtilityInvoices({
      dryRun: true,
    });

    expect(result.processed).toBe(1);
    const d = result.details[0];
    expect(d.status).toBe('PROPOSED');
    expect(d.propuesta.partidas_propuesta).toBeDefined();
    expect(d.propuesta.partidas_propuesta[0].monto).toBeCloseTo(1000);
  });
});

describe('AccountingEntriesService - processDetectedExpenseToEntry fallback', () => {
  let service: AccountingEntriesService;

  const mockAccountingModel = {} as any;
  const mockPaginationService = {} as any;
  const mockFinancialAccountsService = {} as any;

  const mockDetectedExpensesService: any = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  };

  const mockPropertiesService: any = {
    findByMedidor: jest.fn(),
  };

  const mockServiceAccountMappingsService: any = {
    findOne: jest.fn(),
    findByProviderAgentId: jest.fn(),
  };

  const mockChartOfAccountsService: any = {
    getAccountIdsByCode: jest.fn(),
  };

  const mockContractsService: any = {
    findOne: jest.fn(),
  };

  const moduleRefMock = {
    get: jest.fn().mockImplementation((token: any) => {
      if (token === ContractsService) return mockContractsService;
      return null;
    }),
  } as any;

  beforeEach(() => {
    service = new AccountingEntriesService(
      mockAccountingModel,
      mockPaginationService,
      mockFinancialAccountsService,
      mockDetectedExpensesService,
      mockPropertiesService,
      moduleRefMock,
      mockServiceAccountMappingsService,
      mockChartOfAccountsService,
    );
    // override internal dependencies in case constructor wiring differs
    // @ts-expect-error - assigning mocks to private props for test
    service.detectedExpensesService = mockDetectedExpensesService;
    // @ts-expect-error - assigning mocks to private props for test
    service.propertiesService = mockPropertiesService;
    // @ts-expect-error - assigning mocks to private props for test
    service.serviceAccountMappingsService = mockServiceAccountMappingsService;
    // @ts-expect-error - assigning mocks to private props for test
    service.chartOfAccountsService = mockChartOfAccountsService;
    // @ts-expect-error - assigning mocks to private props for test
    service.contractsService = mockContractsService;
  });

  it('uses locador when agente (locatario) has no active contract', async () => {
    const det: any = {
      _id: 'det1',
      identificador_servicio: 'svc-1',
      agente_proveedor_id: 'prov1',
      propuesta_asiento: {
        partidas_propuesta: [
          { descripcion: 'p1', monto: 100, agente_id: 'locatario1' },
        ],
        fecha_imputacion: new Date(),
        fecha_vencimiento: new Date(),
        descripcion: 'prueba',
        monto_original: 100,
      },
    };

    // No active contracts; properties has a locador
    mockDetectedExpensesService.findOne.mockResolvedValue(det);
    mockPropertiesService.findByMedidor.mockResolvedValue([
      { identificador_interno: 'P1', propietarios_ids: ['locador1'] },
    ]);

    mockServiceAccountMappingsService.findByProviderAgentId.mockResolvedValue({
      cuenta_egreso_codigo: 'EG',
      cuenta_a_pagar_codigo: 'AP',
      provider_agent_id: 'provAgent1',
    });

    mockChartOfAccountsService.getAccountIdsByCode.mockResolvedValue({
      EG: 'acctE',
      AP: 'acctP',
    });

    const created = { _id: 'as1', partidas: [] };
    jest.spyOn(service, 'create').mockResolvedValue(created as any);

    await service.processDetectedExpenseToEntry({ detectedExpenseId: 'det1' });

    const createdArg = (service.create as any).mock.calls[0][0];
    expect(createdArg.partidas[0].agente_id).toEqual('locador1');
  });

  it('keeps locatario when there is an active contract', async () => {
    const det: any = {
      _id: 'det2',
      identificador_servicio: 'svc-1',
      agente_proveedor_id: 'prov1',
      propuesta_asiento: {
        partidas_propuesta: [
          { descripcion: 'p1', monto: 200, agente_id: 'locatario2' },
        ],
        fecha_imputacion: new Date(),
        fecha_vencimiento: new Date(),
        descripcion: 'prueba2',
        monto_original: 200,
      },
    };

    const prop = {
      identificador_interno: 'P2',
      propietarios_ids: ['locador2'],
      contrato_vigente_id: 'c1',
    };

    mockDetectedExpensesService.findOne.mockResolvedValue(det);
    mockPropertiesService.findByMedidor.mockResolvedValue([prop]);

    mockContractsService.findOne.mockResolvedValue({
      _id: 'c1',
      partes: [{ agente_id: 'locatario2', rol: 'LOCATARIO' }],
    });

    mockServiceAccountMappingsService.findByProviderAgentId.mockResolvedValue({
      cuenta_egreso_codigo: 'EG',
      cuenta_a_pagar_codigo: 'AP',
      provider_agent_id: 'provAgent1',
    });

    mockChartOfAccountsService.getAccountIdsByCode.mockResolvedValue({
      EG: 'acctE',
      AP: 'acctP',
    });

    const created = { _id: 'as2', partidas: [] };
    jest.spyOn(service, 'create').mockResolvedValue(created as any);

    await service.processDetectedExpenseToEntry({ detectedExpenseId: 'det2' });

    const createdArg = (service.create as any).mock.calls[0][0];
    expect(createdArg.partidas[0].agente_id).toEqual('locatario2');
  });

  it('uses mappingId override when provided', async () => {
    const det: any = {
      _id: 'det3',
      identificador_servicio: 'svc-2',
      agente_proveedor_id: 'provX',
      propuesta_asiento: {
        partidas_propuesta: [{ descripcion: 'p1', monto: 50, agente_id: 'a1' }],
        fecha_imputacion: new Date(),
        fecha_vencimiento: new Date(),
        descripcion: 'prueba3',
        monto_original: 50,
      },
    };

    mockDetectedExpensesService.findOne.mockResolvedValue(det);

    // Simulate override: findOne(mappingId) returns the mapping to use
    mockServiceAccountMappingsService.findOne.mockResolvedValue({
      cuenta_egreso_codigo: 'EG_OVR',
      cuenta_a_pagar_codigo: 'AP_OVR',
      provider_agent_id: 'provX',
    });

    mockChartOfAccountsService.getAccountIdsByCode.mockResolvedValue({
      EG_OVR: 'acctE_ovr',
      AP_OVR: 'acctP_ovr',
    });

    const created = { _id: 'as3', partidas: [] };
    jest.spyOn(service, 'create').mockResolvedValue(created as any);

    await service.processDetectedExpenseToEntry({
      detectedExpenseId: 'det3',
      mappingId: 'map-override',
    });

    const createdArg = (service.create as any).mock.calls[0][0];
    // The HABER partida (index 1) should use the account resolved from AP_OVR
    expect(createdArg.partidas[1].cuenta_id).toEqual('acctP_ovr');
  });

  it('throws when no mapping is found for provider', async () => {
    const det: any = {
      _id: 'det4',
      identificador_servicio: 'svc-3',
      agente_proveedor_id: 'provY',
      propuesta_asiento: {
        partidas_propuesta: [{ descripcion: 'p1', monto: 10, agente_id: 'a9' }],
        fecha_imputacion: new Date(),
        fecha_vencimiento: new Date(),
        descripcion: 'prueba4',
        monto_original: 10,
      },
    };

    mockDetectedExpensesService.findOne.mockResolvedValue(det);
    // No mapping available
    mockServiceAccountMappingsService.findByProviderAgentId.mockResolvedValue(
      null,
    );

    await expect(
      service.processDetectedExpenseToEntry({ detectedExpenseId: 'det4' }),
    ).rejects.toThrow('No se encontró mapping proveedor->cuentas');
  });
});
