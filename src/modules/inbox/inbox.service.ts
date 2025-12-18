import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message } from './entities/message.entity';
import {
  CreateMessageDto,
  CreateFormMessageDto,
} from './dto/create-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { UpdateStatusDto, SendReplyDto } from './dto/update-message.dto';
import { EmailService } from '../../common/email/email.service';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Crear mensaje desde formulario web
   */
  async createMessageFromForm(
    dto: CreateFormMessageDto,
    propertyId?: string,
  ): Promise<Message> {
    this.logger.log(
      `Creando mensaje desde formulario web de: ${dto.email}`,
    );

    const subject = propertyId
      ? `Consulta sobre propiedad ${propertyId}`
      : 'Nueva consulta desde el sitio web';

    const content = `
      <p><strong>Nombre:</strong> ${dto.name}</p>
      ${dto.phone ? `<p><strong>Teléfono:</strong> ${dto.phone}</p>` : ''}
      <p><strong>Email:</strong> ${dto.email}</p>
      <hr>
      <p>${dto.message}</p>
    `;

    const messageData: CreateMessageDto = {
      subject,
      sender: {
        name: dto.name,
        email: dto.email,
      },
      source: 'Formulario Web',
      content,
      contentPlainText: dto.message,
      tags: propertyId ? [`propiedad:${propertyId}`] : [],
    };

    const message = new this.messageModel(messageData);

    // Si hay propertyId, agregarlo como relatedProperty
    if (propertyId && Types.ObjectId.isValid(propertyId)) {
      message.relatedProperty = new Types.ObjectId(propertyId);
    }

    await message.save();

    this.logger.log(`Mensaje creado con ID: ${message._id}`);
    return message;
  }

  /**
   * Crear mensaje genérico
   */
  async createMessage(dto: CreateMessageDto): Promise<Message> {
    this.logger.log(`Creando mensaje genérico desde: ${dto.source}`);
    const message = new this.messageModel(dto);
    await message.save();
    return message;
  }

  /**
   * Buscar mensajes con filtros y paginación
   */
  async findAll(query: QueryMessagesDto) {
    const { page = 1, pageSize = 20, search, ...filters } = query;
    const skip = (page - 1) * pageSize;

    // Construir query
    const mongoQuery: any = {};

    if (filters.source) {
      mongoQuery.source = filters.source;
    }

    if (filters.status) {
      mongoQuery.status = filters.status;
    }

    if (filters.assignedTo) {
      if (Types.ObjectId.isValid(filters.assignedTo)) {
        mongoQuery.assignedTo = new Types.ObjectId(filters.assignedTo);
      }
    }

    if (filters.tag) {
      mongoQuery.tags = filters.tag;
    }

    // Búsqueda por texto
    if (search) {
      mongoQuery.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { contentPlainText: { $regex: search, $options: 'i' } },
        { 'sender.name': { $regex: search, $options: 'i' } },
        { 'sender.email': { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.messageModel
        .find(mongoQuery)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('assignedTo', 'username email')
        .populate('relatedAgent', 'nombre_razon_social email_principal')
        .populate('relatedProperty', 'direccion')
        .lean()
        .exec(),
      this.messageModel.countDocuments(mongoQuery).exec(),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Obtener mensaje por ID
   */
  async findById(id: string): Promise<Message> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('ID de mensaje inválido');
    }

    const message = await this.messageModel
      .findById(id)
      .populate('assignedTo', 'username email')
      .populate('relatedAgent', 'nombre_razon_social email_principal')
      .populate('relatedProperty', 'direccion')
      .exec();

    if (!message) {
      throw new NotFoundException(`Mensaje con ID ${id} no encontrado`);
    }

    // Marcar como leído si está en estado "Nuevo"
    if (message.status === 'Nuevo') {
      message.status = 'Leído';
      await message.save();
    }

    return message;
  }

  /**
   * Buscar mensaje por messageId de email (deduplicación)
   */
  async findByMessageId(messageId: string): Promise<Message | null> {
    return this.messageModel
      .findOne({ 'emailMetadata.messageId': messageId })
      .exec();
  }

  /**
   * Actualizar estado de mensaje
   */
  async updateStatus(id: string, dto: UpdateStatusDto): Promise<Message> {
    const message = await this.messageModel.findById(id);
    if (!message) {
      throw new NotFoundException(`Mensaje con ID ${id} no encontrado`);
    }

    message.status = dto.status;
    await message.save();

    this.logger.log(`Estado del mensaje ${id} actualizado a: ${dto.status}`);
    return message;
  }

  /**
   * Actualizar estado de múltiples mensajes (batch)
   */
  async updateMessagesBatchStatus(
    ids: string[],
    status: string,
  ): Promise<{ updated: number }> {
    this.logger.log(`Actualizando estado de ${ids.length} mensajes a: ${status}`);
    
    const result = await this.messageModel.updateMany(
      { _id: { $in: ids.map(id => new Types.ObjectId(id)) } },
      { $set: { status } }
    );

    this.logger.log(`${result.modifiedCount} mensajes actualizados`);
    return { updated: result.modifiedCount };
  }

  /**
   * Eliminar múltiples mensajes (batch)
   */
  async deleteMessagesBatch(ids: string[]): Promise<{ deleted: number }> {
    this.logger.log(`Eliminando ${ids.length} mensajes`);
    
    const result = await this.messageModel.deleteMany({
      _id: { $in: ids.map(id => new Types.ObjectId(id)) }
    });

    this.logger.log(`${result.deletedCount} mensajes eliminados`);
    return { deleted: result.deletedCount };
  }

  /**
   * Asignar mensaje a un usuario
   */
  async assignTo(id: string, userId: string): Promise<Message> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('ID de usuario inválido');
    }

    const message = await this.messageModel.findById(id);
    if (!message) {
      throw new NotFoundException(`Mensaje con ID ${id} no encontrado`);
    }

    message.assignedTo = new Types.ObjectId(userId);
    await message.save();

    this.logger.log(`Mensaje ${id} asignado al usuario ${userId}`);
    return message;
  }

  /**
   * Agregar etiquetas a mensaje
   */
  async addTags(id: string, tags: string[]): Promise<Message> {
    const message = await this.messageModel.findById(id);
    if (!message) {
      throw new NotFoundException(`Mensaje con ID ${id} no encontrado`);
    }

    // Agregar tags sin duplicar
    const newTags = tags.filter((tag) => !message.tags.includes(tag));
    message.tags.push(...newTags);
    await message.save();

    this.logger.log(`Agregadas ${newTags.length} etiquetas al mensaje ${id}`);
    return message;
  }

  /**
   * Archivar mensaje
   */
  async archiveMessage(id: string): Promise<Message> {
    return this.updateStatus(id, { status: 'Archivado' });
  }

  /**
   * Responder a un mensaje por email
   */
  async sendReply(id: string, dto: SendReplyDto): Promise<void> {
    const message = await this.messageModel.findById(id);
    if (!message) {
      throw new NotFoundException(`Mensaje con ID ${id} no encontrado`);
    }

    const subject = dto.subject || `Re: ${message.subject}`;

    try {
      await this.emailService.send({
        to: message.sender.email,
        subject,
        html: dto.content,
      });

      this.logger.log(`Respuesta enviada al mensaje ${id}`);
    } catch (error) {
      this.logger.error(`Error al enviar respuesta: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de mensajes
   */
  async getStats() {
    const [total, nuevo, leido, archivado, porFuente] = await Promise.all([
      this.messageModel.countDocuments().exec(),
      this.messageModel.countDocuments({ status: 'Nuevo' }).exec(),
      this.messageModel.countDocuments({ status: 'Leído' }).exec(),
      this.messageModel.countDocuments({ status: 'Archivado' }).exec(),
      this.messageModel
        .aggregate([
          {
            $group: {
              _id: '$source',
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
    ]);

    return {
      total,
      porEstado: {
        nuevo,
        leido,
        archivado,
      },
      porFuente,
    };
  }
}
