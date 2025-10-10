import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FiscalDocument } from './entities/fiscal-document.entity';
import * as simpleStatistics from 'simple-statistics';

@Injectable()
export class FiscalReportsService {
  constructor(
    @InjectModel(FiscalDocument.name)
    private readonly fiscalDocModel: Model<FiscalDocument>,
  ) {}

  async getBillingSummary(months: number): Promise<any> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const historicalData = await this.fiscalDocModel.aggregate([
      {
        $match: {
          fecha_emision: { $gte: startDate },
          estado_AFIP: 'APROBADO',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$fecha_emision' },
            month: { $month: '$fecha_emision' },
          },
          totalFacturado: { $sum: '$monto_total_fiscal' },
          numeroFacturas: { $count: {} },
          monthlyData: { $push: '$monto_total_fiscal' },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
        },
      },
      {
        $project: {
            _id: 0,
            year: '$_id.year',
            month: '$_id.month',
            totalFacturado: '$totalFacturado',
            numeroFacturas: '$numeroFacturas',
            stdDev: { $stdDevPop: '$monthlyData' },
        }
      }
    ]);

    const totalBilled = historicalData.reduce((acc, item) => acc + item.totalFacturado, 0);
    const averageBilling = totalBilled / historicalData.length;

    const regressionData = historicalData.map((item, index) => [index, item.totalFacturado]);
    const { m, b } = simpleStatistics.linearRegression(regressionData);

    const projection = [];
    for (let i = 1; i <= 3; i++) {
        const nextMonthIndex = regressionData.length + i - 1;
        projection.push(m * nextMonthIndex + b);
    }

    return {
      historicalData,
      kpis: {
        averageBilling,
        totalInvoices: historicalData.reduce((acc, item) => acc + item.numeroFacturas, 0),
        dispersion: historicalData.map(item => item.stdDev), // This is monthly, maybe an average is better
        projection,
      }
    };
  }
}
