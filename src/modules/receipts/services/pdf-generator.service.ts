import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Receipt } from '../entities/receipt.entity';
import { AgentsService } from '../../agents/agents.service';
import { AccountingEntriesService } from '../../accounting-entries/accounting-entries.service';
import { AccountingEntry } from '../../accounting-entries/entities/accounting-entry.entity';

// Tipo extendido para asientos con monto imputado
type AsientoConMontoImputado = AccountingEntry & {
  monto_imputado?: number;
};

@Injectable()
export class PdfGeneratorService {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly accountingEntriesService: AccountingEntriesService,
  ) {}

  /**
   * Genera un PDF profesional del recibo
   * @param receipt El recibo a convertir en PDF
   * @returns La ruta del archivo PDF generado
   */
  async generateReceiptPDF(receipt: Receipt): Promise<string> {
    // Obtener información adicional
    const agente = await this.agentsService.findOne(
      receipt.agente_id.toString(),
    );

    // Obtener detalles de los asientos afectados con montos imputados
    let asientos: AsientoConMontoImputado[] = [];

    // Intentar usar asientos_afectados primero (nuevo formato con monto_imputado)
    if (receipt.asientos_afectados && receipt.asientos_afectados.length > 0) {
      asientos = await Promise.all(
        receipt.asientos_afectados.map(async (detalle) => {
          const result = await this.accountingEntriesService.find({
            _id: detalle.asiento_id,
          });
          // Convertir el documento Mongoose a objeto plano
          const asientoObj = result[0].toObject();
          return {
            ...asientoObj,
            monto_imputado: detalle.monto_imputado,
          } as AsientoConMontoImputado;
        }),
      );
    }
    // Fallback a asientos_afectados_ids (formato legacy sin monto_imputado)
    else if (
      receipt.asientos_afectados_ids &&
      receipt.asientos_afectados_ids.length > 0
    ) {
      asientos = await Promise.all(
        receipt.asientos_afectados_ids.map(async (id) => {
          const result = await this.accountingEntriesService.find({
            _id: id,
          });
          // Convertir el documento Mongoose a objeto plano
          return result[0].toObject() as AsientoConMontoImputado;
        }),
      );
    }

    // Crear directorio si no existe
    const uploadsDir = path.join(process.cwd(), 'uploads', 'receipts');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Nombre del archivo
    const fileName = `recibo-${receipt.numero_recibo}-${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    // Crear el documento PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Recibo #${receipt.numero_recibo}`,
        Author: 'Propietas',
        Subject: 'Comprobante de Pago',
      },
    });

    // Pipe al archivo
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // **HEADER**
    this.drawHeader(doc, receipt);

    // **INFORMACIÓN DEL CLIENTE**
    this.drawClientInfo(doc, agente);

    // **INFORMACIÓN DEL PAGO**
    this.drawPaymentInfo(doc, receipt);

    // **DETALLE DE OPERACIONES**
    await this.drawOperationsTable(doc, asientos);

    // **TOTALES**
    this.drawTotals(doc, receipt, asientos);

    // **OBSERVACIONES**
    if (receipt.observaciones) {
      this.drawObservations(doc, receipt.observaciones);
    }

    // **FIRMAS**
    this.drawSignatures(doc);

    // Finalizar documento
    doc.end();

    // Esperar que el stream termine
    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }

  /**
   * Dibuja el header del recibo
   */
  private drawHeader(doc: PDFKit.PDFDocument, receipt: Receipt): void {
    const y = 50;

    // Logo o nombre de la empresa (izquierda)
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('PROPIETAS', 50, y, { width: 300 });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Sistema de Gestión Inmobiliaria', 50, y + 25, { width: 300 });

    // Tipo de comprobante (derecha)
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('COMPROBANTE NO FISCAL', 350, y, { align: 'right' });

    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('X', 520, y + 20, { width: 30, align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        `N° ${String(receipt.numero_recibo).padStart(8, '0')}`,
        350,
        y + 60,
        {
          align: 'right',
        },
      );

    doc
      .fontSize(9)
      .text(
        `Fecha: ${new Date(receipt.fecha_emision).toLocaleDateString('es-AR')}`,
        350,
        y + 75,
        { align: 'right' },
      );

    // Línea separadora
    doc
      .moveTo(50, y + 100)
      .lineTo(550, y + 100)
      .stroke();
  }

  /**
   * Dibuja la información del cliente
   */
  private drawClientInfo(doc: PDFKit.PDFDocument, agente: any): void {
    const y = 170;

    doc.fontSize(11).font('Helvetica-Bold').text('CLIENTE', 50, y);

    // Construir el nombre completo según el tipo de persona
    let nombreCompleto = agente.nombre_razon_social || '';
    if (
      agente.persona_tipo === 'FISICA' &&
      agente.apellidos &&
      agente.nombres
    ) {
      nombreCompleto = `${agente.apellidos}, ${agente.nombres}`;
    }

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Nombre: ${nombreCompleto}`, 50, y + 20);

    if (agente.identificador_fiscal) {
      doc.text(`CUIT: ${agente.identificador_fiscal}`, 50, y + 35);
    }

    if (agente.email) {
      doc.text(`Email: ${agente.email}`, 50, y + 50);
    }

    doc
      .moveTo(50, y + 75)
      .lineTo(550, y + 75)
      .stroke();
  }

  /**
   * Dibuja la información del pago
   */
  private drawPaymentInfo(doc: PDFKit.PDFDocument, receipt: Receipt): void {
    const y = 270;

    doc.fontSize(11).font('Helvetica-Bold').text('INFORMACIÓN DE PAGO', 50, y);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Método de Pago: ${this.formatPaymentMethod(receipt.metodo_pago)}`,
        50,
        y + 20,
      );

    if (receipt.comprobante_externo) {
      doc.text(`N° Comprobante: ${receipt.comprobante_externo}`, 50, y + 35);
    }

    doc
      .moveTo(50, y + 60)
      .lineTo(550, y + 60)
      .stroke();
  }

  /**
   * Dibuja la tabla de operaciones
   */
  private async drawOperationsTable(
    doc: PDFKit.PDFDocument,
    asientos: AsientoConMontoImputado[],
  ): Promise<void> {
    const y = 360;
    const tableTop = y;
    const colWidths = {
      descripcion: 250,
      fecha: 100,
      monto: 100,
    };

    // Header de la tabla
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('DETALLE DE OPERACIONES', 50, y - 20);

    // Fondo del header
    doc.rect(50, tableTop, 500, 20).fillAndStroke('#f0f0f0', '#000000');

    // Textos del header
    doc
      .fillColor('#000000')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Descripción', 55, tableTop + 5, { width: colWidths.descripcion })
      .text('Fecha', 310, tableTop + 5, { width: colWidths.fecha })
      .text('Monto', 420, tableTop + 5, {
        width: colWidths.monto,
        align: 'right',
      });

    // Filas de la tabla
    let currentY = tableTop + 25;
    doc.font('Helvetica').fontSize(9);

    for (const asiento of asientos) {
      // Descripción
      doc.text(asiento.descripcion || 'Sin descripción', 55, currentY, {
        width: colWidths.descripcion - 10,
      });

      // Fecha
      doc.text(
        new Date(asiento.fecha_imputacion).toLocaleDateString('es-AR'),
        310,
        currentY,
        { width: colWidths.fecha },
      );

      // Monto: Usar monto_imputado si existe, sino monto_original (fallback)
      const montoAMostrar = asiento.monto_imputado || asiento.monto_original;
      doc.text(`$${this.formatCurrency(montoAMostrar)}`, 420, currentY, {
        width: colWidths.monto,
        align: 'right',
      });

      currentY += 25;

      // Verificar si necesitamos una nueva página
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }
    }

    // Línea final de la tabla
    doc
      .moveTo(50, currentY + 5)
      .lineTo(550, currentY + 5)
      .stroke();
  }

  /**
   * Dibuja los totales
   */
  private drawTotals(
    doc: PDFKit.PDFDocument,
    receipt: Receipt,
    asientos: AsientoConMontoImputado[],
  ): void {
    const y = doc.y + 20;

    // CALCULAR TOTALES DISCRIMINANDO COBROS Y PAGOS
    // Ahora usamos el tipo_operacion guardado en el recibo (COBRO o PAGO)
    // Cada asiento_afectado incluye el tipo de operación que se realizó

    let totalCobros = 0; // INGRESOS
    let totalPagos = 0; // EGRESOS

    // Obtener asientos_afectados del recibo que incluyen tipo_operacion
    const asientosAfectadosConTipo = (receipt as any).asientos_afectados || [];

    asientos.forEach((asiento) => {
      const montoImputado =
        asiento.monto_imputado || asiento.monto_original || 0;

      // Buscar el tipo_operacion guardado en el recibo
      const asientoAfectado = asientosAfectadosConTipo.find(
        (a) => a.asiento_id.toString() === asiento._id.toString(),
      );

      const tipoOperacion = asientoAfectado?.tipo_operacion;

      if (tipoOperacion === 'COBRO') {
        totalCobros += montoImputado;
      } else if (tipoOperacion === 'PAGO') {
        totalPagos += montoImputado;
      } else {
        // Fallback: usar lógica anterior si no hay tipo_operacion guardado
        const totalDebe = (asiento.partidas || []).reduce(
          (sum, p) => sum + (p.debe || 0),
          0,
        );
        const totalHaber = (asiento.partidas || []).reduce(
          (sum, p) => sum + (p.haber || 0),
          0,
        );

        const esHonorarios = asiento.descripcion
          ?.toLowerCase()
          .includes('honorario');

        if (totalDebe > totalHaber) {
          totalCobros += montoImputado;
        } else if (totalHaber > totalDebe) {
          totalPagos += montoImputado;
        } else if (esHonorarios) {
          totalCobros += montoImputado;
        } else {
          totalCobros += montoImputado;
        }
      }
    });

    const movimientoNeto = totalCobros - totalPagos;

    // Box de totales
    doc.rect(350, y, 200, 90).stroke();

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Total Ingresos:', 360, y + 10)
      .text(`$${this.formatCurrency(totalCobros)}`, 450, y + 10, {
        align: 'right',
        width: 90,
      });

    doc
      .text('Total Egresos:', 360, y + 30)
      .text(`$${this.formatCurrency(totalPagos)}`, 450, y + 30, {
        align: 'right',
        width: 90,
      });

    doc
      .moveTo(360, y + 50)
      .lineTo(540, y + 50)
      .stroke();

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('TOTAL NETO:', 360, y + 60)
      .text(`$${this.formatCurrency(Math.abs(movimientoNeto))}`, 450, y + 60, {
        align: 'right',
        width: 90,
      });
  }

  /**
   * Dibuja las observaciones
   */
  private drawObservations(
    doc: PDFKit.PDFDocument,
    observaciones: string,
  ): void {
    const y = doc.y + 30;

    doc.fontSize(10).font('Helvetica-Bold').text('OBSERVACIONES:', 50, y);

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(observaciones, 50, y + 15, { width: 500 });
  }

  /**
   * Dibuja las firmas
   */
  private drawSignatures(doc: PDFKit.PDFDocument): void {
    const y = 700;

    // Firma emisor
    doc.moveTo(80, y).lineTo(220, y).stroke();
    doc
      .fontSize(9)
      .font('Helvetica')
      .text('Firma del Emisor', 80, y + 10, { width: 140, align: 'center' });

    // Firma receptor
    doc.moveTo(360, y).lineTo(500, y).stroke();
    doc
      .fontSize(9)
      .font('Helvetica')
      .text('Firma del Receptor', 360, y + 10, { width: 140, align: 'center' });
  }

  /**
   * Formatea el método de pago
   */
  private formatPaymentMethod(method: string): string {
    const methods: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia Bancaria',
      cheque: 'Cheque',
      tarjeta: 'Tarjeta',
    };
    return methods[method.toLowerCase()] || method;
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
   * Elimina un archivo PDF
   */
  async deletePDF(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
