import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Receipt } from './entities/receipt.entity';
import { CreateReceiptDto, TipoFlujoNeto } from './dto/create-receipt.dto';
import { SequenceService } from '../sequence/sequence.service';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { FiscalDocumentsService } from '../fiscal/fiscal-documents.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { AgentsService } from '../agents/agents.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { EmailService } from './services/email.service';
import { WhatsAppService } from './services/whatsapp.service';
import { PaginationService } from '../../common/pagination/pagination.service';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    @InjectModel(Receipt.name) private readonly receiptModel: Model<Receipt>,
    private readonly sequenceService: SequenceService,
    private readonly accountingEntriesService: AccountingEntriesService,
    private readonly financialAccountsService: FinancialAccountsService,
    @Inject(forwardRef(() => TransactionsService))
    private readonly transactionsService: TransactionsService,
    private readonly fiscalDocumentsService: FiscalDocumentsService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly agentsService: AgentsService,
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly paginationService: PaginationService,
  ) {}

  async createReceipt(dto: CreateReceiptDto, userId: string): Promise<Receipt> {
    const session = await this.receiptModel.db.startSession();
    session.startTransaction();

    try {
      // 1. Generar número de recibo
      const numero_recibo =
        await this.sequenceService.generateReceiptNumber('receipt');

      // 2. Validar y procesar asientos a imputar
      const asientosIds = dto.asientos_a_imputar.map((a) => a.asientoId);
      const asientos = await this.accountingEntriesService.find({
        _id: { $in: asientosIds },
      });

      if (asientos.length !== asientosIds.length) {
        throw new NotFoundException(
          'Uno o más asientos contables no encontrados.',
        );
      }

      let montoTotalImputadoCalculado = 0;
      let montoCobrosTotal = 0; // Total de COBROS (DEBE cobrado)
      let montoPagosTotal = 0; // Total de PAGOS (HABER liquidado)
      const asientosAfectados: Types.ObjectId[] = [];
      const asientosAfectadosDetalle: Array<{
        asiento_id: Types.ObjectId;
        monto_imputado: number;
        tipo_operacion?: 'COBRO' | 'PAGO'; // Guardar qué operación se hizo
      }> = [];
      const asientosFacturablesIds: string[] = [];

      for (const imputacion of dto.asientos_a_imputar) {
        const asiento = asientos.find(
          (a) => a._id.toString() === imputacion.asientoId,
        );
        if (!asiento) continue; // Ya validado arriba, pero por seguridad

        // Determinar si el asiento o sus partidas son facturables
        const partidasFacturables = asiento.partidas.filter(
          (p) => p.es_iva_incluido === false && p.debe > 0,
        );
        if (partidasFacturables.length > 0) {
          // Obtener las cuentas de las partidas para verificar si son facturables
          const cuentaIds = partidasFacturables.map((p) => p.cuenta_id);
          const cuentas = await this.chartOfAccountsService.find({
            _id: { $in: cuentaIds },
            es_facturable: true,
          });
          if (cuentas.length > 0) {
            asientosFacturablesIds.push(asiento._id.toString());
          }
        }

        // COMPROBANTES MIXTOS: Determinar automáticamente el tipo de operación
        // Si no se especifica tipoOperacion, inferir basándose en la estructura del asiento
        let tipoOperacion: 'COBRO' | 'PAGO' | undefined =
          imputacion.tipoOperacion;

        if (!tipoOperacion) {
          // LÓGICA AUTOMÁTICA: Detectar si es COBRO o PAGO según las partidas pendientes
          const totalDebe = asiento.partidas.reduce(
            (sum, p) => sum + p.debe,
            0,
          );
          const totalHaber = asiento.partidas.reduce(
            (sum, p) => sum + p.haber,
            0,
          );
          const debePagado = asiento.partidas
            .filter((p) => p.debe > 0)
            .reduce((sum, p) => sum + (p.monto_pagado_acumulado || 0), 0);
          const haberLiquidado = asiento.partidas
            .filter((p) => p.haber > 0)
            .reduce((sum, p) => sum + (p.monto_liquidado || 0), 0);

          const debePendiente = totalDebe - debePagado;
          const haberPendiente = totalHaber - haberLiquidado;

          // REGLA: Si tiene DEBE pendiente, es un COBRO. Si tiene HABER pendiente, es un PAGO.
          if (debePendiente > 0) {
            tipoOperacion = 'COBRO';
          } else if (haberPendiente > 0) {
            tipoOperacion = 'PAGO';
          } else {
            throw new BadRequestException(
              `El asiento ${imputacion.asientoId} no tiene saldo pendiente para procesar`,
            );
          }
        }

        if (tipoOperacion === 'COBRO') {
          // COBRO: Registrar pago del locatario (actualiza partidas DEBE -> monto_pagado_acumulado)
          const paymentDto = {
            monto_pagado: imputacion.montoImputado,
            fecha_pago: new Date().toISOString(),
            metodo_pago: dto.metodo_pago,
            cuenta_financiera_id: dto.cuenta_afectada_id,
            comprobante: numero_recibo.toString(),
            usuario_id: userId,
            observaciones: dto.observaciones,
          };

          await this.accountingEntriesService.registerPayment(
            asiento._id.toString(),
            paymentDto,
          );

          montoCobrosTotal += imputacion.montoImputado;
        } else if (tipoOperacion === 'PAGO') {
          // PAGO: Liquidar al locador/inmobiliaria (actualiza partidas HABER -> monto_liquidado)
          // IMPORTANTE: agenteId es requerido para saber a quién liquidar
          const agenteId = imputacion.agenteId || dto.agente_id;
          if (!agenteId) {
            throw new BadRequestException(
              `El asiento ${imputacion.asientoId} con tipoOperacion=PAGO requiere agenteId`,
            );
          }

          const liquidacionDto = {
            agente_id: agenteId,
            cuenta_financiera_id: dto.cuenta_afectada_id,
            fecha_liquidacion: new Date().toISOString(),
            metodo_liquidacion: dto.metodo_pago,
            monto_a_liquidar: imputacion.montoImputado, // LIQUIDACIÓN PARCIAL
            comprobante: numero_recibo.toString(),
            observaciones: dto.observaciones,
            usuario_id: userId,
          };

          await this.accountingEntriesService.liquidarAPropietario(
            asiento._id.toString(),
            liquidacionDto,
          );

          montoPagosTotal += imputacion.montoImputado;
        }

        montoTotalImputadoCalculado += imputacion.montoImputado;
        asientosAfectados.push(asiento._id as Types.ObjectId);
        asientosAfectadosDetalle.push({
          asiento_id: asiento._id as Types.ObjectId,
          monto_imputado: imputacion.montoImputado,
          tipo_operacion: tipoOperacion, // Guardar COBRO o PAGO
        });
      }

      if (montoTotalImputadoCalculado !== dto.monto_total_imputado) {
        throw new BadRequestException(
          'El monto total imputado calculado no coincide con el monto_total_imputado enviado.',
        );
      }

      // CALCULAR FLUJO NETO: COBROS - PAGOS
      // Si COBROS > PAGOS → INGRESO (entra dinero)
      // Si PAGOS > COBROS → EGRESO (sale dinero)
      const montoNeto = montoCobrosTotal - montoPagosTotal;
      const tipoFlujoNetoCalculado: 'INGRESO' | 'EGRESO' =
        montoNeto >= 0 ? 'INGRESO' : 'EGRESO';
      const montoNetoAbsoluto = Math.abs(montoNeto);

      // Validar que el tipo_flujo_neto enviado coincida con el calculado (si se envió)
      if (
        dto.tipo_flujo_neto &&
        dto.tipo_flujo_neto !== tipoFlujoNetoCalculado
      ) {
        this.logger.warn(
          `⚠️ Tipo flujo neto enviado (${dto.tipo_flujo_neto}) no coincide con el calculado (${tipoFlujoNetoCalculado}). Se usará el calculado.`,
        );
      }

      this.logger.debug('💰 RESUMEN DEL RECIBO:');
      this.logger.debug(`   Cobros (DEBE): $${montoCobrosTotal}`);
      this.logger.debug(`   Pagos (HABER): $${montoPagosTotal}`);
      this.logger.debug(`   NETO: $${montoNeto} (${tipoFlujoNetoCalculado})`);

      // Manejo de Saldo a Favor (si aplica)
      let saldoAFavorEntryId: Types.ObjectId | undefined;
      if (dto.monto_recibido_fisico > dto.monto_total_imputado) {
        const saldoAFavor =
          dto.monto_recibido_fisico - dto.monto_total_imputado;
        // Buscar una cuenta contable para 'Saldo a Favor' o usar una por defecto
        const saldoAFavorAccount = (
          await this.chartOfAccountsService.find({
            codigo: 'CXP_LOC', // Temporal: Usar Cuentas por Pagar - Locadores. Se recomienda crear una cuenta específica para Saldo a Favor de Clientes.
          })
        )[0];

        if (!saldoAFavorAccount) {
          throw new BadRequestException(
            'No se encontró la cuenta contable para Saldo a Favor.',
          );
        }

        const saldoAFavorEntry = await this.accountingEntriesService.create({
          fecha_imputacion: new Date(),
          tipo_asiento: 'SALDO_A_FAVOR',
          descripcion: `Saldo a favor generado por recibo #${numero_recibo}`,
          monto_original: saldoAFavor,
          monto_actual: saldoAFavor,
          estado: 'PENDIENTE',
          contrato_id: dto.contrato_id
            ? new Types.ObjectId(dto.contrato_id)
            : undefined,
          partidas: [
            {
              cuenta_id: saldoAFavorAccount._id as Types.ObjectId,
              debe: 0,
              haber: saldoAFavor,
              descripcion: 'Saldo a favor',
              agente_id: new Types.ObjectId(dto.agente_id),
              es_iva_incluido: false,
              tasa_iva_aplicada: 0,
              monto_base_imponible: 0,
              monto_iva_calculado: 0,
            },
          ],
          historial_cambios: [
            {
              fecha: new Date(),
              usuario_id: new Types.ObjectId(userId),
              accion: 'CREACION',
              estado_nuevo: 'PENDIENTE',
              monto: saldoAFavor,
              observaciones: 'Asiento de saldo a favor creado',
            },
          ],
        });
        saldoAFavorEntryId = saldoAFavorEntry._id as Types.ObjectId;
      }

      // 3. Crear el documento de recibo
      const newReceipt = new this.receiptModel({
        numero_recibo,
        fecha_emision: new Date(),
        monto_total: montoNetoAbsoluto, // Monto NETO absoluto
        metodo_pago: dto.metodo_pago,
        comprobante_externo: dto.comprobante_externo,
        tipo_flujo_neto: tipoFlujoNetoCalculado, // Calculado automáticamente
        cuenta_financiera_id: new Types.ObjectId(dto.cuenta_afectada_id),
        agente_id: new Types.ObjectId(dto.agente_id),
        asientos_afectados_ids: asientosAfectados, // Legacy
        asientos_afectados: asientosAfectadosDetalle, // Nuevo campo con detalle
        usuario_emisor_id: new Types.ObjectId(userId),
        observaciones: dto.observaciones,
        contrato_id: dto.contrato_id
          ? new Types.ObjectId(dto.contrato_id)
          : undefined,
        fiscal_document_id: undefined, // Se asignará si se emite factura
        saldo_a_favor_entry_id: saldoAFavorEntryId, // Vincular el asiento de saldo a favor
      });
      await newReceipt.save({ session });

      // 4. Registrar Transacción Financiera
      let transactionDescription = `Cobro según recibo #${numero_recibo}`;
      let transactionAmount = montoNetoAbsoluto; // Usar el monto neto
      const financialAccountToUpdate = dto.cuenta_afectada_id;

      if (tipoFlujoNetoCalculado === TipoFlujoNeto.EGRESO) {
        // Para egresos, el monto de la transacción es el monto neto (pagos - cobros)
        // La cuenta afectada es la cuenta de la inmobiliaria que EMITE el pago.
        // Necesitamos la cuenta bancaria del agente para la descripción o referencia.
        const agent = await this.agentsService.findOne(dto.agente_id);
        if (
          !agent ||
          !agent.cuentas_bancarias ||
          agent.cuentas_bancarias.length === 0
        ) {
          throw new BadRequestException(
            'Agente no tiene cuentas bancarias registradas para un egreso.',
          );
        }
        // Asumimos que tomamos la primera cuenta bancaria del agente para la referencia
        const agentBankAccount = agent.cuentas_bancarias[0];
        transactionDescription = `Liquidación a agente #${dto.agente_id} según recibo #${numero_recibo}. CBU: ${agentBankAccount.cbu_numero}`;
        transactionAmount = montoNetoAbsoluto; // El monto neto a egresar
      }

      await this.transactionsService.create(
        {
          referencia_asiento: asientosAfectados[0].toString(),
          monto: transactionAmount,
          cuenta_financiera_id: financialAccountToUpdate,
          tipo:
            tipoFlujoNetoCalculado === TipoFlujoNeto.INGRESO
              ? 'INGRESO'
              : 'EGRESO',
          descripcion: transactionDescription,
          referencia_bancaria: dto.comprobante_externo,
          receipt_id: newReceipt._id.toString(),
        },
        userId,
        session,
      );

      // 5. Actualizar Saldo de Cuenta Financiera
      // NOTA: El saldo ya fue actualizado por registerPayment() para cada asiento imputado
      // No es necesario actualizar nuevamente aquí para evitar duplicación
      // El registerPayment() ya llamó a updateBalance() con el monto correcto

      // 6. Generación de Factura Fiscal (Condicional)
      if (dto.emitir_factura && asientosFacturablesIds.length > 0) {
        // En lugar de emitir directamente, marcamos los asientos para facturación
        await this.fiscalDocumentsService.queueInvoiceGeneration(
          asientosFacturablesIds,
          userId,
          session,
        );
        // Opcionalmente, podrías guardar una referencia a la tarea de facturación en el recibo
      }

      await session.commitTransaction();
      return newReceipt;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  }

  async findOne(id: string): Promise<Receipt> {
    const receipt = await this.receiptModel.findById(id);
    if (!receipt) {
      throw new NotFoundException(`Recibo con ID "${id}" no encontrado.`);
    }

    // Convertir a objeto plano para que los subdocumentos se lean correctamente
    const receiptObj = receipt.toObject();
    return receiptObj as Receipt;
  }

  /**
   * Genera un PDF del recibo
   */
  async generatePDF(
    receiptId: string,
  ): Promise<{ pdfPath: string; pdfUrl: string }> {
    const receipt = await this.findOne(receiptId);

    // Generar el PDF
    const pdfPath = await this.pdfGeneratorService.generateReceiptPDF(receipt);

    // Generar URL pública (puede ser una URL del servidor o S3, etc.)
    const pdfUrl = `/uploads/receipts/${pdfPath.split('/').pop()}`;

    // Actualizar el recibo con la información del PDF
    await this.receiptModel.findByIdAndUpdate(receiptId, {
      pdf_path: pdfPath,
      pdf_url: pdfUrl,
    });

    return { pdfPath, pdfUrl };
  }

  /**
   * Envía un recibo por email
   */
  async sendEmail(
    receiptId: string,
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    const receipt = await this.findOne(receiptId);
    const agente = await this.agentsService.findOne(
      receipt.agente_id.toString(),
    );

    // Generar PDF si no existe
    let pdfPath = receipt.pdf_path;
    if (!pdfPath) {
      const result = await this.generatePDF(receiptId);
      pdfPath = result.pdfPath;
    }

    // Enviar email
    await this.emailService.sendReceiptEmail(
      email,
      receipt.numero_recibo,
      pdfPath,
      agente.nombres || agente.nombre_razon_social || 'Cliente',
      receipt.monto_total,
    );

    return {
      success: true,
      message: `Email enviado exitosamente a ${email}`,
    };
  }

  /**
   * Envía un recibo por WhatsApp
   */
  async sendWhatsApp(
    receiptId: string,
    phoneNumber: string,
  ): Promise<{ success: boolean; message: string }> {
    const receipt = await this.findOne(receiptId);
    const agente = await this.agentsService.findOne(
      receipt.agente_id.toString(),
    );

    // Verificar configuración de WhatsApp
    if (!this.whatsappService.isConfigured()) {
      throw new BadRequestException(
        'WhatsApp no está configurado. Configure las variables de entorno necesarias.',
      );
    }

    // Generar PDF si no existe
    let pdfPath = receipt.pdf_path;
    if (!pdfPath) {
      const result = await this.generatePDF(receiptId);
      pdfPath = result.pdfPath;
    }

    // Enviar WhatsApp
    await this.whatsappService.sendReceiptWhatsApp(
      phoneNumber,
      receipt.numero_recibo,
      pdfPath,
      agente.nombres || agente.nombre_razon_social || 'Cliente',
      receipt.monto_total,
    );

    return {
      success: true,
      message: `WhatsApp enviado exitosamente a ${phoneNumber}`,
    };
  }

  /**
   * Obtiene la URL pública del PDF del recibo
   */
  async getPdfUrl(receiptId: string): Promise<{ pdfUrl: string }> {
    const receipt = await this.findOne(receiptId);

    // Si no existe el PDF, generarlo
    if (!receipt.pdf_url) {
      const result = await this.generatePDF(receiptId);
      return { pdfUrl: result.pdfUrl };
    }

    return { pdfUrl: receipt.pdf_url };
  }

  /**
   * Lista paginada de recibos asociados a un agente con filtros opcionales
   */
  async findByAgent(agentId: string, filters: any) {
    // Map homogeneously to PaginationDto semantics (page is 0-based, pageSize)
    const {
      tipo_flujo_neto,
      fecha_from,
      fecha_to,
      order = 'desc',
      page = 0,
      pageSize = 10,
    } = filters;

    const baseFilter: any = { agente_id: new Types.ObjectId(agentId) };
    if (tipo_flujo_neto) baseFilter.tipo_flujo_neto = tipo_flujo_neto;
    if (fecha_from || fecha_to) {
      baseFilter.fecha_emision = {};
      if (fecha_from) baseFilter.fecha_emision.$gte = new Date(fecha_from);
      if (fecha_to) {
        const toDate = new Date(fecha_to);
        toDate.setHours(23, 59, 59, 999);
        baseFilter.fecha_emision.$lte = toDate;
      }
    }

    // Build a PaginationDto-like object
    const paginationDto = {
      page,
      pageSize,
      sort: order === 'asc' ? 'fecha_emision' : '-fecha_emision',
    } as any;

    const paginated = await this.paginationService.paginate(
      this.receiptModel,
      paginationDto,
      baseFilter,
    );

    // Adapt response to homogeneous format used elsewhere
    return {
      totalItems: paginated.totalItems,
      totalPages: paginated.totalPages,
      page,
      pageSize,
      items: paginated.items,
    };
  }
}
