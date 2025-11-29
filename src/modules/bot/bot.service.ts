import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent } from '../agents/entities/agent.entity';
import { Property } from '../properties/entities/property.entity';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { OtpService } from '../otp/otp.service';
import { TicketsService } from '../tickets/tickets.service';
import { ValidateIdentityDto, VerifyOtpDto } from '../otp/dto';
import { CreateTicketDto } from '../tickets/dto';
import { TicketSource } from '../tickets/schemas/ticket.schema';

/**
 * BotService - Lógica de negocio para endpoints del WhatsApp Bot
 * 
 * Maneja:
 * - Búsqueda de clientes por JID de WhatsApp
 * - Consultas de saldo y estado de cuenta
 * - Validación de identidad con OTP
 * - Creación de reclamos/tickets
 * - Búsqueda de propiedades publicadas
 */
@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectModel(Agent.name)
    private readonly agentModel: Model<Agent>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<Property>,
    private readonly accountingEntriesService: AccountingEntriesService,
    private readonly otpService: OtpService,
    private readonly ticketsService: TicketsService,
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
   * Obtiene el estado de cuenta detallado de un cliente
   * Usa AccountingEntriesService.getEstadoCuentaByAgente() para obtener
   * información completa de movimientos, saldos, y deudas pendientes
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

      // Obtener estado de cuenta usando el servicio de accounting entries
      // Fecha de corte: hoy
      const today = new Date().toISOString().split('T')[0];
      const estadoCuenta = await this.accountingEntriesService.getEstadoCuentaByAgente(
        clientId,
        { 
          fecha_corte: today,
          solo_pendientes: true, // Solo movimientos con saldo pendiente
        }
      );

      // Formatear respuesta para el bot
      return {
        clientId: clientId,
        name: agent.nombre_razon_social,
        balance: {
          totalDebt: estadoCuenta.saldo_neto || 0,
          totalDebe: estadoCuenta.total_debe || 0,
          totalHaber: estadoCuenta.total_haber || 0,
          currency: 'ARS',
        },
        summary: {
          pendingMovements: estadoCuenta.movimientos?.length || 0,
          lastUpdate: today,
        },
        // Incluir movimientos pendientes (limitado a los últimos 5 para no saturar)
        recentMovements: (estadoCuenta.movimientos || [])
          .slice(0, 5)
          .map((mov: any) => ({
            date: mov.fecha_imputacion,
            description: mov.descripcion,
            amount: mov.saldo_pendiente,
            type: mov.tipo_partida,
          })),
      };
    } catch (error) {
      this.logger.error(`Error getting balance for ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Valida identidad del usuario y genera OTP
   * Delega a OtpService para buscar DNI y generar código
   */
  async validateIdentity(dto: ValidateIdentityDto) {
    this.logger.log(`[Bot API] Validating identity for DNI: ${dto.dni}`);
    return this.otpService.validateIdentity(dto);
  }

  /**
   * Verifica código OTP ingresado por el usuario
   * Delega a OtpService para validar el código
   */
  async verifyOtp(dto: VerifyOtpDto) {
    this.logger.log(`[Bot API] Verifying OTP for JID: ${dto.whatsappJid}`);
    return this.otpService.verifyOtp(dto);
  }

  /**
   * Crea un reclamo/ticket para un cliente
   * Delega a TicketsService para crear el ticket
   */
  async createComplaint(dto: CreateTicketDto) {
    this.logger.log(`[Bot API] Creating complaint for client: ${dto.clientId}`);
    return this.ticketsService.createTicket(dto, TicketSource.WHATSAPP);
  }

  /**
   * Busca propiedades publicadas según filtros
   * Filtra por propiedades disponibles y publicadas para venta/alquiler
   */
  async searchPublishedProperties(filters: {
    operation: 'rent' | 'sale';
    type?: string;
    zone?: string;
    city?: string;
    rooms?: number;
    maxPrice?: number;
  }) {
    this.logger.log(`[Bot API] Searching properties: ${JSON.stringify(filters)}`);

    // Construir query base
    const query: any = {
      status: 'DISPONIBLE',
    };

    // Filtrar por operación (alquiler o venta)
    if (filters.operation === 'rent') {
      query.publicar_para_alquiler = true;
      query.valor_alquiler = { $gt: 0 };
    } else {
      query.publicar_para_venta = true;
      query.valor_venta = { $gt: 0 };
    }

    // Filtrar por tipo de propiedad
    if (filters.type) {
      const typeMap: Record<string, string> = {
        'apartment': 'departamento',
        'house': 'casa',
        'duplex': 'duplex',
        'local': 'local_comercial',
        'office': 'oficina',
      };
      query['caracteristicas.tipo_propiedad'] = typeMap[filters.type] || filters.type;
    }

    // Filtrar por ambientes
    if (filters.rooms) {
      query['caracteristicas.ambientes'] = { $gte: filters.rooms };
    }

    // Filtrar por precio máximo
    if (filters.maxPrice) {
      const priceField = filters.operation === 'rent' ? 'valor_alquiler' : 'valor_venta';
      query[priceField] = { ...query[priceField], $lte: filters.maxPrice };
    }

    // Ejecutar query base
    let propertiesQuery = this.propertyModel
      .find(query)
      .populate('direccion.provincia_id', 'nombre')
      .populate('direccion.localidad_id', 'nombre')
      .limit(50) // Aumentado para filtrado posterior
      .lean();

    const properties = await propertiesQuery.exec();

    // Filtrar por ciudad si se especifica (búsqueda parcial case-insensitive)
    let filteredProperties = properties;
    if (filters.city) {
      const cityRegex = new RegExp(filters.city, 'i');
      filteredProperties = properties.filter((prop: any) => {
        const localidadNombre = prop.direccion?.localidad_id?.nombre || '';
        return cityRegex.test(localidadNombre);
      });
    }

    // Limitar a 10 resultados finales
    filteredProperties = filteredProperties.slice(0, 10);

    // Formatear respuesta para el bot
    return filteredProperties.map((prop: any) => {
      const address = prop.direccion 
        ? `${prop.direccion.calle || ''} ${prop.direccion.numero || ''}`.trim()
        : 'Dirección no disponible';
      
      const zone = prop.direccion?.localidad_id?.nombre || 
                   prop.direccion?.provincia_id?.nombre || 
                   'Zona no especificada';

      const price = filters.operation === 'rent' 
        ? prop.valor_alquiler 
        : prop.valor_venta;

      return {
        id: prop._id.toString(),
        title: prop.titulo || address,
        address,
        zone,
        type: prop.caracteristicas?.tipo_propiedad || 'No especificado',
        rooms: prop.caracteristicas?.ambientes || 0,
        price,
        currency: 'ARS',
        surface: prop.caracteristicas?.metraje_total || 0,
        url: `https://propietas.com/propiedad/${prop._id}`,
      };
    });
  }

  /**
   * Obtiene lista de ciudades con propiedades disponibles
   * Agrupa por ciudad y cuenta propiedades en alquiler/venta
   */
  async getAvailableCities() {
    this.logger.log('[Bot API] Getting available cities');

    const pipeline = [
      {
        $match: {
          status: 'DISPONIBLE',
          $or: [
            { publicar_para_alquiler: true, valor_alquiler: { $gt: 0 } },
            { publicar_para_venta: true, valor_venta: { $gt: 0 } }
          ]
        }
      },
      {
        $lookup: {
          from: 'localities',
          localField: 'direccion.localidad_id',
          foreignField: '_id',
          as: 'locality'
        }
      },
      {
        $unwind: {
          path: '$locality',
          preserveNullAndEmptyArrays: false
        }
      },
      {
        $group: {
          _id: '$locality.nombre',
          rent: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$publicar_para_alquiler', true] },
                  { $gt: ['$valor_alquiler', 0] }
                ]},
                1,
                0
              ]
            }
          },
          sale: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$publicar_para_venta', true] },
                  { $gt: ['$valor_venta', 0] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          city: '$_id',
          rent: 1,
          sale: 1
        }
      },
      {
        $sort: { city: 1 }
      }
    ];

    const cities = await this.propertyModel.aggregate(pipeline as any).exec();
    return cities;
  }
}

