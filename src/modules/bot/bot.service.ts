import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent } from '../agents/entities/agent.entity';
import { AgentsService } from '../agents/agents.service';

/**
 * BotService - Lógica de negocio para endpoints del WhatsApp Bot
 * 
 * Maneja:
 * - Búsqueda de clientes por JID de WhatsApp
 * - Consultas de saldo
 * - Validación de identidad
 * - Creación de reclamos
 */
@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectModel(Agent.name)
    private readonly agentModel: Model<Agent>,
    private readonly agentsService: AgentsService,
  ) {}

  /**
   * Health check para verificar que el servicio está funcionando
   */
  async healthCheck() {
    return {
      status: 'ok',
      service: 'whatsapp-bot-api',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Normaliza un JID de WhatsApp removiendo sufijos
   * Ejemplo: "5491112345678@s.whatsapp.net" -> "5491112345678"
   * 
   * Para Argentina, también genera variante sin el prefijo 549
   * Ejemplo: "5491112345678" -> también busca "1112345678"
   */
  private normalizeJid(jid: string): { full: string; withoutPrefix: string | null } {
    const cleaned = jid.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
    
    // Si el número empieza con 549 (Argentina), generar variante sin prefijo
    let withoutPrefix = null;
    if (cleaned.startsWith('549')) {
      withoutPrefix = cleaned.substring(3); // Remueve "549"
    }
    
    return {
      full: cleaned,
      withoutPrefix,
    };
  }

  /**
   * Busca un cliente por su JID de WhatsApp
   * Busca en el campo telefonos.numero del agente
   * 
   * Maneja números argentinos con y sin prefijo 549
   */
  async findClientByJid(jid: string) {
    const normalized = this.normalizeJid(jid);
    this.logger.log(`Searching client by JID: ${normalized.full} (also trying: ${normalized.withoutPrefix})`);

    // Construir query para buscar ambas variantes
    const searchPatterns = [normalized.full];
    if (normalized.withoutPrefix) {
      searchPatterns.push(normalized.withoutPrefix);
    }

    // Buscar agente que tenga alguna de las variantes del número
    const agent = await this.agentModel
      .findOne({
        'telefonos.numero': { 
          $in: searchPatterns.map(pattern => new RegExp(pattern, 'i'))
        },
      })
      .select('_id nombre_razon_social email_principal identificador_fiscal')
      .lean();

    if (!agent) {
      return {
        exists: false,
        message: 'Cliente no encontrado',
      };
    }

    return {
      exists: true,
      clientId: agent._id.toString(),
      name: agent.nombre_razon_social,
      email: agent.email_principal,
      fiscalId: agent.identificador_fiscal,
    };
  }

  /**
   * Obtiene el saldo de un cliente
   * Reutiliza AgentsService.getAgentBalance()
   */
  async getClientBalance(clientId: string) {
    this.logger.log(`Getting balance for client: ${clientId}`);

    try {
      // Verificar que el agente existe y obtener sus datos
      const agent = await this.agentModel
        .findById(clientId)
        .select('nombre_razon_social email_principal identificador_fiscal')
        .lean();

      if (!agent) {
        throw new NotFoundException(`Cliente ${clientId} no encontrado`);
      }

      // Obtener saldo usando el servicio existente
      const balance = await this.agentsService.getAgentBalance(clientId);

      return {
        clientId: clientId,
        name: agent.nombre_razon_social,
        balance: {
          totalDebt: balance,
          currency: 'ARS',
        },
      };
    } catch (error) {
      this.logger.error(`Error getting balance for ${clientId}:`, error);
      throw error;
    }
  }
}
