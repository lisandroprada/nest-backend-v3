import { Test, TestingModule } from '@nestjs/testing';
import { ClassificationService } from './classification.service';
import { getModelToken } from '@nestjs/mongoose';
import {
  ServiceCommunication,
  CommunicationType,
  CommunicationStatus,
} from '../entities/service-communication.entity';
import { Property } from '../../properties/entities/property.entity';
import { DetectedExpensesService } from '../../detected-expenses/detected-expenses.service';

describe('ClassificationService', () => {
  let service: ClassificationService;

  const mockServiceCommunicationModel = {
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockPropertyModel = {
    find: jest.fn(),
  };

  const mockDetectedExpensesService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        {
          provide: getModelToken(ServiceCommunication.name),
          useValue: mockServiceCommunicationModel,
        },
        {
          provide: getModelToken(Property.name),
          useValue: mockPropertyModel,
        },
        {
          provide: DetectedExpensesService,
          useValue: mockDetectedExpensesService,
        },
      ],
    }).compile();

    service = module.get<ClassificationService>(ClassificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateCandidates', () => {
    it('should process unprocessed communications and create expenses', async () => {
      const mockCommunications = [
        {
          _id: '507f1f77bcf86cd799439011',
          email_id: '123',
          identificador_servicio: '9103/0-21-08-0023608/4',
          tipo_alerta: CommunicationType.FACTURA_DISPONIBLE,
          monto_estimado: 45000,
          fecha_vencimiento: new Date('2025-11-15'),
          asunto: 'Factura Camuzzi 10/2025',
          periodo_label: '10/2025',
          estado_procesamiento: CommunicationStatus.UNPROCESSED,
        },
      ];

      const mockProperties = [
        {
          _id: '507f1f77bcf86cd799439012',
          direccion: 'Calle Test 123',
          servicios_impuestos: [
            {
              identificador_servicio: '9103/0-21-08-0023608/4',
            },
          ],
        },
      ];

      const mockCreatedExpense = {
        _id: '507f1f77bcf86cd799439013',
        tipo_gasto: 'servicio_gas',
        monto: 45000,
      };

      // find(...).sort(...).limit(...) -> limit resolves to array
      mockServiceCommunicationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockCommunications),
        }),
      });

      // propertyModel.find(...).limit(5) -> limit resolves to properties
      mockPropertyModel.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue(mockProperties),
      });

      mockDetectedExpensesService.create.mockResolvedValue(mockCreatedExpense);

      // updateOne is used to mark the communication processed
      mockServiceCommunicationModel.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

      const result = await service.generateCandidates({ maxPerRun: 50 });

      expect(result.processed).toBe(1);
      expect(result.results['507f1f77bcf86cd799439011'].createdExpense).toBe(
        true,
      );
      expect(result.results['507f1f77bcf86cd799439011'].expenseId).toBe(
        '507f1f77bcf86cd799439013',
      );
      expect(mockDetectedExpensesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_alerta: 'FACTURA_DISPONIBLE',
          monto_estimado: 45000,
        }),
      );
    });

    it('should skip communications without identificador_servicio', async () => {
      const mockCommunications = [
        {
          _id: '507f1f77bcf86cd799439011',
          email_id: '123',
          identificador_servicio: null,
          tipo_alerta: CommunicationType.FACTURA_DISPONIBLE,
          estado_procesamiento: CommunicationStatus.UNPROCESSED,
        },
      ];

      mockServiceCommunicationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockCommunications),
        }),
      });

      const result = await service.generateCandidates({ maxPerRun: 50 });

      expect(result.processed).toBe(1);
      expect(result.results['507f1f77bcf86cd799439011'].createdExpense).toBe(
        false,
      );
      expect(result.results['507f1f77bcf86cd799439011'].reason).toBe(
        'NO_SERVICE_ID',
      );
    });

    it('should handle no matching properties', async () => {
      const mockCommunications = [
        {
          _id: '507f1f77bcf86cd799439011',
          email_id: '123',
          identificador_servicio: '9103/0-21-08-0023608/4',
          tipo_alerta: CommunicationType.FACTURA_DISPONIBLE,
          estado_procesamiento: CommunicationStatus.UNPROCESSED,
        },
      ];

      mockServiceCommunicationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockCommunications),
        }),
      });

      mockPropertyModel.find.mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      });

      const result = await service.generateCandidates({ maxPerRun: 50 });

      expect(result.processed).toBe(1);
      // current implementation still creates a detected expense even if no properties
      expect(result.results['507f1f77bcf86cd799439011'].createdExpense).toBe(
        true,
      );
      expect(result.results['507f1f77bcf86cd799439011'].propiedadesIds).toEqual(
        [],
      );
    });
  });
});
