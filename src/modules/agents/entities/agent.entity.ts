import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AgenteRoles } from '../constants/agent-roles.enum';

@Schema({ _id: false })
class Direccion {
  @Prop({ type: String })
  calle: string;

  @Prop({ type: String })
  numero: string;

  @Prop({ type: String })
  piso_dpto: string;

  @Prop({ type: Types.ObjectId, ref: 'Province', required: true })
  provincia_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Locality', required: true })
  localidad_id: Types.ObjectId;

  @Prop({ type: String })
  codigo_postal: string;

  @Prop({ type: Number })
  latitud: number;

  @Prop({ type: Number })
  longitud: number;
}
const DireccionSchema = SchemaFactory.createForClass(Direccion);

@Schema({ _id: false })
class Telefono {
  @Prop({ type: String, required: true })
  numero: string;

  @Prop({ type: String, enum: ['MOVIL', 'FIJO'], required: true })
  tipo: string;
}
const TelefonoSchema = SchemaFactory.createForClass(Telefono);

@Schema({ _id: false })
class RedSocial {
  @Prop({ type: String, required: true })
  plataforma: string;

  @Prop({ type: String, required: true })
  url: string;
}
const RedSocialSchema = SchemaFactory.createForClass(RedSocial);

@Schema({ timestamps: true })
export class Agent extends Document {
  @Prop({ type: [String], enum: Object.values(AgenteRoles), required: false })
  rol: AgenteRoles[];

  @Prop({ type: String, enum: ['FISICA', 'JURIDICA'], required: true })
  persona_tipo: string;

  @Prop({ type: String, enum: ['RI', 'CF', 'MONOTRIBUTO'], required: true })
  nomenclador_fiscal: string;

  @Prop({ type: String, unique: true, required: true, index: true })
  identificador_fiscal: string;

  @Prop({ type: Boolean, default: false })
  cuit_validado: boolean;

  @Prop({ type: Date })
  cuit_validado_en: Date;

  @Prop({
    type: {
      nombre: String,
      tipoPersona: String,
      ganancias: String,
      iva: String,
    },
  })
  cuit_datos_afip: {
    nombre?: string;
    tipoPersona?: string;
    ganancias?: string;
    iva?: string;
  };

  @Prop({ type: String, required: true })
  nombre_razon_social: string;

  @Prop({ type: String })
  nombres: string;

  @Prop({ type: String })
  apellidos: string;

  @Prop({ type: String, enum: ['MASCULINO', 'FEMENINO', 'PERSONA_JURIDICA'] })
  genero: string;

  @Prop({ type: String, enum: ['DNI', 'LE', 'LC', 'PASAPORTE'] })
  documento_tipo: string;

  @Prop({ type: String, index: true })
  documento_numero: string;

  @Prop({ type: DireccionSchema })
  direccion_real: Direccion;

  @Prop({ type: DireccionSchema, required: true })
  direccion_fiscal: Direccion;

  @Prop({ type: [TelefonoSchema] })
  telefonos: Telefono[];

  @Prop({ type: String, index: true })
  email_principal: string;

  @Prop({ type: [RedSocialSchema] })
  redes_sociales: RedSocial[];

  @Prop({ type: Types.ObjectId, ref: 'Agent' })
  apoderado_id: Types.ObjectId;

  @Prop({ type: Date })
  apoderado_poder_fecha: Date;

  @Prop({ type: Boolean })
  apoderado_vigente: boolean;

  @Prop({ type: Boolean, default: false })
  check_automatizado: boolean;

  @Prop({ type: [String] })
  dominios_notificacion: string[];

  @Prop({ type: String })
  servicio_id_regex: string;

  @Prop({ type: String })
  monto_regex: string;

  @Prop({ type: String })
  pdf_search_key: string;

  @Prop({ type: [String] })
  pdf_attachment_names: string[];

  @Prop({
    type: [
      {
        cbu_alias: String,
        cbu_numero: String,
        bank_id: { type: Types.ObjectId, ref: 'Bank' },
        moneda: String,
      },
    ],
  })
  cuentas_bancarias: {
    cbu_alias: string;
    cbu_numero: string;
    bank_id: Types.ObjectId; // Reference to the Bank entity
    moneda: string;
  }[];

  @Prop({ type: String, select: false })
  password?: string;

  @Prop({ type: String, enum: ['ACTIVO', 'INACTIVO'], default: 'ACTIVO' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
