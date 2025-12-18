import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AgenteRoles } from '../../agents/constants/agent-roles.enum';
import { ServicioImpuestoSchema } from '../../properties/entities/property.entity';

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

  // Honorarios variables por contrato
  @Prop({ type: Number, required: true })
  comision_administracion_porcentaje: number;

  @Prop({ type: Number, default: 0 })
  honorarios_locador_porcentaje: number;

  @Prop({ type: Number, default: 1 })
  honorarios_locador_cuotas: number;

  @Prop({ type: Number, default: 0 })
  honorarios_locatario_porcentaje: number;

  @Prop({ type: Number, default: 1 })
  honorarios_locatario_cuotas: number;

  // Ajustes de alquiler
  @Prop({ type: Number, default: 0 })
  ajuste_porcentaje: number;

  @Prop({ type: Number, default: 12 })
  ajuste_periodicidad_meses: number;

  @Prop({ type: Boolean, default: false })
  ajuste_es_fijo: boolean;

  @Prop({ type: Number, default: 0 })
  indice_valor_inicial: number;
}
const TerminosFinancierosSchema =
  SchemaFactory.createForClass(TerminosFinancieros);

@Schema({ timestamps: true })
export class Contract extends Document {
  // Hitos de activación
  @Prop({ type: Boolean, default: false })
  firmas_completas: boolean;

  @Prop({ type: Boolean, default: false })
  documentacion_completa: boolean;

  @Prop({ type: Boolean, default: false })
  visita_realizada: boolean;

  @Prop({ type: Boolean, default: false })
  inventario_actualizado: boolean;

  @Prop({ type: [String], default: [] })
  fotos_inventario: string[];

  // Referencia a la versión específica del inventario asociada al contrato
  @Prop({ type: Types.ObjectId, ref: 'InventoryVersion' })
  inventory_version_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
  propiedad_id: Types.ObjectId;

  @Prop({ type: [ParteSchema], required: true })
  partes: Parte[];

  @Prop({ type: Date, required: true })
  fecha_inicio: Date;

  @Prop({ type: Date, required: true })
  fecha_final: Date;

  @Prop({ type: Number, required: true })
  duracion_meses: number;

  @Prop({ type: Date })
  fecha_recision_anticipada: Date;

  @Prop({ type: Date })
  fecha_notificacion_rescision: Date;

  @Prop({ type: Number, default: 0 })
  penalidad_rescision_monto: number;

  @Prop({ type: String })
  penalidad_rescision_motivo: string;

  @Prop({ type: Number, default: 30 })
  rescision_dias_preaviso_minimo: number;

  @Prop({ type: Number, default: 90 })
  rescision_dias_sin_penalidad: number;

  @Prop({ type: Number, default: 10 })
  rescision_porcentaje_penalidad: number;

  @Prop({
    type: String,
    enum: ['VIVIENDA_UNICA', 'VIVIENDA', 'COMERCIAL', 'TEMPORARIO', 'OTROS'],
  })
  tipo_contrato: string;

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

  @Prop({ type: Number, default: 1 })
  deposito_cuotas: number;

  @Prop({ type: String, enum: ['AL_ORIGEN', 'AL_ULTIMO_ALQUILER'] })
  deposito_tipo_ajuste: string;

  @Prop({ type: Date, index: true })
  ajuste_programado: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
  // Servicios e impuestos específicos del contrato (override de la propiedad)
  @Prop({ type: [ServicioImpuestoSchema], default: [] })
  servicios_impuestos_contrato: any[];
  contract: typeof Object;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);
