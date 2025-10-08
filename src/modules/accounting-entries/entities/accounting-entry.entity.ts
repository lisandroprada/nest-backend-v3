import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class Partida {
  @Prop({ type: Types.ObjectId, ref: 'ChartOfAccount', required: true })
  cuenta_id: Types.ObjectId;

  @Prop({ type: String, required: true })
  descripcion: string;

  @Prop({ type: Number, default: 0 })
  debe: number; // Debit

  @Prop({ type: Number, default: 0 })
  haber: number; // Credit

  @Prop({ type: Types.ObjectId, ref: 'Agent', index: true })
  agente_id?: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  monto_pagado_acumulado?: number; // Acumulador de pagos para partidas de débito

  @Prop({ type: Boolean, default: false })
  es_iva_incluido: boolean;

  @Prop({ type: Number })
  tasa_iva_aplicada: number;

  @Prop({ type: Number })
  monto_base_imponible: number;

  @Prop({ type: Number })
  monto_iva_calculado: number;
}
const PartidaSchema = SchemaFactory.createForClass(Partida);


@Schema({ timestamps: true })
export class AccountingEntry extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Contract', index: true })
  contrato_id: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  fecha_vencimiento: Date;

  @Prop({ type: String, required: true })
  descripcion: string;

  @Prop({ type: String, required: true })
  tipo_asiento: string; // e.g., 'Alquiler', 'Expensa', 'Interes', 'Deposito en Garantía'

  @Prop({
    type: String,
    enum: ['PENDIENTE', 'PAGADO', 'PAGADO_PARCIAL', 'ANULADO', 'CONDONADO', 'PENDIENTE_APROBACION', 'LIQUIDADO', 'ANULADO_POR_RESCISION', 'PENDIENTE_FACTURAR', 'FACTURADO'],
    default: 'PENDIENTE',
    index: true
  })
  estado: string;

  @Prop({ type: Number, required: true })
  monto_original: number;

  @Prop({ type: Number, required: true })
  monto_actual: number;

  @Prop({ type: [PartidaSchema], required: true })
  partidas: Partida[];

  @Prop({ type: Boolean, default: false })
  es_ajustable: boolean; // Usado por el motor de ajustes para identificar pasivos/activos ajustables

  @Prop({ type: String })
  regla_ajuste: string; // Ej: 'AL_ULTIMO_ALQUILER' para depósitos

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
}

export const AccountingEntrySchema = SchemaFactory.createForClass(AccountingEntry);

// Índice compuesto sugerido por el DDD
AccountingEntrySchema.index({ contrato_id: 1, estado: 1, fecha_vencimiento: 1 });

// Índice para optimizar el cálculo de saldo de agentes
AccountingEntrySchema.index({ 'partidas.agente_id': 1, estado: 1 });
