import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../user/entities/user.entity';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';

@Controller('receipts')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  /**
   * POST /receipts/process-receipt
   * Endpoint unificado para procesar recibos (COBRO o PAGO)
   * Reemplaza los antiguos /register-payment y /liquidar
   * Crea automáticamente transacciones en caja/bancos
   */
  @Post('process-receipt')
  async processReceipt(
    @Body() createReceiptDto: CreateReceiptDto,
    @GetUser() user: User,
  ) {
    return this.receiptsService.createReceipt(
      createReceiptDto,
      user._id.toString(),
    );
  }

  /**
   * @deprecated Usar /process-receipt en su lugar
   */
  @Post()
  async createReceipt(
    @Body() createReceiptDto: CreateReceiptDto,
    @GetUser() user: User,
  ) {
    return this.receiptsService.createReceipt(
      createReceiptDto,
      user._id.toString(),
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.receiptsService.findOne(id);
  }
}
