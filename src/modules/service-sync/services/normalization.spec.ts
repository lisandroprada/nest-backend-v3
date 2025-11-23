import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ModuleRef } from '@nestjs/core';
import { CamuzziScanService } from './camuzzi-scan.service';
import { ClassificationService } from './classification.service';
import { Agent } from '../../agents/entities/agent.entity';
import { ServiceCommunication } from '../entities/service-communication.entity';
import { Property } from '../../properties/entities/property.entity';
import { SystemConfigService } from '../../system-config/system-config.service';
import { ServiceSyncService } from '../service-sync.service';
import { DetectedExpensesService } from '../../detected-expenses/detected-expenses.service';

// Mock dependencies
const mockSystemConfigService = {};
const mockServiceSyncService = { create: jest.fn() };
const mockAgentModel = { find: jest.fn(), findOne: jest.fn() };
const mockCommModel = { find: jest.fn(), updateOne: jest.fn() };
const mockPropertyModel = { find: jest.fn() };
const mockDetectedExpensesService = { create: jest.fn() };
const mockModuleRef = { get: jest.fn() };

describe('Service Identifier Normalization', () => {
  let camuzziService: CamuzziScanService;
  let classificationService: ClassificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CamuzziScanService,
        ClassificationService,
        { provide: SystemConfigService, useValue: mockSystemConfigService },
        { provide: ServiceSyncService, useValue: mockServiceSyncService },
        { provide: getModelToken(Agent.name), useValue: mockAgentModel },
        { provide: getModelToken(ServiceCommunication.name), useValue: mockCommModel },
        { provide: getModelToken(Property.name), useValue: mockPropertyModel },
        { provide: DetectedExpensesService, useValue: mockDetectedExpensesService },
        { provide: ModuleRef, useValue: mockModuleRef },
      ],
    }).compile();

    camuzziService = module.get<CamuzziScanService>(CamuzziScanService);
    classificationService = module.get<ClassificationService>(ClassificationService);
  });

  describe('CamuzziScanService.parseCamuzziEmail', () => {
    it('should strip dashes and slashes from account number', () => {
      const result = camuzziService.parseCamuzziEmail({
        subject: 'Factura Camuzzi',
        from: 'no-reply@camuzzi.com.ar',
        text: 'Estimado cliente, su Cuenta N° 9103/12345-6 vence el...',
      });
      expect(result.cuenta).toBe('9103123456');
    });

    it('should strip dots if present in account number', () => {
      const result = camuzziService.parseCamuzziEmail({
        subject: 'Factura',
        from: 'test',
        text: 'Cuenta: 12.345.678',
      });
      expect(result.cuenta).toBe('12345678');
    });

    it('should handle mixed separators', () => {
      const result = camuzziService.parseCamuzziEmail({
        subject: 'Factura',
        from: 'test',
        text: 'Cuenta: 12-345/67.8',
      });
      expect(result.cuenta).toBe('12345678');
    });
  });

  describe('ClassificationService.extractServiceIdFromText', () => {
    it('should strip dashes and slashes from extracted ID', () => {
      const text = 'Asunto: Factura. Cuerpo: Nro Cuenta: 123-456/7';
      const result = (classificationService as any).extractServiceIdFromText(text);
      expect(result).toBe('1234567');
    });

    it('should strip multiple slashes', () => {
      const text = 'Cuenta 9103/00123/456';
      const result = (classificationService as any).extractServiceIdFromText(text);
      expect(result).toBe('910300123456');
    });
    
    it('should return undefined if no valid ID found', () => {
        const text = 'Hola mundo sin numeros de cuenta';
        const result = (classificationService as any).extractServiceIdFromText(text);
        expect(result).toBeUndefined();
    });
  });
});
