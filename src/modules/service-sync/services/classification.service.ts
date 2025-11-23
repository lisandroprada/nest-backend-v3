import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ServiceCommunication,
  CommunicationStatus,
  CommunicationType,
} from '../entities/service-communication.entity';
import { Property } from '../../properties/entities/property.entity';
import { Agent } from '../../agents/entities/agent.entity';
import { DetectedExpensesService } from '../../detected-expenses/detected-expenses.service';
import { ModuleRef } from '@nestjs/core';
import { AccountingEntriesService } from '../../accounting-entries/accounting-entries.service';
import { CreateDetectedExpenseDto } from '../../detected-expenses/dto/create-detected-expense.dto';

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    @InjectModel(ServiceCommunication.name)
    private readonly commModel: Model<ServiceCommunication>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<Property>,
    @InjectModel(Agent.name)
    private readonly agentModel: Model<Agent>,
    private readonly detectedExpensesService: DetectedExpensesService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async generateCandidates(options?: {
    communicationId?: string;
    communicationIds?: string[];
    maxPerRun?: number;
    providerCuit?: string;
    tryExtractServiceId?: boolean;
  }) {
    const q: any = { estado_procesamiento: CommunicationStatus.UNPROCESSED };
    if (options?.communicationId)
      q._id = new Types.ObjectId(options.communicationId);
    if (options?.communicationIds && options.communicationIds.length > 0)
      q._id = {
        $in: options.communicationIds.map((id) => new Types.ObjectId(id)),
      };
    if (options?.providerCuit) q.proveedor_cuit = options.providerCuit;

    const limit = Math.min(Math.max(options?.maxPerRun ?? 50, 1), 200);
    const comms = await this.commModel
      .find(q)
      .sort('-fecha_email')
      .limit(limit);

    let processed = 0;
    const results: Record<string, any> = {};

    for (const c of comms) {
      try {
        // If allowed, attempt to extract identificador_servicio when missing
        if (
          !c.identificador_servicio &&
          options?.tryExtractServiceId !== false
        ) {
          const extracted = this.extractServiceIdFromText(
            (c.cuerpo_texto || '') + ' ' + (c.asunto || ''),
          );
          if (extracted) {
            // Persist the extracted identifier to the communication so subsequent runs see it
            await this.commModel.updateOne(
              { _id: c._id },
              { $set: { identificador_servicio: extracted } },
            );
            // update local object for immediate processing
            (c as any).identificador_servicio = extracted;
          }
        }

        const res = await this.processCommunication(c);
        results[c._id.toString()] = res;
        processed++;
      } catch (e) {
        this.logger.error(
          `Error clasificando comunicación ${c._id}: ${e.message}`,
        );
      }
    }

    return { processed, results };
  }

  private mapTipoAlertaToDetected(
    tipo: CommunicationType,
  ): 'FACTURA_DISPONIBLE' | 'AVISO_DEUDA' | 'AVISO_CORTE' {
    switch (tipo) {
      case CommunicationType.AVISO_CORTE:
        return 'AVISO_CORTE';
      case CommunicationType.AVISO_DEUDA:
        return 'AVISO_DEUDA';
      case CommunicationType.FACTURA_DISPONIBLE:
      case CommunicationType.VENCIMIENTO_PROXIMO:
      default:
        return 'FACTURA_DISPONIBLE';
    }
  }

  private async processCommunication(c: ServiceCommunication) {
    // Necesitamos identificador de servicio para vincular propiedad
    if (!c.identificador_servicio) {
      await this.commModel.updateOne(
        { _id: c._id },
        {
          $set: {
            estado_procesamiento: CommunicationStatus.ERROR,
            notas: 'No se pudo extraer identificador de servicio',
          },
        },
      );
      return { createdExpense: false, reason: 'NO_SERVICE_ID' };
    }

    // Normalizar identificador (eliminar guiones, barras, etc) para buscar en BD
    // Nota: Los identificadores ya deberían venir normalizados desde CamuzziScanService,
    // pero mantenemos esta normalización como medida de seguridad
    const cleanServiceId = c.identificador_servicio.replace(/[^0-9]/g, '');

    // Buscar propiedades asociadas a este identificador de servicio
    const props = await this.propertyModel
      .find({
        'servicios_impuestos.identificador_servicio': cleanServiceId,
      })
      .limit(5);

    const propiedadesIds = props.map((p) => p._id.toString());

    // Crear gasto detectado
    // Try to resolve provider agent by proveedor_id or proveedor_cuit
    let resolvedAgentId: string | null = null;
    if (c.proveedor_id) {
      resolvedAgentId = (c.proveedor_id as any)?.toString?.();
    } else if (c.proveedor_cuit) {
      // attempt to find Agent by CUIT
      try {
        const found = await this.agentModel
          .findOne({ identificador_fiscal: c.proveedor_cuit })
          .lean()
          .exec();
        if (found && found._id) resolvedAgentId = found._id.toString();
      } catch (e) {
        // ignore lookup errors
      }
    }

    const dto: CreateDetectedExpenseDto = {
      agente_proveedor_id: resolvedAgentId
        ? resolvedAgentId
        : new Types.ObjectId().toString(),
      tipo_alerta: this.mapTipoAlertaToDetected(c.tipo_alerta),
      identificador_servicio: c.identificador_servicio,
      monto_estimado: c.monto_estimado,
      estado_procesamiento: 'PENDIENTE_VALIDACION',
      cuerpo_email: c.cuerpo_texto?.slice(0, 5000),
      provider_cuit: c.proveedor_cuit || null,
    } as any;

    const expense = await this.detectedExpensesService.create(dto);

    await this.commModel.updateOne(
      { _id: c._id },
      {
        $set: {
          gasto_detectado_id: expense._id,
          propiedades_sugeridas_ids: propiedadesIds.map(
            (id) => new Types.ObjectId(id),
          ),
          estado_procesamiento: CommunicationStatus.PROCESSED,
        },
      },
    );

    // Attempt to auto-generate a propuesta_asiento for this detected expense
    try {
      const accountingSvc = this.moduleRef.get(AccountingEntriesService, {
        strict: false,
      });
      if (
        accountingSvc &&
        typeof accountingSvc.processDetectedUtilityInvoices === 'function'
      ) {
        // Fire-and-forget but await to capture potential errors during development
        await accountingSvc.processDetectedUtilityInvoices({
          detectedExpenseIds: [expense._id.toString()],
          dryRun: false,
          limit: 1,
        });
      }
    } catch (e) {
      this.logger.error(
        `Error auto-generando propuesta para detectedExpense ${expense._id}: ${e?.message || e}`,
      );
      // do not throw — proposal generation is best-effort here
    }

    return {
      createdExpense: true,
      expenseId: expense._id.toString(),
      propiedadesIds,
    };
  }

  /**
   * Heurística ligera para extraer un identificador de servicio de texto bruto
   * (asunto + cuerpo). Intenta patrones de "Cuenta" y tokens con slashes.
   */
  private extractServiceIdFromText(text: string): string | undefined {
    if (!text) return undefined;

    // Buscar patrones tipo "Cuenta" similares al parser de Camuzzi
    const accountPatterns = [
      /Nro\.?\s*Cuenta[:\s]*([0-9\/\-\.\s]{6,})/i,
      /Cuenta(?:\s*N(?:o|º|°|ro)\.?){0,1}[:\s]*([0-9\/\-\.\s]{6,})/i,
      /N\s?°\s*([0-9\/\-\.\s]{6,})/i,
      /([0-9]{3,}\/0[0-9\-]{1,}\/[0-9\-\/]{5,})/i,
    ];

    for (const p of accountPatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const raw = m[1].trim();
        // Normalizar: eliminar todo lo que no sea dígito
        const cleaned = raw.replace(/[^0-9]/g, '');
        if (cleaned.length >= 4) return cleaned;
      }
    }

    // Fallback: buscar tokens con dígitos y al menos una barra (ej: 9103/12345)
    const fallback = text.match(/[0-9]{3,}[\/][0-9A-Za-z\-\/]{3,}/);
    if (fallback) {
        return fallback[0].replace(/[^0-9]/g, '');
    }

    return undefined;
  }
}
