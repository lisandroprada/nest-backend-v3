import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Contract } from 'src/modules/contracts/entities/contract.entity';

@Injectable()
export class AdjustmentService {
  private readonly logger = new Logger(AdjustmentService.name);

  constructor(
    @InjectModel(Contract.name)
    private readonly contractsModel: Model<Contract>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleContractAdjustments() {
    this.logger.log('Ejecutando barrido diario de contratos para ajustar...');

    try {
      const contractsToAdjust = await this.contractsModel
        .find({
          status: 'VIGENTE',
          ajuste_programado: { $lte: new Date() }, // Contratos cuyo ajuste está vencido
        })
        .exec();

      if (contractsToAdjust.length === 0) {
        this.logger.log('No se encontraron contratos para ajustar hoy.');
        return;
      }

      this.logger.log(
        `Se encontraron ${contractsToAdjust.length} contratos para ajustar.`,
      );
      // Por ahora, solo se muestra en consola. Aquí iría la lógica de ajuste.
      console.log(contractsToAdjust);
    } catch (error) {
      this.logger.error(
        'Error durante el barrido de ajuste de contratos',
        error.stack,
      );
    }
  }
}
