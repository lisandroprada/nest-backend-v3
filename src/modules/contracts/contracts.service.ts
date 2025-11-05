import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contract } from './entities/contract.entity';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { DateTime } from 'luxon';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { AgenteRoles } from '../agents/constants/agent-roles.enum';
import { PropertiesService } from '../properties/properties.service';
import { PaginationService } from '../../common/pagination/pagination.service';
import { PaginationDto } from '../../common/pagination/dto/pagination.dto';
import { ContractSettingsService } from '../contract-settings/contract-settings.service';
import {
  CalculateInitialPaymentsDto,
  CalculateInitialPaymentsResponseDto,
  AsientoPreviewDto,
  PartidaPreviewDto,
} from './dto/calculate-initial-payments.dto';
import * as fs from 'fs';
import { AgentsService } from '../agents/agents.service';
import { Property } from '../properties/entities/property.entity';

@Injectable()
export class ContractsService {
  private readonly REQUIRED_ACCOUNTS = [
    'CXC_ALQ', // Alquiler a Cobrar
    'CXP_LOC', // Alquiler a Pagar a Locador
    'ING_HNR', // Ingreso por Honorarios
    'ING_HNR_INIC', // Ingreso por Honorarios de Inicio de Contrato
    'PAS_DEP', // Pasivo Depósito
    'ACT_FID', // Activo Fiduciario (Caja/Banco)
  ];
  private accountIdsCache: Record<string, Types.ObjectId>;

  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<Contract>,
    private readonly accountingEntriesService: AccountingEntriesService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly propertiesService: PropertiesService,
    private readonly paginationService: PaginationService,
    private readonly contractSettingsService: ContractSettingsService,
    private readonly agentsService: AgentsService,
  ) {}

  private inmobiliariaAgentIdCache: Types.ObjectId | null = null;

  private async getInmobiliariaAgentId(): Promise<Types.ObjectId | null> {
    if (this.inmobiliariaAgentIdCache) return this.inmobiliariaAgentIdCache;
    try {
      const agent = await this.agentsService.findOneByRole(
        AgenteRoles.INMOBILIARIA,
      );
      if (agent?._id) {
        this.inmobiliariaAgentIdCache = agent._id as unknown as Types.ObjectId;
        return this.inmobiliariaAgentIdCache;
      }
    } catch (e) {
      // noop
    }
    return null;
  }

  private async loadAccountIds(): Promise<void> {
    if (this.accountIdsCache) {
      return;
    }
    this.accountIdsCache =
      await this.chartOfAccountsService.getAccountIdsByCode(
        this.REQUIRED_ACCOUNTS,
      );
  }

  async create(
    createContractDto: CreateContractDto,
    userId: string,
  ): Promise<Contract> {
    await this.loadAccountIds(); // Carga centralizada de cuentas

    const settings = await this.contractSettingsService.getSettings();
    const tipoContrato = (
      createContractDto.tipo_contrato || 'VIVIENDA'
    ).toUpperCase();

    let duracionMeses = createContractDto.duracion_meses;
    if (
      !duracionMeses &&
      createContractDto.fecha_inicio &&
      createContractDto.fecha_final
    ) {
      const start = new Date(createContractDto.fecha_inicio);
      const end = new Date(createContractDto.fecha_final);
      duracionMeses =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());
      if (end.getDate() >= start.getDate()) duracionMeses += 1;
    }

    const interesMora =
      createContractDto.terminos_financieros.interes_mora_diaria ??
      settings.interes_mora_diaria_default;
    const depositoTipoAjuste =
      createContractDto.deposito_tipo_ajuste ||
      settings.deposito_tipo_ajuste_default;
    const comisionAdmin =
      createContractDto.terminos_financieros
        .comision_administracion_porcentaje ??
      settings.comision_administracion_default;

    const contractData = {
      ...createContractDto,
      tipo_contrato: tipoContrato,
      duracion_meses: duracionMeses,
      terminos_financieros: {
        ...createContractDto.terminos_financieros,
        interes_mora_diaria: interesMora,
        comision_administracion_porcentaje: comisionAdmin,
      },
      deposito_tipo_ajuste: depositoTipoAjuste,
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    };

    const newContract = new this.contractModel(contractData);
    await newContract.save();

    await this.propertiesService.update(
      newContract.propiedad_id.toString(),
      { status: 'ALQUILADO', contrato_vigente_id: newContract._id.toString() },
      userId,
    );

    return newContract;
  }

  async findAll(paginationDto: PaginationDto) {
    return this.paginationService.paginate(this.contractModel, paginationDto);
  }

  async findOne(id: string): Promise<Contract> {
    const contract = await this.contractModel
      .findById(id)
      .populate('propiedad_id');
    if (!contract) {
      throw new NotFoundException(`Contract with ID "${id}" not found.`);
    }
    return contract;
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
    userId: string,
  ): Promise<Contract> {
    let generarAsientos = false;
    if (updateContractDto.status === 'VIGENTE') {
      const contract = await this.contractModel.findById(id);
      if (!contract) {
        throw new NotFoundException(`Contract with ID "${id}" not found.`);
      }
      const firmas_completas =
        typeof updateContractDto.firmas_completas === 'boolean'
          ? updateContractDto.firmas_completas
          : contract.firmas_completas;
      const documentacion_completa =
        typeof updateContractDto.documentacion_completa === 'boolean'
          ? updateContractDto.documentacion_completa
          : contract.documentacion_completa;
      const visita_realizada =
        typeof updateContractDto.visita_realizada === 'boolean'
          ? updateContractDto.visita_realizada
          : contract.visita_realizada;
      const inventario_actualizado =
        typeof updateContractDto.inventario_actualizado === 'boolean'
          ? updateContractDto.inventario_actualizado
          : contract.inventario_actualizado;
      const fotos_inventario =
        updateContractDto.fotos_inventario !== undefined
          ? updateContractDto.fotos_inventario
          : contract.fotos_inventario;

      if (!firmas_completas)
        throw new BadRequestException(
          'No se puede activar el contrato: faltan firmas de las partes.',
        );
      if (!documentacion_completa)
        throw new BadRequestException(
          'No se puede activar el contrato: falta documentación obligatoria.',
        );
      if (!visita_realizada)
        throw new BadRequestException(
          'No se puede activar el contrato: falta registrar la visita a la vivienda.',
        );
      if (!inventario_actualizado)
        throw new BadRequestException(
          'No se puede activar el contrato: falta actualizar el inventario.',
        );
      if (!fotos_inventario || fotos_inventario.length === 0)
        throw new BadRequestException(
          'No se puede activar el contrato: faltan fotos de la vivienda en el inventario.',
        );

      if (contract.status === 'PENDIENTE') {
        generarAsientos = true;
      }
    }

    const updatedContract = await this.contractModel
      .findByIdAndUpdate(
        id,
        {
          ...updateContractDto,
          usuario_modificacion_id: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .populate('propiedad_id');
    if (!updatedContract) {
      throw new NotFoundException(`Contract with ID "${id}" not found.`);
    }

    if (generarAsientos) {
      await this.loadAccountIds();
      await this.generateInitialAccountingEntries(
        updatedContract as unknown as Contract & { propiedad_id: Property },
        userId,
      );
      await this.generateDepositEntry(
        updatedContract as unknown as Contract & { propiedad_id: Property },
        userId,
      );
      await this.generateHonorariosEntries(
        updatedContract as unknown as Contract & { propiedad_id: Property },
        userId,
      );
    }

    return updatedContract;
  }

  private async generateDepositEntry(
    contract: Contract & { propiedad_id: Property },
    userId: string,
  ): Promise<void> {
    const locatario = contract.partes.find(
      (p) => p.rol === AgenteRoles.LOCATARIO,
    );
    if (!locatario) return;

    const locatarioAgent = await this.agentsService.findOne(
      locatario.agente_id.toString(),
    );

    if (!locatarioAgent) {
      console.warn(
        `Agente locatario con ID ${locatario.agente_id} no encontrado para el depósito.`,
      );
    }

    const locatarioName = locatarioAgent
      ? locatarioAgent.nombres
      : 'Locatario Desconocido';

    const propertyAddress = contract.propiedad_id
      ? `${contract.propiedad_id.direccion.calle} ${contract.propiedad_id.direccion.numero}, ${contract.propiedad_id.direccion.localidad_id}`
      : 'Propiedad Desconocida';

    const cuentaPasivoDepositoId = this.accountIdsCache['PAS_DEP'];
    const cuentaActivoFiduciarioId = this.accountIdsCache['ACT_FID'];

    const descripcionBase = 'Registro de depósito en garantía';

    const metadata = {
      propertyAddress: propertyAddress,

      locatarioName: locatarioName,
    };

    const partidas = [
      {
        cuenta_id: cuentaPasivoDepositoId,

        descripcion: 'Recepción de depósito en garantía',

        debe: 0,

        haber: contract.deposito_monto,

        agente_id: locatario.agente_id,

        es_iva_incluido: false,

        tasa_iva_aplicada: 0,

        monto_base_imponible: 0,

        monto_iva_calculado: 0,
      },

      {
        cuenta_id: cuentaActivoFiduciarioId,

        descripcion: 'Ingreso de depósito en garantía a caja/banco',

        debe: contract.deposito_monto,

        haber: 0,

        es_iva_incluido: false,

        tasa_iva_aplicada: 0,

        monto_base_imponible: 0,

        monto_iva_calculado: 0,
      },
    ];

    const montoOriginal = partidas.reduce((sum, p) => sum + (p.debe || 0), 0);

    const montoActual = montoOriginal;

    const entryPayload = {
      contrato_id: contract._id as Types.ObjectId,

      tipo_asiento: 'Deposito en Garantia',

      fecha_imputacion: new Date(contract.fecha_inicio),

      fecha_vencimiento: new Date(contract.fecha_inicio),

      descripcion: descripcionBase,

      partidas: partidas.map((p) =>
        p.agente_id ? { ...p, agente_id: new Types.ObjectId(p.agente_id) } : p,
      ),

      monto_original: montoOriginal,

      monto_actual: montoActual,

      usuario_creacion_id: new Types.ObjectId(userId),

      usuario_modificacion_id: new Types.ObjectId(userId),

      metadata: metadata,
    };

    await this.accountingEntriesService.create(entryPayload);
  }

  private async generateHonorariosEntries(
    contract: Contract & { propiedad_id: Property },
    userId: string,
  ): Promise<void> {
    const { terminos_financieros, fecha_inicio, fecha_final, partes } =
      contract;

    const propertyAddress = contract.propiedad_id
      ? `${contract.propiedad_id.direccion.calle} ${contract.propiedad_id.direccion.numero}, ${contract.propiedad_id.direccion.localidad_id}`
      : 'Propiedad Desconocida';

    const locador = partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = partes.find((p) => p.rol === AgenteRoles.LOCATARIO);
    if (!locador || !locatario) return;

    const locadorAgent = await this.agentsService.findOne(
      locador.agente_id.toString(),
    );

    if (!locadorAgent) {
      console.warn(`Agente locador con ID ${locador.agente_id} no encontrado.`);
    }

    const locatarioAgent = await this.agentsService.findOne(
      locatario.agente_id.toString(),
    );

    if (!locatarioAgent) {
      console.warn(
        `Agente locatario con ID ${locatario.agente_id} no encontrado.`,
      );
    }

    const locadorName = locadorAgent
      ? locadorAgent.nombres
      : 'Locador Desconocido';

    const locatarioName = locatarioAgent
      ? locatarioAgent.nombres
      : 'Locatario Desconocido';
    const cuentaLocadorId = this.accountIdsCache['CXP_LOC'];
    const cuentaDeudaLocatarioId = this.accountIdsCache['CXC_ALQ'];
    const cuentaIngresoInmoId = this.accountIdsCache['ING_HNR_INIC'];

    const inmoAgentId = await this.getInmobiliariaAgentId();

    const fechaInicio = DateTime.fromJSDate(fecha_inicio);
    const fechaFinal = DateTime.fromJSDate(fecha_final);
    const mesesContrato = Math.round(
      fechaFinal.diff(fechaInicio, 'months').months,
    );
    const montoBase = terminos_financieros.monto_base_vigente;
    const montoTotalContrato = mesesContrato * montoBase;

    const porcentajeHonLocador =
      (terminos_financieros.honorarios_locador_porcentaje ?? 0) / 100;
    const cuotasLocador = terminos_financieros.honorarios_locador_cuotas ?? 1;
    if (porcentajeHonLocador > 0) {
      const montoTotalHonorarios = montoTotalContrato * porcentajeHonLocador;
      const montoPorCuota = montoTotalHonorarios / cuotasLocador;
      for (let i = 0; i < cuotasLocador; i++) {
        const fechaVenc = fechaInicio.plus({ months: i, days: 10 });
        const descripcionBase = `Honorarios locador - Cuota ${i + 1}/${cuotasLocador}`;
        const metadata = {
          propertyAddress: propertyAddress,
          locadorName: locadorName,
          locatarioName: locatarioName,
          cuota: `${i + 1}/${cuotasLocador}`,
        };

        const partidas = [
          {
            cuenta_id: cuentaLocadorId,
            descripcion: `Descuento honorarios locador - Cuota ${i + 1}`,
            debe: montoPorCuota,
            haber: 0,
            agente_id: locador.agente_id,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
          {
            cuenta_id: cuentaIngresoInmoId,
            descripcion: `Ingreso honorarios locador - Cuota ${i + 1}`,
            debe: 0,
            haber: montoPorCuota,
            agente_id: inmoAgentId || undefined,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
        ];
        const montoOriginal = partidas.reduce(
          (sum, p) => sum + (p.debe || 0),
          0,
        );
        const montoActual = montoOriginal;
        await this.accountingEntriesService.create({
          contrato_id: contract._id as Types.ObjectId,
          tipo_asiento: 'Honorarios Locador',
          fecha_imputacion: fechaInicio.plus({ months: i }).toJSDate(),
          fecha_vencimiento: fechaVenc.toJSDate(),
          descripcion: descripcionBase,
          partidas: partidas.map((p) =>
            p.agente_id
              ? { ...p, agente_id: new Types.ObjectId(p.agente_id) }
              : p,
          ),
          monto_original: montoOriginal,
          monto_actual: montoActual,
          usuario_creacion_id: new Types.ObjectId(userId),
          usuario_modificacion_id: new Types.ObjectId(userId),
          metadata: metadata,
        });
      }
    }

    const porcentajeHonLocatario =
      (terminos_financieros.honorarios_locatario_porcentaje ?? 0) / 100;
    const cuotasLocatario =
      terminos_financieros.honorarios_locatario_cuotas ?? 1;
    if (porcentajeHonLocatario > 0) {
      const montoTotalHonorarios = montoTotalContrato * porcentajeHonLocatario;
      const montoPorCuota = montoTotalHonorarios / cuotasLocatario;
      for (let i = 0; i < cuotasLocatario; i++) {
        const fechaVenc = fechaInicio.plus({ months: i, days: 10 });
        const descripcionBase = `Honorarios locatario - Cuota ${i + 1}/${cuotasLocatario}`;
        const metadata = {
          propertyAddress: propertyAddress,
          locadorName: locadorName,
          locatarioName: locatarioName,
          cuota: `${i + 1}/${cuotasLocatario}`,
        };

        const partidas = [
          {
            cuenta_id: cuentaDeudaLocatarioId,
            descripcion: `Cargo honorarios locatario - Cuota ${i + 1}`,
            debe: montoPorCuota,
            haber: 0,
            agente_id: locatario.agente_id,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
          {
            cuenta_id: cuentaIngresoInmoId,
            descripcion: `Ingreso honorarios locatario - Cuota ${i + 1}`,
            debe: 0,
            haber: montoPorCuota,
            agente_id: inmoAgentId || undefined,
            es_iva_incluido: false,
            tasa_iva_aplicada: 0,
            monto_base_imponible: 0,
            monto_iva_calculado: 0,
          },
        ];
        const montoOriginal = partidas.reduce(
          (sum, p) => sum + (p.debe || 0),
          0,
        );
        const montoActual = montoOriginal;
        await this.accountingEntriesService.create({
          contrato_id: contract._id as Types.ObjectId,
          tipo_asiento: 'Honorarios Locatario',
          fecha_imputacion: fechaInicio.plus({ months: i }).toJSDate(),
          fecha_vencimiento: fechaVenc.toJSDate(),
          descripcion: descripcionBase,
          partidas: partidas.map((p) =>
            p.agente_id
              ? { ...p, agente_id: new Types.ObjectId(p.agente_id) }
              : p,
          ),
          monto_original: montoOriginal,
          monto_actual: montoActual,
          usuario_creacion_id: new Types.ObjectId(userId),
          usuario_modificacion_id: new Types.ObjectId(userId),
          metadata: metadata,
        });
      }
    }
  }

  private async generateInitialAccountingEntries(
    contract: Contract & { propiedad_id: Property },
    userId: string,
  ): Promise<void> {
    const logData = {
      timestamp: new Date().toISOString(),
      contrato_id: contract._id,
      fecha_inicio: contract.fecha_inicio,
      fecha_final: contract.fecha_final,
      partes: contract.partes,
      terminos_financieros: contract.terminos_financieros,
      deposito_monto: contract.deposito_monto,
      deposito_cuotas: contract.deposito_cuotas,
      deposito_tipo_ajuste: contract.deposito_tipo_ajuste,
      status: contract.status,
    };
    fs.appendFileSync(
      'asientos_debug.txt',
      JSON.stringify(logData, null, 2) + '\n',
    );
    const { terminos_financieros, fecha_inicio, fecha_final, partes } =
      contract;

    const settings = await this.contractSettingsService.getSettings();
    const porcentajeHonorarios =
      (terminos_financieros.comision_administracion_porcentaje ??
        (settings.comision_administracion_default || 0)) / 100;

    const propertyAddress = contract.propiedad_id
      ? `${contract.propiedad_id.direccion.calle} ${contract.propiedad_id.direccion.numero}, ${contract.propiedad_id.direccion.localidad_id}`
      : 'Propiedad Desconocida';

    const locador = partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = partes.find((p) => p.rol === AgenteRoles.LOCATARIO);
    if (!locador || !locatario) {
      throw new BadRequestException(
        'Se requiere un locador y un locatario en las partes del contrato',
      );
    }

    const locadorAgent = await this.agentsService.findOne(
      locador.agente_id.toString(),
    );

    if (!locadorAgent) {
      console.warn(
        `Agente locador con ID ${locador.agente_id} no encontrado para honorarios.`,
      );
    }

    const locatarioAgent = await this.agentsService.findOne(
      locatario.agente_id.toString(),
    );

    if (!locatarioAgent) {
      console.warn(
        `Agente locatario con ID ${locatario.agente_id} no encontrado para honorarios.`,
      );
    }

    const locadorName = locadorAgent
      ? locadorAgent.nombres
      : 'Locador Desconocido';

    const locatarioName = locatarioAgent
      ? locatarioAgent.nombres
      : 'Locatario Desconocido';
    const cuentaDeudaLocatarioId = this.accountIdsCache['CXC_ALQ'];
    const cuentaIngresoLocadorId = this.accountIdsCache['CXP_LOC'];
    const cuentaIngresoInmoId = this.accountIdsCache['ING_HNR'];

    const inmoAgentId = await this.getInmobiliariaAgentId();

    const fechaInicio = DateTime.fromJSDate(fecha_inicio);
    const fechaFinal = DateTime.fromJSDate(fecha_final);
    const mesesContrato = Math.round(
      fechaFinal.diff(fechaInicio, 'months').months,
    );
    let mesesAjuste = terminos_financieros.ajuste_periodicidad_meses;
    if (!mesesAjuste || mesesAjuste <= 0 || mesesAjuste > mesesContrato) {
      mesesAjuste = 12;
    }
    const tipoIndice = terminos_financieros.indice_tipo;
    const montoBase = terminos_financieros.monto_base_vigente;

    for (let mes = 0; mes < mesesContrato; mes++) {
      const fechaPeriodo = fechaInicio.plus({ months: mes });
      const fechaVencimiento = fechaPeriodo.plus({ days: 10 }).toJSDate();
      const esMesAjuste = mesesAjuste > 0 && mes > 0 && mes % mesesAjuste === 0;
      const montoAlquiler = montoBase;
      let estado = 'PENDIENTE';

      if (esMesAjuste && tipoIndice !== 'FIJO') {
        estado = 'PENDIENTE_AJUSTE';
      }

      const descripcionBase = `Alquiler ${fechaPeriodo.toFormat('MM/yyyy')}`;
      const metadata = {
        propertyAddress: propertyAddress,
        locadorName: locadorName,
        locatarioName: locatarioName,
        periodo: fechaPeriodo.toFormat('MM/yyyy'),
      };

      const montoHonorarios = montoAlquiler * porcentajeHonorarios;
      const montoParaLocador = montoAlquiler - montoHonorarios;

      if (
        !cuentaDeudaLocatarioId ||
        !cuentaIngresoLocadorId ||
        !cuentaIngresoInmoId
      ) {
        throw new BadRequestException(
          'No se encontraron todas las cuentas contables requeridas.',
        );
      }
      if (!locatario.agente_id || !locador.agente_id) {
        throw new BadRequestException(
          'No se encontraron los agentes requeridos.',
        );
      }

      const partidas = [
        {
          cuenta_id: cuentaDeudaLocatarioId,
          descripcion: `Alquiler ${fechaPeriodo.toFormat('MM/yyyy')}`,
          debe: montoAlquiler,
          haber: 0,
          agente_id: new Types.ObjectId(locatario.agente_id),
          es_iva_incluido: false,
          tasa_iva_aplicada: 0,
          monto_base_imponible: 0,
          monto_iva_calculado: 0,
        },
        {
          cuenta_id: cuentaIngresoLocadorId,
          descripcion: `Crédito por alquiler ${fechaPeriodo.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: montoParaLocador,
          agente_id: new Types.ObjectId(locador.agente_id),
          es_iva_incluido: false,
          tasa_iva_aplicada: 0,
          monto_base_imponible: 0,
          monto_iva_calculado: 0,
        },
        {
          cuenta_id: cuentaIngresoInmoId,
          descripcion: `Honorarios por alquiler ${fechaPeriodo.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: montoHonorarios,
          agente_id: inmoAgentId || undefined,
          es_iva_incluido: false,
          tasa_iva_aplicada: 0,
          monto_base_imponible: 0,
          monto_iva_calculado: 0,
        },
      ];

      const montoOriginal = partidas.reduce((sum, p) => sum + (p.debe || 0), 0);
      const montoActual = montoOriginal;
      console.log('[GENERATE ASIENTO]', {
        contrato_id: contract._id,
        fecha_vencimiento: fechaVencimiento,
        descripcion: descripcionBase,
        partidas,
        monto_original: montoOriginal,
        monto_actual: montoActual,
        estado,
        es_ajustable: estado === 'PENDIENTE_AJUSTE',
        metadata: metadata,
      });
      if (!partidas || partidas.length === 0) {
        console.error(
          '[ERROR ASIENTO] Se intenta persistir asiento con partidas vacías',
          {
            contrato_id: contract._id,
            fecha_vencimiento: fechaVencimiento,
            descripcion: descripcionBase,
          },
        );
      }
      await this.accountingEntriesService.create({
        contrato_id: contract._id as Types.ObjectId,
        tipo_asiento: 'Alquiler',
        fecha_imputacion: fechaPeriodo.toJSDate(),
        fecha_vencimiento: fechaVencimiento,
        descripcion: descripcionBase,
        partidas: partidas,
        monto_original: montoOriginal,
        monto_actual: montoActual,
        usuario_creacion_id: new Types.ObjectId(userId),
        usuario_modificacion_id: new Types.ObjectId(userId),
        estado,
        es_ajustable: estado === 'PENDIENTE_AJUSTE',
        metadata: metadata,
      });
    }
  }

  async calculateInitialPayments(
    dto: CalculateInitialPaymentsDto,
  ): Promise<CalculateInitialPaymentsResponseDto> {
    // 1. Cargar settings para defaults
    const settings = await this.contractSettingsService.getSettings();

    // 2. Cargar cuentas contables
    if (!this.accountIdsCache) {
      this.accountIdsCache =
        await this.chartOfAccountsService.getAccountIdsByCode(
          this.REQUIRED_ACCOUNTS,
        );
    }

    // 3. Obtener información de las cuentas para los códigos/nombres
    const cuentas = await this.chartOfAccountsService.findAll();
    const cuentasMap = new Map(
      cuentas.map((c) => [
        c._id.toString(),
        { codigo: c.codigo, nombre: c.nombre },
      ]),
    );

    const getCuentaInfo = (id: Types.ObjectId) => {
      const info = cuentasMap.get(id.toString());
      return {
        codigo: info?.codigo || 'UNKNOWN',
        nombre: info?.nombre || 'Cuenta desconocida',
      };
    };

    // 4. Parsear fechas
    const fechaInicio = DateTime.fromISO(dto.fecha_inicio);
    const fechaFinal = DateTime.fromISO(dto.fecha_final);
    const ajusteProgramado = DateTime.fromISO(dto.ajuste_programado);

    // 5. Determinar si es índice FIJO o variable para la proyección
    const indice = dto.terminos_financieros.indice_tipo;
    const fechaFinProyeccion =
      indice === 'FIJO' ? fechaFinal : ajusteProgramado;

    // 6. Determinar IVA base y obtener porcentaje de comisión
    const ivaBase =
      dto.terminos_financieros.iva_calculo_base ||
      settings.iva_calculo_base_default ||
      'MAS_IVA';
    const porcentajeComision =
      (dto.terminos_financieros.comision_administracion_porcentaje ??
        settings.comision_administracion_default) / 100;

    const montoBase = dto.terminos_financieros.monto_base_vigente;

    // 7. Buscar locador y locatario
    const locador = dto.partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = dto.partes.find((p) => p.rol === AgenteRoles.LOCATARIO);

    if (!locador || !locatario) {
      throw new BadRequestException(
        'Se requiere un locador y un locatario en las partes del contrato',
      );
    }

    // ========================================
    // CALCULAR ASIENTOS DE ALQUILER MENSUAL
    // ========================================
    const asientosAlquiler: AsientoPreviewDto[] = [];
    let fechaActual = fechaInicio;
    let totalAlquileres = 0;
    let totalHonorariosInmo = 0;

    const cuentaDeudaId = this.accountIdsCache['CXC_ALQ'];
    const cuentaLocadorId = this.accountIdsCache['CXP_LOC'];
    const cuentaHonorariosId = this.accountIdsCache['ING_HNR'];

    const cuentaDeudaInfo = getCuentaInfo(cuentaDeudaId);
    const cuentaLocadorInfo = getCuentaInfo(cuentaLocadorId);
    const cuentaHonorariosInfo = getCuentaInfo(cuentaHonorariosId);

    while (fechaActual < fechaFinProyeccion) {
      const fechaVencimiento = fechaActual.plus({ days: 10 });
      const montoHonorarios = montoBase * porcentajeComision;
      const montoParaLocador = montoBase - montoHonorarios;

      const partidas: PartidaPreviewDto[] = [
        {
          cuenta_codigo: cuentaDeudaInfo.codigo,
          cuenta_nombre: cuentaDeudaInfo.nombre,
          descripcion: `Alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          debe: montoBase,
          haber: 0,
          agente_id: locatario.agente_id,
        },
        {
          cuenta_codigo: cuentaLocadorInfo.codigo,
          cuenta_nombre: cuentaLocadorInfo.nombre,
          descripcion: `Crédito por alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: montoParaLocador,
          agente_id: locador.agente_id,
        },
        {
          cuenta_codigo: cuentaHonorariosInfo.codigo,
          cuenta_nombre: cuentaHonorariosInfo.nombre,
          descripcion: `Honorarios por alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: montoHonorarios,
        },
      ];

      asientosAlquiler.push({
        tipo_asiento: 'Alquiler',
        fecha_vencimiento: fechaVencimiento.toISO(),
        descripcion: `Devengamiento alquiler ${fechaActual.toFormat('MM/yyyy')}`,
        partidas,
        total_debe: montoBase,
        total_haber: montoBase,
        imputaciones: [
          {
            rol: AgenteRoles.LOCATARIO,
            agente_id: locatario.agente_id as any,
          },
          {
            rol: AgenteRoles.LOCADOR,
            agente_id: locador.agente_id as any,
          },
        ],
      });

      totalAlquileres += montoBase;
      totalHonorariosInmo += montoHonorarios;
      fechaActual = fechaActual.plus({ months: 1 });
    }

    // ========================================
    // CALCULAR ASIENTO DE DEPÓSITO EN GARANTÍA
    // ========================================
    let asientoDeposito: AsientoPreviewDto | undefined;
    const montoDeposito = dto.deposito_monto || 0;

    if (montoDeposito > 0) {
      const cuentaPasivoDepId = this.accountIdsCache['PAS_DEP'];
      const cuentaActivoFidId = this.accountIdsCache['ACT_FID'];

      const cuentaPasivoInfo = getCuentaInfo(cuentaPasivoDepId);
      const cuentaActivoInfo = getCuentaInfo(cuentaActivoFidId);

      asientoDeposito = {
        tipo_asiento: 'Deposito en Garantia',
        fecha_vencimiento: fechaFinal.toISO(),
        descripcion: 'Registro de depósito en garantía',
        partidas: [
          {
            cuenta_codigo: cuentaPasivoInfo.codigo,
            cuenta_nombre: cuentaPasivoInfo.nombre,
            descripcion: 'Recepción de depósito en garantía',
            debe: 0,
            haber: montoDeposito,
            agente_id: locatario.agente_id,
          },
          {
            cuenta_codigo: cuentaActivoInfo.codigo,
            cuenta_nombre: cuentaActivoInfo.nombre,
            descripcion: 'Ingreso de depósito en garantía a caja/banco',
            debe: montoDeposito,
            haber: 0,
          },
        ],
        total_debe: montoDeposito,
        total_haber: montoDeposito,
        imputaciones: [
          {
            rol: AgenteRoles.LOCATARIO,
            agente_id: locatario.agente_id as any,
          },
        ],
      };
    }

    // ========================================
    // CALCULAR HONORARIOS LOCADOR (si aplica)
    // ========================================
    const asientosHonorariosLocador: AsientoPreviewDto[] = [];
    const porcentajeHonLocador =
      (dto.terminos_financieros.honorarios_locador_porcentaje ?? 0) / 100;
    const cuotasLocador =
      dto.terminos_financieros.honorarios_locador_cuotas ?? 1;

    let totalHonorariosLocador = 0;

    if (porcentajeHonLocador > 0) {
      // Calcular monto total del contrato: duración en meses × monto base vigente
      const mesesContrato = Math.round(
        fechaFinal.diff(fechaInicio, 'months').months,
      );
      const montoTotalContrato = mesesContrato * montoBase;
      const montoTotalHonorarios = montoTotalContrato * porcentajeHonLocador;
      const montoPorCuota = montoTotalHonorarios / cuotasLocador;

      for (let i = 0; i < cuotasLocador; i++) {
        const fechaVenc = fechaInicio.plus({ months: i, days: 10 });

        asientosHonorariosLocador.push({
          tipo_asiento: 'Honorarios Locador',
          fecha_vencimiento: fechaVenc.toISO(),
          descripcion: `Honorarios locador - Cuota ${i + 1}/${cuotasLocador}`,
          partidas: [
            {
              cuenta_codigo: cuentaLocadorInfo.codigo,
              cuenta_nombre: cuentaLocadorInfo.nombre,
              descripcion: `Descuento honorarios locador - Cuota ${i + 1}`,
              debe: montoPorCuota,
              haber: 0,
              agente_id: locador.agente_id,
            },
            {
              cuenta_codigo: cuentaHonorariosInfo.codigo,
              cuenta_nombre: cuentaHonorariosInfo.nombre,
              descripcion: `Ingreso honorarios locador - Cuota ${i + 1}`,
              debe: 0,
              haber: montoPorCuota,
            },
          ],
          total_debe: montoPorCuota,
          total_haber: montoPorCuota,
          imputaciones: [
            {
              rol: AgenteRoles.LOCADOR,
              agente_id: locador.agente_id as any,
            },
          ],
        });

        totalHonorariosLocador += montoPorCuota;
      }
    }

    // ========================================
    // CALCULAR HONORARIOS LOCATARIO (si aplica)
    // ========================================
    const asientosHonorariosLocatario: AsientoPreviewDto[] = [];
    const porcentajeHonLocatario =
      (dto.terminos_financieros.honorarios_locatario_porcentaje ?? 0) / 100;
    const cuotasLocatario =
      dto.terminos_financieros.honorarios_locatario_cuotas ?? 1;

    let totalHonorariosLocatario = 0;

    if (porcentajeHonLocatario > 0) {
      // Calcular monto total del contrato: duración en meses × monto base vigente
      const mesesContrato = Math.round(
        fechaFinal.diff(fechaInicio, 'months').months,
      );
      const montoTotalContrato = mesesContrato * montoBase;
      const montoPorCuota =
        (montoTotalContrato * porcentajeHonLocatario) / cuotasLocatario;

      for (let i = 0; i < cuotasLocatario; i++) {
        const fechaVenc = fechaInicio.plus({ months: i, days: 10 });

        asientosHonorariosLocatario.push({
          tipo_asiento: 'Honorarios Locatario',
          fecha_vencimiento: fechaVenc.toISO(),
          descripcion: `Honorarios locatario - Cuota ${i + 1}/${cuotasLocatario}`,
          partidas: [
            {
              cuenta_codigo: cuentaDeudaInfo.codigo,
              cuenta_nombre: cuentaDeudaInfo.nombre,
              descripcion: `Cargo honorarios locatario - Cuota ${i + 1}`,
              debe: montoPorCuota,
              haber: 0,
              agente_id: locatario.agente_id,
            },
            {
              cuenta_codigo: cuentaHonorariosInfo.codigo,
              cuenta_nombre: cuentaHonorariosInfo.nombre,
              descripcion: `Ingreso honorarios locatario - Cuota ${i + 1}`,
              debe: 0,
              haber: montoPorCuota,
            },
          ],
          total_debe: montoPorCuota,
          total_haber: montoPorCuota,
          imputaciones: [
            {
              rol: AgenteRoles.LOCATARIO,
              agente_id: locatario.agente_id as any,
            },
          ],
        });

        totalHonorariosLocatario += montoPorCuota;
      }
    }

    // ========================================
    // CONSTRUIR RESUMEN
    // ========================================
    const totalAsientos =
      asientosAlquiler.length +
      (asientoDeposito ? 1 : 0) +
      asientosHonorariosLocador.length +
      asientosHonorariosLocatario.length;

    // Desglose de honorarios inmobiliaria
    const mesesContrato = Math.round(
      fechaFinal.diff(fechaInicio, 'months').months,
    );
    const montoTotalContrato = mesesContrato * montoBase;

    const pctHonLocador =
      dto.terminos_financieros.honorarios_locador_porcentaje ?? 0;
    const cuotasHonLocador =
      dto.terminos_financieros.honorarios_locador_cuotas ?? 1;
    const montoPorCuotaLocador =
      pctHonLocador > 0
        ? (montoTotalContrato * (pctHonLocador / 100)) / cuotasHonLocador
        : 0;

    const pctHonLocatario =
      dto.terminos_financieros.honorarios_locatario_porcentaje ?? 0;
    const cuotasHonLocatario =
      dto.terminos_financieros.honorarios_locatario_cuotas ?? 1;
    const montoPorCuotaLocatario =
      pctHonLocatario > 0
        ? (montoTotalContrato * (pctHonLocatario / 100)) / cuotasHonLocatario
        : 0;

    const honorariosInmobiliaria = {
      mensual: {
        porcentaje: porcentajeComision * 100,
        monto_mensual: montoBase * porcentajeComision,
        meses_proyectados: asientosAlquiler.length,
        total: totalHonorariosInmo,
      },
      locador: {
        porcentaje: pctHonLocador,
        cuotas: cuotasHonLocador,
        monto_total: totalHonorariosLocador,
        monto_por_cuota: montoPorCuotaLocador,
      },
      locatario: {
        porcentaje: pctHonLocatario,
        cuotas: cuotasHonLocatario,
        monto_total: totalHonorariosLocatario,
        monto_por_cuota: montoPorCuotaLocatario,
      },
      notas_iva:
        ivaBase === 'MAS_IVA'
          ? 'Los montos informados son base imponible, el IVA se adiciona según corresponda.'
          : 'Los montos informados incluyen IVA en el precio (IVA incluido).',
    } as const;

    // Construir agrupamiento para pagos iniciales
    const pagosIniciales: any[] = [];
    // Helper para agregar movimientos por agente y rol
    function addMovimiento(agente_id, rol, movimiento) {
      let agente = pagosIniciales.find(
        (a) => a.agente_id === agente_id && a.rol === rol,
      );
      if (!agente) {
        agente = { agente_id, rol, movimientos: [] };
        pagosIniciales.push(agente);
      }
      agente.movimientos.push(movimiento);
    }

    // Procesar asientos iniciales relevantes
    // Alquiler mensual (primer mes)
    if (asientosAlquiler.length > 0) {
      const primerAsiento = asientosAlquiler[0];
      primerAsiento.partidas.forEach((p) => {
        if (p.agente_id === locatario.agente_id) {
          addMovimiento(locatario.agente_id, 'LOCATARIO', {
            tipo: 'Alquiler',
            cuenta: p.cuenta_codigo,
            debe: p.debe,
            haber: p.haber,
            descripcion: p.descripcion,
          });
        }
        if (p.agente_id === locador.agente_id) {
          addMovimiento(locador.agente_id, 'LOCADOR', {
            tipo: 'Alquiler',
            cuenta: p.cuenta_codigo,
            debe: p.debe,
            haber: p.haber,
            descripcion: p.descripcion,
          });
        }
        // Honorarios inmobiliaria (sin agente_id)
        if (!p.agente_id && p.cuenta_codigo === cuentaHonorariosInfo.codigo) {
          addMovimiento('INMOBILIARIA', 'INMOBILIARIA', {
            tipo: 'Honorarios',
            cuenta: p.cuenta_codigo,
            debe: p.debe,
            haber: p.haber,
            descripcion: p.descripcion,
          });
        }
      });
    }

    // Depósito en garantía
    if (asientoDeposito) {
      asientoDeposito.partidas.forEach((p) => {
        if (p.agente_id === locatario.agente_id) {
          addMovimiento(locatario.agente_id, 'LOCATARIO', {
            tipo: 'Depósito',
            cuenta: p.cuenta_codigo,
            debe: p.debe,
            haber: p.haber,
            descripcion: p.descripcion,
          });
        }
      });
    }

    // Honorarios locador
    if (asientosHonorariosLocador.length > 0) {
      asientosHonorariosLocador[0].partidas.forEach((p) => {
        if (p.agente_id === locador.agente_id) {
          addMovimiento(locador.agente_id, 'LOCADOR', {
            tipo: 'Honorarios',
            cuenta: p.cuenta_codigo,
            debe: p.debe,
            haber: p.haber,
            descripcion: p.descripcion,
          });
        }
        if (!p.agente_id && p.cuenta_codigo === cuentaHonorariosInfo.codigo) {
          addMovimiento('INMOBILIARIA', 'INMOBILIARIA', {
            tipo: 'Honorarios',
            cuenta: p.cuenta_codigo,
            debe: p.debe,
            haber: p.haber,
            descripcion: p.descripcion,
          });
        }
      });
    }

    // Honorarios locatario
    if (asientosHonorariosLocatario.length > 0) {
      asientosHonorariosLocatario[0].partidas.forEach((p) => {
        if (p.agente_id === locatario.agente_id) {
          addMovimiento(locatario.agente_id, 'LOCATARIO', {
            tipo: 'Honorarios',
            cuenta: p.cuenta_codigo,
            debe: p.debe,
            haber: p.haber,
            descripcion: p.descripcion,
          });
        }
        if (!p.agente_id && p.cuenta_codigo === cuentaHonorariosInfo.codigo) {
          addMovimiento('INMOBILIARIA', 'INMOBILIARIA', {
            tipo: 'Honorarios',
            cuenta: p.cuenta_codigo,
            debe: p.debe,
            haber: p.haber,
            descripcion: p.descripcion,
          });
        }
      });
    }

    // Calcular totalizadores por agente
    const totalizadores_por_agente = pagosIniciales.map((agente) => {
      let total_debe = 0;
      let total_haber = 0;
      agente.movimientos.forEach((mov) => {
        total_debe += mov.debe || 0;
        total_haber += mov.haber || 0;
      });
      return {
        agente_id: agente.agente_id,
        rol: agente.rol,
        total_debe,
        total_haber,
      };
    });

    return {
      asientos_alquiler: asientosAlquiler,
      asiento_deposito: asientoDeposito,
      asientos_honorarios_locador: asientosHonorariosLocador,
      asientos_honorarios_locatario: asientosHonorariosLocatario,
      iva_calculo_base: ivaBase,
      honorarios_inmobiliaria: honorariosInmobiliaria,
      resumen: {
        total_asientos: totalAsientos,
        total_meses_alquiler: asientosAlquiler.length,
        monto_total_alquileres: totalAlquileres,
        monto_deposito: montoDeposito,
        monto_total_honorarios_locador: totalHonorariosLocador,
        monto_total_honorarios_locatario: totalHonorariosLocatario,
        monto_total_honorarios_inmobiliaria: totalHonorariosInmo,
      },
      pagos_iniciales: pagosIniciales,
      totalizadores_por_agente,
    };
  }

  // async calcularRescision(
  //   _contractId: string,
  //   _fechaNotificacion: Date,
  //   _fechaRecision: Date,
  // ) {
  //   // ... [Implementation not changed]
  // }

  // async registrarRescision(
  //   _contractId: string,
  //   _fechaNotificacion: Date,
  //   _fechaRecision: Date,
  //   _penalidadMonto: number,
  //   _motivo: string,
  //   _userId: string,
  // ) {
  //   // ... [Implementation not changed]
  // }

  // private async generarAsientoPenalidad(
  //   _contract: Contract,
  //   _monto: number,
  //   _userId: string,
  // ) {
  //   // ... [Implementation not changed]
  // }

  // private async anularAsientosFuturos(
  //   _contract: Contract,
  //   _fechaRecision: Date,
  //   _userId: string,
  // ) {
  //   // ... [Implementation not changed]
  // }

  async deleteWithEntries(
    contratoId: string,
    // _dto y _userId no se usan actualmente
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _dto: { motivo?: string },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<{ contratoEliminado: boolean; asientosEliminados: number }> {
    // Los parámetros _dto y _userId están presentes para compatibilidad futura y trazabilidad, pero no se usan actualmente.
    const asientosResult =
      await this.accountingEntriesService.deleteManyByContractId(contratoId);

    const contratoResult = await this.contractModel.deleteOne({
      _id: contratoId,
    });

    return {
      contratoEliminado: contratoResult.deletedCount === 1,
      asientosEliminados: asientosResult.deletedCount || 0,
    };
  }

  async getAccruedIncome(
    contratoId: string,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<number> {
    // Buscar asientos de tipo 'Alquiler' y 'Honorarios' en el periodo
    const asientos =
      await this.accountingEntriesService.findByContractAndDateRange(
        contratoId,
        fechaInicio,
        fechaFin,
        undefined, // Estado opcional
      );
    let total = 0;
    for (const asiento of asientos) {
      // Sumar solo partidas de ingreso (haber > 0)
      asiento.partidas.forEach((p) => {
        if (p.haber && p.haber > 0) {
          total += p.haber;
        }
      });
    }
    return total;
  }

  async calcularRescision(
    _contractId: string,
    _fechaNotificacion: Date,
    _fechaRecision: Date,
  ) {
    console.log(_contractId, _fechaNotificacion, _fechaRecision);
    // TODO: Implementar lógica de cálculo de rescisión
    return Promise.resolve({ monto_penalidad: 0 });
  }

  async registrarRescision(
    _contractId: string,
    _fechaNotificacion: Date,
    _fechaRecision: Date,
    _penalidadMonto: number,
    _motivo: string,
    _userId: string,
  ) {
    console.log(
      _contractId,
      _fechaNotificacion,
      _fechaRecision,
      _penalidadMonto,
      _motivo,
      _userId,
    );
    // TODO: Implementar lógica de registro de rescisión
    return Promise.resolve({});
  }
}
