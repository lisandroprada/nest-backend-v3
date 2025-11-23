import { Test, TestingModule } from '@nestjs/testing';
import { ServiceSyncController } from './service-sync.controller';
import { NotFoundException } from '@nestjs/common';
import { ServiceSyncService } from './service-sync.service';
import { CamuzziScanService } from './services/camuzzi-scan.service';
import { ClassificationService } from './services/classification.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { getModelToken } from '@nestjs/mongoose';
import { Agent } from '../agents/entities/agent.entity';
import { CommunicationStatus } from './entities/service-communication.entity';

describe('ServiceSyncController', () => {
  let controller: ServiceSyncController;
  let serviceSyncService: ServiceSyncService;
  let camuzziScanService: CamuzziScanService;
  let classificationService: ClassificationService;

  const mockServiceSyncService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
    getStats: jest.fn(),
  };

  const mockCamuzziScanService = {
    scanEmails: jest.fn(),
    testConnection: jest.fn(),
  };

  const mockClassificationService = {
    generateCandidates: jest.fn(),
  };

  const mockSystemConfigService = {
    getSingletonConfig: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAgentModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceSyncController],
      providers: [
        {
          provide: ServiceSyncService,
          useValue: mockServiceSyncService,
        },
        {
          provide: CamuzziScanService,
          useValue: mockCamuzziScanService,
        },
        {
          provide: ClassificationService,
          useValue: mockClassificationService,
        },
        {
          provide: SystemConfigService,
          useValue: mockSystemConfigService,
        },
        {
          provide: getModelToken(Agent.name),
          useValue: mockAgentModel,
        },
      ],
    }).compile();

    controller = module.get<ServiceSyncController>(ServiceSyncController);
    serviceSyncService = module.get<ServiceSyncService>(ServiceSyncService);
    camuzziScanService = module.get<CamuzziScanService>(CamuzziScanService);
    classificationService = module.get<ClassificationService>(
      ClassificationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should return paginated communications', async () => {
      const query = { page: 0, pageSize: 10 };
      const mockResult = {
        data: [],
        total: 0,
        page: 0,
        pageSize: 10,
        totalPages: 0,
      };

      mockServiceSyncService.findAll.mockResolvedValue(mockResult);

      const result = await controller.list(query);

      expect(result).toEqual(mockResult);
      expect(serviceSyncService.findAll).toHaveBeenCalledWith(query);
    });

    it('should handle solo_sin_procesar filter', async () => {
      const query = { solo_sin_procesar: true };

      mockServiceSyncService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 0,
        pageSize: 10,
        totalPages: 0,
      });

      await controller.list(query);

      expect(serviceSyncService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('health', () => {
    it('should return health status with IMAP connection success', async () => {
      const mockConfig = { _id: 'config-id' };
      const mockStats = {
        total: 10,
        pendientes: 5,
        procesadas: 3,
        ignoradas: 2,
        por_tipo: [],
        tasa_procesamiento: '30.00',
      };

      mockSystemConfigService.findOne.mockResolvedValue(mockConfig);
      mockCamuzziScanService.testConnection.mockResolvedValue({
        status: 'success',
      });
      mockServiceSyncService.getStats.mockResolvedValue(mockStats);

      const result = await controller.health();

      expect(result.configPresent).toBe(true);
      expect(result.imapConnection).toBe('success');
      expect(result.isScanning).toBe(false);
      expect(result.stats).toEqual(mockStats);
    });

    it('should handle IMAP connection failure', async () => {
      const mockConfig = { _id: 'config-id' };
      const mockStats = {
        total: 10,
        pendientes: 5,
        procesadas: 3,
        ignoradas: 2,
        por_tipo: [],
        tasa_procesamiento: '30.00',
      };

      mockSystemConfigService.findOne.mockResolvedValue(mockConfig);
      mockCamuzziScanService.testConnection.mockRejectedValue(
        new Error('Connection failed'),
      );
      mockServiceSyncService.getStats.mockResolvedValue(mockStats);

      const result = await controller.health();

      expect(result.imapConnection).toBe('failed');
    });
  });

  describe('testConnection', () => {
    it('should test IMAP connection successfully', async () => {
      mockCamuzziScanService.testConnection.mockResolvedValue({
        status: 'success',
      });

      const result = await controller.testConnection();

      expect(result).toEqual({ status: 'success' });
      expect(camuzziScanService.testConnection).toHaveBeenCalled();
    });

    it('should handle connection test failure', async () => {
      mockCamuzziScanService.testConnection.mockRejectedValue(
        new Error('Timeout'),
      );

      await expect(controller.testConnection()).rejects.toThrow('Timeout');
    });
  });

  describe('listProviders', () => {
    it('should return list of configured providers', async () => {
      const mockProviders = [
        {
          _id: 'provider-1',
          nombre_razon_social: 'Camuzzi Gas del Sur',
          identificador_fiscal: '30657864427',
          dominios_notificacion: ['avisos.camuzzigas.com.ar'],
        },
      ];

      mockAgentModel.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue(mockProviders),
      });

      const result = await controller.listProviders();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'provider-1',
        razon_social: 'Camuzzi Gas del Sur',
        cuit: '30657864427',
        dominios_notificacion: ['avisos.camuzzigas.com.ar'],
      });
    });
  });

  describe('rescan', () => {
    it('should trigger manual rescan', async () => {
      const mockResult = {
        message: 'Escaneo completado',
        procesados: 10,
        nuevos: 5,
        duplicados: 3,
        errores: 2,
      };

      mockCamuzziScanService.scanEmails.mockResolvedValue(mockResult);

      const result = await controller.rescan();

      expect(result).toEqual(mockResult);
      expect(camuzziScanService.scanEmails).toHaveBeenCalledWith({
        providerCuit: undefined,
        autoCandidates: false,
        tryExtractServiceId: true,
      });
    });

    it('should rescan with provider filter', async () => {
      const providerCuit = '30657864427';
      const mockResult = {
        message: 'Escaneo completado',
        procesados: 5,
        nuevos: 2,
        duplicados: 2,
        errores: 1,
      };

      mockCamuzziScanService.scanEmails.mockResolvedValue(mockResult);

      const result = await controller.rescan(providerCuit);

      expect(result).toEqual(mockResult);
      expect(camuzziScanService.scanEmails).toHaveBeenCalledWith({
        providerCuit,
        autoCandidates: false,
        tryExtractServiceId: true,
      });
    });
  });

  describe('generateCandidates', () => {
    it('should generate candidates for unprocessed communications', async () => {
      const dto = { maxPerRun: 20 };
      const mockResult = {
        processed: 5,
        results: {
          'comm-1': {
            createdExpense: true,
            expenseId: 'expense-1',
            propiedadesIds: ['prop-1'],
          },
        },
      };

      mockClassificationService.generateCandidates.mockResolvedValue(
        mockResult,
      );

      const result = await controller.generateCandidates(dto);

      expect(result).toEqual(mockResult);
      expect(classificationService.generateCandidates).toHaveBeenCalledWith(
        dto,
      );
    });

    it('should handle single communication classification', async () => {
      const dto = { communicationId: 'comm-123' };
      const mockResult = {
        processed: 1,
        results: {
          'comm-123': {
            createdExpense: true,
            expenseId: 'expense-1',
            propiedadesIds: ['prop-1'],
          },
        },
      };

      mockClassificationService.generateCandidates.mockResolvedValue(
        mockResult,
      );

      const result = await controller.generateCandidates(dto);

      expect(result).toEqual(mockResult);
    });
  });

  describe('updateStatus', () => {
    it('should update communication status to IGNORED', async () => {
      const dto = {
        communicationId: 'comm-123',
        status: CommunicationStatus.IGNORED,
        notes: 'Email promocional',
      };

      const mockUpdated = {
        _id: 'comm-123',
        estado_procesamiento: CommunicationStatus.IGNORED,
        notas: 'Email promocional',
      };

      mockServiceSyncService.updateStatus.mockResolvedValue(mockUpdated);

      const result = await controller.updateStatus(dto);

      expect(result).toEqual(mockUpdated);
      expect(serviceSyncService.updateStatus).toHaveBeenCalledWith(
        'comm-123',
        CommunicationStatus.IGNORED,
        'Email promocional',
      );
    });
  });

  describe('getOne', () => {
    it('should return communication by ID', async () => {
      const mockCommunication = {
        _id: 'comm-123',
        email_id: '12345',
        asunto: 'Test',
        estado_procesamiento: 'UNPROCESSED',
      };

      mockServiceSyncService.findOne.mockResolvedValue(mockCommunication);

      const result = await controller.getOne('comm-123');

      expect(result).toEqual(mockCommunication);
      expect(serviceSyncService.findOne).toHaveBeenCalledWith('comm-123');
    });

    it('should throw NotFoundException for non-existent ID', async () => {
      mockServiceSyncService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.getOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should return overview statistics', async () => {
      const mockStats = {
        total: 50,
        pendientes: 20,
        procesadas: 25,
        ignoradas: 5,
        por_tipo: [
          { _id: 'FACTURA_DISPONIBLE', count: 15 },
          { _id: 'AVISO_CORTE', count: 5 },
        ],
        tasa_procesamiento: '50.00',
      };

      mockServiceSyncService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual(mockStats);
      expect(serviceSyncService.getStats).toHaveBeenCalled();
    });
  });
});
