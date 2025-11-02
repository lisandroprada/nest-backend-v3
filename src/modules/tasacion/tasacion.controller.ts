import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ValuationService } from './valuation.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Comparable } from './comparable.schema';
import * as Papa from 'papaparse';

@Controller('tasacion')
export class TasacionController {
  constructor(
    private readonly valuationService: ValuationService,
    @InjectModel(Comparable.name)
    private comparableModel: Model<Comparable>,
  ) {}

  /**
   * Calcula la tasación usando la versión de MarketParams vigente a la fecha indicada (opcional).
   * @param body Debe incluir propertyId, comparableIds y opcionalmente fechaTasacion (ISO string o Date)
   */
  @Post('calculate')
  async calculate(
    @Body()
    body: {
      propertyId: string;
      comparableIds: string[];
      fechaTasacion?: string | Date;
    },
  ) {
    const fecha = body.fechaTasacion ? new Date(body.fechaTasacion) : undefined;
    return this.valuationService.calculateValuation(
      body.propertyId,
      body.comparableIds,
      fecha,
    );
  }
  @Post('migrar-comparables')
  @UseInterceptors(FileInterceptor('file'))
  async migrarComparables(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se subió ningún archivo');
    const csv = file.buffer.toString('utf8');
    const { data, errors } = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
    });
    if (errors.length) {
      throw new BadRequestException(
        'Error de parseo CSV: ' + JSON.stringify(errors),
      );
    }
    const resultados = [];
    for (const row of data) {
      // Validación mínima de campos obligatorios
      if (
        !row.ciudad ||
        !row.provincia ||
        !row.m2_construidos ||
        !row.precio_m2_construido ||
        !row.moneda ||
        !row.valor_transaccion ||
        !row.estado_general
      ) {
        resultados.push({
          row,
          status: 'error',
          reason: 'Faltan campos obligatorios',
        });
        continue;
      }
      // Normalización y parseo de tipos
      try {
        const comparable: any = {
          propietario: row.propietario || undefined,
          direccion: row.direccion || undefined,
          ciudad: row.ciudad,
          provincia: row.provincia,
          localidad_id: row.localidad_id || undefined,
          m2_terreno: row.m2_terreno ? Number(row.m2_terreno) : undefined,
          m2_construidos: Number(row.m2_construidos),
          m2_semicubiertos: row.m2_semicubiertos
            ? Number(row.m2_semicubiertos)
            : undefined,
          precio_m2_construido: Number(row.precio_m2_construido),
          precio_m2_semicubierto: row.precio_m2_semicubierto
            ? Number(row.precio_m2_construido) * 0.5
            : undefined,
          precio_m2_lote: row.precio_m2_lote
            ? Number(row.precio_m2_lote)
            : undefined,
          dormitorios: row.dormitorios ? Number(row.dormitorios) : undefined,
          baños: row.baños ? Number(row.baños) : undefined,
          quincho: row.quincho === 'true' || row.quincho === true,
          garage: row.garage === 'true' || row.garage === true,
          patio: row.patio === 'true' || row.patio === true,
          antiguedad_anos: row.antiguedad_anos
            ? Number(row.antiguedad_anos)
            : undefined,
          avance_construccion: row.avance_construccion
            ? Number(row.avance_construccion)
            : undefined,
          estado_general: row.estado_general,
          ubicacion: row.ubicacion || undefined,
          moneda: row.moneda,
          valor_transaccion: Number(row.valor_transaccion),
        };
        await this.comparableModel.create(comparable);
        resultados.push({ row, status: 'ok' });
      } catch (e) {
        resultados.push({ row, status: 'error', reason: e.message });
      }
    }
    return { resultados };
  }
}
