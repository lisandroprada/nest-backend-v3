// Mock absolute path imports that Jest may not resolve in isolated spec runs
// Create a virtual mock for absolute path imports that Jest may not resolve in isolated spec runs
jest.mock(
  'src/common/pagination/dto/pagination.dto',
  () => ({ PaginationDto: class {} }),
  { virtual: true },
);

import { Test, TestingModule } from '@nestjs/testing';
import { AccountingEntriesController } from './accounting-entries.controller';
import { AccountingEntriesService } from './accounting-entries.service';
import { ProcessDetectedExpenseDto } from './dto/process-proposal.dto';

describe('AccountingEntriesController', () => {
  let controller: AccountingEntriesController;

  const mockResult = {
    accountingEntry: { _id: 'as1', partidas: [] },
    detectedExpense: { _id: 'det1', estado_procesamiento: 'ASIGNADO' },
  };

  const mockService = {
    processDetectedExpenseToEntry: jest.fn().mockResolvedValue(mockResult),
  } as Partial<AccountingEntriesService> as AccountingEntriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountingEntriesController],
      providers: [
        {
          provide: AccountingEntriesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AccountingEntriesController>(
      AccountingEntriesController,
    );
  });

  it('should return { accountingEntry, detectedExpense } when processing detected expense', async () => {
    const dto: ProcessDetectedExpenseDto = {
      detectedExpenseId: 'det1',
    } as any;

    const res = await controller.processDetectedExpense(dto);

    expect(mockService.processDetectedExpenseToEntry).toHaveBeenCalledWith(dto);
    expect(res).toEqual(mockResult);
    expect(res.accountingEntry._id).toBe('as1');
    expect(res.detectedExpense._id).toBe('det1');
  });
});
