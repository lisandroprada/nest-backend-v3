import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Receipt } from './entities/receipt.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { SequenceService } from '../sequence/sequence.service';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { FiscalDocumentsService } from '../fiscal/fiscal-documents.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectModel(Receipt.name) private readonly receiptModel: Model<Receipt>,
    private readonly sequenceService: SequenceService,
    private readonly accountingEntriesService: AccountingEntriesService,
    private readonly financialAccountsService: FinancialAccountsService,
    @Inject(forwardRef(() => TransactionsService))
    private readonly transactionsService: TransactionsService,
    private readonly fiscalDocumentsService: FiscalDocumentsService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
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

      let montoTotalImputado = 0;
      const asientosAfectados: Types.ObjectId[] = [];
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

        // Imputar pago al asiento (parcial o completo)
        if (imputacion.montoImputado < asiento.monto_actual) {
          await this.accountingEntriesService.registrarPagoParcial(
            asiento._id.toString(),
            {
              monto_pagado: imputacion.montoImputado,
              fecha_pago: new Date().toISOString(),
              metodo_pago: dto.metodo_pago,
              comprobante: numero_recibo.toString(),
              usuario_id: userId,
              observaciones: dto.observaciones,
            },
          );
        } else {
          await this.accountingEntriesService.marcarComoPagado(
            asiento._id.toString(),
            {
              monto_pagado: imputacion.montoImputado,
              fecha_pago: new Date().toISOString(),
              metodo_pago: dto.metodo_pago,
              comprobante: numero_recibo.toString(),
              usuario_id: userId,
              observaciones: dto.observaciones,
            },
          );
        }
        montoTotalImputado += imputacion.montoImputado;
        asientosAfectados.push(asiento._id as Types.ObjectId);
      }

      if (montoTotalImputado !== dto.monto_total) {
        throw new BadRequestException(
          'El monto total del recibo no coincide con la suma de los montos imputados.',
        );
      }

      // 3. Crear el documento de recibo
      const newReceipt = new this.receiptModel({
        numero_recibo,
        fecha_emision: new Date(),
        monto_total: dto.monto_total,
        metodo_pago: dto.metodo_pago,
        comprobante_externo: dto.comprobante_externo,
        cuenta_financiera_id: new Types.ObjectId(dto.cuenta_financiera_id),
        agente_id: new Types.ObjectId(dto.agente_id),
        asientos_afectados_ids: asientosAfectados,
        usuario_emisor_id: new Types.ObjectId(userId),
        observaciones: dto.observaciones,
        contrato_id: dto.contrato_id
          ? new Types.ObjectId(dto.contrato_id)
          : undefined,
      });
      await newReceipt.save({ session });

      // 4. Registrar Transacción Financiera
      await this.transactionsService.create(
        {
          referencia_asiento: asientosAfectados[0].toString(), // Convert ObjectId to string
          monto: dto.monto_total,
          cuenta_financiera_id: dto.cuenta_financiera_id,
          tipo: 'INGRESO',
          descripcion: `Cobro según recibo #${numero_recibo}`,
          referencia_bancaria: dto.comprobante_externo,
          receipt_id: newReceipt._id.toString(), // Vincular la transacción al recibo
        },
        userId,
        session,
      ); // Pasar la sesión

      // 5. Actualizar Saldo de Cuenta Financiera
      await this.financialAccountsService.updateBalance(
        dto.cuenta_financiera_id,
        dto.monto_total,
        'INGRESO',
        session,
      );

      // 6. Generación de Factura Fiscal (Condicional)
      if (dto.emitir_factura && asientosFacturablesIds.length > 0) {
        const fiscalDocument = await this.fiscalDocumentsService.issueInvoice(
          {
            asientos_asociados_ids: asientosFacturablesIds,
          },
          userId,
          session,
        );
        newReceipt.fiscal_document_id = fiscalDocument._id as Types.ObjectId;
        await newReceipt.save({ session });
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
    return receipt;
  }
}
