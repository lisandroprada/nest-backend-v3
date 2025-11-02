import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * MarketParams (Singleton Schema)
 *
 * Este esquema almacena los parámetros macroeconómicos y de construcción
 * necesarios para la lógica de tasación inmobiliaria avanzada.
 *
 * - Solo debe existir un documento vigente por región/configuración.
 * - Incluye timestamps para trazabilidad de cambios.
 *
 * Campos:
 * - costo_m2_base_construccion: Valor base por m2 de construcción (ej: USD).
 * - indice_ajuste_mano_obra: Factor (>1.0) para ajuste por mano de obra.
 * - indice_ajuste_materiales: Factor (>1.0) para ajuste por materiales.
 * - depreciacion_anual: Curva de depreciación anual por estado (ejemplo abajo).
 * - inflacion_mensual_mercado: Factor mensual de inflación (ej: 0.005 = 0.5%).
 * - sentimiento_mercado_factor: Factor de ajuste final (ej: 1.10 = +10%).
 * - fecha_vigencia: Fecha desde la cual estos parámetros son válidos.
 *
 * Ejemplo depreciacion_anual:
 * {
 *   "excelente": 0.005,
 *   "bueno": 0.01,
 *   "regular": 0.015,
 *   "malo": 0.025
 * }
 */

@Schema({ timestamps: true })
export class MarketParams extends Document {
  @Prop({ required: true })
  costo_m2_base_construccion: number;

  @Prop({ required: true })
  indice_ajuste_mano_obra: number;

  @Prop({ required: true })
  indice_ajuste_materiales: number;

  @Prop({ required: true, type: Object })
  depreciacion_anual: Record<string, number>; // curva de depreciación por año

  /**
   * Factor de inflación mensual del mercado (ej: 0.005 = 0.5% mensual).
   * Usado para homogeneizar precios históricos.
   * Default sugerido: 0.005
   */
  @Prop({ required: true, default: 0.005 })
  inflacion_mensual_mercado: number;

  /**
   * Factor de sentimiento de mercado (ej: 1.10 = +10% optimismo).
   * Ajuste final sobre la tasación.
   * Default sugerido: 1.0
   */
  @Prop({ required: true, default: 1.0 })
  sentimiento_mercado_factor: number;

  /**
   * Fecha de vigencia de estos parámetros.
   * Se recomienda actualizar periódicamente.
   */
  @Prop({ required: true })
  fecha_vigencia: Date;
}

export const MarketParamsSchema = SchemaFactory.createForClass(MarketParams);
