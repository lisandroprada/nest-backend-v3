import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContractSettings } from './entities/contract-settings.entity';
import { UpdateContractSettingsDto } from './dto/update-contract-settings.dto';
import { UpdateHonorariosTipoDto } from './dto/update-honorarios-tipo.dto';

@Injectable()
export class ContractSettingsService {
  constructor(
    @InjectModel(ContractSettings.name)
    private readonly contractSettingsModel: Model<ContractSettings>,
  ) {}

  /**
   * Obtiene la configuración activa de contratos
   * Si no existe, crea una con valores por defecto
   */
  async getSettings(): Promise<ContractSettings> {
    const settings = await this.contractSettingsModel.findOne({ activo: true });
    if (!settings) {
      throw new NotFoundException(
        'Contract settings not initialized. Please run: npm run seed:contract-settings',
      );
    }
    return settings;
  }

  /**
   * Inicializa los valores por defecto si no existen.
   * Idempotente y pensado para uso del seed de despliegue.
   */
  async initializeDefaults(): Promise<ContractSettings> {
    const defaults = {
      interes_mora_diaria_default: 0.05,
      dias_mora_default: 10,
      iva_calculo_base_default: 'MAS_IVA',
      comision_administracion_default: 7,
      honorarios_locador_porcentaje_default: 2,
      honorarios_locador_cuotas_default: 1,
      honorarios_locatario_porcentaje_default: 5,
      honorarios_locatario_cuotas_default: 2,
      deposito_cuotas_default: 1,
      deposito_tipo_ajuste_default: 'AL_ULTIMO_ALQUILER',
      deposito_meses_alquiler: 1,
      ajuste_es_fijo_default: false,
      ajuste_porcentaje_default: 0,
      dias_aviso_vencimiento: 60,
      dias_aviso_ajuste: 30,
      enviar_recordatorio_pago: true,
      rescision_dias_preaviso_minimo: 30,
      rescision_dias_sin_penalidad: 90,
      rescision_porcentaje_penalidad: 10,
      activo: true,
      tipos_contrato: [
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
    } as any;

    try {
      const doc = await this.contractSettingsModel.findOneAndUpdate(
        { activo: true },
        { $setOnInsert: defaults },
        { new: true, upsert: true },
      );
      return doc;
    } catch (error) {
      if (error?.code === 11000) {
        const existing = await this.contractSettingsModel.findOne({
          activo: true,
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  /**
   * Actualiza overrides de honorarios para un tipo de contrato
   */
  async updateHonorariosForTipo(
    tipoContrato: string,
    dto: UpdateHonorariosTipoDto,
    userId: string,
  ) {
    const settings = await this.getSettings();
    const tipos = settings.tipos_contrato.map((t) => {
      if (t.tipo_contrato === tipoContrato) {
        return {
          ...t,
          ...dto,
        } as any;
      }
      return t;
    });

    const updated = await this.contractSettingsModel.findByIdAndUpdate(
      settings._id,
      {
        tipos_contrato: tipos,
        usuario_modificacion_id: new Types.ObjectId(userId),
      },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('No se pudo actualizar honorarios del tipo');
    }
    return updated;
  }

  /**
   * Obtiene configuración específica para un tipo de contrato
   */
  async getSettingsByTipoContrato(tipoContrato: string) {
    const settings = await this.getSettings();
    const tipoConfig = settings.tipos_contrato.find(
      (t) => t.tipo_contrato === tipoContrato,
    );

    if (!tipoConfig) {
      throw new NotFoundException(
        `No se encontró configuración para el tipo de contrato: ${tipoContrato}`,
      );
    }

    const obj = settings.toObject();
    let honorariosLocador =
      tipoConfig.honorarios_locador_porcentaje_default ??
      obj.honorarios_locador_porcentaje_default;
    let honorariosLocatario =
      tipoConfig.honorarios_locatario_porcentaje_default ??
      obj.honorarios_locatario_porcentaje_default;

    // Reglas de negocio por tipo (fallback si no hay override persistido)
    if (
      tipoConfig.tipo_contrato === 'VIVIENDA_UNICA' ||
      tipoConfig.tipo_contrato === 'VIVIENDA'
    ) {
      if (tipoConfig.honorarios_locador_porcentaje_default === undefined)
        honorariosLocador = 2;
      if (tipoConfig.honorarios_locatario_porcentaje_default === undefined)
        honorariosLocatario = 2;
    } else if (tipoConfig.tipo_contrato === 'COMERCIAL') {
      if (tipoConfig.honorarios_locatario_porcentaje_default === undefined)
        honorariosLocatario = 5;
    }

    return {
      ...obj,
      tipo_contrato_seleccionado: {
        ...tipoConfig,
        honorarios_locador_porcentaje_default: honorariosLocador,
        honorarios_locatario_porcentaje_default: honorariosLocatario,
      },
      honorarios_efectivos: {
        locador_porcentaje: honorariosLocador,
        locatario_porcentaje: honorariosLocatario,
      },
    };
  }

  /**
   * Actualiza la configuración de contratos
   */
  async updateSettings(
    updateDto: UpdateContractSettingsDto,
    userId: string,
  ): Promise<ContractSettings> {
    const settings = await this.getSettings();

    const updated = await this.contractSettingsModel.findByIdAndUpdate(
      settings._id,
      {
        ...updateDto,
        usuario_modificacion_id: new Types.ObjectId(userId),
      },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('No se pudo actualizar la configuración');
    }

    return updated;
  }

  /**
   * Crea la configuración por defecto
   */
  private async createDefaultSettings(): Promise<ContractSettings> {
    const defaultSettings = new this.contractSettingsModel({
      interes_mora_diaria_default: 0.05,
      dias_mora_default: 10,
      iva_calculo_base_default: 'MAS_IVA',
      comision_administracion_default: 7,
      honorarios_locador_porcentaje_default: 2,
      honorarios_locador_cuotas_default: 1,
      honorarios_locatario_porcentaje_default: 5,
      honorarios_locatario_cuotas_default: 2,
      deposito_cuotas_default: 1,
      deposito_tipo_ajuste_default: 'AL_ULTIMO_ALQUILER',
      deposito_meses_alquiler: 1,
      ajuste_es_fijo_default: false,
      ajuste_porcentaje_default: 0,
      dias_aviso_vencimiento: 60,
      dias_aviso_ajuste: 30,
      enviar_recordatorio_pago: true,
      rescision_dias_preaviso_minimo: 30,
      rescision_dias_sin_penalidad: 90,
      rescision_porcentaje_penalidad: 10,
      activo: true,
    });

    return await defaultSettings.save();
  }

  /**
   * Resetea la configuración a valores por defecto
   */
  async resetToDefaults(userId: string): Promise<ContractSettings> {
    const settings = await this.getSettings();

    const updated = await this.contractSettingsModel.findByIdAndUpdate(
      settings._id,
      {
        interes_mora_diaria_default: 0.05,
        dias_mora_default: 10,
        iva_calculo_base_default: 'MAS_IVA',
        comision_administracion_default: 7,
        honorarios_locador_porcentaje_default: 2,
        honorarios_locador_cuotas_default: 1,
        honorarios_locatario_porcentaje_default: 5,
        honorarios_locatario_cuotas_default: 2,
        deposito_cuotas_default: 1,
        deposito_tipo_ajuste_default: 'AL_ULTIMO_ALQUILER',
        deposito_meses_alquiler: 1,
        ajuste_es_fijo_default: false,
        ajuste_porcentaje_default: 0,
        dias_aviso_vencimiento: 60,
        dias_aviso_ajuste: 30,
        enviar_recordatorio_pago: true,
        rescision_dias_preaviso_minimo: 30,
        rescision_dias_sin_penalidad: 90,
        rescision_porcentaje_penalidad: 10,
        usuario_modificacion_id: new Types.ObjectId(userId),
      },
      { new: true },
    );

    return updated;
  }
}
