import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { AccountingEntryBuilder } from '../builders/accounting-entry.builder';
import { ChartOfAccountsService } from '../../chart-of-accounts/chart-of-accounts.service';
import { CreateAccountingEntryDto } from '../dto/create-accounting-entry.dto';

export interface MonthlyRentEntryParams {
  propertyAddress: string;
  period: DateTime;
  periodNumber: number;
  totalPeriods: number;
  amount: number;
  commissionRate: number;
  tenantId: Types.ObjectId;
  tenantName: string;
  landlordId: Types.ObjectId;
  landlordName: string;
  inmobiliariaId?: Types.ObjectId;
  state?: string;
  isAdjustable?: boolean;
}

export interface DepositEntryParams {
  propertyAddress: string;
  amount: number;
  date: Date;
  tenantId?: Types.ObjectId;
  landlordId?: Types.ObjectId;
  entryType: 'COBRO' | 'DEVOLUCION';
}

export interface HonorariosEntryParams {
  propertyAddress: string;
  totalContractAmount: number;
  percentage: number;
  installments: number;
  installmentNumber: number;
  startDate: DateTime;
  agentId: Types.ObjectId;
  agentName: string;
  agentType: 'LOCADOR' | 'LOCATARIO';
  inmobiliariaId?: Types.ObjectId;
}

/**
 * Factory centralizado para la creación de asientos contables.
 * Encapsula la lógica de negocio y el conocimiento del Plan de Cuentas.
 */
@Injectable()
export class AccountingEntryFactory {
  private accountsCache: Record<string, Types.ObjectId> = {};

  constructor(
    private readonly builder: AccountingEntryBuilder,
    private readonly chartOfAccountsService: ChartOfAccountsService,
  ) {}

  /**
   * Crea un asiento contable para un alquiler mensual.
   * 
   * Estructura:
   * - DEBE [CXC_ALQ]: Cargo al Locatario por el monto total
   * - HABER [CXP_LOC]: Crédito al Locador por el monto neto (total - comisión)
   * - HABER [ING_HNR]: Ingreso por honorarios de administración
   */
  async createMonthlyRentEntry(
    params: MonthlyRentEntryParams,
  ): Promise<CreateAccountingEntryDto> {
    const {
      propertyAddress,
      period,
      periodNumber,
      totalPeriods,
      amount,
      commissionRate,
      tenantId,
      tenantName,
      landlordId,
      landlordName,
      inmobiliariaId,
      state = 'PENDIENTE',
      isAdjustable = false,
    } = params;

    const commission = amount * commissionRate;
    const netToLandlord = amount - commission;

    const periodStr = period.toFormat('MM/yyyy');
    const vencimiento = period.plus({ days: 10 }).toJSDate();

    return this.builder
      .reset()
      .setType('Alquiler')
      .setDescription(`Alquiler ${periodStr} - Período ${periodNumber} de ${totalPeriods} - ${propertyAddress}`)
      .setDates(period.toJSDate(), vencimiento)
      .setState(state)
      .setAdjustable(isAdjustable)
      .addDebit(
        await this.getAccountByCode('CXC_ALQ'),
        amount,
        tenantId,
        `Alquiler ${periodStr} - Período ${periodNumber} de ${totalPeriods} - ${propertyAddress}`,
      )
      .addCredit(
        await this.getAccountByCode('CXP_LOC'),
        netToLandlord,
        landlordId,
        `Crédito por alquiler ${periodStr} - Período ${periodNumber} de ${totalPeriods} - ${propertyAddress}`,
      )
      .addCredit(
        await this.getAccountByCode('ING_HNR'),
        commission,
        inmobiliariaId,
        `Honorarios por alquiler ${periodStr} - Período ${periodNumber} de ${totalPeriods} - ${propertyAddress}`,
      )
      .addMetadata('propertyAddress', propertyAddress)
      .addMetadata('locadorName', landlordName)
      .addMetadata('locatarioName', tenantName)
      .addMetadata('periodo', periodStr)
      .addMetadata('periodoNumero', periodNumber)
      .addMetadata('periodoTotal', totalPeriods)
      .build();
  }

