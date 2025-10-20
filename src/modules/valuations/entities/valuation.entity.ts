import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Valuation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Property', index: true })
  propiedad_original_id: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Agent' }],
    required: true,
    index: true,
  })
  clientes_solicitantes_ids: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true, index: true })
  agente_tasador_id: Types.ObjectId;

  @Prop({ type: Number, required: true })
  honorario_facturar: number;

  @Prop({ type: Types.ObjectId, ref: 'AccountingEntry', required: true })
  asiento_debito_id: Types.ObjectId;

  @Prop({ type: Object, required: true })
  datos_propiedad_snapshot: any;

  @Prop({ type: Object })
  parametros_valoracion: any;

  @Prop({ type: Number, required: true })
  valor_estimado_final: number;

  @Prop({
    type: String,
    enum: ['PENDIENTE_COBRO', 'FINALIZADA', 'ENTREGADA'],
    default: 'PENDIENTE_COBRO',
    index: true,
  })
  estado_tasacion: string;
}

export const ValuationSchema = SchemaFactory.createForClass(Valuation);
