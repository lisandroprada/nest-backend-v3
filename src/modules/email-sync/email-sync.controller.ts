import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { EmailSyncService } from './email-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('email-sync')
@UseGuards(JwtAuthGuard)
export class EmailSyncController {
  constructor(private readonly emailSyncService: EmailSyncService) {}

  /**
   * Forzar sincronización manual de un usuario
   * POST /email-sync/trigger/:userId
   */
  @Post('trigger/:userId')
  async triggerSync(@Param('userId') userId: string) {
    return this.emailSyncService.syncUserEmail(userId);
  }

  /**
   * Probar configuración IMAP
   * POST /email-sync/test-imap
   */
  @Post('test-imap')
  async testImap(@Body() imapConfig: any) {
    return this.emailSyncService.testImapConnection(imapConfig);
  }
}
