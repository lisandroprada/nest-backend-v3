import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorsService } from 'src/common/errors/errors.service';
import { IndexValue } from '../entities/index-value.entity';
import {
  getMonthNameEs,
  MESES_ES,
} from 'src/modules/shared/utils/constants/dates';
import * as https from 'https';

@Injectable()
export class IndexScrapperService {
  constructor(
    @InjectModel(IndexValue.name)
    private readonly indexValueModel: Model<IndexValue>,
    private readonly errorsService: ErrorsService,
  ) {}

  // Tarea automática para actualizar los índices diariamente a medianoche
  @Cron('0 0 * * *')
  async handleCron() {
    try {
      console.log('Ejecutando tarea automática para actualizar los índices...');
      await this.updateIndexData('IPC');
      await this.updateIndexData('CASAPROPIA');
      await this.updateIndexData('ICL');
    } catch (error) {
      console.error(
        'Error durante la tarea automática de actualización:',
        error,
      );
    }
  }

  // Método general para manejar la actualización de diferentes índices
  async updateIndexData(formula: string): Promise<void> {
    switch (formula) {
      case 'IPC':
        await this.updateIPC();
        break;
      case 'CASAPROPIA':
        await this.updateCasaPropia();
        break;
      case 'ICL':
        await this.updateICL();
        break;
      default:
        throw new Error(`Fórmula ${formula} no soportada`);
    }
  }

  // Actualización del IPC desde una API externa
  private async updateIPC(): Promise<void> {
    try {
      const url =
        'https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACNAL_DICI_M_15&metadata=full';
      const response = await axios.get(url);
      const seriesData = response.data.data;

      const documentsIPC = seriesData.map((datum) => {
        const [year, monthNumber] = datum[0].split('-');
        const month = getMonthNameEs(parseInt(monthNumber) - 1);
        const value = datum[1];
        const date = new Date(parseInt(year), parseInt(monthNumber) - 1, 1);

        return {
          date,
          year: parseInt(year),
          month,
          day: 1,
          formula: 'IPC',
          value,
          type: 'índice',
        };
      });

      console.log('Documentos IPC generados:', documentsIPC);

      await this.saveNewDocuments(documentsIPC, 'IPC');
    } catch (error) {
      console.error('Error al obtener los datos del IPC:', error);
      this.errorsService.handleDatabaseError(error);
    }
  }

  // Actualización del índice "Casa Propia" mediante scrapping
  private async updateCasaPropia(): Promise<void> {
    try {
      const url = 'https://ikiwi.net.ar/prestamos/coeficiente-casa-propia/';
      const response = await axios.get(url);
      const html = response.data;
      const $ = cheerio.load(html);

      const documentosCasaPropia = [];

      $('table tr').each((index, element) => {
        const tds = $(element).find('td');
        if (tds.length === 0) return; // Saltar filas vacías

        const mesAnio = $(tds[0]).text().trim();
        const coeficiente = $(tds[1]).text().trim().replace(',', '.');
        const [mes, year] = mesAnio.split(' ');
        const monthIndex = MESES_ES.indexOf(mes.toLowerCase());
        if (monthIndex === -1) return; // Mes no válido

        const dateObj = DateTime.fromObject({
          year: parseInt(year),
          month: monthIndex + 1,
          day: 1,
        });

        documentosCasaPropia.push({
          date: dateObj.toJSDate(),
          month: mes.toLowerCase(),
          year: parseInt(year),
          day: 1,
          formula: 'CASAPROPIA',
          value: parseFloat(coeficiente),
          type: 'índice',
        });
      });

      await this.saveNewDocuments(documentosCasaPropia, 'CASAPROPIA');
    } catch (error) {
      console.error(
        'Error durante el scrapping del índice Casa Propia:',
        error,
      );
      this.errorsService.handleDatabaseError(error);
    }
  }

  // Actualización del ICL desde la nueva API externa del BCRA v3.0
  private async updateICL(): Promise<void> {
    try {
      const lastRecord = await this.indexValueModel
        .findOne({ formula: 'ICL' })
        .sort({ date: -1 });
      let startDate = lastRecord
        ? DateTime.fromJSDate(lastRecord.date)
        : DateTime.fromISO('2020-07-01');
      const endDate = DateTime.now().plus({ months: 1 });

      while (startDate < endDate) {
        const nextEndDate =
          startDate.plus({ years: 1 }) < endDate
            ? startDate.plus({ years: 1 })
            : endDate;
        const desde = startDate.toFormat('yyyy-MM-dd');
        const hasta = nextEndDate.toFormat('yyyy-MM-dd');
        const url = `https://api.bcra.gob.ar/estadisticas/v3.0/monetarias/40?desde=${desde}&hasta=${hasta}`;

        const response = await axios.get(url, {
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        });

        if (!response.data || !Array.isArray(response.data.results)) {
          console.error(
            'Respuesta inesperada de la API BCRA v3.0:',
            response.data,
          );
          return;
        }

        const seriesData = response.data.results;

        const documentosICL = seriesData.map((datum) => {
          const dateObj = DateTime.fromISO(datum.fecha);
          const year = dateObj.year;
          const month = getMonthNameEs(dateObj.month - 1);
          const value = datum.valor;
          const date = dateObj.toJSDate();

          return {
            date,
            year,
            month,
            day: 1,
            formula: 'ICL',
            value,
            type: 'índice',
          };
        });

        await this.saveNewDocuments(documentosICL, 'ICL');
        startDate = nextEndDate.plus({ days: 1 });
      }
    } catch (error) {
      console.error('Error al obtener los datos del ICL (v3.0):', error);
      this.errorsService.handleDatabaseError(error);
    }
  }

  // Método genérico para guardar nuevos documentos
  async saveNewDocuments(documents: any[], formula: string): Promise<void> {
    try {
      console.log(`Intentando insertar documentos para la fórmula: ${formula}`);
      console.log('Documentos recibidos para insertar:', documents);
      // Buscar documentos existentes en la base de datos que coincidan en la fórmula y las fechas
      const existingRecords = await this.indexValueModel.find({
        formula,
        date: { $in: documents.map((doc) => doc.date) }, // Verificar registros por fecha
      });

      console.log(
        'Registros existentes encontrados en la base de datos:',
        existingRecords,
      );

      // Filtrar solo los documentos que no son duplicados basados en la fecha
      const nuevosDocumentos = documents.filter((doc) => {
        return !existingRecords.some((record) => {
          return (
            new Date(record.date).getTime() === new Date(doc.date).getTime()
          );
        });
      });

      console.log(
        'Nuevos documentos a insertar después del filtrado:',
        nuevosDocumentos,
      );

      // Insertar nuevos documentos si los hay
      if (nuevosDocumentos.length > 0) {
        const insertResult =
          await this.indexValueModel.insertMany(nuevosDocumentos);
        console.log(`Datos nuevos insertados para ${formula}:`, insertResult);
      } else {
        console.log(`No hay nuevos datos para insertar para ${formula}`);
      }
    } catch (error) {
      console.error(`Error al insertar documentos en la colección:`, error);
    }
  }
}
