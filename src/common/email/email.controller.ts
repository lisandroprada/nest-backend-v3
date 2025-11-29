import { Body, Controller, Post, Logger } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(private readonly emailService: EmailService) {}

  @Post('test')
  async sendTestEmail(@Body('email') email: string) {
    this.logger.log(`[Email Test] Sending test email to: ${email}`);

    try {
      await this.emailService.send({
        to: email,
        subject: '✅ Test de Email - Propietas',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">🎉 ¡Email funcionando correctamente!</h2>
            <p>Este es un email de prueba desde el sistema de Propietas.</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
            <p><strong>Destinatario:</strong> ${email}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 14px;">
              Si recibiste este email, significa que la configuración SMTP está funcionando correctamente.
            </p>
          </div>
        `,
      });

      return {
        success: true,
        message: `Email de prueba enviado a ${email}`,
      };
    } catch (error) {
      this.logger.error('[Email Test] Error:', error);
      throw error;
    }
  }
}
