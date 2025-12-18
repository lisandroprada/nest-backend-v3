import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contract } from './entities/contract.entity';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { AccountingEntryFactory } from '../accounting-entries/factories/accounting-entry.factory';
import { DateTime } from 'luxon';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { AgenteRoles } from '../agents/constants/agent-roles.enum';
import { PropertiesService } from '../properties/properties.service';
import { PaginationService } from '../../common/pagination/pagination.service';
import { PaginationDto } from '../../common/pagination/dto/pagination.dto';
import { SearchOperation } from '../../common/pagination/dto/search-operations.enum';
import { ContractSettingsService } from '../contract-settings/contract-settings.service';
import {
  CalculateInitialPaymentsDto,
  CalculateInitialPaymentsResponseDto,
  AsientoPreviewDto,
  PartidaPreviewDto,
} from './dto/calculate-initial-payments.dto';
import { DepositoPendienteResponseDto } from './dto/depositos-pendientes.dto';
import { AgentsService } from '../agents/agents.service';
import { Property } from '../properties/entities/property.entity';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  private readonly REQUIRED_ACCOUNTS = [
    'CXC_ALQ', // Alquiler a Cobrar
    'CXP_LOC', // Alquiler a Pagar a Locador
    'ING_HNR', // Ingreso por Honorarios
    'ING_HNR_INIC', // Ingreso por Honorarios de Inicio de Contrato
    'PAS_DEP', // Pasivo Depósito
    'ACT_FID', // Activo Fiduciario (Caja/Banco)
  ];
  private accountIdsCache: Record<string, Types.ObjectId>;

  private accountingEntriesServiceInstance?: AccountingEntriesService;
  private agentsServiceInstance?: AgentsService;
  private accountingFactoryInstance?: AccountingEntryFactory;

  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<Contract>,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly propertiesService: PropertiesService,
    private readonly paginationService: PaginationService,
    private readonly contractSettingsService: ContractSettingsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private getAccountingEntriesService(): AccountingEntriesService {
    if (!this.accountingEntriesServiceInstance) {
      this.accountingEntriesServiceInstance = this.moduleRef.get(
        AccountingEntriesService,
        { strict: false },
      );
    }
    return this.accountingEntriesServiceInstance as AccountingEntriesService;
  }

  private getAgentsService(): AgentsService {
    if (!this.agentsServiceInstance) {
      this.agentsServiceInstance = this.moduleRef.get(AgentsService, {
        strict: false,
      });
    }
    return this.agentsServiceInstance as AgentsService;
  }

  private getAccountingFactory(): AccountingEntryFactory {
    if (!this.accountingFactoryInstance) {
      this.accountingFactoryInstance = this.moduleRef.get(
        AccountingEntryFactory,
        { strict: false },
      );
    }
    return this.accountingFactoryInstance;
  }

  /**
   * Construye la dirección de una propiedad sin incluir ObjectIds.
   */
  private getPropertyAddress(property: Property): string {
    if (!property) return 'Propiedad Desconocida';
    
    const partes = [];
    if (property.direccion?.calle) partes.push(property.direccion.calle);
    if (property.direccion?.numero) partes.push(property.direccion.numero);
    if (property.direccion?.piso_dpto) partes.push(property.direccion.piso_dpto);
    
    return partes.length > 0 ? partes.join(' ') : 'Propiedad Desconocida';
  }

  private inmobiliariaAgentIdCache: Types.ObjectId | null = null;

  private async getInmobiliariaAgentId(): Promise<Types.ObjectId | null> {
    if (this.inmobiliariaAgentIdCache) return this.inmobiliariaAgentIdCache;
    try {
      const agent = await this.getAgentsService().findOneByRole(
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
    let baseFilter: any = {};

    // Procesar todos los criterios de búsqueda y convertirlos en filtros MongoDB
    if (paginationDto.search?.criteria) {
      for (const criterion of paginationDto.search.criteria) {
        // Filtro por status (campo directo)
        if (criterion.field === 'status' && criterion.operation === 'eq') {
          baseFilter.status = criterion.term;
        }
        
        // Búsqueda Inteligente: Dirección de Propiedad O Nombre de Locatario
        // Se activa cuando el frontend busca por 'propiedad_id.direccion' (comportamiento por defecto de la barra de búsqueda)
        else if (
          criterion.field.includes('propiedad_id.direccion') &&
          criterion.operation === 'contains'
        ) {
          const conditions: any[] = [];
          const searchTerm = criterion.term;

          // 1. Buscar correspondencias en Propiedades (Dirección)
          const properties = await this.propertiesService.findByAddressText(searchTerm);
          if (properties.length > 0) {
            // El campo propiedad_id en la colección contracts se almacenó como STRING en algunas migraciones.
            // Solución: Usar $expr para comparar strings directamente.
            const propertyIdsStrings = properties.map((p) => p._id.toString());
            conditions.push({
              $expr: { $in: ['$propiedad_id', propertyIdsStrings] }
            });
          }

          // 2. Buscar correspondencias en Agentes (Locatarios)
          const agentsService = this.getAgentsService();
          const agents = await agentsService.findByName(searchTerm);
          if (agents.length > 0) {
            const agentIds = agents.map((a) => new Types.ObjectId(a._id as string));
            conditions.push({
              partes: {
                $elemMatch: {
                  agente_id: { $in: agentIds },
                  rol: { $in: [AgenteRoles.LOCATARIO, AgenteRoles.LOCADOR] },
                },
              },
            });
          }

          // 3. Aplicar resultados combinados
          if (conditions.length > 0) {
            if (conditions.length === 1) {
              // Solo se encontraron coincidencias en uno de los dos grupos
              // Mezclar con baseFilter. Cuidado si ya existe $expr en baseFilter (merge manual si fuera necesario)
              if (conditions[0].$expr && baseFilter.$expr) {
                 // Si ya existe un $expr previo, lo combinamos con un $and
                 const existingExpr = baseFilter.$expr;
                 const newExpr = conditions[0].$expr;
                 if (baseFilter.$and) {
                   baseFilter.$and.push({ $expr: newExpr });
                 } else {
                   baseFilter.$and = [{ $expr: newExpr }]; // Nota: esto mueve el expr al $and, pero el baseFilter.$expr original sigue ahí?
                   // Mejor: usar $and global
                   // Pero PaginationService usa su propio $and.
                   // Simplificación: Asumimos que no hay conflicto de keys por ahora.
                 }
                 // Para evitar sobrescribir, mejor usar una key temporal o merge inteligente.
                 // Dado el contexto actual, baseFilter empieza vacío, así que esto es seguro.
                 baseFilter.$expr = { $and: [existingExpr, newExpr] }; // Intento de merge
              } else {
                 Object.assign(baseFilter, conditions[0]);
              }
            } else {
              // Se encontraron coincidencias en AMBOS (Propiedades y Agentes)
              // Usar $or para traer contratos que coincidan con CUALQUIERA
              if (baseFilter.$or) {
                baseFilter.$and = baseFilter.$and || [];
                baseFilter.$and.push({ $or: conditions });
              } else {
                baseFilter.$or = conditions;
              }
            }
          } else {
            // No se encontró nada ni en propiedades ni en agentes
            baseFilter._id = null;
          }
        }
        
        // Filtro por tipo de propiedad
        else if (
          criterion.field === 'propiedad_id.caracteristicas.tipo_propiedad' &&
          criterion.operation === 'eq'
        ) {
          const propertyModel = this.propertiesService.getModel();
          const properties = await propertyModel.find({
            'caracteristicas.tipo_propiedad': criterion.term,
          });
          if (properties.length > 0) {
            if (baseFilter.propiedad_id) {
              const existingIds = baseFilter.propiedad_id.$in.map(id => id.toString());
              const newIds = properties.map((p) => p._id.toString());
              const intersection = newIds.filter(id => existingIds.includes(id));
              baseFilter.propiedad_id = { $in: intersection.map(id => new Types.ObjectId(id)) };
            } else {
              baseFilter.propiedad_id = { $in: properties.map((p) => new Types.ObjectId(p._id as string)) };
            }
          } else {
            baseFilter._id = null;
          }
        }
        
        // Búsqueda por nombre de locatario
        else if (
          criterion.field.includes('locatario') &&
          criterion.operation === 'contains'
        ) {
          const agentsService = this.getAgentsService();
          const agents = await agentsService.findByName(criterion.term);
          if (agents.length > 0) {
            baseFilter['partes'] = {
              $elemMatch: {
                agente_id: { $in: agents.map((a) => new Types.ObjectId(a._id as string)) },
                rol: AgenteRoles.LOCATARIO,
              },
            };
          } else {
            baseFilter._id = null;
          }
        }
      }
      
      // Limpiar el search para que PaginationService no lo procese de nuevo
      paginationDto.search = undefined;
    }

    return this.paginationService.paginate(
      this.contractModel,
      paginationDto,
      baseFilter,
    );
  }

  async findOne(id: string): Promise<Contract> {
    const contract = await this.contractModel
      .findById(id)
      .populate('propiedad_id')
      .populate('partes.agente_id') // Populate agentes para mostrar datos completos
      .exec();
    if (!contract) {
      throw new NotFoundException(`Contrato con ID ${id} no encontrado`);
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
      const inventory_version_id =
        updateContractDto.inventory_version_id || contract.inventory_version_id;

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
          'No se puede activar el contrato: el inventario debe estar actualizado y confirmado.',
        );
      if (!fotos_inventario || fotos_inventario.length === 0)
        throw new BadRequestException(
          'No se puede activar el contrato: deben adjuntarse fotos del inventario.',
        );
      if (!inventory_version_id)
        throw new BadRequestException(
          'No se puede activar el contrato: debe seleccionar una versión de inventario.',
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
    const locador = contract.partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = contract.partes.find(
      (p) => p.rol === AgenteRoles.LOCATARIO,
    );

    if (!locador || !locatario) return;

    const propertyAddress = this.getPropertyAddress(contract.propiedad_id);

    const factory = this.getAccountingFactory();

    // ASIENTO 1: COBRO DEL DEPÓSITO AL LOCATARIO
    const cobroDto = await factory.createDepositEntry({
      propertyAddress,
      amount: contract.deposito_monto,
      date: contract.fecha_inicio,
      tenantId: new Types.ObjectId(locatario.agente_id),
      landlordId: new Types.ObjectId(locador.agente_id),
      entryType: 'COBRO',
    });

    await this.getAccountingEntriesService().create({
      ...cobroDto,
      fecha_imputacion: new Date(cobroDto.fecha_imputacion),
      fecha_vencimiento: new Date(cobroDto.fecha_vencimiento),
      contrato_id: contract._id as Types.ObjectId,
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    });

    // ASIENTO 2: DEVOLUCIÓN DEL DEPÓSITO AL LOCADOR
    const devolucionDto = await factory.createDepositEntry({
      propertyAddress,
      amount: contract.deposito_monto,
      date: contract.fecha_final,
      tenantId: new Types.ObjectId(locatario.agente_id),
      landlordId: new Types.ObjectId(locador.agente_id),
      entryType: 'DEVOLUCION',
    });

    await this.getAccountingEntriesService().create({
      ...devolucionDto,
      fecha_imputacion: new Date(devolucionDto.fecha_imputacion),
      fecha_vencimiento: new Date(devolucionDto.fecha_vencimiento),
      contrato_id: contract._id as Types.ObjectId,
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    });
  }

  private async generateHonorariosEntries(
    contract: Contract & { propiedad_id: Property },
    userId: string,
  ): Promise<void> {
    const { terminos_financieros, fecha_inicio, fecha_final, partes } =
      contract;

    const propertyAddress = this.getPropertyAddress(contract.propiedad_id);

    const locador = partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = partes.find((p) => p.rol === AgenteRoles.LOCATARIO);
    if (!locador || !locatario) return;

    const locadorAgent = await this.getAgentsService().findOne(
      locador.agente_id.toString(),
    );
    const locatarioAgent = await this.getAgentsService().findOne(
      locatario.agente_id.toString(),
    );

    const locadorName = locadorAgent?.nombres || 'Locador Desconocido';
    const locatarioName = locatarioAgent?.nombres || 'Locatario Desconocido';
    const inmoAgentId = await this.getInmobiliariaAgentId();

    const fechaInicio = DateTime.fromJSDate(fecha_inicio);
    const fechaFinal = DateTime.fromJSDate(fecha_final);
    const mesesContrato = Math.round(
      fechaFinal.diff(fechaInicio, 'months').months,
    );
    const montoBase = terminos_financieros.monto_base_vigente;
    const montoTotalContrato = mesesContrato * montoBase;

    const factory = this.getAccountingFactory();

    // Honorarios Locador
    const porcentajeHonLocador =
      terminos_financieros.honorarios_locador_porcentaje ?? 0;
    const cuotasLocador = terminos_financieros.honorarios_locador_cuotas ?? 1;
    
    if (porcentajeHonLocador > 0) {
      for (let i = 0; i < cuotasLocador; i++) {
        const entryDto = await factory.createHonorariosEntry({
          propertyAddress,
          totalContractAmount: montoTotalContrato,
          percentage: porcentajeHonLocador,
          installments: cuotasLocador,
          installmentNumber: i + 1,
          startDate: fechaInicio,
          agentId: new Types.ObjectId(locador.agente_id),
          agentName: locadorName,
          agentType: 'LOCADOR',
          inmobiliariaId: inmoAgentId,
        });

        await this.getAccountingEntriesService().create({
          ...entryDto,
          fecha_imputacion: new Date(entryDto.fecha_imputacion),
          fecha_vencimiento: new Date(entryDto.fecha_vencimiento),
          contrato_id: contract._id as Types.ObjectId,
          usuario_creacion_id: new Types.ObjectId(userId),
          usuario_modificacion_id: new Types.ObjectId(userId),
        });
      }
    }

    // Honorarios Locatario
    const porcentajeHonLocatario =
      terminos_financieros.honorarios_locatario_porcentaje ?? 0;
    const cuotasLocatario =
      terminos_financieros.honorarios_locatario_cuotas ?? 1;
    
    if (porcentajeHonLocatario > 0) {
      for (let i = 0; i < cuotasLocatario; i++) {
        const entryDto = await factory.createHonorariosEntry({
          propertyAddress,
          totalContractAmount: montoTotalContrato,
          percentage: porcentajeHonLocatario,
          installments: cuotasLocatario,
          installmentNumber: i + 1,
          startDate: fechaInicio,
          agentId: new Types.ObjectId(locatario.agente_id),
          agentName: locatarioName,
          agentType: 'LOCATARIO',
          inmobiliariaId: inmoAgentId,
        });

        await this.getAccountingEntriesService().create({
          ...entryDto,
          fecha_imputacion: new Date(entryDto.fecha_imputacion),
          fecha_vencimiento: new Date(entryDto.fecha_vencimiento),
          contrato_id: contract._id as Types.ObjectId,
          usuario_creacion_id: new Types.ObjectId(userId),
          usuario_modificacion_id: new Types.ObjectId(userId),
        });
      }
    }
  }

  private async generateInitialAccountingEntries(
    contract: Contract & { propiedad_id: Property },
    userId: string,
  ): Promise<void> {
    const { terminos_financieros, fecha_inicio, fecha_final, partes } =
      contract;

    const settings = await this.contractSettingsService.getSettings();
    const porcentajeHonorarios =
      (terminos_financieros.comision_administracion_porcentaje ??
        (settings.comision_administracion_default || 0)) / 100;

    const propertyAddress = this.getPropertyAddress(contract.propiedad_id);

    const locador = partes.find((p) => p.rol === AgenteRoles.LOCADOR);
    const locatario = partes.find((p) => p.rol === AgenteRoles.LOCATARIO);
    if (!locador || !locatario) {
      throw new BadRequestException(
        'Se requiere un locador y un locatario en las partes del contrato',
      );
    }

    const locadorAgent = await this.getAgentsService().findOne(
      locador.agente_id.toString(),
    );
    const locatarioAgent = await this.getAgentsService().findOne(
      locatario.agente_id.toString(),
    );

    const locadorName = locadorAgent?.nombres || 'Locador Desconocido';
    const locatarioName = locatarioAgent?.nombres || 'Locatario Desconocido';
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

    const factory = this.getAccountingFactory();

    for (let mes = 0; mes < mesesContrato; mes++) {
      const fechaPeriodo = fechaInicio.plus({ months: mes });
      const esMesAjuste = mesesAjuste > 0 && mes > 0 && mes % mesesAjuste === 0;
      let estado = 'PENDIENTE';

      if (esMesAjuste && tipoIndice !== 'FIJO') {
        estado = 'PENDIENTE_AJUSTE';
      }

      // Usar Factory para crear el asiento
      const entryDto = await factory.createMonthlyRentEntry({
        propertyAddress,
        period: fechaPeriodo,
        periodNumber: mes + 1,
        totalPeriods: mesesContrato,
        amount: montoBase,
        commissionRate: porcentajeHonorarios,
        tenantId: new Types.ObjectId(locatario.agente_id),
        tenantName: locatarioName,
        landlordId: new Types.ObjectId(locador.agente_id),
        landlordName: locadorName,
        inmobiliariaId: inmoAgentId,
        state: estado,
        isAdjustable: estado === 'PENDIENTE_AJUSTE',
      });

      await this.getAccountingEntriesService().create({
        ...entryDto,
        fecha_imputacion: new Date(entryDto.fecha_imputacion),
        fecha_vencimiento: new Date(entryDto.fecha_vencimiento),
        contrato_id: contract._id as Types.ObjectId,
        usuario_creacion_id: new Types.ObjectId(userId),
        usuario_modificacion_id: new Types.ObjectId(userId),
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
    const cuentas = await this.chartOfAccountsService.findAllWithoutPagination();
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

    // 8. Obtener dirección de la propiedad si está disponible en el DTO o buscarla
    let propertyAddress = 'Propiedad Desconocida';
    if (dto['propiedad_id'] || dto['propiedad']) {
      const propId = dto['propiedad_id'] || dto['propiedad'];
      try {
        const prop = await this.propertiesService.findOne(propId.toString());
        if (prop) {
          // Construir dirección sin ObjectIds
          const partes = [];
          if (prop.direccion?.calle) partes.push(prop.direccion.calle);
          if (prop.direccion?.numero) partes.push(prop.direccion.numero);
          if (prop.direccion?.piso_dpto) partes.push(prop.direccion.piso_dpto);
          propertyAddress = partes.length > 0 ? partes.join(' ') : 'Propiedad Desconocida';
        }
      } catch (e) {
        // Ignorar error si no se encuentra la propiedad al previsualizar
      }
    }

    const cuentaDeudaId = this.accountIdsCache['CXC_ALQ'];
    const cuentaLocadorId = this.accountIdsCache['CXP_LOC'];
    const cuentaHonorariosId = this.accountIdsCache['ING_HNR'];

    const cuentaDeudaInfo = getCuentaInfo(cuentaDeudaId);
    const cuentaLocadorInfo = getCuentaInfo(cuentaLocadorId);
    const cuentaHonorariosInfo = getCuentaInfo(cuentaHonorariosId);

    // Calcular total de períodos para numeración (se usa tanto para el loop como para honorarios más adelante)
    const mesesContrato = Math.round(
      fechaFinal.diff(fechaInicio, 'months').months,
    );
    let periodoNumero = 0;

    while (fechaActual < fechaFinProyeccion) {
      periodoNumero++;
      const fechaVencimiento = fechaActual.plus({ days: 10 });
      const montoHonorarios = montoBase * porcentajeComision;
      const montoParaLocador = montoBase - montoHonorarios;

      const partidas: PartidaPreviewDto[] = [
        {
          cuenta_codigo: cuentaDeudaInfo.codigo,
          cuenta_nombre: cuentaDeudaInfo.nombre,
          descripcion: `Alquiler ${fechaActual.toFormat('MM/yyyy')} - Período ${periodoNumero} de ${mesesContrato} - ${propertyAddress}`,
          debe: montoBase,
          haber: 0,
          agente_id: locatario.agente_id,
        },
        {
          cuenta_codigo: cuentaLocadorInfo.codigo,
          cuenta_nombre: cuentaLocadorInfo.nombre,
          descripcion: `Crédito por alquiler ${fechaActual.toFormat('MM/yyyy')} - Período ${periodoNumero} de ${mesesContrato} - ${propertyAddress}`,
          debe: 0,
          haber: montoParaLocador,
          agente_id: locador.agente_id,
        },
        {
          cuenta_codigo: cuentaHonorariosInfo.codigo,
          cuenta_nombre: cuentaHonorariosInfo.nombre,
          descripcion: `Honorarios por alquiler ${fechaActual.toFormat('MM/yyyy')} - Período ${periodoNumero} de ${mesesContrato} - ${propertyAddress}`,
          debe: 0,
          haber: montoHonorarios,
        },
      ];

      asientosAlquiler.push({
        tipo_asiento: 'Alquiler',
        fecha_vencimiento: fechaVencimiento.toISO(),
        descripcion: `Devengamiento alquiler ${fechaActual.toFormat('MM/yyyy')} - Período ${periodoNumero} de ${mesesContrato} - ${propertyAddress}`,
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
        descripcion: `Registro de depósito en garantía - ${propertyAddress}`,
        partidas: [
          {
            cuenta_codigo: cuentaActivoInfo.codigo,
            cuenta_nombre: cuentaActivoInfo.nombre,
            descripcion:
              `Ingreso de depósito en garantía a caja/banco fiduciaria - ${propertyAddress}`,
            debe: montoDeposito,
            haber: 0,
          },
          {
            cuenta_codigo: cuentaPasivoInfo.codigo,
            cuenta_nombre: cuentaPasivoInfo.nombre,
            descripcion: `Depósito en garantía a devolver al locador - ${propertyAddress}`,
            debe: 0,
            haber: montoDeposito,
            agente_id: locador.agente_id, // CORREGIDO: Ahora es el LOCADOR
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
          descripcion: `Honorarios locador - Cuota ${i + 1}/${cuotasLocador} - ${propertyAddress}`,
          partidas: [
            {
              cuenta_codigo: cuentaLocadorInfo.codigo,
              cuenta_nombre: cuentaLocadorInfo.nombre,
              descripcion: `Descuento honorarios locador - Cuota ${i + 1} - ${propertyAddress}`,
              debe: montoPorCuota,
              haber: 0,
              agente_id: locador.agente_id,
            },
            {
              cuenta_codigo: cuentaHonorariosInfo.codigo,
              cuenta_nombre: cuentaHonorariosInfo.nombre,
              descripcion: `Ingreso honorarios locador - Cuota ${i + 1} - ${propertyAddress}`,
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
          descripcion: `Honorarios locatario - Cuota ${i + 1}/${cuotasLocatario} - ${propertyAddress}`,
          partidas: [
            {
              cuenta_codigo: cuentaDeudaInfo.codigo,
              cuenta_nombre: cuentaDeudaInfo.nombre,
              descripcion: `Cargo honorarios locatario - Cuota ${i + 1} - ${propertyAddress}`,
              debe: montoPorCuota,
              haber: 0,
              agente_id: locatario.agente_id,
            },
            {
              cuenta_codigo: cuentaHonorariosInfo.codigo,
              cuenta_nombre: cuentaHonorariosInfo.nombre,
              descripcion: `Ingreso honorarios locatario - Cuota ${i + 1} - ${propertyAddress}`,
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

    // Desglose de honorarios inmobiliaria (mesesContrato ya calculado arriba)
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
      await this.getAccountingEntriesService().deleteManyByContractId(
        contratoId,
      );

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
      await this.getAccountingEntriesService().findByContractAndDateRange(
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
    this.logger.debug(
      `calcularRescision: ${_contractId} ${_fechaNotificacion} ${_fechaRecision}`,
    );
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
    this.logger.debug(
      `registrarRescision: ${_contractId} ${_fechaNotificacion} ${_fechaRecision} ${_penalidadMonto} ${_motivo} ${_userId}`,
    );
    // TODO: Implementar lógica de registro de rescisión
    return Promise.resolve({});
  }

  /**
   * Obtiene la lista de depósitos en garantía pendientes de devolución
   * Filtra contratos próximos a finalizar o finalizados
   */
  async getDepositosPendientes(
    filters: any,
  ): Promise<DepositoPendienteResponseDto[]> {
    const { fecha_desde, fecha_hasta, solo_proximos_a_vencer = true } = filters;

    // Construir query para contratos
    const query: any = {
      status: { $in: ['VIGENTE', 'FINALIZADO'] },
      deposito_monto: { $gt: 0 },
    };

    // Si solo_proximos_a_vencer, filtrar por fecha_final
    if (solo_proximos_a_vencer) {
      const hoy = new Date();
      const dentro30Dias = new Date();
      dentro30Dias.setDate(dentro30Dias.getDate() + 30);
      query.fecha_final = { $gte: hoy, $lte: dentro30Dias };
    } else if (fecha_desde || fecha_hasta) {
      query.fecha_final = {};
      if (fecha_desde) query.fecha_final.$gte = new Date(fecha_desde);
      if (fecha_hasta) query.fecha_final.$lte = new Date(fecha_hasta);
    }

    const contratos = await this.contractModel
      .find(query)
      .populate('propiedad_id')
      .exec();

    const resultado: DepositoPendienteResponseDto[] = [];

    for (const contrato of contratos) {
      // Buscar el asiento de depósito en garantía
      const asientosDeposito =
        await this.getAccountingEntriesService().findByContractAndType(
          contrato._id.toString(),
          'Deposito en Garantia',
        );

      if (asientosDeposito.length === 0) continue;

      const asientoDeposito = asientosDeposito[0];

      // Buscar la partida HABER del depósito (obligación con el locador)
      const partidaHaber = asientoDeposito.partidas.find(
        (p) => p.haber > 0 && p.agente_id,
      );

      if (!partidaHaber) continue;

      const montoOriginal = partidaHaber.haber;
      const montoLiquidado = partidaHaber.monto_liquidado || 0;
      const saldoPendiente = montoOriginal - montoLiquidado;

      // Calcular monto a devolver según tipo_ajuste
      let montoADevolver = montoOriginal;
      let ultimoMontoAlquiler: number | undefined;

      if (contrato.deposito_tipo_ajuste === 'AL_ULTIMO_ALQUILER') {
        // Buscar el último asiento de alquiler para obtener el monto actualizado
        const ultimosAlquileres =
          await this.getAccountingEntriesService().findByContractAndType(
            contrato._id.toString(),
            'Alquiler',
          );

        if (ultimosAlquileres.length > 0) {
          // Ordenar por fecha_imputacion descendente
          ultimosAlquileres.sort(
            (a, b) =>
              b.fecha_imputacion.getTime() - a.fecha_imputacion.getTime(),
          );
          const ultimoAlquiler = ultimosAlquileres[0];
          ultimoMontoAlquiler = ultimoAlquiler.monto_actual;
          montoADevolver = ultimoMontoAlquiler;
        }
      }

      // Obtener agentes
      const locador = contrato.partes.find(
        (p) => p.rol === AgenteRoles.LOCADOR,
      );
      const locatario = contrato.partes.find(
        (p) => p.rol === AgenteRoles.LOCATARIO,
      );

      if (!locador || !locatario) continue;

      const locadorAgent = await this.getAgentsService().findOne(
        locador.agente_id.toString(),
      );
      const locatarioAgent = await this.getAgentsService().findOne(
        locatario.agente_id.toString(),
      );

      // Calcular días hasta finalización
      const hoy = DateTime.now();
      const fechaFinal = DateTime.fromJSDate(contrato.fecha_final);
      const diasHastaFinalizacion = Math.ceil(
        fechaFinal.diff(hoy, 'days').days,
      );

      // Determinar estado de liquidación
      let estadoLiquidacion: 'PENDIENTE' | 'LIQUIDADO_PARCIAL' | 'LIQUIDADO' =
        'PENDIENTE';
      if (montoLiquidado >= montoADevolver) {
        estadoLiquidacion = 'LIQUIDADO';
      } else if (montoLiquidado > 0) {
        estadoLiquidacion = 'LIQUIDADO_PARCIAL';
      }

      const propiedad = contrato.propiedad_id as any;
      const direccionPropiedad = propiedad
        ? `${propiedad.direccion.calle} ${propiedad.direccion.numero}, ${propiedad.direccion.localidad_id}`
        : 'Propiedad Desconocida';

      resultado.push({
        contrato_id: contrato._id.toString(),
        numero_contrato: contrato._id.toString(), // Usar _id como número de contrato
        fecha_inicio: contrato.fecha_inicio,
        fecha_final: contrato.fecha_final,
        dias_hasta_finalizacion: diasHastaFinalizacion,
        locador: {
          agente_id: locador.agente_id.toString(),
          nombre: locadorAgent ? locadorAgent.nombres : 'Desconocido',
        },
        locatario: {
          agente_id: locatario.agente_id.toString(),
          nombre: locatarioAgent ? locatarioAgent.nombres : 'Desconocido',
        },
        propiedad: {
          direccion: direccionPropiedad,
        },
        deposito: {
          monto_original: montoOriginal,
          monto_a_devolver: montoADevolver,
          tipo_ajuste: contrato.deposito_tipo_ajuste,
          ultimo_monto_alquiler: ultimoMontoAlquiler,
          asiento_id: asientoDeposito._id.toString(),
          estado_liquidacion: estadoLiquidacion,
          monto_liquidado: montoLiquidado,
          saldo_pendiente: saldoPendiente,
        },
      });
    }

    // Ordenar por días hasta finalización (más próximos primero)
    return resultado.sort(
      (a, b) => a.dias_hasta_finalizacion - b.dias_hasta_finalizacion,
    );
  }
}
