import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl: string;
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor() {
    // Configuración de WhatsApp Business API
    // IMPORTANTE: Configura estas variables de entorno en tu .env
    this.apiUrl =
      process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  /**
   * Envía un recibo por WhatsApp con archivo PDF adjunto
   * @param phoneNumber Número de teléfono del destinatario (formato: 549XXXXXXXXXX)
   * @param receiptNumber Número del recibo
   * @param pdfPath Ruta del archivo PDF
   * @param agentName Nombre del agente
   * @param amount Monto del recibo
   */
  async sendReceiptWhatsApp(
    phoneNumber: string,
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

      // Validar configuración
      if (!this.accessToken || !this.phoneNumberId) {
        throw new Error(
          'WhatsApp no está configurado. Configure WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en .env',
        );
      }

      // Normalizar número de teléfono (eliminar espacios, guiones, etc.)
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      // Paso 1: Subir el archivo PDF a WhatsApp
      const mediaId = await this.uploadMedia(pdfPath);

      // Paso 2: Enviar mensaje de texto
      await this.sendTextMessage(
        normalizedPhone,
        this.generateWhatsAppMessage(receiptNumber, agentName, amount),
      );

      // Paso 3: Enviar el documento PDF
      await this.sendDocumentMessage(
        normalizedPhone,
        mediaId,
        `recibo-${receiptNumber}.pdf`,
      );

      this.logger.log(`WhatsApp enviado exitosamente a ${normalizedPhone}`);
    } catch (error) {
      this.logger.error('Error al enviar WhatsApp:', error);
      throw new Error(`No se pudo enviar el WhatsApp: ${error.message}`);
    }
  }

  /**
   * Sube un archivo a WhatsApp Cloud API
   */
  private async uploadMedia(filePath: string): Promise<string> {
    try {
      const formData = new FormData();
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });

      formData.append('file', blob, path.basename(filePath));
      formData.append('messaging_product', 'whatsapp');

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/media`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      return response.data.id;
    } catch (error) {
      this.logger.error('Error al subir media a WhatsApp:', error);
      throw new Error('No se pudo subir el archivo a WhatsApp');
    }
  }

  /**
   * Envía un mensaje de texto
   */
  private async sendTextMessage(
    phoneNumber: string,
    message: string,
  ): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: {
            body: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      this.logger.error('Error al enviar mensaje de texto WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Envía un documento PDF
   */
  private async sendDocumentMessage(
    phoneNumber: string,
    mediaId: string,
    filename: string,
  ): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'document',
          document: {
            id: mediaId,
            filename: filename,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      this.logger.error('Error al enviar documento WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Genera el mensaje de WhatsApp
   */
  private generateWhatsAppMessage(
    receiptNumber: number,
    agentName: string,
    amount: number,
  ): string {
    return `
🧾 *COMPROBANTE DE PAGO*

¡Hola ${agentName}!

Se ha generado el siguiente recibo:

📋 *Recibo N°:* ${String(receiptNumber).padStart(8, '0')}
📅 *Fecha:* ${new Date().toLocaleDateString('es-AR')}
💰 *Monto:* $${this.formatCurrency(amount)}

📎 A continuación recibirás el comprobante en PDF.

_Por favor, conserva este recibo para tus registros contables._

---
*Propietas* - Sistema de Gestión Inmobiliaria
`.trim();
  }

  /**
   * Normaliza el número de teléfono
   * Formato esperado: 549XXXXXXXXXX (Argentina)
   */
  private normalizePhoneNumber(phone: string): string {
    // Eliminar todos los caracteres no numéricos
    let normalized = phone.replace(/\D/g, '');

    // Si empieza con 0, quitarlo
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }

    // Si empieza con 15, quitarlo (código de celular argentino)
    if (normalized.startsWith('15')) {
      normalized = normalized.substring(2);
    }

    // Si no empieza con 549, agregarlo (código de país + código de celular)
    if (!normalized.startsWith('549')) {
      normalized = '549' + normalized;
    }

    return normalized;
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
   * Verifica si WhatsApp está configurado
   */
  isConfigured(): boolean {
    return !!(this.accessToken && this.phoneNumberId);
  }
}
