import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Contract } from '../contracts/entities/contract.entity';
import { AccountingEntry } from '../accounting-entries/entities/accounting-entry.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Receipt } from '../receipts/entities/receipt.entity';
import { CashBoxMovement } from '../cash-box/entities/cash-box-movement.entity';
import { FinancialAccount } from '../financial-accounts/entities/financial-account.entity';
import { Agent } from '../agents/entities/agent.entity';
import { Property } from '../properties/entities/property.entity';
import { ChartOfAccount } from '../chart-of-accounts/entities/chart-of-account.entity';
import { ResetSystemDto, ResetSystemResponseDto } from './dto/reset-system.dto';

@Injectable()
export class SystemAdminService {
  private readonly logger = new Logger(SystemAdminService.name);

  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<Contract>,
    @InjectModel(AccountingEntry.name)
    private readonly accountingEntryModel: Model<AccountingEntry>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    @InjectModel(Receipt.name)
    private readonly receiptModel: Model<Receipt>,
    @InjectModel(CashBoxMovement.name)
    private readonly cashBoxMovementModel: Model<CashBoxMovement>,
    @InjectModel(FinancialAccount.name)
    private readonly financialAccountModel: Model<FinancialAccount>,
    @InjectModel(Agent.name)
    private readonly agentModel: Model<Agent>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<Property>,
    @InjectModel(ChartOfAccount.name)
    private readonly chartOfAccountModel: Model<ChartOfAccount>,
  ) {}

  /**
   * Resetea completamente el sistema eliminando:
   * - Contratos
   * - Asientos contables
   * - Transacciones
   * - Recibos (documentos y archivos)
   * - Movimientos de caja
   * - Resetea saldos de cuentas financieras a saldo_inicial
   *
   * Mantiene intactos:
   * - Plan de cuentas (ChartOfAccounts)
   * - Agentes (Agents)
   * - Propiedades (Properties)
   * - Usuarios (Users)
   * - Configuraciones (ContractSettings)
   * - Localidades, provincias, amenities, etc.
   */
  async resetSystem(dto: ResetSystemDto): Promise<ResetSystemResponseDto> {
    if (!dto.confirm) {
      throw new BadRequestException(
        'Debe confirmar la operación estableciendo confirm: true',
      );
    }

    const isDryRun = dto.dryRun || false;

    this.logger.warn(
      `🚨 INICIO DE RESETEO DEL SISTEMA ${isDryRun ? '(DRY RUN)' : '(REAL)'}`,
    );

    const startTime = Date.now();
    const deletedCounts = {
      contracts: 0,
      accountingEntries: 0,
      transactions: 0,
      receipts: 0,
      receiptFiles: 0, // Nuevo contador para archivos de recibos
      cashBoxMovements: 0,
      financialAccountsReset: 0,
    };

    try {
      // 1. Contar registros y archivos antes de eliminar
      const contractsCount = await this.contractModel.countDocuments();
      const entriesCount = await this.accountingEntryModel.countDocuments();
      const transactionsCount = await this.transactionModel.countDocuments();
      const receiptsCount = await this.receiptModel.countDocuments();
      const cashBoxCount = await this.cashBoxMovementModel.countDocuments();
      const financialAccountsCount =
        await this.financialAccountModel.countDocuments();

      const receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');
      const receiptFiles = fs.existsSync(receiptsDir)
        ? (await fs.promises.readdir(receiptsDir)).filter(
            (file) => file !== '.gitkeep',
          )
        : [];
      const receiptFilesCount = receiptFiles.length;

      this.logger.log('📊 Registros a eliminar:');
      this.logger.log(`   - Contratos: ${contractsCount}`);
      this.logger.log(`   - Asientos contables: ${entriesCount}`);
      this.logger.log(`   - Transacciones: ${transactionsCount}`);
      this.logger.log(`   - Recibos (DB): ${receiptsCount}`);
      this.logger.log(`   - Recibos (Archivos): ${receiptFilesCount}`);
      this.logger.log(`   - Movimientos de caja: ${cashBoxCount}`);
      this.logger.log(
        `   - Cuentas financieras a resetear: ${financialAccountsCount}`,
      );

      if (!isDryRun) {
        // 2. Eliminar movimientos de caja
        this.logger.log('🗑️  Eliminando movimientos de caja...');
        const cashBoxResult = await this.cashBoxMovementModel.deleteMany({});
        deletedCounts.cashBoxMovements = cashBoxResult.deletedCount || 0;

        // 3. Eliminar transacciones
        this.logger.log('🗑️  Eliminando transacciones...');
        const transactionsResult = await this.transactionModel.deleteMany({});
        deletedCounts.transactions = transactionsResult.deletedCount || 0;

        // 4. Eliminar recibos (documentos de la DB)
        this.logger.log('🗑️  Eliminando recibos de la base de datos...');
        const receiptsResult = await this.receiptModel.deleteMany({});
        deletedCounts.receipts = receiptsResult.deletedCount || 0;

        // 4.1. Eliminar archivos de recibos
        this.logger.log('🗑️  Eliminando archivos de recibos...');
        for (const file of receiptFiles) {
          try {
            await fs.promises.unlink(path.join(receiptsDir, file));
            deletedCounts.receiptFiles++;
          } catch (err) {
            this.logger.error(
              `No se pudo eliminar el archivo ${file}: ${err.message}`,
            );
          }
        }

        // 5. Eliminar asientos contables
        this.logger.log('🗑️  Eliminando asientos contables...');
        const entriesResult = await this.accountingEntryModel.deleteMany({});
        deletedCounts.accountingEntries = entriesResult.deletedCount || 0;

        // 6. Eliminar contratos
        this.logger.log('🗑️  Eliminando contratos...');
        const contractsResult = await this.contractModel.deleteMany({});
        deletedCounts.contracts = contractsResult.deletedCount || 0;

        // 7. Resetear saldos de cuentas financieras
        this.logger.log(
          '🔄 Reseteando saldos de cuentas financieras a saldo_inicial original...',
        );
        const financialAccounts = await this.financialAccountModel.find({});

        for (const account of financialAccounts) {
          await this.financialAccountModel.updateOne(
            { _id: account._id },
            { $set: { saldo_inicial: 0 } },
          );
          deletedCounts.financialAccountsReset++;
        }

        this.logger.log('✅ Reseteo completado exitosamente');
      } else {
        // En dry run, solo asignamos los conteos
        deletedCounts.contracts = contractsCount;
        deletedCounts.accountingEntries = entriesCount;
        deletedCounts.transactions = transactionsCount;
        deletedCounts.receipts = receiptsCount;
        deletedCounts.receiptFiles = receiptFilesCount;
        deletedCounts.cashBoxMovements = cashBoxCount;
        deletedCounts.financialAccountsReset = financialAccountsCount;

        this.logger.log(
          '✅ Simulación completada (no se eliminaron datos reales)',
        );
      }

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `⏱️  Tiempo de ejecución: ${executionTime}ms (${(
          executionTime / 1000
        ).toFixed(2)}s)`,
      );

      return {
        success: true,
        message: isDryRun
          ? 'Simulación completada. No se eliminaron datos reales.'
          : `Sistema reseteado exitosamente. Se eliminaron ${Object.values(
              deletedCounts,
            ).reduce((a, b) => a + b, 0)} registros en total.`,
        deletedCounts,
        timestamp: new Date(),
        isDryRun,
      };
    } catch (error) {
      this.logger.error('❌ Error durante el reseteo del sistema:', error);
      throw new BadRequestException(
        `Error al resetear el sistema: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene estadísticas del sistema para verificar el estado actual
   */
  async getSystemStats(): Promise<any> {
    const [
      contractsCount,
      entriesCount,
      transactionsCount,
      receiptsCount,
      cashBoxCount,
      financialAccountsCount,
      agentsCount,
      propertiesCount,
      chartOfAccountsCount,
    ] = await Promise.all([
      this.contractModel.countDocuments(),
      this.accountingEntryModel.countDocuments(),
      this.transactionModel.countDocuments(),
      this.receiptModel.countDocuments(),
      this.cashBoxMovementModel.countDocuments(),
      this.financialAccountModel.countDocuments(),
      this.agentModel.countDocuments(),
      this.propertyModel.countDocuments(),
      this.chartOfAccountModel.countDocuments(),
    ]);

    return {
      operationalData: {
        contracts: contractsCount,
        accountingEntries: entriesCount,
        transactions: transactionsCount,
        receipts: receiptsCount,
        cashBoxMovements: cashBoxCount,
        financialAccounts: financialAccountsCount,
      },
      masterData: {
        agents: agentsCount,
        properties: propertiesCount,
        chartOfAccounts: chartOfAccountsCount,
      },
      timestamp: new Date(),
    };
  }
}