  /**
   * Crea un asiento contable para depósito en garantía.
   * 
   * Dos tipos:
   * 1. COBRO: Cargo al Locatario + Ingreso a Caja Fiduciaria
   * 2. DEVOLUCION: Egreso de Caja + Pasivo a Locador
   */
  async createDepositEntry(
    params: DepositEntryParams,
  ): Promise<CreateAccountingEntryDto> {
    const { propertyAddress, amount, date, tenantId, landlordId, entryType } =
      params;

    if (entryType === 'COBRO') {
      return this.builder
        .reset()
        .setType('Deposito en Garantia - Cobro')
        .setDescription(
          `Cobro de depósito en garantía al locatario - ${propertyAddress}`,
        )
        .setDates(date, date)
        .setState('PENDIENTE')
        .addDebit(
          await this.getAccountByCode('CXC_ALQ'),
          amount,
          tenantId,
          `Depósito en garantía a cobrar al locatario - ${propertyAddress}`,
        )
        .addCredit(
          await this.getAccountByCode('ACT_FID'),
          amount,
          undefined,
          `Ingreso de depósito en garantía a caja/banco fiduciaria - ${propertyAddress}`,
        )
        .addMetadata('propertyAddress', propertyAddress)
        .build();
    } else {
      // DEVOLUCION
      return this.builder
        .reset()
        .setType('Deposito en Garantia - Devolucion')
        .setDescription(
          `Devolución de depósito en garantía al locador - ${propertyAddress}`,
        )
        .setDates(date, date)
        .setState('PENDIENTE')
        .addDebit(
          await this.getAccountByCode('ACT_FID'),
          amount,
          undefined,
          `Egreso de depósito en garantía desde caja/banco - ${propertyAddress}`,
        )
        .addCredit(
          await this.getAccountByCode('PAS_DEP'),
          amount,
          landlordId,
          `Depósito en garantía a devolver al locador - ${propertyAddress}`,
        )
        .addMetadata('propertyAddress', propertyAddress)
        .build();
    }
  }

  /**
   * Crea un asiento contable para honorarios (Locador o Locatario).
   * 
   * Estructura:
   * - DEBE: Descuento de la cuenta del agente (CXP_LOC o CXC_ALQ)
   * - HABER: Ingreso por honorarios iniciales (ING_HNR_INIC)
   */
  async createHonorariosEntry(
    params: HonorariosEntryParams,
  ): Promise<CreateAccountingEntryDto> {
    const {
      propertyAddress,
      totalContractAmount,
      percentage,
      installments,
      installmentNumber,
      startDate,
      agentId,
      agentName,
      agentType,
      inmobiliariaId,
    } = params;

    const totalHonorarios = totalContractAmount * (percentage / 100);
    const amountPerInstallment = totalHonorarios / installments;

    const vencimiento = startDate
      .plus({ months: installmentNumber - 1, days: 10 })
      .toJSDate();
    const imputacion = startDate
      .plus({ months: installmentNumber - 1 })
      .toJSDate();

    const cuotaStr = `${installmentNumber}/${installments}`;
    const tipoAsiento =
      agentType === 'LOCADOR' ? 'Honorarios Locador' : 'Honorarios Locatario';
    const cuentaDebit =
      agentType === 'LOCADOR'
        ? await this.getAccountByCode('CXP_LOC')
        : await this.getAccountByCode('CXC_ALQ');

    return this.builder
      .reset()
      .setType(tipoAsiento)
      .setDescription(
        `Honorarios ${agentType.toLowerCase()} - Cuota ${cuotaStr} - ${propertyAddress}`,
      )
      .setDates(imputacion, vencimiento)
      .setState('PENDIENTE')
      .addDebit(
        cuentaDebit,
        amountPerInstallment,
        agentId,
        `${agentType === 'LOCADOR' ? 'Descuento' : 'Cargo'} honorarios ${agentType.toLowerCase()} - Cuota ${installmentNumber} - ${propertyAddress}`,
      )
      .addCredit(
        await this.getAccountByCode('ING_HNR_INIC'),
        amountPerInstallment,
        inmobiliariaId,
        `Ingreso honorarios ${agentType.toLowerCase()} - Cuota ${installmentNumber} - ${propertyAddress}`,
      )
      .addMetadata('propertyAddress', propertyAddress)
      .addMetadata(`${agentType.toLowerCase()}Name`, agentName)
      .addMetadata('cuota', cuotaStr)
      .build();
  }

  /**
   * Obtiene el ID de una cuenta contable por su código.
   * Implementa caché para evitar consultas repetidas.
   */
  private async getAccountByCode(code: string): Promise<Types.ObjectId> {
    if (this.accountsCache[code]) {
      return this.accountsCache[code];
    }

    const accountsMap = await this.chartOfAccountsService.getAccountIdsByCode([
      code,
    ]);
    const accountId = accountsMap[code];

    if (!accountId) {
      throw new Error(`No se encontró la cuenta contable con código: ${code}`);
    }

    this.accountsCache[code] = accountId;
    return accountId;
  }

  /**
   * Limpia el caché de cuentas (útil en tests o cambios de configuración).
   */
  clearCache(): void {
    this.accountsCache = {};
  }
}
