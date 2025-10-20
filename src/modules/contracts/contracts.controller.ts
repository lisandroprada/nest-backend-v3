import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractReportsService } from './contract-reports.service';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { User } from '../user/entities/user.entity';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';
import { CalculateInitialPaymentsDto } from './dto/calculate-initial-payments.dto';
import { DeleteContractWithEntriesDto } from './dto/delete-contract-with-entries.dto';

@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly contractReportsService: ContractReportsService,
  ) {}

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async create(
    @Body() createContractDto: CreateContractDto,
    @GetUser() user: User,
  ) {
    return this.contractsService.create(createContractDto, user._id.toString());
  }

  @Get()
  @Auth(
    ValidRoles.admin,
    ValidRoles.superUser,
    ValidRoles.contabilidad,
    ValidRoles.agente,
  )
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.contractsService.findAll(paginationDto);
  }

  @Get(':id')
  @Auth(
    ValidRoles.admin,
    ValidRoles.superUser,
    ValidRoles.contabilidad,
    ValidRoles.agente,
  )
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateContractDto: UpdateContractDto,
    @GetUser() user: User,
  ) {
    return this.contractsService.update(
      id,
      updateContractDto,
      user._id.toString(),
    );
  }

  /**
   * Dashboard de Contratos - Resumen Consolidado
   *
   * Endpoint: GET /contracts/reports/dashboard-summary
   *
   * Retorna todas las métricas operacionales y financieras del dashboard:
   * - Distribución de estados (VIGENTE, RESCINDIDO, FINALIZADO, PENDIENTE)
   * - Vencimientos próximos (90 días)
   * - Promedio financiero mensual
   * - Distribución de agentes por rol
   * - Tasa de rescisión
   * - Distribución de madurez (maturity)
   * - Proyección de facturación (histórico + 3 meses)
   * - Lista de contratos con vencimientos próximos
   */
  @Get('reports/dashboard-summary')
  @Auth(
    ValidRoles.admin,
    ValidRoles.superUser,
    ValidRoles.contabilidad,
    ValidRoles.agente,
  )
  async getDashboardSummary() {
    return this.contractReportsService.getDashboardSummary();
  }

  /**
   * POST /contracts/calculate-initial-payments
   * Calcula y retorna una vista previa de todos los asientos contables
   * que se generarán al crear un contrato, SIN persistir nada en base de datos.
   *
   * Útil para mostrar en el frontend una vista previa de los pagos antes de confirmar.
   *
   * Incluye:
   * - Asientos de alquiler mensual hasta el primer ajuste
   * - Asiento de depósito en garantía (si aplica)
   * - Asientos de honorarios del locador (si aplica)
   * - Asientos de honorarios del locatario (si aplica)
   *
   * @returns Vista previa completa con todos los asientos y resumen financiero
   */
  @Post('calculate-initial-payments')
  @Auth(
    ValidRoles.admin,
    ValidRoles.superUser,
    ValidRoles.contabilidad,
    ValidRoles.agente,
  )
  async calculateInitialPayments(@Body() dto: CalculateInitialPaymentsDto) {
    return this.contractsService.calculateInitialPayments(dto);
  }

  /**
   * POST /contracts/:id/calcular-rescision
   * Calcula la penalidad por rescisión anticipada sin aplicarla
   */
  @Post(':id/calcular-rescision')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
  async calcularRescision(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: any,
  ) {
    const fechaNotificacion = new Date(dto.fecha_notificacion_rescision);
    const fechaRecision = new Date(dto.fecha_recision_efectiva);

    return this.contractsService.calcularRescision(
      id,
      fechaNotificacion,
      fechaRecision,
    );
  }

  /**
   * POST /contracts/:id/registrar-rescision
   * Registra la rescisión anticipada del contrato y genera asientos
   */
  @Post(':id/registrar-rescision')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async registrarRescision(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: any,
    @GetUser() user: User,
  ) {
    const fechaNotificacion = new Date(dto.fecha_notificacion_rescision);
    const fechaRecision = new Date(dto.fecha_recision_anticipada);

    return this.contractsService.registrarRescision(
      id,
      fechaNotificacion,
      fechaRecision,
      dto.penalidad_monto,
      dto.motivo || 'Rescisión anticipada',
      user._id.toString(),
    );
  }

  @Delete(':id/delete-with-entries')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  @HttpCode(200)
  async deleteWithEntries(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: DeleteContractWithEntriesDto,
    @GetUser() user: User,
  ) {
    return this.contractsService.deleteWithEntries(
      id,
      dto,
      user._id.toString(),
    );
  }
}
