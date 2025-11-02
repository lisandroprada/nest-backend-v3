import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comparable } from './comparable.schema';
import { MarketParams } from './market-params.schema';

@Injectable()
export class ValuationService {
  constructor(
    @InjectModel(Comparable.name)
    private comparableModel: Model<Comparable>,
    @InjectModel(MarketParams.name)
    private marketParamsModel: Model<MarketParams>,
  ) {}

  /**
   * Calcula la tasación usando la versión de MarketParams vigente a la fecha indicada.
   * @param propertyId ID de la propiedad a tasar
   * @param comparableIds IDs de comparables
   * @param fechaTasacion Fecha de la tasación (opcional, default: hoy)
   */
  async calculateValuation(
    propertyId: string,
    comparableIds: string[],
    fechaTasacion?: Date,
  ): Promise<any> {
    if (!comparableIds || comparableIds.length < 3) {
      throw new BadRequestException(
        'Se requieren al menos 3 comparables para la tasación.',
      );
    }
    const comparables = await this.comparableModel.find({
      _id: { $in: comparableIds },
    });
    // Seleccionar la versión vigente de MarketParams según la fecha de tasación
    const fecha = fechaTasacion || new Date();
    const marketParams = await this.marketParamsModel
      .findOne({ fecha_vigencia: { $lte: fecha } })
      .sort({ fecha_vigencia: -1 });
    if (!marketParams)
      throw new BadRequestException(
        'No hay parámetros de mercado configurados para la fecha indicada.',
      );

    // 1. Ajuste por tiempo (inflación)
    const comparablesAjustados = comparables.map((c) => {
      const meses = this.diffMonths(c.fecha_transaccion, fecha);
      const F_Tiempo = Math.pow(
        1 + marketParams.inflacion_mensual_mercado,
        meses,
      );
      const valorAjustado = c.valor_transaccion * F_Tiempo;
      return { ...c.toObject(), valorAjustado, F_Tiempo };
    });

    // 2. Valor Mercado (promedio ajustado)
    const V_Mercado =
      comparablesAjustados.reduce((acc, c) => acc + c.valorAjustado, 0) /
      comparablesAjustados.length;

    // 3. Valor Costo (reposicion)
    // Suponiendo que la propiedad a tasar tiene los mismos campos que Comparable
    // (En la práctica, buscar la propiedad y sus datos reales)
    const propiedad = comparablesAjustados[0]; // Placeholder
    const valorTerreno = V_Mercado * 0.3; // Ejemplo: 30% del valor mercado
    const valorEdificioBruto =
      propiedad.superficie_m2 *
      marketParams.costo_m2_base_construccion *
      marketParams.indice_ajuste_mano_obra *
      marketParams.indice_ajuste_materiales;
    const dep = marketParams.depreciacion_anual[propiedad.antiguedad_anos] || 1;
    const valorEdificioNeto = valorEdificioBruto * dep;
    const V_Costo = valorTerreno + valorEdificioNeto;

    // 4. Valor Final (ponderado y sentimiento)
    const V_T =
      ((V_Mercado + V_Costo) / 2) * marketParams.sentimiento_mercado_factor;

    return {
      V_Mercado,
      V_Costo,
      V_T,
      comparables: comparablesAjustados,
      marketParams: {
        _id: marketParams._id,
        fecha_vigencia: marketParams.fecha_vigencia,
        inflacion_mensual_mercado: marketParams.inflacion_mensual_mercado,
        sentimiento_mercado_factor: marketParams.sentimiento_mercado_factor,
        costo_m2_base_construccion: marketParams.costo_m2_base_construccion,
        indice_ajuste_mano_obra: marketParams.indice_ajuste_mano_obra,
        indice_ajuste_materiales: marketParams.indice_ajuste_materiales,
        depreciacion_anual: marketParams.depreciacion_anual,
      },
      fecha_tasacion: fecha,
    };
  }

  private diffMonths(date1: Date, date2: Date): number {
    return (
      (date2.getFullYear() - date1.getFullYear()) * 12 +
      (date2.getMonth() - date1.getMonth())
    );
  }
}
