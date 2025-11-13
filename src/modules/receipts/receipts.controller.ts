import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { SendWhatsAppDto } from './dto/send-whatsapp.dto';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../user/entities/user.entity';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';
import { ReceiptFiltersDto } from './dto/receipt-filters.dto';

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

  /**
   * POST /receipts/generate-pdf
   * Genera un PDF del recibo y lo guarda
   */
  @Post('generate-pdf')
  async generatePDF(@Body('receiptId') receiptId: string) {
    return this.receiptsService.generatePDF(receiptId);
  }

  /**
   * POST /receipts/send-email
   * Envía el recibo por email
   */
  @Post('send-email')
  async sendEmail(@Body() dto: SendEmailDto) {
    return this.receiptsService.sendEmail(dto.receiptId, dto.email);
  }

  /**
   * POST /receipts/send-whatsapp
   * Envía el recibo por WhatsApp
   */
  @Post('send-whatsapp')
  async sendWhatsApp(@Body() dto: SendWhatsAppDto) {
    return this.receiptsService.sendWhatsApp(dto.receiptId, dto.phoneNumber);
  }

  /**
   * GET /receipts/:id/pdf-url
   * Obtiene la URL pública del PDF del recibo
   */
  @Get(':id/pdf-url')
  async getPdfUrl(@Param('id', ParseMongoIdPipe) id: string) {
    return this.receiptsService.getPdfUrl(id);
  }

  /**
   * GET /receipts/by-agent/:agentId
   * Lista paginada de recibos (cobros/liquidaciones) asociados a un agente
   * Query params soportados:
   *   - tipo_flujo_neto=INGRESO|EGRESO
   *   - fecha_from=YYYY-MM-DD
   *   - fecha_to=YYYY-MM-DD
   *   - page=number (0-based, default 0)
   *   - pageSize=number (default 10)
   *   - order=asc|desc (fecha_emision)
   */
  @Get('by-agent/:agentId')
  async findByAgent(
    @Param('agentId', ParseMongoIdPipe) agentId: string,
    @Query() filters: ReceiptFiltersDto,
  ) {
    // Normalize legacy "limit" param to pageSize if provided
    const normalized: any = { ...filters };
    if ((normalized as any).limit && !normalized.pageSize) {
      normalized.pageSize = Number((normalized as any).limit);
      delete (normalized as any).limit;
    }
    return this.receiptsService.findByAgent(agentId, normalized);
  }
}
