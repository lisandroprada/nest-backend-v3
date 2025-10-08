import { Controller } from '@nestjs/common';
import { SequenceService } from './sequence.service';

@Controller('sequence')
export class SequenceController {
  constructor(private readonly sequenceService: SequenceService) {}
}
