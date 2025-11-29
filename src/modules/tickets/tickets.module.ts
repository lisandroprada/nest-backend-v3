import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketsService } from './tickets.service';
import { Ticket, TicketSchema } from './schemas/ticket.schema';
import { Agent, AgentSchema } from '../agents/entities/agent.entity';

/**
 * TicketsModule - Módulo para gestión de tickets/reclamos
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
  ],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
