import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ContractsMigrationService } from './contracts-migration.service';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../user/entities/user.entity';

class MigrateAccountingEntriesDto {
  contractIds?: string[];
  dryRun?: boolean;
  strategy?: 'OPENING_BALANCE' | 'FULL_HISTORY';
  deleteExisting?: boolean; // Si true, elimina asientos existentes antes de regenerar
}

@Controller('contracts/migration')
@Auth(ValidRoles.admin, ValidRoles.superUser)
export class ContractsMigrationController {
  constructor(private readonly migrationService: ContractsMigrationService) {}

  /**
   * Endpoint principal de migración
   * POST /contracts/migration/generate-accounting-entries
   *
   * Body:
   * {
   *   "contractIds": ["id1", "id2"], // Opcional: IDs específicos
   *   "dryRun": true,                // Opcional: simular sin guardar
   *   "strategy": "OPENING_BALANCE"  // "OPENING_BALANCE" | "FULL_HISTORY"
   * }
   */
  @Post('generate-accounting-entries')
  async generateAccountingEntries(
    @Body() dto: MigrateAccountingEntriesDto,
    @GetUser() user: User,
  ): Promise<any> {
    const {
      contractIds,
      dryRun = false,
      strategy = 'OPENING_BALANCE',
      deleteExisting = false,
    } = dto;

    const result =
      await this.migrationService.generateAccountingEntriesForMigratedContracts(
        user._id.toString(),
        {
          contractIds,
          dryRun,
          strategy,
          deleteExisting,
        },
      );

    return {
      message: dryRun
        ? 'Simulación completada (no se guardaron datos)'
        : 'Migración completada',
      summary: result,
    };
  }

  /**
   * Obtiene contratos vigentes sin asientos contables
   * GET /contracts/migration/without-entries
   */
  @Get('without-entries')
  async getContractsWithoutEntries(): Promise<any> {
    const contracts = await this.migrationService.getContractsWithoutEntries();

    return {
      total: contracts.length,
      contracts: contracts.map((c) => ({
        id: c._id,
        propiedad_id: c.propiedad_id,
        fecha_inicio: c.fecha_inicio,
        fecha_final: c.fecha_final,
        monto_base: c.terminos_financieros.monto_base_vigente,
        status: c.status,
      })),
    };
  }

  /**
   * Migración específica de un contrato por ID
   * POST /contracts/migration/contract/:id
   * Body: { "dryRun": false, "deleteExisting": true, "strategy": "FULL_HISTORY" }
   */
  @Post('contract/:id')
  async migrateSpecificContract(
    @Param('id') contractId: string,
    @Body() dto: MigrateAccountingEntriesDto,
    @GetUser() user: User,
  ): Promise<any> {
    const {
      dryRun = false,
      strategy = 'FULL_HISTORY',
      deleteExisting = false,
    } = dto;

    const result =
      await this.migrationService.generateAccountingEntriesForMigratedContracts(
        user._id.toString(),
        {
          contractIds: [contractId],
          dryRun,
          strategy,
          deleteExisting,
        },
      );

    return {
      message: dryRun
        ? 'Simulación completada'
        : 'Contrato migrado exitosamente',
      result: result.results[0],
    };
  }
}
