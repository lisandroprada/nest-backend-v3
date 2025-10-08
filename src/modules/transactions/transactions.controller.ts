import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { User } from '../user/entities/user.entity';
import { LiquidateDto } from './dto/liquidate.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @GetUser() user: User,
  ) {
    return this.transactionsService.createTransactionAndImpute(
      createTransactionDto,
      user._id.toString(),
    );
  }

  @Get('liquidate/:agentId')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
  async getPendingLiquidation(@Param('agentId') agentId: string) {
    return this.transactionsService.getAgentPendingLiquidation(agentId);
  }

  @Post('liquidate')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
  async liquidate(@Body() liquidateDto: LiquidateDto, @GetUser() user: User) {
    return this.transactionsService.liquidate(
      liquidateDto,
      user._id.toString(),
    );
  }

  @Get(':id/receipt')
  @Auth() // Any authenticated user can access for now
  async getReceipt(@Param('id') transactionId: string) {
    return this.transactionsService.getReceipt(transactionId);
  }
}
