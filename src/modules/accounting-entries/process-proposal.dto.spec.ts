import { validate } from 'class-validator';
import { ProcessDetectedExpenseDto } from './dto/process-proposal.dto';

describe('ProcessDetectedExpenseDto validation', () => {
  it('accepts a valid detectedExpenseId and optional mappingId', async () => {
    const dto = new ProcessDetectedExpenseDto();
    dto.detectedExpenseId = '507f1f77bcf86cd799439011';
    dto.mappingId = '507f1f77bcf86cd799439022';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects when detectedExpenseId is missing', async () => {
    const dto = new ProcessDetectedExpenseDto();
    // dto.detectedExpenseId is undefined
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid detectedExpenseId format', async () => {
    const dto = new ProcessDetectedExpenseDto();
    dto.detectedExpenseId = 'invalid-id';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
