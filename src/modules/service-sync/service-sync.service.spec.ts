import { Test, TestingModule } from '@nestjs/testing';
import { ServiceSyncService } from './service-sync.service';
import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import {
  ServiceCommunication,
  CommunicationType,
  CommunicationStatus,
} from './entities/service-communication.entity';

describe('ServiceSyncService', () => {
  let service: ServiceSyncService;

  const mockServiceCommunication = {
    _id: '507f1f77bcf86cd799439011',
    email_id: '12345',
    remitente: 'test@camuzzigas.com.ar',
    asunto: 'Test factura',
    fecha_email: new Date(),
    tipo_alerta: CommunicationType.FACTURA_DISPONIBLE,
    identificador_servicio: '9103/0-21-08-0023608/4',
    estado_procesamiento: CommunicationStatus.UNPROCESSED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Simulate Mongoose model + constructor behavior
  const mockDoc: any = {
    save: jest.fn().mockResolvedValue(null),
  };

  function mockModel(this: any, payload: any) {
    // constructor emulation
    Object.assign(mockDoc, payload);
    return mockDoc;
  }

  // attach static methods used in service
  mockModel.create = jest.fn();
  mockModel.find = jest.fn();
  mockModel.findById = jest.fn();
  mockModel.findByIdAndUpdate = jest.fn();
  mockModel.findOne = jest.fn();
  mockModel.countDocuments = jest.fn();
  mockModel.aggregate = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceSyncService,
        {
          provide: getModelToken(ServiceCommunication.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<ServiceSyncService>(ServiceSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new communication', async () => {
      const createDto = {
        email_id: '12345',
        remitente: 'test@camuzzigas.com.ar',
        asunto: 'Test',
        tipo_alerta: CommunicationType.FACTURA_DISPONIBLE,
        estado_procesamiento: CommunicationStatus.UNPROCESSED,
      };

      mockModel.findOne.mockResolvedValue(null); // No existe duplicado
      // Emulate constructor + save
      mockDoc.save.mockResolvedValue(mockServiceCommunication);

      const result = await service.create(createDto);

      expect(result).toEqual(mockServiceCommunication);
      expect(mockModel.findOne).toHaveBeenCalledWith({
        email_id: '12345',
      });
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated communications', async () => {
      const query = {
        page: 0,
        pageSize: 10,
      };

      const mockCommunications = [mockServiceCommunication];
      const mockTotal = 1;

      mockModel.countDocuments.mockResolvedValue(mockTotal);
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockCommunications),
            }),
          }),
        }),
      });

      const result = await service.findAll(query);

      expect(result).toEqual({
        data: mockCommunications,
        total: mockTotal,
        page: 0,
        pageSize: 10,
        totalPages: 1,
      });
    });

    it('should filter by estado_procesamiento', async () => {
      const query = {
        page: 0,
        pageSize: 10,
        estado_procesamiento: CommunicationStatus.UNPROCESSED,
      };

      mockModel.countDocuments.mockResolvedValue(5);
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await service.findAll(query);

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          estado_procesamiento: CommunicationStatus.UNPROCESSED,
        }),
      );
    });

    it('should filter by proveedor_cuit', async () => {
      const query = {
        page: 0,
        pageSize: 10,
        proveedor_cuit: '30657864427',
      };

      mockModel.countDocuments.mockResolvedValue(3);
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await service.findAll(query);

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          proveedor_cuit: expect.objectContaining({
            $regex: '30657864427',
            $options: 'i',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      const query = {
        page: 0,
        pageSize: 10,
        fecha_desde: '2025-11-01',
        fecha_hasta: '2025-11-30',
      };

      mockModel.countDocuments.mockResolvedValue(10);
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await service.findAll(query);

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          fecha_email: expect.objectContaining({
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          }),
        }),
      );
    });

    it('should handle solo_sin_procesar shortcut', async () => {
      const query = {
        page: 0,
        pageSize: 10,
        solo_sin_procesar: true,
      };

      mockModel.countDocuments.mockResolvedValue(8);
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await service.findAll(query);

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          estado_procesamiento: CommunicationStatus.UNPROCESSED,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a communication by ID', async () => {
      // service.findOne awaits findById(...) directly, so mock a resolved value
      mockModel.findById.mockResolvedValue(mockServiceCommunication);

      const result = await service.findOne('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockServiceCommunication);
      expect(mockModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });

    it('should throw NotFoundException for non-existent ID', async () => {
      mockModel.findById.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update communication status', async () => {
      const updatedComm = {
        ...mockServiceCommunication,
        estado_procesamiento: CommunicationStatus.IGNORED,
        notas: 'Test note',
      };

      // findOne calls findById and then doc.save(), so return an object with save()
      const savedDoc = {
        ...mockServiceCommunication,
        save: jest.fn().mockResolvedValue(updatedComm),
      };
      mockModel.findById.mockResolvedValue(savedDoc as any);

      const result = await service.updateStatus(
        '507f1f77bcf86cd799439011',
        CommunicationStatus.IGNORED,
        'Test note',
      );

      expect(result).toEqual(updatedComm);
      // ensure findById was used internally to load the doc
      expect(mockModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });
  });

  describe('linkDetectedExpense', () => {
    it('should link detected expense to communication', async () => {
      const linkedComm = {
        ...mockServiceCommunication,
        gasto_detectado_id: 'expense-123',
        estado_procesamiento: CommunicationStatus.PROCESSED,
      };

      // linkDetectedExpense -> uses findById then doc.save(); use a valid ObjectId and a doc with save
      const validGastoId = '507f1f77bcf86cd799439011';
      const linkedSaved = {
        ...mockServiceCommunication,
        gasto_detectado_id: validGastoId,
        estado_procesamiento: CommunicationStatus.PROCESSED,
      };
      const linkedDoc = {
        ...mockServiceCommunication,
        save: jest.fn().mockResolvedValue(linkedSaved),
      };
      mockModel.findById.mockResolvedValue(linkedDoc as any);

      const result = await service.linkDetectedExpense(
        '507f1f77bcf86cd799439011',
        validGastoId,
      );

      expect(result).toEqual(linkedSaved);
      expect(mockModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const mockStats = [
        {
          _id: null,
          total: 50,
          pendientes: 20,
          procesadas: 25,
          ignoradas: 5,
        },
      ];

      const mockTypeStats = [
        { _id: 'FACTURA_DISPONIBLE', count: 15 },
        { _id: 'AVISO_CORTE', count: 5 },
      ];

      // set up successive countDocuments values then aggregate for porTipo
      mockModel.countDocuments
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(20) // pendientes
        .mockResolvedValueOnce(25) // procesadas
        .mockResolvedValueOnce(5); // ignoradas
      mockModel.aggregate.mockResolvedValueOnce(mockTypeStats);

      const result = await service.getStats();

      expect(result).toEqual({
        total: 50,
        pendientes: 20,
        procesadas: 25,
        ignoradas: 5,
        por_tipo: mockTypeStats,
        tasa_procesamiento: 50,
      });
    });

    it('should handle zero total', async () => {
      const mockStats = [
        {
          _id: null,
          total: 0,
          pendientes: 0,
          procesadas: 0,
          ignoradas: 0,
        },
      ];

      mockModel.countDocuments
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockModel.aggregate.mockResolvedValueOnce([]);

      const result = await service.getStats();

      expect(result.tasa_procesamiento).toBe(0);
    });
  });
});
