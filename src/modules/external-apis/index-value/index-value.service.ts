import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { IndexValue } from './entities/index-value.entity';
import { Model } from 'mongoose';
import { CreateIndexValueDto } from './dto/create-index-value.dto';

@Injectable()
export class IndexValueService {
  constructor(
    @InjectModel(IndexValue.name)
    private readonly indexValueModel: Model<IndexValue>,
  ) {}

  // Guardar un valor de índice (manual o automático)
  async saveIndexValue(
    createIndexValueDto: CreateIndexValueDto,
  ): Promise<IndexValue> {
    const newIndexValue = new this.indexValueModel(createIndexValueDto);
    return await newIndexValue.save();
  }

  // Obtener el valor más reciente de un índice específico
  async getLatestIndexValue(formula: string): Promise<IndexValue> {
    return this.indexValueModel.findOne({ formula }).sort({ date: -1 }).exec(); // Obtener el valor más reciente según la fecha
  }

  // Obtener el historial de un índice específico con un límite de resultados
  async getIndexHistory(formula: string, limit = 10): Promise<IndexValue[]> {
    return this.indexValueModel
      .find({ formula })
      .sort({ date: -1 }) // Ordenar por fecha de forma descendente
      .limit(limit) // Limitar el número de resultados
      .exec();
  }

  // Método genérico para verificar si existen registros duplicados antes de guardar
  async saveNewDocuments(documents: any[], formula: string): Promise<void> {
    const existingRecords = await this.indexValueModel.find({
      formula,
      date: { $in: documents.map((doc) => doc.date) },
    });

    const nuevosDocumentos = documents.filter((doc) => {
      return !existingRecords.some(
        (record) => record.date.getTime() === doc.date.getTime(),
      );
    });

    if (nuevosDocumentos.length > 0) {
      await this.indexValueModel.insertMany(nuevosDocumentos);
      console.log(`Datos nuevos insertados para ${formula}`);
    } else {
      console.log(`No hay nuevos datos para insertar para ${formula}`);
    }
  }

  async getLatestICLValueBeforeDate(date: Date): Promise<number | null> {
    const latestIndex = await this.indexValueModel
      .findOne({
        formula: 'ICL',
        date: { $lte: date },
      })
      .sort({ date: -1 })
      .exec();

    return latestIndex ? latestIndex.value : null;
  }

  async getICLValueByDate(date: Date): Promise<number> {
    // Crear un rango de fechas que incluya la fecha específica
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const iclValue = await this.indexValueModel
      .findOne({
        formula: 'ICL',
        date: { $gte: startOfDay, $lte: endOfDay },
      })
      .exec();

    if (!iclValue) {
      throw new Error(`No ICL value found for the exact date: ${date}`);
    }
    return iclValue.value;
  }

  async getLatestICLDate(): Promise<Date | null> {
    const latestRecord = await this.indexValueModel
      .findOne({ formula: 'ICL' })
      .sort({ date: -1 })
      .exec();

    return latestRecord ? latestRecord.date : null;
  }

  async getIPCValueByDate(date: Date): Promise<number> {
    // Restar un mes a la fecha proporcionada
    const previousMonthDate = new Date(date);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);

    const ipcValue = await this.indexValueModel
      .findOne({
        formula: 'IPC',
        date: { $lte: previousMonthDate },
      })
      .sort({ date: -1 })
      .exec();

    if (!ipcValue) {
      throw new Error(`No IPC value found for the date: ${previousMonthDate}`);
    }
    return ipcValue.value;
  }

  async getLatestIPCValueBeforeDate(date: Date): Promise<number> {
    // Restar un mes a la fecha proporcionada
    const previousMonthDate = new Date(date);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);

    const ipcValue = await this.indexValueModel
      .findOne({
        formula: 'IPC',
        date: { $lte: previousMonthDate },
      })
      .sort({ date: -1 })
      .exec();

    if (!ipcValue) {
      throw new Error(
        `No IPC value found before the date: ${previousMonthDate}`,
      );
    }
    return ipcValue.value;
  }

  async getLatestIPCDate(): Promise<Date> {
    const latestIPC = await this.indexValueModel
      .findOne({
        formula: 'IPC',
      })
      .sort({ date: -1 })
      .exec();

    if (!latestIPC) {
      throw new Error('No IPC value found');
    }
    return latestIPC.date;
  }

  async getCasaPropiaValueByDate(date: Date): Promise<number | null> {
    const casaPropiaValue = await this.indexValueModel
      .findOne({
        formula: 'CASAPROPIA',
        date: { $lte: date },
      })
      .sort({ date: -1 })
      .exec();

    return casaPropiaValue ? casaPropiaValue.value : null;
  }

  async getLatestCasaPropiaDate(): Promise<Date | null> {
    const latestRecord = await this.indexValueModel
      .findOne({ formula: 'CASAPROPIA' })
      .sort({ date: -1 })
      .exec();

    return latestRecord ? latestRecord.date : null;
  }
}
