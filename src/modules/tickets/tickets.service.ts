import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket, TicketSource, TicketStatus } from './schemas/ticket.schema';
import { Agent } from '../agents/entities/agent.entity';
import { CreateTicketDto } from './dto';

/**
 * TicketsService - Servicio para gestión de tickets/reclamos
 * 
 * Funcionalidades:
 * - Crear tickets desde diferentes canales (WhatsApp, Web, etc.)
 * - Obtener tickets por cliente
 * - Actualizar estado de tickets
 * - Notificar al equipo sobre nuevos tickets
 */
@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    @InjectModel(Agent.name)
    private readonly agentModel: Model<Agent>,
  ) {}

  /**
   * Crea un nuevo ticket/reclamo
   * 
   * @param dto - Datos del ticket
   * @param source - Canal por el que se reportó (WhatsApp, Web, etc.)
   * @returns Ticket creado
   */
  async createTicket(dto: CreateTicketDto, source: TicketSource = TicketSource.WHATSAPP) {
    this.logger.log(`Creating ticket for client ${dto.clientId}, category: ${dto.category}`);

    // Verificar que el cliente existe y obtener sus datos
    const client = await this.agentModel
      .findById(dto.clientId)
      .select('nombre_razon_social fullName name lastName email_principal email')
      .lean();

    if (!client) {
      throw new NotFoundException(`Cliente ${dto.clientId} no encontrado`);
    }

    // Obtener nombre del cliente (soporta ambos schemas)
    const clientData = client as any;
    const clientName = client.nombre_razon_social || clientData.fullName || `${clientData.name || ''} ${clientData.lastName || ''}`.trim();

    // Crear ticket
    const ticket = await this.ticketModel.create({
      clientId: dto.clientId,
      clientName,
      propertyId: dto.propertyId,
      category: dto.category,
      description: dto.description,
      urgency: dto.urgency,
      status: TicketStatus.OPEN,
      source,
      whatsappJid: dto.whatsappJid,
      evidenceUrls: dto.evidenceUrls || [],
    });

    this.logger.log(`Ticket created: ${ticket._id} for client ${clientName}`);

    // TODO: Enviar notificación por email al equipo
    // await this.notifyTeam(ticket);

    return {
      success: true,
      ticketId: ticket._id.toString(),
      message: 'Reclamo creado exitosamente. Nuestro equipo lo revisará pronto.',
      ticket: {
        id: ticket._id.toString(),
        category: ticket.category,
        urgency: ticket.urgency,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    };
  }

  /**
   * Obtiene todos los tickets de un cliente
   * 
   * @param clientId - ID del cliente
   * @returns Lista de tickets
   */
  async getClientTickets(clientId: string) {
    const tickets = await this.ticketModel
      .find({ clientId })
      .sort({ createdAt: -1 })
      .select('category description urgency status createdAt resolvedAt')
      .lean();

    return {
      clientId,
      totalTickets: tickets.length,
      tickets: tickets.map(ticket => ({
        id: ticket._id.toString(),
        category: ticket.category,
        description: ticket.description,
        urgency: ticket.urgency,
        status: ticket.status,
        createdAt: ticket.createdAt,
        resolvedAt: ticket.resolvedAt,
      })),
    };
  }
}
