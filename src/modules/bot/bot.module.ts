import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { Agent, AgentSchema } from '../agents/entities/agent.entity';
import { AgentsModule } from '../agents/agents.module';

/**
 * BotModule - Módulo para endpoints del WhatsApp Bot
 * 
 * Proporciona:
 * - Autenticación via API Key
 * - Rate limiting (100 req/min)
 * - Endpoints para consultas de clientes, saldo, reclamos, etc.
 */
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Agent.name, schema: AgentSchema }]),
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 segundos en milisegundos
      limit: 100, // 100 requests
    }]),
    AgentsModule, // Para acceder a AgentsService
  ],
  controllers: [BotController],
  providers: [BotService, ApiKeyGuard],
  exports: [BotService],
})
export class BotModule {}
