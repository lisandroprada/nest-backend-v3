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
import { CreateReceiptDto, TipoFlujoNeto } from './dto/create-receipt.dto';
import { SequenceService } from '../sequence/sequence.service';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { FiscalDocumentsService } from '../fiscal/fiscal-documents.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { AgentsService } from '../agents/agents.service'; // Import AgentsService

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
    private readonly agentsService: AgentsService, // Inject AgentsService
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

        const paymentDto = {
          monto_pagado: imputacion.montoImputado,
          fecha_pago: new Date().toISOString(),
          metodo_pago: dto.metodo_pago,
          comprobante: numero_recibo.toString(),
          usuario_id: userId,
          observaciones: dto.observaciones,
        };

        await this.accountingEntriesService.registerPayment(
          asiento._id.toString(),
          paymentDto,
        );
        montoTotalImputadoCalculado += imputacion.montoImputado;
        asientosAfectados.push(asiento._id as Types.ObjectId);
      }

      if (montoTotalImputadoCalculado !== dto.monto_total_imputado) {
        throw new BadRequestException(
          'El monto total imputado calculado no coincide con el monto_total_imputado enviado.',
        );
      }

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
        monto_total: dto.monto_total_imputado,
        metodo_pago: dto.metodo_pago,
        comprobante_externo: dto.comprobante_externo,
        cuenta_financiera_id: new Types.ObjectId(dto.cuenta_afectada_id),
        agente_id: new Types.ObjectId(dto.agente_id),
        asientos_afectados_ids: asientosAfectados,
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
      let transactionAmount = dto.monto_total_imputado;
      const financialAccountToUpdate = dto.cuenta_afectada_id;

      if (dto.tipo_flujo_neto === TipoFlujoNeto.EGRESO) {
        // Para egresos, el monto de la transacción es el monto_total_imputado (que es el neto a pagar al agente)
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
        transactionDescription = `Pago a agente #${dto.agente_id} según recibo #${numero_recibo}. CBU: ${agentBankAccount.cbu_numero}`;
        transactionAmount = dto.monto_total_imputado; // El monto neto a egresar
      }

      await this.transactionsService.create(
        {
          referencia_asiento: asientosAfectados[0].toString(),
          monto: transactionAmount,
          cuenta_financiera_id: financialAccountToUpdate,
          tipo:
            dto.tipo_flujo_neto === TipoFlujoNeto.INGRESO
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
      await this.financialAccountsService.updateBalance(
        financialAccountToUpdate,
        transactionAmount,
        dto.tipo_flujo_neto === TipoFlujoNeto.INGRESO ? 'INGRESO' : 'EGRESO',
        session,
      );

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
    return receipt;
  }
}
