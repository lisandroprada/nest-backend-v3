import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contract } from './entities/contract.entity';
import { AccountingEntry } from '../accounting-entries/entities/accounting-entry.entity';
import { Property } from '../properties/entities/property.entity';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { IndexValueService } from '../external-apis/index-value/index-value.service';
import { DateTime } from 'luxon';
import { AgenteRoles } from '../agents/constants/agent-roles.enum';

export interface MigrationResult {
  success: boolean;
  contractId: string;
  error?: string;
  asientosGenerados?: number;
  montoTotal?: number;
}

export interface MigrationSummary {
  totalContracts: number;
  successCount: number;
  failureCount: number;
  totalAmount: number;
  results: MigrationResult[];
  executionTime: number;
}

interface AdjustmentPeriod {
  start: DateTime;
  end: DateTime;
  adjustmentDate: DateTime;
  months: number;
}

@Injectable()
export class ContractsMigrationService {
  private readonly logger = new Logger(ContractsMigrationService.name);
  private accountIdsCache: Record<string, Types.ObjectId>;

  private readonly REQUIRED_ACCOUNTS = [
    'CXC_ALQ', // Cuenta por Cobrar - Alquileres
    'CXP_LOC', // Cuenta por Pagar - Locador
    'ING_HNR', // Ingresos - Honorarios
    'PAS_DEP', // Pasivo - Depósitos en Garantía (antes PASIVO_DEPOSITO)
    'ACT_FID', // Activo - Fondos de Terceros (antes ACTIVO_FIDUCIARIO)
  ];

  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<Contract>,
    @InjectModel(AccountingEntry.name)
    private readonly accountingEntryModel: Model<AccountingEntry>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<Property>,
    private readonly accountingEntriesService: AccountingEntriesService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly indexValueService: IndexValueService,
  ) {}

  /**
   * Redondea un monto a 2 decimales (estándar contable argentino)
   */
  private roundToTwoDecimals(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Genera asientos contables para contratos migrados
   * Estrategia: Asiento de apertura + Proyección futura
   */
  async generateAccountingEntriesForMigratedContracts(
    userId: string,
    options: {
      contractIds?: string[];
      dryRun?: boolean;
      strategy?: 'OPENING_BALANCE' | 'FULL_HISTORY';
      deleteExisting?: boolean; // Si true, elimina asientos existentes antes de regenerar
    } = {},
  ): Promise<MigrationSummary> {
    const startTime = Date.now();
    const {
      contractIds,
      dryRun = false,
      strategy = 'FULL_HISTORY', // ✅ CAMBIO: Ahora por defecto genera historial completo
      deleteExisting = false,
    } = options;

    this.logger.log(`🔍 DEBUG - options recibido:`, JSON.stringify(options));
    this.logger.log(
      `🔍 DEBUG - deleteExisting después de destructuring: ${deleteExisting}`,
    );

    this.logger.log(
      `Iniciando migración de asientos. Estrategia: ${strategy}, DryRun: ${dryRun}, DeleteExisting: ${deleteExisting}`,
    );

    // Cargar IDs de cuentas contables
    await this.loadAccountIds();

    // Obtener contratos a procesar
    const contracts = await this.getContractsToMigrate(contractIds);
    this.logger.log(`Contratos a procesar: ${contracts.length}`);

    const results: MigrationResult[] = [];
    let totalAmount = 0;

    for (const contract of contracts) {
      try {
        const result = await this.processContract(
          contract,
          userId,
          dryRun,
          strategy,
          deleteExisting,
        );
        results.push(result);

        if (result.success) {
          totalAmount += result.montoTotal || 0;
        }
      } catch (error) {
        this.logger.error(
          `Error procesando contrato ${contract._id}: ${error.message}`,
        );
        results.push({
          success: false,
          contractId: contract._id.toString(),
          error: error.message,
        });
      }
    }

    const executionTime = Date.now() - startTime;
    const summary: MigrationSummary = {
      totalContracts: contracts.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      totalAmount,
      results,
      executionTime,
    };

    this.logger.log(`Migración completada en ${executionTime}ms`);
    this.logger.log(
      `Éxitos: ${summary.successCount}, Fallos: ${summary.failureCount}`,
    );

    return summary;
  }

  /**
   * Procesa un contrato individual
   */
  private async processContract(
    contract: Contract,
    userId: string,
    dryRun: boolean,
    strategy: 'OPENING_BALANCE' | 'FULL_HISTORY',
    deleteExisting: boolean = false,
  ): Promise<MigrationResult> {
    this.logger.debug(`Procesando contrato ${contract._id}`);
    this.logger.log(
      `🔍 DEBUG processContract - deleteExisting recibido: ${deleteExisting}`,
    );

    // Verificar si tiene asientos previos
    const existingEntriesCount = await this.accountingEntryModel.countDocuments(
      {
        contrato_id: contract._id,
      },
    );

    this.logger.log(
      `🔍 DEBUG - Contrato ${contract._id}: ${existingEntriesCount} asientos existentes, deleteExisting=${deleteExisting}`,
    );

    if (existingEntriesCount > 0) {
      if (deleteExisting) {
        // Eliminar asientos existentes
        this.logger.warn(
          `Eliminando ${existingEntriesCount} asientos existentes del contrato ${contract._id}`,
        );

        if (!dryRun) {
          await this.accountingEntryModel.deleteMany({
            contrato_id: contract._id,
          });
        }
      } else {
        // Si no se permite eliminar, lanzar error
        throw new BadRequestException(
          `El contrato ${contract._id} ya tiene asientos contables generados`,
        );
      }
    }

    let asientosGenerados = 0;
    let montoTotal = 0;

    if (strategy === 'OPENING_BALANCE') {
      // Estrategia recomendada: Asiento de apertura + proyección futura
      const openingBalance = await this.generateOpeningBalanceEntry(
        contract,
        userId,
        dryRun,
      );
      asientosGenerados++;
      montoTotal = this.roundToTwoDecimals(openingBalance.montoDevengado);

      // Generar asientos futuros desde hoy
      const futureEntries = await this.generateFutureEntries(
        contract,
        userId,
        dryRun,
      );
      asientosGenerados += futureEntries.count;
      montoTotal = this.roundToTwoDecimals(montoTotal + futureEntries.total);
    } else {
      // Estrategia alternativa: Historial completo
      const historicalEntries = await this.generateFullHistoricalEntries(
        contract,
        userId,
        dryRun,
      );
      asientosGenerados = historicalEntries.count;
      montoTotal = this.roundToTwoDecimals(historicalEntries.total);
    }

    // Generar asiento de depósito si corresponde
    if (contract.deposito_monto && contract.deposito_monto > 0) {
      await this.generateDepositEntry(contract, userId, dryRun);
      asientosGenerados++;
    }

    return {
      success: true,
      contractId: contract._id.toString(),
      asientosGenerados,
      montoTotal: this.roundToTwoDecimals(montoTotal),
    };
  }

  /**
   * Genera el asiento de apertura con el saldo devengado hasta hoy
   */
  private async generateOpeningBalanceEntry(
    contract: Contract,
    userId: string,
    dryRun: boolean,
  ): Promise<{ montoDevengado: number }> {
    this.logger.debug(
      `Generando asiento de apertura para contrato ${contract._id}`,
    );

    const { fecha_inicio, partes } = contract;
    const today = DateTime.now();
    const startDate = DateTime.fromJSDate(fecha_inicio);

    // Si el contrato inicia en el futuro, no hay devengamiento
    if (startDate > today) {
      this.logger.warn(
        `Contrato ${contract._id} inicia en el futuro. No se genera asiento de apertura.`,
      );
      return { montoDevengado: 0 };
    }

    // Calcular monto devengado con ajustes por índice
    const accruedAmount = await this.calculateAccruedAmount(
      contract,
      startDate,
      today,
    );

    if (accruedAmount === 0) {
      return { montoDevengado: 0 };
    }

    const locador = partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = partes.find((p) => p.rol === AgenteRoles.LOCATARIO);

    if (!locador || !locatario) {
      throw new BadRequestException(
        `Contrato ${contract._id} no tiene locador o locatario definido`,
      );
    }

    // Obtener comisión real del contrato (no usar valor hardcodeado)
    const comisionPorcentaje =
      contract.terminos_financieros.comision_administracion_porcentaje / 100;

    // Calcular comisión y neto para locador con redondeo
    const comisionTotal = this.roundToTwoDecimals(
      accruedAmount * comisionPorcentaje,
    );
    const netoLocador = this.roundToTwoDecimals(accruedAmount - comisionTotal);

    const partidas = [
      {
        cuenta_id: this.accountIdsCache['CXC_ALQ'],
        descripcion: `Saldo apertura - Deuda acumulada (${startDate.toFormat('MM/yyyy')} - ${today.toFormat('MM/yyyy')})`,
        debe: this.roundToTwoDecimals(accruedAmount),
        haber: 0,
        agente_id: locatario.agente_id,
        monto_pagado_acumulado: 0,
      },
      {
        cuenta_id: this.accountIdsCache['CXP_LOC'],
        descripcion: `Saldo apertura - Crédito acumulado locador (neto ${100 - contract.terminos_financieros.comision_administracion_porcentaje}%)`,
        debe: 0,
        haber: netoLocador,
        agente_id: locador.agente_id,
      },
      {
        cuenta_id: this.accountIdsCache['ING_HNR'],
        descripcion: `Saldo apertura - Comisión acumulada (${contract.terminos_financieros.comision_administracion_porcentaje}%)`,
        debe: 0,
        haber: comisionTotal,
      },
    ];

    if (!dryRun) {
      const partidasFinal = partidas.map((p) => ({
        ...p,
        es_iva_incluido: false,
        tasa_iva_aplicada: 0,
        monto_base_imponible: 0,
        monto_iva_calculado: 0,
      }));
      const montoOriginal = partidasFinal.reduce(
        (sum, p) => sum + (p.debe || 0),
        0,
      );
      const montoActual = montoOriginal;
      await this.accountingEntriesService.create({
        contrato_id: contract._id as Types.ObjectId,
        tipo_asiento: 'SALDO_APERTURA_DEVENGADO',
        fecha_vencimiento: today.toJSDate(),
        fecha_imputacion: today.toJSDate(),
        descripcion: `Saldo de apertura - Alquileres devengados hasta ${today.toFormat('dd/MM/yyyy')}`,
        partidas: partidasFinal,
        monto_original: montoOriginal,
        monto_actual: montoActual,
        usuario_creacion_id: new Types.ObjectId(userId),
        usuario_modificacion_id: new Types.ObjectId(userId),
      });

      this.logger.debug(
        `Asiento de apertura creado. Monto: $${accruedAmount.toFixed(2)}`,
      );
    } else {
      this.logger.debug(
        `[DRY RUN] Asiento de apertura. Monto: $${accruedAmount.toFixed(2)}`,
      );
    }

    return { montoDevengado: this.roundToTwoDecimals(accruedAmount) };
  }

  /**
   * Calcula el monto devengado entre dos fechas aplicando ajustes por índice
   */
  private async calculateAccruedAmount(
    contract: Contract,
    startDate: DateTime,
    endDate: DateTime,
  ): Promise<number> {
    const { terminos_financieros, ajuste_programado } = contract;
    const { monto_base_vigente, indice_tipo } = terminos_financieros;

    // Si es tipo FIJO, no hay ajustes
    if (indice_tipo === 'FIJO') {
      const months = this.calculateMonthsBetween(startDate, endDate);
      return this.roundToTwoDecimals(monto_base_vigente * months);
    }

    // Para ICL o IPC: calcular por períodos de ajuste
    const adjustmentPeriods = this.getAdjustmentPeriods(
      startDate,
      endDate,
      DateTime.fromJSDate(ajuste_programado),
    );

    let totalAccrued = 0;
    let currentAmount = monto_base_vigente;

    for (let i = 0; i < adjustmentPeriods.length; i++) {
      const period = adjustmentPeriods[i];

      // Calcular devengamiento del período con redondeo
      totalAccrued += this.roundToTwoDecimals(currentAmount * period.months);

      // Aplicar ajuste para el próximo período (si no es el último)
      if (i < adjustmentPeriods.length - 1) {
        try {
          // Obtener ICL base (del inicio del contrato o ajuste anterior)
          const baseIndexValue = await this.getIndexValueForDate(
            indice_tipo,
            period.start.toJSDate(),
          );

          // Obtener ICL de la fecha de ajuste
          const adjustmentIndexValue = await this.getIndexValueForDate(
            indice_tipo,
            period.adjustmentDate.toJSDate(),
          );

          if (baseIndexValue && adjustmentIndexValue) {
            // CORRECCIÓN: El ajuste se calcula como proporción entre índices
            // nuevoMonto = montoActual * (ICL_ajuste / ICL_base)
            const adjustmentRatio = adjustmentIndexValue / baseIndexValue;
            const adjustmentPercentage = (adjustmentRatio - 1) * 100;

            currentAmount = this.roundToTwoDecimals(
              currentAmount * adjustmentRatio,
            );

            this.logger.debug(
              `Ajuste aplicado en ${period.adjustmentDate.toFormat('MM/yyyy')}: ${adjustmentPercentage.toFixed(2)}% (ICL ${baseIndexValue} → ${adjustmentIndexValue}). Nuevo monto: $${currentAmount.toFixed(2)}`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `No se pudo obtener índice ${indice_tipo} para ${period.adjustmentDate.toFormat('MM/yyyy')}: ${error.message}`,
          );
          // Continuar sin ajuste
        }
      }
    }

    return this.roundToTwoDecimals(totalAccrued);
  }

  /**
   * Obtiene el valor del índice para una fecha específica
   */
  private async getIndexValueForDate(
    indice_tipo: string,
    date: Date,
  ): Promise<number | null> {
    if (indice_tipo === 'ICL') {
      return await this.indexValueService.getLatestICLValueBeforeDate(date);
    } else if (indice_tipo === 'IPC') {
      return await this.indexValueService.getLatestIPCValueBeforeDate(date);
    }
    return null;
  }

  /**
   * Divide el período en intervalos de ajuste
   */
  private getAdjustmentPeriods(
    startDate: DateTime,
    endDate: DateTime,
    firstAdjustmentDate: DateTime,
  ): AdjustmentPeriod[] {
    const periods: AdjustmentPeriod[] = [];
    let currentStart = startDate;

    // Determinar el intervalo de ajuste (semestral, anual, etc.)
    // Asumimos ajuste semestral por defecto (6 meses)
    const adjustmentInterval = 6;

    let nextAdjustment = firstAdjustmentDate;

    while (currentStart < endDate) {
      const periodEnd = nextAdjustment < endDate ? nextAdjustment : endDate;
      const months = this.calculateMonthsBetween(currentStart, periodEnd);

      if (months > 0) {
        periods.push({
          start: currentStart,
          end: periodEnd,
          adjustmentDate: nextAdjustment,
          months,
        });
      }

      currentStart = nextAdjustment;
      nextAdjustment = nextAdjustment.plus({ months: adjustmentInterval });
    }

    return periods;
  }

  /**
   * Calcula los meses entre dos fechas
   */
  private calculateMonthsBetween(start: DateTime, end: DateTime): number {
    const diff = end.diff(start, 'months');
    return Math.floor(diff.months);
  }

  /**
   * Genera asientos futuros desde hoy hasta el fin del contrato o ajuste programado
   */
  private async generateFutureEntries(
    contract: Contract,
    userId: string,
    dryRun: boolean,
  ): Promise<{ count: number; total: number }> {
    this.logger.debug(
      `Generando asientos futuros para contrato ${contract._id}`,
    );

    const { terminos_financieros, fecha_final, partes } = contract;

    const today = DateTime.now();

    // SIEMPRE proyectar hasta fecha_final del contrato (ventana móvil completa)
    // Esto permite pagos adelantados y mantiene asientos disponibles
    const fechaFinProyeccion = DateTime.fromJSDate(fecha_final);

    // Si el contrato ya finalizó completamente, no hay períodos futuros
    if (today >= fechaFinProyeccion) {
      this.logger.warn(
        `Contrato ${contract._id} ya finalizó (fecha_final: ${fechaFinProyeccion.toFormat('MM/yyyy')})`,
      );
      return { count: 0, total: 0 };
    }

    let fechaActual = today.startOf('month').plus({ months: 1 }); // Primer día del próximo mes
    const montoVigente = terminos_financieros.monto_base_vigente;
    const comisionPorcentaje =
      terminos_financieros.comision_administracion_porcentaje / 100;
    let count = 0;
    let total = 0;

    const locador = partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = partes.find((p) => p.rol === AgenteRoles.LOCATARIO);

    while (fechaActual < fechaFinProyeccion) {
      const fechaVencimiento = fechaActual.plus({ days: 10 }).toJSDate();
      const comision = this.roundToTwoDecimals(
        montoVigente * comisionPorcentaje,
      );
      const netoLocador = this.roundToTwoDecimals(montoVigente - comision);

      const partidas = [
        {
          cuenta_id: this.accountIdsCache['CXC_ALQ'],
          descripcion: `Alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          debe: this.roundToTwoDecimals(montoVigente),
          haber: 0,
          agente_id: locatario.agente_id,
        },
        {
          cuenta_id: this.accountIdsCache['CXP_LOC'],
          descripcion: `Crédito por alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: netoLocador,
          agente_id: locador.agente_id,
        },
        {
          cuenta_id: this.accountIdsCache['ING_HNR'],
          descripcion: `Honorarios por alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: comision,
        },
      ];

      if (!dryRun) {
        const montoOriginal = this.roundToTwoDecimals(montoVigente);
        const montoActual = montoOriginal;
        
        await this.accountingEntriesService.create({
          contrato_id: contract._id as Types.ObjectId,
          tipo_asiento: 'Alquiler',
          fecha_vencimiento: fechaVencimiento,
          fecha_imputacion: fechaActual.toJSDate(),
          descripcion: `Devengamiento alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          partidas: partidas.map((p) => ({
            ...p,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          })),
          monto_original: montoOriginal,
          monto_actual: montoActual,
          usuario_creacion_id: new Types.ObjectId(userId),
          usuario_modificacion_id: new Types.ObjectId(userId),
        });
      }

      count++;
      total = this.roundToTwoDecimals(total + montoVigente);
      fechaActual = fechaActual.plus({ months: 1 });
    }

    this.logger.debug(
      `Asientos futuros generados: ${count}, Total: $${total.toFixed(2)}`,
    );
    return { count, total: this.roundToTwoDecimals(total) };
  }

  /**
   * Genera asientos históricos completos (mes a mes)
   */
  private async generateFullHistoricalEntries(
    contract: Contract,
    userId: string,
    dryRun: boolean,
  ): Promise<{ count: number; total: number }> {
    this.logger.debug(
      `Generando historial completo para contrato ${contract._id}`,
    );

    const {
      terminos_financieros,
      fecha_inicio,
      fecha_final,
      ajuste_programado,
      partes,
      propiedad_id,
    } = contract;

    // Obtener propiedad para usar su dirección en las descripciones
    const propiedad = await this.propertyModel.findById(propiedad_id).lean();
    const propiedadRef = propiedad?.direccion?.calle || propiedad?.identificador_interno || 'N/A';

    // Para FULL_HISTORY generamos TODO el historial hasta fecha_final
    // sin importar si es futuro o pasado
    const fechaFinProyeccion = DateTime.fromJSDate(fecha_final);

    this.logger.debug(
      `Generando asientos desde ${DateTime.fromJSDate(fecha_inicio).toFormat('MM/yyyy')} hasta ${fechaFinProyeccion.toFormat('MM/yyyy')} - Propiedad: ${propiedadRef}`,
    );

    this.logger.debug(
      `Tipo: ${terminos_financieros.indice_tipo}, Ajuste programado: ${ajuste_programado ? DateTime.fromJSDate(ajuste_programado).toFormat('MM/yyyy') : 'N/A'}`,
    );

    let fechaActual = DateTime.fromJSDate(fecha_inicio);
    let montoVigente = terminos_financieros.monto_base_vigente;
    const comisionPorcentaje =
      terminos_financieros.comision_administracion_porcentaje / 100;
    let count = 0;
    let total = 0;

    const locador = partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = partes.find((p) => p.rol === AgenteRoles.LOCATARIO);

    // NUEVO: Calcular monto total del contrato para honorarios
    const totalMesesContrato = Math.ceil(
      fechaFinProyeccion.diff(DateTime.fromJSDate(fecha_inicio), 'months')
        .months,
    );
    const montoTotalContrato = this.roundToTwoDecimals(
      montoVigente * totalMesesContrato,
    );

    // Calcular honorarios totales
    const honorariosLocadorTotal = this.roundToTwoDecimals(
      (montoTotalContrato *
        (terminos_financieros.honorarios_locador_porcentaje || 0)) /
        100,
    );
    const honorariosLocatarioTotal = this.roundToTwoDecimals(
      (montoTotalContrato *
        (terminos_financieros.honorarios_locatario_porcentaje || 0)) /
        100,
    );

    // Calcular cuota mensual de honorarios
    const cuotasLocador = terminos_financieros.honorarios_locador_cuotas || 1;
    const cuotasLocatario =
      terminos_financieros.honorarios_locatario_cuotas || 1;
    const honorariosLocadorPorCuota = this.roundToTwoDecimals(
      honorariosLocadorTotal / cuotasLocador,
    );
    const honorariosLocatarioPorCuota = this.roundToTwoDecimals(
      honorariosLocatarioTotal / cuotasLocatario,
    );

    this.logger.debug(
      `Honorarios - Total contrato: $${montoTotalContrato}, Locador: $${honorariosLocadorTotal} (${cuotasLocador} cuotas), Locatario: $${honorariosLocatarioTotal} (${cuotasLocatario} cuotas)`,
    );

    // Obtener períodos de ajuste para aplicar ICL/IPC
    let adjustmentPeriods = [];
    let periodIndex = 0;
    let currentPeriod = null;

    if (terminos_financieros.indice_tipo !== 'FIJO' && ajuste_programado) {
      adjustmentPeriods = this.getAdjustmentPeriods(
        DateTime.fromJSDate(fecha_inicio),
        fechaFinProyeccion,
        DateTime.fromJSDate(ajuste_programado),
      );
      currentPeriod = adjustmentPeriods[periodIndex];
      this.logger.debug(
        `Períodos de ajuste generados: ${adjustmentPeriods.length}`,
      );
    }

    while (fechaActual < fechaFinProyeccion) {
      // Verificar si necesitamos cambiar de período y aplicar ajuste ICL/IPC
      if (
        currentPeriod &&
        adjustmentPeriods.length > 0 &&
        fechaActual >= currentPeriod.end &&
        periodIndex < adjustmentPeriods.length - 1
      ) {
        periodIndex++;
        currentPeriod = adjustmentPeriods[periodIndex];

        // CORRECCIÓN: Aplicar ajuste de índice comparando con valor base
        // Obtener ICL/IPC del inicio del período anterior
        const baseIndexValue = await this.getIndexValueForDate(
          terminos_financieros.indice_tipo,
          adjustmentPeriods[periodIndex - 1].start.toJSDate(),
        );

        // Obtener ICL/IPC de la fecha de ajuste
        const adjustmentIndexValue = await this.getIndexValueForDate(
          terminos_financieros.indice_tipo,
          currentPeriod.adjustmentDate.toJSDate(),
        );

        if (baseIndexValue && adjustmentIndexValue) {
          const montoAnterior = montoVigente;
          const adjustmentRatio = adjustmentIndexValue / baseIndexValue;
          const adjustmentPercentage = (adjustmentRatio - 1) * 100;

          montoVigente = this.roundToTwoDecimals(
            montoVigente * adjustmentRatio,
          );

          this.logger.debug(
            `Ajuste ${terminos_financieros.indice_tipo} aplicado en ${currentPeriod.adjustmentDate.toFormat('MM/yyyy')}: $${montoAnterior.toFixed(2)} → $${montoVigente.toFixed(2)} (+${adjustmentPercentage.toFixed(2)}%, ICL ${baseIndexValue.toFixed(2)} → ${adjustmentIndexValue.toFixed(2)})`,
          );
        }
      }

      const fechaVencimiento = fechaActual.plus({ days: 10 }).toJSDate();
      const comision = this.roundToTwoDecimals(
        montoVigente * comisionPorcentaje,
      );
      const creditoLocador = this.roundToTwoDecimals(montoVigente - comision);

      // Generar asiento de alquiler mensual (SOLO 3 partidas, sin honorarios)
      const numeroCuota = count + 1;
      const periodoDesc = `Período ${numeroCuota}/${totalMesesContrato}`;
      
      const partidas = [
        {
          cuenta_id: this.accountIdsCache['CXC_ALQ'],
          descripcion: `Alquiler a cobrar - ${propiedadRef} - ${fechaActual.toFormat('MM/yyyy')}`,
          debe: montoVigente,
          haber: 0,
          agente_id: locatario.agente_id,
          monto_pagado_acumulado: 0,
        },
        {
          cuenta_id: this.accountIdsCache['CXP_LOC'],
          descripcion: `Alquiler a pagar al locador - ${propiedadRef} - ${fechaActual.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: creditoLocador,
          agente_id: locador.agente_id,
        },
        {
          cuenta_id: this.accountIdsCache['ING_HNR'],
          descripcion: `Comisión administración - ${propiedadRef} - ${fechaActual.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: comision,
        },
      ];

      if (!dryRun) {
        const montoOriginal = this.roundToTwoDecimals(montoVigente);
        const montoActual = montoOriginal;
        
        await this.accountingEntriesService.create({
          contrato_id: contract._id as Types.ObjectId,
          tipo_asiento: 'Alquiler',
          fecha_vencimiento: fechaVencimiento,
          fecha_imputacion: fechaActual.toJSDate(),
          descripcion: `Alquiler ${fechaActual.toFormat('MM/yyyy')} - ${periodoDesc} - ${propiedadRef}`,
          metadata: {
            periodo: numeroCuota, // **AGREGADO** - Número de período para matching
            mes: fechaActual.month,
            anio: fechaActual.year,
          },
          partidas: partidas.map((p) => ({
            ...p,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          })),
          monto_original: montoOriginal,
          monto_actual: montoActual,
          usuario_creacion_id: new Types.ObjectId(userId),
          usuario_modificacion_id: new Types.ObjectId(userId),
        });
      }

      count++;
      total = this.roundToTwoDecimals(total + montoVigente);
      fechaActual = fechaActual.plus({ months: 1 });

      // Debug cada 6 meses
      if (count % 6 === 0) {
        this.logger.debug(
          `Asientos generados hasta ahora: ${count}, Fecha actual: ${fechaActual.toFormat('MM/yyyy')}`,
        );
      }
    }

    // Generar asientos de honorarios locador (asientos separados)
    if (honorariosLocadorPorCuota > 0) {
      for (let i = 0; i < cuotasLocador; i++) {
        const fechaHonorario = DateTime.fromJSDate(fecha_inicio).plus({ months: i });
        const fechaVenc = fechaHonorario.plus({ days: 10 });
        
        if (!dryRun) {
          await this.accountingEntriesService.create({
            contrato_id: contract._id as Types.ObjectId,
            tipo_asiento: 'Honorarios Locador',
            fecha_imputacion: fechaHonorario.toJSDate(),
            fecha_vencimiento: fechaVenc.toJSDate(),
            descripcion: `Honorarios Locador - Cuota ${i + 1}/${cuotasLocador} - ${propiedadRef}`,
            metadata: {
              periodo: i + 1, // Período = número de cuota
              tipo_honorario: 'locador',
            },
            partidas: [
              {
                cuenta_id: this.accountIdsCache['CXP_LOC'],
                descripcion: `Descuento honorarios locador - ${propiedadRef} - Cuota ${i + 1}/${cuotasLocador}`,

                debe: honorariosLocadorPorCuota,
                haber: 0,
                agente_id: locador.agente_id,
                es_iva_incluido: false,
                tasa_iva_aplicada: 0,
                monto_base_imponible: 0,
                monto_iva_calculado: 0,
              },
              {
                cuenta_id: this.accountIdsCache['ING_HNR'],
                descripcion: `Ingreso honorarios locador - ${propiedadRef} - Cuota ${i + 1}/${cuotasLocador}`,
                debe: 0,
                haber: honorariosLocadorPorCuota,
                es_iva_incluido: false,
                tasa_iva_aplicada: 0,
                monto_base_imponible: 0,
                monto_iva_calculado: 0,
              },
            ],
            monto_original: honorariosLocadorPorCuota,
            monto_actual: honorariosLocadorPorCuota,
            usuario_creacion_id: new Types.ObjectId(userId),
            usuario_modificacion_id: new Types.ObjectId(userId),
          });
        }
        count++;
      }
    }

    // Generar asientos de honorarios locatario (asientos separados)
    if (honorariosLocatarioPorCuota > 0) {
      for (let i = 0; i < cuotasLocatario; i++) {
        const fechaHonorario = DateTime.fromJSDate(fecha_inicio).plus({ months: i });
        const fechaVenc = fechaHonorario.plus({ days: 10 });
        
        if (!dryRun) {
          await this.accountingEntriesService.create({
            contrato_id: contract._id as Types.ObjectId,
            tipo_asiento: 'Honorarios Locatario',
            fecha_imputacion: fechaHonorario.toJSDate(),
            fecha_vencimiento: fechaVenc.toJSDate(),
            descripcion: `Honorarios Locatario - Cuota ${i + 1}/${cuotasLocatario} - ${propiedadRef}`,
            metadata: {
              periodo: i + 1, // Período = número de cuota
              tipo_honorario: 'locatario',
            },
            partidas: [
              {
                cuenta_id: this.accountIdsCache['CXC_ALQ'],
                descripcion: `Cargo honorarios locatario - ${propiedadRef} - Cuota ${i + 1}/${cuotasLocatario}`,
                debe: honorariosLocatarioPorCuota,
                haber: 0,
                agente_id: locatario.agente_id,
                es_iva_incluido: false,
                tasa_iva_aplicada: 0,
                monto_base_imponible: 0,
                monto_iva_calculado: 0,
              },
              {
                cuenta_id: this.accountIdsCache['ING_HNR'],
                descripcion: `Ingreso honorarios locatario - ${propiedadRef} - Cuota ${i + 1}/${cuotasLocatario}`,
                debe: 0,
                haber: honorariosLocatarioPorCuota,
                es_iva_incluido: false,
                tasa_iva_aplicada: 0,
                monto_base_imponible: 0,
                monto_iva_calculado: 0,
              },
            ],
            monto_original: honorariosLocatarioPorCuota,
            monto_actual: honorariosLocatarioPorCuota,
            usuario_creacion_id: new Types.ObjectId(userId),
            usuario_modificacion_id: new Types.ObjectId(userId),
          });
        }
        count++;
      }
    }

    this.logger.log(
      `Historial completo generado: ${count} asientos (${count - cuotasLocador - cuotasLocatario} alquileres + ${cuotasLocador} hon. locador + ${cuotasLocatario} hon. locatario), Total: $${total.toFixed(2)}`,
    );
    return { count, total: this.roundToTwoDecimals(total) };
  }

  /**
   * Genera asiento de depósito en garantía
   */
  private async generateDepositEntry(
    contract: Contract,
    userId: string,
    dryRun: boolean,
  ): Promise<void> {
    this.logger.debug(
      `Generando asientos de depósito para contrato ${contract._id}`,
    );

    const { deposito_monto, fecha_inicio, fecha_final, partes } = contract;

    // Buscar LOCADOR y LOCATARIO
    const locador = partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = partes.find((p) => p.rol === AgenteRoles.LOCATARIO);

    const depositoRedondeado = this.roundToTwoDecimals(deposito_monto);

    // ========================================
    // ASIENTO 1: COBRO DEL DEPÓSITO AL LOCATARIO (fecha_inicio)
    // ========================================
    const partidasCobro = [
      {
        cuenta_id: this.accountIdsCache['CXC_ALQ'],
        descripcion: 'Depósito en garantía a cobrar al locatario',
        debe: depositoRedondeado,
        haber: 0,
        agente_id: locatario.agente_id, // LOCATARIO debe pagar
      },
      {
        cuenta_id: this.accountIdsCache['ACT_FID'],
        descripcion: 'Ingreso de depósito en garantía a caja/banco fiduciaria',
        debe: 0,
        haber: depositoRedondeado,
      },
    ];

    if (!dryRun) {
      const partidasCobroFinal = partidasCobro.map((p) => ({
        ...p,
        es_iva_incluido: false,
        tasa_iva_aplicada: 0,
        monto_base_imponible: 0,
        monto_iva_calculado: 0,
      }));
      const montoOriginal = depositoRedondeado;
      await this.accountingEntriesService.create({
        contrato_id: contract._id as Types.ObjectId,
        tipo_asiento: 'Deposito en Garantia - Cobro',
        fecha_imputacion: fecha_inicio,
        fecha_vencimiento: fecha_inicio,
        descripcion: 'Cobro de depósito en garantía al locatario',
        metadata: {
          periodo: 0, // Depósito = período 0 (especial)
          tipo: 'cobro',
        },
        partidas: partidasCobroFinal,
        monto_original: montoOriginal,
        monto_actual: montoOriginal,
        usuario_creacion_id: new Types.ObjectId(userId),
        usuario_modificacion_id: new Types.ObjectId(userId),
      });
    }

    // ========================================
    // ASIENTO 2: DEVOLUCIÓN DEL DEPÓSITO AL LOCADOR (fecha_final)
    // ========================================
    const partidasDevolucion = [
      {
        cuenta_id: this.accountIdsCache['ACT_FID'],
        descripcion: 'Egreso de depósito en garantía desde caja/banco',
        debe: depositoRedondeado,
        haber: 0,
      },
      {
        cuenta_id: this.accountIdsCache['PAS_DEP'],
        descripcion: 'Depósito en garantía a devolver al locador',
        debe: 0,
        haber: depositoRedondeado,
        agente_id: locador.agente_id, // LOCADOR debe recibir la devolución
      },
    ];

    if (!dryRun) {
      const partidasDevolucionFinal = partidasDevolucion.map((p) => ({
        ...p,
        es_iva_incluido: false,
        tasa_iva_aplicada: 0,
        monto_base_imponible: 0,
        monto_iva_calculado: 0,
      }));
      const montoOriginal = depositoRedondeado;
      await this.accountingEntriesService.create({
        contrato_id: contract._id as Types.ObjectId,
        tipo_asiento: 'Deposito en Garantia - Devolucion',
        fecha_imputacion: fecha_final,
        fecha_vencimiento: fecha_final,
        descripcion: 'Devolución de depósito en garantía al locador',
        metadata: {
          periodo: 0, // Depósito = período 0 (especial)
          tipo: 'devolucion',
        },
        partidas: partidasDevolucionFinal,
        monto_original: montoOriginal,
        monto_actual: montoOriginal,
        usuario_creacion_id: new Types.ObjectId(userId),
        usuario_modificacion_id: new Types.ObjectId(userId),
      });
    }
  }

  /**
   * Obtiene los contratos a migrar
   */
  private async getContractsToMigrate(
    contractIds?: string[],
  ): Promise<Contract[]> {
    let query: any;

    if (contractIds && contractIds.length > 0) {
      // Si se proporcionan IDs específicos, SOLO filtrar por esos IDs
      // NO filtrar por status para permitir migrar TODOS los contratos legacy
      this.logger.debug(`🔍 MIGRATION DEBUG: Recibidos ${contractIds.length} contract IDs`);
      this.logger.debug(`🔍 MIGRATION DEBUG: Primeros 3 IDs: ${contractIds.slice(0, 3).join(', ')}`);
      
      query = {
        _id: { $in: contractIds.map((id) => new Types.ObjectId(id)) },
      };
    } else {
    // Si NO se proporcionan IDs, procesar TODOS los contratos
    // CAMBIO CRÍTICO: Incluir FINALIZADOS y PENDIENTES para migración completa FULL_HISTORY
    this.logger.debug(`🔍 MIGRATION DEBUG: SIN contract IDs, procesando TODOS los contratos`);
    query = {}; // Sin filtro de status - procesar TODOS los contratos
  }

    const results = await this.contractModel.find(query).exec();
    this.logger.debug(`🔍 MIGRATION DEBUG: Query devolvió ${results.length} contratos`);
    
    return results;
  }

  /**
   * Carga los IDs de las cuentas contables en caché
   */
  private async loadAccountIds(): Promise<void> {
    if (!this.accountIdsCache) {
      this.accountIdsCache =
        await this.chartOfAccountsService.getAccountIdsByCode(
          this.REQUIRED_ACCOUNTS,
        );
      this.logger.debug('IDs de cuentas contables cargados en caché');
    }
  }

  /**
   * Genera un reporte de validación de contratos sin asientos
   */
  async getContractsWithoutEntries(): Promise<Contract[]> {
    const allContracts = await this.contractModel
      .find({ status: 'VIGENTE' })
      .exec();

    const contractsWithoutEntries: Contract[] = [];

    for (const contract of allContracts) {
      const entriesCount = await this.accountingEntryModel.countDocuments({
        contrato_id: contract._id,
      });

      if (entriesCount === 0) {
        contractsWithoutEntries.push(contract);
      }
    }

    return contractsWithoutEntries;
  }

  /**
   * Migra propiedades desde la BD legacy manteniendo _id originales
   */
  async migratePropertiesFromLegacy(deleteExisting: boolean = false): Promise<any> {
    const mongoose = require('mongoose');
    const legacyConnection = mongoose.createConnection(
      'mongodb://127.0.0.1:27017/propietas',
    );

    try {
      this.logger.log('🔄 Iniciando migración de propiedades...');

      // Esperar conexión
      await new Promise((resolve) => legacyConnection.once('open', resolve));

      const LegacyProperty = legacyConnection.model(
        'Property',
        new mongoose.Schema({}, { strict: false }),
      );

      // Obtener propiedades de legacy
      const legacyProperties = await LegacyProperty.find({}).lean();
      this.logger.log(`📥 Propiedades en legacy: ${legacyProperties.length}`);

      // Eliminar existentes si se solicita
      if (deleteExisting) {
        await this.propertyModel.deleteMany({});
        this.logger.log('✅ Propiedades existentes eliminadas');
      }

      let inserted = 0;
      let errors = 0;
      const errorDetails = [];

      for (const prop of legacyProperties) {
        try {
          // Transformación simple manteniendo _id original
          const v3Property = {
            _id: prop._id, // MANTENER ID ORIGINAL
            propietarios_ids: prop.owner?.map((o) => o._id) || [],
            identificador_interno: `PROP-${prop._id.toString().slice(-8).toUpperCase()}`,
            titulo: prop.detailedDescription?.title || '',
            descripcion: prop.detailedDescription?.brief || '',
            direccion: {
              calle: prop.address || '',
              numero: '',
              piso_dpto: '',
              codigo_postal: '',
              latitud: prop.lat || null,
              longitud: prop.lng || null,
            },
            caracteristicas: {
              tipo_propiedad: prop.type || 'departamento',
              dormitorios: prop.detailedDescription?.rooms || null,
              banos: prop.detailedDescription?.bathrooms || null,
              metraje_total: prop.detailedDescription?.sqFt || null,
              metraje_cubierto: prop.detailedDescription?.buildSqFt || null,
              antiguedad_anos: prop.detailedDescription?.age || null,
            },
            valor_venta: prop.valueForSale?.amount || null,
            valor_alquiler: prop.valueForRent?.amount || null,
            publicar_para_venta: prop.publishForSale || false,
            publicar_para_alquiler: prop.publishForRent || false,
            status: prop.status || 'DISPONIBLE',
            estado_ocupacional: prop.tenant?._id ? 'ALQUILADA' : 'DISPONIBLE',
            contrato_vigente_id: prop.leaseAgreement || null,
            createdAt: prop.createdAt || new Date(),
            updatedAt: new Date(),
          };

          await this.propertyModel.create(v3Property);
          inserted++;

          if (inserted % 100 === 0) {
            this.logger.log(`  Progreso: ${inserted}/${legacyProperties.length}...`);
          }
        } catch (error) {
          errors++;
          if (errors < 10) {
            errorDetails.push({
              propertyId: prop._id,
              error: error.message,
            });
          }
        }
      }

      this.logger.log(`✅ Migración completada: ${inserted} propiedades`);

      return {
        total: legacyProperties.length,
        inserted,
        errors,
        errorDetails,
      };
    } finally {
      await legacyConnection.close();
    }
  }
}
