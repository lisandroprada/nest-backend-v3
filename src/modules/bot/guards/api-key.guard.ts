import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ApiKeyGuard - Guard para autenticación service-to-service
 * 
 * Valida que el request incluya un header 'x-api-key' con la API key correcta.
 * Diseñado específicamente para requests del WhatsApp Bot.
 * 
 * Uso:
 * @UseGuards(ApiKeyGuard)
 * o mediante el decorator @ServiceAuth()
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    const validKey = this.configService.get<string>('WHATSAPP_BOT_API_KEY');

    if (!validKey) {
      throw new Error('WHATSAPP_BOT_API_KEY not configured in environment');
    }

    if (apiKey !== validKey) {
      throw new UnauthorizedException('Invalid API Key');
    }

    // Marcar request como autenticado por servicio
    request.serviceAuth = {
      type: 'SERVICE',
      service: 'whatsapp-bot',
      timestamp: new Date(),
    };

    return true;
  }
}
