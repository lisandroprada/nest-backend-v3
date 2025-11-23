import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { CashBoxService } from './cash-box.service';
import { CreateCashBoxMovementDto } from './dto/create-cash-box-movement.dto';
import { CashBoxMovementType } from './entities/cash-box-movement.entity';
import { Request } from 'express';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id/parse-mongo-id.pipe';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('cash-box')
export class CashBoxController {
  constructor(private readonly cashBoxService: CashBoxService) {}

  @Post('open')
  createOpening(
    @Body() createCashBoxMovementDto: CreateCashBoxMovementDto,
    @Req() req: any,
  ) {
    const user_id = (req.user as any).id; // Cast req.user to any
    if (!user_id) {
      throw new BadRequestException('User ID not found in token.');
    }
    if (createCashBoxMovementDto.type !== CashBoxMovementType.OPENING) {
      throw new BadRequestException(
        'Movement type must be OPENING for this endpoint.',
      );
    }
    return this.cashBoxService.createOpening(createCashBoxMovementDto, user_id);
  }

  @Post('partial-close')
  createPartialClosure(
    @Body() createCashBoxMovementDto: CreateCashBoxMovementDto,
    @Req() req: any,
  ) {
    const user_id = (req.user as any).id;
    if (!user_id) {
      throw new BadRequestException('User ID not found in token.');
    }
    if (createCashBoxMovementDto.type !== CashBoxMovementType.PARTIAL_CLOSURE) {
      throw new BadRequestException(
        'Movement type must be PARTIAL_CLOSURE for this endpoint.',
      );
    }
    return this.cashBoxService.createPartialClosure(
      createCashBoxMovementDto,
      user_id,
    );
  }

  @Post('final-close')
  createFinalClosure(
    @Body() createCashBoxMovementDto: CreateCashBoxMovementDto,
    @Req() req: any,
  ) {
    const user_id = (req.user as any).id;
    if (!user_id) {
      throw new BadRequestException('User ID not found in token.');
    }
    if (createCashBoxMovementDto.type !== CashBoxMovementType.FINAL_CLOSURE) {
      throw new BadRequestException(
        'Movement type must be FINAL_CLOSURE for this endpoint.',
      );
    }
    return this.cashBoxService.createFinalClosure(
      createCashBoxMovementDto,
      user_id,
    );
  }

  @Get(':id/expected-balance')
  getExpectedBalance(
    @Param('id', ParseMongoIdPipe) financialAccountId: string,
    // @Req() req: Request,
  ) {
    // user_id is not directly used here, but AuthGuard ensures authentication
    return this.cashBoxService.getExpectedBalance(financialAccountId);
  }
}
