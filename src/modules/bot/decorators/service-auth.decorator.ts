import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { Throttle } from '@nestjs/throttler';

/**
 * @ServiceAuth() - Decorator para endpoints exclusivos de servicios
 * 
 * Aplica:
 * - ApiKeyGuard: Valida x-api-key header
 * - Rate limiting: 100 requests por minuto por defecto
 * 
 * Uso:
 * @Get('client/:id')
 * @ServiceAuth()
 * async getClient(@Param('id') id: string) { ... }
 * 
 * Con rate limit personalizado:
 * @ServiceAuth(200, 60) // 200 requests por minuto
 */
export function ServiceAuth(limit: number = 100, ttl: number = 60) {
  return applyDecorators(
    UseGuards(ApiKeyGuard),
    Throttle({ default: { limit, ttl } }),
  );
}
