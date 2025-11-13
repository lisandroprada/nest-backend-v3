import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    // Configuración del transportador de email
    // IMPORTANTE: Configura estas variables de entorno en tu .env
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Envía un recibo por email con archivo PDF adjunto
   * @param to Email del destinatario
   * @param receiptNumber Número del recibo
   * @param pdfPath Ruta del archivo PDF
   * @param agentName Nombre del agente
   * @param amount Monto del recibo
   */
  async sendReceiptEmail(
    to: string,
    receiptNumber: number,
    pdfPath: string,
    agentName: string,
    amount: number,
  ): Promise<void> {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`El archivo PDF no existe: ${pdfPath}`);
      }

      const mailOptions = {
        from: `"Propietas" <${process.env.SMTP_USER}>`,
        to,
        subject: `Recibo de Pago N° ${String(receiptNumber).padStart(8, '0')}`,
        html: this.generateEmailHTML(receiptNumber, agentName, amount),
        attachments: [
          {
            filename: `recibo-${receiptNumber}.pdf`,
            path: pdfPath,
            contentType: 'application/pdf',
          },
        ],
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email enviado: ${info.messageId}`);
    } catch (error) {
      this.logger.error('Error al enviar email:', error);
      throw new Error(`No se pudo enviar el email: ${error.message}`);
    }
  }

  /**
   * Genera el HTML del email
   */
  private generateEmailHTML(
    receiptNumber: number,
    agentName: string,
    amount: number,
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4CAF50;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: none;
          }
          .receipt-number {
            font-size: 24px;
            font-weight: bold;
            color: #4CAF50;
            text-align: center;
            margin: 20px 0;
          }
          .info-box {
            background-color: white;
            padding: 15px;
            border-left: 4px solid #4CAF50;
            margin: 20px 0;
          }
          .amount {
            font-size: 28px;
            font-weight: bold;
            color: #4CAF50;
            text-align: center;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #777;
            font-size: 12px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PROPIETAS</h1>
          <p>Sistema de Gestión Inmobiliaria</p>
        </div>
        
        <div class="content">
          <h2>¡Recibo Generado Exitosamente!</h2>
          
          <p>Estimado/a <strong>${agentName}</strong>,</p>
          
          <p>Se ha generado el siguiente comprobante de pago:</p>
          
          <div class="receipt-number">
            Recibo N° ${String(receiptNumber).padStart(8, '0')}
          </div>
          
          <div class="info-box">
            <p><strong>Fecha:</strong> ${new Date().toLocaleDateString(
              'es-AR',
              {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              },
            )}</p>
            <p><strong>Cliente:</strong> ${agentName}</p>
          </div>
          
          <div class="amount">
            $${this.formatCurrency(amount)}
          </div>
          
          <p>Adjunto encontrará el comprobante en formato PDF.</p>
          
          <p>Por favor, conserve este recibo para sus registros contables.</p>
          
          <div style="text-align: center;">
            <p><em>Si tiene alguna consulta, no dude en contactarnos.</em></p>
          </div>
        </div>
        
        <div class="footer">
          <p>Este es un email automático. Por favor no responda a este mensaje.</p>
          <p>&copy; ${new Date().getFullYear()} Propietas - Sistema de Gestión Inmobiliaria</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Formatea números a moneda
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Verifica la conexión con el servidor SMTP
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Conexión SMTP verificada correctamente');
      return true;
    } catch (error) {
      this.logger.error('Error en conexión SMTP:', error);
      return false;
    }
  }
}
