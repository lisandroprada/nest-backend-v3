import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Logger,
  Query,
} from '@nestjs/common';
import { BotService } from './bot.service';
import { ServiceAuth } from './decorators/service-auth.decorator';
import { ValidateIdentityDto, VerifyOtpDto } from '../otp/dto';
import { CreateTicketDto } from '../tickets/dto';
import { SearchPropertiesDto } from './dto/search-properties.dto';

/**
 * BotController - Endpoints para el WhatsApp Bot
 * 
 * Todos los endpoints están protegidos con @ServiceAuth() que valida API Key
 * y aplica rate limiting para prevenir abuso
 */
@Controller('bot')
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(private readonly botService: BotService) {}

  /**
   * Health check endpoint
   * GET /api/v1/bot/health
   */
  @Get('health')
  @ServiceAuth()
  async healthCheck() {
    return this.botService.healthCheck();
  }

  /**
   * Buscar cliente por JID de WhatsApp
   * GET /api/v1/bot/client/by-jid/:jid
   */
  @Get('client/by-jid/:jid')
  @ServiceAuth()
  async getClientByJid(@Param('jid') jid: string) {
    this.logger.log(`[Bot API] Getting client by JID: ${jid}`);
    return this.botService.findClientByJid(jid);
  }

  /**
   * Obtener saldo y estado de cuenta del cliente
   * GET /api/v1/bot/client/:clientId/balance
   */
  @Get('client/:clientId/balance')
  @ServiceAuth()
  async getAccountStatus(@Param('clientId') clientId: string) {
    this.logger.log(`[Bot API] Getting account status for client: ${clientId}`);
    return this.botService.getClientBalance(clientId);
  }

  /**
   * Validar identidad del usuario y generar OTP
   * POST /api/v1/bot/auth/validate-identity
   */
  @Post('auth/validate-identity')
  @ServiceAuth()
  async validateIdentity(@Body() dto: ValidateIdentityDto) {
    this.logger.log(`[Bot API] Validating identity for DNI: ${dto.dni}`);
    return this.botService.validateIdentity(dto);
  }

  /**
   * Verificar código OTP
   * POST /api/v1/bot/auth/verify-otp
   */
  @Post('auth/verify-otp')
  @ServiceAuth()
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    this.logger.log(`[Bot API] Verifying OTP for JID: ${dto.whatsappJid}`);
    return this.botService.verifyOtp(dto);
  }

  /**
   * Crear reclamo/ticket
   * POST /api/v1/bot/client/:clientId/complaints
   */
  @Post('client/:clientId/complaints')
  @ServiceAuth()
  async createComplaint(
    @Param('clientId') clientId: string,
    @Body() dto: Omit<CreateTicketDto, 'clientId'>,
  ) {
    this.logger.log(`[Bot API] Creating complaint for client: ${clientId}`);
    return this.botService.createComplaint({ ...dto, clientId } as CreateTicketDto);
  }

  /**
   * Buscar propiedades publicadas
   * GET /api/v1/bot/properties/search
   */
  @Get('properties/search')
  @ServiceAuth()
  async searchProperties(@Query() filters: SearchPropertiesDto) {
    this.logger.log(`[Bot API] Searching properties with filters: ${JSON.stringify(filters)}`);
    return this.botService.searchPublishedProperties(filters);
  }

  /**
   * Obtener ciudades con propiedades disponibles
   * GET /api/v1/bot/properties/cities
   */
  @Get('properties/cities')
  @ServiceAuth()
  async getAvailableCities() {
    this.logger.log('[Bot API] Getting available cities');
    return this.botService.getAvailableCities();
  }
}
