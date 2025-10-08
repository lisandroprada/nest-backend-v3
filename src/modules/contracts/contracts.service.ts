import { Injectable, NotFoundException } from '@nestjs/common';
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
import { PaginationService } from 'src/common/pagination/pagination.service';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';

@Injectable()
export class ContractsService {
  private readonly REQUIRED_ACCOUNTS = [
    'CXC_ALQ', // Alquiler a Cobrar
    'CXP_LOC', // Alquiler a Pagar a Locador
    'ING_HNR', // Ingreso por Honorarios
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
  ) {}

  async create(createContractDto: CreateContractDto, userId: string): Promise<Contract> {
    this.accountIdsCache = null; // Limpiar caché en cada nueva creación
    
    const contractData = {
        ...createContractDto,
        usuario_creacion_id: new Types.ObjectId(userId),
        usuario_modificacion_id: new Types.ObjectId(userId),
    };

    const newContract = new this.contractModel(contractData);
    await newContract.save();

    await this.generateInitialAccountingEntries(newContract, userId);
    await this.generateDepositEntry(newContract, userId);

    await this.propertiesService.update(newContract.propiedad_id.toString(), { status: 'ALQUILADO', contrato_vigente_id: newContract._id.toString() }, userId);

    return newContract;
  }

  async findAll(paginationDto: PaginationDto) {
    return this.paginationService.paginate(this.contractModel, paginationDto);
  }

  async findOne(id: string): Promise<Contract> {
    const contract = await this.contractModel.findById(id).populate('propiedad_id');
    if (!contract) {
        throw new NotFoundException(`Contract with ID "${id}" not found.`);
    }
    return contract;
  }

  async update(id: string, updateContractDto: UpdateContractDto, userId: string): Promise<Contract> {
    const updatedContract = await this.contractModel.findByIdAndUpdate(id, { ...updateContractDto, usuario_modificacion_id: new Types.ObjectId(userId) }, { new: true });
    if (!updatedContract) {
        throw new NotFoundException(`Contract with ID "${id}" not found.`);
    }
    // Here you should add the logic for massive cancellation of accounting entries if the rescission date is modified.
    return updatedContract;
  }

  private async generateDepositEntry(contract: Contract, userId: string): Promise<void> {
    if (!contract.deposito_monto || contract.deposito_monto <= 0) {
      return;
    }

    const locatario = contract.partes.find((p) => p.rol === AgenteRoles.LOCATARIO);
    if (!locatario) return;

    if (!this.accountIdsCache) {
      this.accountIdsCache =
        await this.chartOfAccountsService.getAccountIdsByCode(
          this.REQUIRED_ACCOUNTS,
        );
    }

    const cuentaPasivoDepositoId = this.accountIdsCache['PAS_DEP'];
    const cuentaActivoFiduciarioId = this.accountIdsCache['ACT_FID'];

    const partidas = [
      {
        cuenta_id: cuentaPasivoDepositoId,
        descripcion: 'Recepción de depósito en garantía',
        debe: 0,
        haber: contract.deposito_monto,
        agente_id: locatario.agente_id,
      },
      {
        cuenta_id: cuentaActivoFiduciarioId,
        descripcion: 'Ingreso de depósito en garantía a caja/banco',
        debe: contract.deposito_monto,
        haber: 0,
      },
    ];

    await this.accountingEntriesService.create({
      contrato_id: contract._id as Types.ObjectId,
      tipo_asiento: 'Deposito en Garantia',
      fecha_vencimiento: contract.fecha_final.toISOString(),
      descripcion: 'Registro de depósito en garantía',
      partidas: partidas,
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    });
  }

  private async generateInitialAccountingEntries(
    contract: Contract,
    userId: string,
  ): Promise<void> {
    const {
      terminos_financieros,
      fecha_inicio,
      fecha_final,
      ajuste_programado,
      partes,
    } = contract;

    if (!this.accountIdsCache) {
      this.accountIdsCache =
        await this.chartOfAccountsService.getAccountIdsByCode(
          this.REQUIRED_ACCOUNTS,
        );
    }

    const cuentaDeudaLocatarioId = this.accountIdsCache['CXC_ALQ'];
    const cuentaIngresoLocadorId = this.accountIdsCache['CXP_LOC'];
    const cuentaIngresoInmoId = this.accountIdsCache['ING_HNR'];

    let fechaFinProyeccion: DateTime;
    if (terminos_financieros.indice_tipo === 'FIJO') {
      fechaFinProyeccion = DateTime.fromJSDate(fecha_final);
    } else {
      fechaFinProyeccion = DateTime.fromJSDate(ajuste_programado);
    }

    let fechaActual = DateTime.fromJSDate(fecha_inicio);
    const montoVigente = terminos_financieros.monto_base_vigente;

    while (fechaActual < fechaFinProyeccion) {
      const fechaVencimiento = fechaActual.plus({ days: 10 }).toJSDate();
      const locador = partes.find((p) => p.rol === AgenteRoles.LOCADOR);
      const locatario = partes.find((p) => p.rol === AgenteRoles.LOCATARIO);

      const porcentajeHonorarios = 0.03;
      const montoHonorarios = montoVigente * porcentajeHonorarios;
      const montoParaLocador = montoVigente - montoHonorarios;

      const partidas = [
        {
          cuenta_id: cuentaDeudaLocatarioId,
          descripcion: `Alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          debe: montoVigente,
          haber: 0,
          agente_id: locatario.agente_id,
        },
        {
          cuenta_id: cuentaIngresoLocadorId,
          descripcion: `Crédito por alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: montoParaLocador,
          agente_id: locador.agente_id,
        },
        {
          cuenta_id: cuentaIngresoInmoId,
          descripcion: `Honorarios por alquiler ${fechaActual.toFormat('MM/yyyy')}`,
          debe: 0,
          haber: montoHonorarios,
        },
      ];

      await this.accountingEntriesService.create({
        contrato_id: contract._id as Types.ObjectId,
        tipo_asiento: 'Alquiler',
        fecha_vencimiento: fechaVencimiento.toISOString(),
        descripcion: `Devengamiento alquiler ${fechaActual.toFormat('MM/yyyy')}`,
        partidas: partidas,
        usuario_creacion_id: new Types.ObjectId(userId),
        usuario_modificacion_id: new Types.ObjectId(userId),
      });

      fechaActual = fechaActual.plus({ months: 1 });
    }
  }
}