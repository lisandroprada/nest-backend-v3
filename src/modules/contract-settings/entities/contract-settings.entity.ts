import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ContractSettings extends Document {
  // ============================================================
  // CONFIGURACIÓN FINANCIERA POR DEFECTO
  // ============================================================

  @Prop({ required: true, default: 0.05 })
  interes_mora_diaria_default: number; // % de interés diario por mora (ej: 0.05 = 5%)

  @Prop({ required: true, default: 10 })
  dias_mora_default: number; // Días de gracia antes de aplicar mora

  @Prop({
    type: String,
    enum: ['INCLUIDO', 'MAS_IVA'],
    default: 'MAS_IVA',
  })
  iva_calculo_base_default: string; // Cálculo de IVA por defecto

  // ============================================================
  // HONORARIOS POR DEFECTO
  // ============================================================

  @Prop({ required: true, default: 7 })
  comision_administracion_default: number; // % comisión mensual (6%, 7%, 8%)

  @Prop({ required: true, default: 2 })
  honorarios_locador_porcentaje_default: number; // % honorario locador

  @Prop({ required: true, default: 1 })
  honorarios_locador_cuotas_default: number; // Cuotas para pago honorarios locador

  @Prop({ required: true, default: 5 })
  honorarios_locatario_porcentaje_default: number; // % honorario locatario

  @Prop({ required: true, default: 2 })
  honorarios_locatario_cuotas_default: number; // Cuotas para pago honorarios locatario

  // ============================================================
  // CONFIGURACIÓN DE CONTRATOS POR TIPO
  // ============================================================

  @Prop({
    type: [
      {
        tipo_contrato: {
          type: String,
          enum: [
            'VIVIENDA_UNICA',
            'VIVIENDA',
            'COMERCIAL',
            'TEMPORARIO',
            'OTROS',
          ],
          required: true,
        },
        duracion_meses_default: { type: Number, required: true },
        indice_tipo_default: {
          type: String,
          enum: ['ICL', 'IPC', 'FIJO'],
          required: true,
        },
        ajuste_periodicidad_meses_default: { type: Number, required: true },
        permite_renovacion_automatica: { type: Boolean, default: false },
        // Overrides de honorarios por tipo de contrato (opcionales). Si no están presentes, se usan los globales.
        honorarios_locador_porcentaje_default: {
          type: Number,
          required: false,
        },
        honorarios_locatario_porcentaje_default: {
          type: Number,
          required: false,
        },
        descripcion: { type: String },
      },
    ],
    default: [
      {
        tipo_contrato: 'VIVIENDA_UNICA',
        duracion_meses_default: 36,
        indice_tipo_default: 'ICL',
        ajuste_periodicidad_meses_default: 12,
        permite_renovacion_automatica: true,
        honorarios_locador_porcentaje_default: 2,
        honorarios_locatario_porcentaje_default: 2,
        descripcion: 'Contrato de vivienda única - Ley 27.551',
      },
      {
        tipo_contrato: 'VIVIENDA',
        duracion_meses_default: 24,
        indice_tipo_default: 'ICL',
        ajuste_periodicidad_meses_default: 12,
        permite_renovacion_automatica: false,
        honorarios_locador_porcentaje_default: 2,
        honorarios_locatario_porcentaje_default: 2,
        descripcion: 'Contrato de vivienda estándar',
      },
      {
        tipo_contrato: 'COMERCIAL',
        duracion_meses_default: 36,
        indice_tipo_default: 'IPC',
        ajuste_periodicidad_meses_default: 6,
        permite_renovacion_automatica: true,
        honorarios_locatario_porcentaje_default: 5,
        descripcion: 'Contrato comercial',
      },
      {
        tipo_contrato: 'TEMPORARIO',
        duracion_meses_default: 6,
        indice_tipo_default: 'FIJO',
        ajuste_periodicidad_meses_default: 6,
        permite_renovacion_automatica: false,
        descripcion: 'Contrato temporario',
      },
      {
        tipo_contrato: 'OTROS',
        duracion_meses_default: 12,
        indice_tipo_default: 'FIJO',
        ajuste_periodicidad_meses_default: 12,
        permite_renovacion_automatica: false,
        descripcion: 'Otros tipos de contrato',
      },
    ],
  })
  tipos_contrato: {
    tipo_contrato: string;
    duracion_meses_default: number;
    indice_tipo_default: string;
    ajuste_periodicidad_meses_default: number;
    permite_renovacion_automatica: boolean;
    honorarios_locador_porcentaje_default?: number;
    honorarios_locatario_porcentaje_default?: number;
    descripcion?: string;
  }[];

  // ============================================================
  // CONFIGURACIÓN DE DEPÓSITOS
  // ============================================================

  @Prop({ required: true, default: 1 })
  deposito_cuotas_default: number; // Cuotas para pago de depósito

  @Prop({
    type: String,
    enum: ['AL_ORIGEN', 'AL_ULTIMO_ALQUILER'],
    default: 'AL_ULTIMO_ALQUILER',
  })
  deposito_tipo_ajuste_default: string; // Tipo de ajuste del depósito

  @Prop({ required: true, default: 1 })
  deposito_meses_alquiler: number; // Cantidad de meses de alquiler para calcular depósito (ej: 1 = 1 mes de alquiler)

  // ============================================================
  // CONFIGURACIÓN DE AJUSTES
  // ============================================================

  @Prop({ required: true, default: false })
  ajuste_es_fijo_default: boolean; // Si el ajuste es fijo o variable por índice

  @Prop({ required: true, default: 0 })
  ajuste_porcentaje_default: number; // % de ajuste si es fijo

  // ============================================================
  // NOTIFICACIONES Y ALERTAS
  // ============================================================

  @Prop({ required: true, default: 60 })
  dias_aviso_vencimiento: number; // Días antes del vencimiento para notificar

  @Prop({ required: true, default: 30 })
  dias_aviso_ajuste: number; // Días antes del ajuste para notificar

  @Prop({ required: true, default: true })
  enviar_recordatorio_pago: boolean; // Enviar recordatorios de pago

  // ============================================================
  // CONFIGURACIÓN DE RESCISIÓN ANTICIPADA
  // ============================================================

  @Prop({ required: true, default: 30 })
  rescision_dias_preaviso_minimo: number; // Días mínimos de preaviso requeridos para rescisión

  @Prop({ required: true, default: 90 })
  rescision_dias_sin_penalidad: number; // Días de anticipación para exención de penalidad (>= este valor = sin penalidad)

  @Prop({ required: true, default: 10 })
  rescision_porcentaje_penalidad: number; // % de penalidad sobre el saldo futuro (ej: 10%)

  // ============================================================
  // CONFIGURACIÓN SISTEMA
  // ============================================================

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId; // Usuario que modificó la configuración

  @Prop({ required: true, default: true })
  activo: boolean; // Si esta configuración está activa
}

export const ContractSettingsSchema =
  SchemaFactory.createForClass(ContractSettings);

// Asegurar que solo exista un documento de configuración
ContractSettingsSchema.index(
  { activo: 1 },
  { unique: true, partialFilterExpression: { activo: true } },
);
