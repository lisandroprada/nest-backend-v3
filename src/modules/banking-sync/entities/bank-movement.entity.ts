import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum TipoOperacion {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

@Schema({ timestamps: true, collection: 'movimientos_bancarios_externos' })
export class BankMovement extends Document {
  @Prop({ required: true, unique: true, index: true })
  identificador_unico: string; // Nº de transacción o Identificador del Debin

  @Prop({ required: true, enum: TipoOperacion })
  tipo_operacion: TipoOperacion;

  @Prop({ required: true })
  monto: number;

  @Prop({ required: true })
  fecha_operacion: Date;

  @Prop({ required: false })
  cuenta_origen_cbu: string; // CBU del remitente/pagador

  @Prop({ required: false })
  cuenta_destino_cbu: string; // CBU del beneficiario

  @Prop({ required: false })
  identificador_fiscal: string; // CUIT/CUIL del tercero

  @Prop({ required: false })
  nombre_tercero: string; // Nombre del pagador o beneficiario

  @Prop({ required: false })
  concepto_transaccion: string; // Concepto del Debin o Transferencia

  @Prop({ required: true })
  email_id: string; // ID único del email procesado

  @Prop({ default: false, index: true })
  conciliado_sistema: boolean; // Si ya fue cotejado con transacción interna

  @Prop({ required: false })
  transaccion_id: string; // ID de la transacción interna relacionada (después de conciliar)

  @Prop({ required: false })
  candidato_conciliacion_ids: string[]; // IDs de candidatos generados para validación manual

  @Prop({ required: false })
  observaciones: string; // Notas adicionales del procesamiento

  @Prop({ required: false })
  email_asunto: string; // Asunto del email original

  @Prop({ required: false })
  email_fecha: Date; // Fecha de recepción del email
}

export const BankMovementSchema = SchemaFactory.createForClass(BankMovement);

// Índices compuestos para optimizar consultas
BankMovementSchema.index({ fecha_operacion: -1 });
BankMovementSchema.index({ conciliado_sistema: 1, fecha_operacion: -1 });
BankMovementSchema.index({ tipo_operacion: 1, conciliado_sistema: 1 });
