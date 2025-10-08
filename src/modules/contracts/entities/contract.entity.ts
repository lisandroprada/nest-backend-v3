import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AgenteRoles } from '../../agents/constants/agent-roles.enum';

@Schema({ _id: false })
class Parte {
  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true })
  agente_id: Types.ObjectId;

  @Prop({ type: String, enum: AgenteRoles, required: true })
  rol: AgenteRoles;
}
const ParteSchema = SchemaFactory.createForClass(Parte);

@Schema({ _id: false })
class TerminosFinancieros {
  @Prop({ type: Number, required: true })
  monto_base_vigente: number;

  @Prop({ type: String, enum: ['ICL', 'IPC', 'FIJO'], required: true })
  indice_tipo: string;

  @Prop({ type: Number, default: 0 })
  interes_mora_diaria: number;

  @Prop({ type: String, enum: ['INCLUIDO', 'MAS_IVA'], default: 'MAS_IVA' })
  iva_calculo_base: string;
}
const TerminosFinancierosSchema =
  SchemaFactory.createForClass(TerminosFinancieros);

@Schema({ timestamps: true })
export class Contract extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
  propiedad_id: Types.ObjectId;

  @Prop({ type: [ParteSchema], required: true })
  partes: Parte[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Asset' }] })
  inventario_items: Types.ObjectId[];

  @Prop({ type: Date, required: true })
  fecha_inicio: Date;

  @Prop({ type: Date, required: true })
  fecha_final: Date;

  @Prop({ type: Date })
  fecha_recision_anticipada: Date;

  @Prop({
    type: String,
    enum: ['VIGENTE', 'FINALIZADO', 'RESCINDIDO', 'PENDIENTE'],
    default: 'PENDIENTE',
    index: true,
  })
  status: string;

  @Prop({ type: TerminosFinancierosSchema, required: true })
  terminos_financieros: TerminosFinancieros;

  @Prop({ type: Number })
  deposito_monto: number;

  @Prop({ type: String, enum: ['AL_ORIGEN', 'AL_ULTIMO_ALQUILER'] })
  deposito_tipo_ajuste: string;

  @Prop({ type: Date, index: true })
  ajuste_programado: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
  contract: typeof Object;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);
