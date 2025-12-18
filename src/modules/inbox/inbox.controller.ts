import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InboxService } from './inbox.service';
import {
  CreateMessageDto,
  CreateFormMessageDto,
} from './dto/create-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import {
  UpdateStatusDto,
  AssignMessageDto,
  AddTagsDto,
  SendReplyDto,
} from './dto/update-message.dto';
import { BatchUpdateStatusDto } from './dto/batch-update-status.dto';
import { BatchDeleteDto } from './dto/batch-delete.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  /**
   * Endpoint público para formularios web
   * POST /inbox/messages/form
   */
  @Post('messages/form')
  @HttpCode(HttpStatus.CREATED)
  async createFormMessage(@Body() dto: CreateFormMessageDto) {
    return this.inboxService.createMessageFromForm(dto, dto.propertyId);
  }

  /**
   * Crear mensaje genérico (protegido)
   * POST /inbox/messages
   */
  @Post('messages')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createMessage(@Body() dto: CreateMessageDto) {
    return this.inboxService.createMessage(dto);
  }

  /**
   * Listar mensajes con filtros (protegido)
   * GET /inbox/messages
   */
  @Get('messages')
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: QueryMessagesDto) {
    return this.inboxService.findAll(query);
  }

  /**
   * Obtener estadísticas (protegido)
   * GET /inbox/stats
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.inboxService.getStats();
  }

  /**
   * Obtener detalle de mensaje (protegido)
   * GET /inbox/messages/:id
   */
  @Get('messages/:id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.inboxService.findById(id);
  }

  /**
   * Actualizar estado de mensaje (protegido)
   * PATCH /inbox/messages/:id/status
   */
  @Patch('messages/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.inboxService.updateStatus(id, dto);
  }

  /**
   * Asignar mensaje a usuario (protegido)
   * PATCH /inbox/messages/:id/assign
   */
  @Patch('messages/:id/assign')
  @UseGuards(JwtAuthGuard)
  async assignMessage(@Param('id') id: string, @Body() dto: AssignMessageDto) {
    return this.inboxService.assignTo(id, dto.userId);
  }

  /**
   * Agregar etiquetas a mensaje (protegido)
   * PATCH /inbox/messages/:id/tags
   */
  @Patch('messages/:id/tags')
  @UseGuards(JwtAuthGuard)
  async addTags(@Param('id') id: string, @Body() dto: AddTagsDto) {
    return this.inboxService.addTags(id, dto.tags);
  }

  /**
   * Archivar mensaje (protegido)
   * PATCH /inbox/messages/:id/archive
   */
  @Patch('messages/:id/archive')
  @UseGuards(JwtAuthGuard)
  async archiveMessage(@Param('id') id: string) {
    return this.inboxService.archiveMessage(id);
  }

  /**
   * Responder mensaje (protegido)
   * POST /inbox/messages/:id/reply
   */
  @Post('messages/:id/reply')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendReply(@Param('id') id: string, @Body() dto: SendReplyDto) {
    await this.inboxService.sendReply(id, dto);
    return { message: 'Respuesta enviada exitosamente' };
  }

  /**
   * Actualizar estado de múltiples mensajes (batch)
   * PATCH /inbox/messages/batch/status
   */
  @Patch('messages/batch/status')
  @UseGuards(JwtAuthGuard)
  async updateBatchStatus(@Body() dto: BatchUpdateStatusDto) {
    return this.inboxService.updateMessagesBatchStatus(
      dto.messageIds,
      dto.status,
    );
  }

  /**
   * Eliminar múltiples mensajes (batch)
   * DELETE /inbox/messages/batch
   */
  @Patch('messages/batch/delete')
  @UseGuards(JwtAuthGuard)
  async deleteBatch(@Body() dto: BatchDeleteDto) {
    return this.inboxService.deleteMessagesBatch(dto.messageIds);
  }
}
