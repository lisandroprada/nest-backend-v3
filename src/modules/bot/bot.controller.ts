import { Controller, Get, Param, Logger } from '@nestjs/common';
import { BotService } from './bot.service';
import { ServiceAuth } from './decorators';

/**
 * BotController - Endpoints exclusivos para el WhatsApp Bot
 * 
 * Todos los endpoints requieren autenticación via API Key (x-api-key header)
 * Rate limit: 100 requests por minuto por defecto
 * 
 * Base path: /bot
 */
@Controller('bot')
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(private readonly botService: BotService) {}

  /**
   * GET /bot/health
   * Health check endpoint (sin autenticación para monitoreo)
   */
  @Get('health')
  async healthCheck() {
    return this.botService.healthCheck();
  }

  /**
   * GET /bot/client/by-jid/:jid
   * Busca un cliente por su JID de WhatsApp
   * 
   * @param jid - WhatsApp JID (ej: "5491112345678@s.whatsapp.net")
   * @returns Información básica del cliente si existe
   */
  @Get('client/by-jid/:jid')
  @ServiceAuth()
  async findClientByJid(@Param('jid') jid: string) {
    this.logger.log(`[Bot API] Finding client by JID: ${jid}`);
    return this.botService.findClientByJid(jid);
  }

  /**
   * GET /bot/client/:clientId/balance
   * Obtiene el saldo pendiente de un cliente
   * 
   * @param clientId - ID del cliente (MongoDB ObjectId)
   * @returns Saldo del cliente y datos básicos
   */
  @Get('client/:clientId/balance')
  @ServiceAuth()
  async getClientBalance(@Param('clientId') clientId: string) {
    this.logger.log(`[Bot API] Getting balance for client: ${clientId}`);
    return this.botService.getClientBalance(clientId);
  }
}
