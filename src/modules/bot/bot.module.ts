import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { Agent, AgentSchema } from '../agents/entities/agent.entity';
import { Property, PropertySchema } from '../properties/entities/property.entity';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';
import { OtpModule } from '../otp/otp.module';
import { TicketsModule } from '../tickets/tickets.module';

/**
 * BotModule - Módulo para endpoints del WhatsApp Bot
 * 
 * Proporciona API protegida con API Key para:
 * - Consultas de clientes y saldos
 * - Validación de identidad con OTP
 * - Creación de reclamos
 * - Búsqueda de propiedades publicadas
 * 
 * Incluye rate limiting para prevenir abuso
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minuto
        limit: 30, // 30 requests por minuto
      },
    ]),
    AccountingEntriesModule,
    OtpModule,
    TicketsModule,
  ],
  controllers: [BotController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
