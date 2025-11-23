import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SystemConfigService } from '../../system-config/system-config.service';
import { ServiceSyncService } from '../service-sync.service';
import { ClassificationService } from './classification.service';
import {
  CommunicationStatus,
  CommunicationType,
} from '../entities/service-communication.entity';
import * as Imap from 'imap';
import { simpleParser } from 'mailparser';
import * as cheerio from 'cheerio';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent } from '../../agents/entities/agent.entity';

interface ParsedCommunication {
  email_id: string;
  proveedor_cuit?: string;
  proveedor_id?: string;
  remitente?: string;
  asunto?: string;
  fecha_email?: Date;
  cuerpo_texto?: string;
  cuerpo_html?: string;
  tipo_alerta?: CommunicationType;
  identificador_servicio?: string;
  numero_medidor?: string;
  monto_estimado?: number;
  fecha_vencimiento?: Date;
  periodo_label?: string;
}
export interface CamuzziMailData {
  tipo: 'factura' | 'corte' | 'mora' | 'otro';
  cuenta?: string;
  periodo?: string;
  monto?: number;
  vencimiento?: string;
  direccion?: string;
  nombre?: string;
  // No link fields: we only extract structured data (cuenta, monto, vencimiento, etc.)
  asunto?: string;
  remitente?: string;
}
@Injectable()
export class CamuzziScanService {
  private readonly logger = new Logger(CamuzziScanService.name);
  private isScanning = false;

  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly serviceSyncService: ServiceSyncService,
    private readonly classificationService: ClassificationService,
    @InjectModel(Agent.name)
    private readonly agentModel: Model<Agent>,
  ) {}

  /**
   * Parsea el contenido de un mail HTML/texto de Camuzzi y extrae los datos clave
   */
  parseCamuzziEmail(mail: {
    subject: string;
    from: string;
    html?: string;
    text?: string;
  }): CamuzziMailData {
    const result: CamuzziMailData = {
      tipo: 'otro',
      asunto: mail.subject,
      remitente: mail.from,
    };
    // Detectar tipo de notificación
    if (/factura/i.test(mail.subject)) result.tipo = 'factura';
    if (/corte/i.test(mail.subject)) result.tipo = 'corte';
    if (/mora/i.test(mail.subject)) result.tipo = 'mora';

    // Usar cheerio para parsear HTML si está disponible
    const $ = mail.html ? cheerio.load(mail.html) : null;
    // bodyText es preferentemente el texto dentro del body HTML; si no hay HTML, usar text plano
    let bodyText = mail.text || '';
    if ($) {
      bodyText = $('body').text();
    }

    // Construir haystack combinado (subject + body) para buscar tokens tanto en asunto como en cuerpo
    const haystack = `${mail.subject || ''} ${bodyText || ''}`;

    // Buscar número de cuenta: probar varios patrones (asunto y cuerpo pueden variar)
    const accountPatterns = [
      /Nro\.?\s*Cuenta[:\s]*([0-9\/\-\.\s]{6,})/i,
      /Cuenta(?:\s*N(?:o|º|°|ro)\.?){0,1}[:\s]*([0-9\/\-\.\s]{6,})/i,
      /N\s?°\s*([0-9\/\-\.\s]{6,})/i, // e.g. "Cuenta N° 9103/..."
      /cuentaunificadaformat["']?\s*[:=]\s*["']?([0-9\/\-\.\s]{6,})/i,
      /([0-9]{3,}\/0[0-9\-]{1,}\/[0-9\-\/]{5,})/i, // very rough fallback for long tokens with slashes
    ];

    let rawCuenta: string | undefined;
    for (const p of accountPatterns) {
      const m = haystack.match(p);
      if (m && m[1]) {
        rawCuenta = m[1].trim();
        break;
      }
    }

    if (rawCuenta) {
      // Normalizar: eliminar todo lo que no sea dígito para coincidir con la BD
      const cleaned = rawCuenta.replace(/[^0-9]/g, '');
      result.cuenta = cleaned;
    }

    // Buscar periodo (MM/YYYY o MM/YY) en haystack
    const periodoMatch = haystack.match(/(\d{2}\/\d{4}|\d{2}\/\d{2})/);
    if (periodoMatch) result.periodo = periodoMatch[1];

    // Buscar monto: preferir etiquetas como "Importe total" o "Total", si no, cualquier $... en el haystack
    let montoStr: string | undefined;
    const montoPreferidos = haystack.match(
      /(?:importe total|total)[:\s]*\$?\s*([\d\.,]+)/i,
    );
    if (montoPreferidos) montoStr = montoPreferidos[1];
    else {
      const anyMonto = haystack.match(/\$\s*([\d\.,]+)/);
      if (anyMonto) montoStr = anyMonto[1];
    }

    if (montoStr) {
      const s = montoStr.trim();
      let cleaned: string;
      // If both dot and comma present, assume dot is thousands sep and comma is decimal
      if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
        cleaned = s.replace(/\./g, '').replace(',', '.');
      } else if (s.indexOf(',') > -1 && s.indexOf('.') === -1) {
        // Only comma present -> decimal separator
        cleaned = s.replace(',', '.');
      } else {
        // Only dot or no separator -> keep dot as decimal
        cleaned = s;
      }
      // Remove any non-numeric (except dot and minus)
      cleaned = cleaned.replace(/[^0-9\.-]/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) result.monto = parsed;
    }

    // Buscar vencimiento dd/mm/yyyy (o dd/mm/yy como fallback)
    const vencMatch = haystack.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (vencMatch) result.vencimiento = vencMatch[1];
    else {
      const vencShort = haystack.match(/(\d{2}\/\d{2}\/\d{2})/);
      if (vencShort) result.vencimiento = vencShort[1];
    }

    // Buscar dirección de suministro (varios formatos)
    const dirMatch =
      haystack.match(/suministro ubicado en:?\s*([^<\n\r]+)/i) ||
      haystack.match(/suministro ubicado en la calle:?\s*([^<\n\r]+)/i) ||
      haystack.match(/ubicado en:?\s*([^<\n\r]+)/i);
    if (dirMatch) result.direccion = dirMatch[1].trim();

    // Buscar nombre del titular (heurística común en los correos)
    const nombreMatch =
      haystack.match(/Hola\s+([A-Za-zÁÉÍÓÚÑ\s]+)/i) ||
      haystack.match(/Hola,?\s*([A-Za-zÁÉÍÓÚÑ\s]+)/i) ||
      haystack.match(/PRADA TOLEDO\s+([A-Za-zÁÉÍÓÚÑ\s]+)?/i) ||
      haystack.match(/(Sr\.|Sra\.|Estimado)\s+([A-Za-zÁÉÍÓÚÑ\s]+)/i);
    if (nombreMatch) {
      // Capturar el grupo que contiene el nombre (último grupo disponible)
      const g = nombreMatch[2] || nombreMatch[1];
      if (g) result.nombre = g.trim();
    }

    // Buscar enlace de descarga desde el HTML (si existe). No detectamos enlace de pago.
    // No link extraction: we purposely do not include payment or download links.
    // The parser only extracts structured fields: cuenta, monto, vencimiento, periodo, direccion, nombre, tipo.

    return result;
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handleCron() {
    this.logger.log('Iniciando escaneo automático de emails de servicios');
    await this.scanEmails({
      autoCandidates: true,
      tryExtractServiceId: true,
    });
  }

  async scanEmails(options?: {
    providerCuit?: string;
    autoCandidates?: boolean;
    tryExtractServiceId?: boolean;
  }): Promise<{
    procesados: number;
    nuevos: number;
    duplicados: number;
    errores: number;
  }> {
    if (this.isScanning) {
      this.logger.warn('Ya hay un escaneo en progreso (service-sync)');
      return { procesados: 0, nuevos: 0, duplicados: 0, errores: 0 };
    }

    this.isScanning = true;
    let procesados = 0;
    let nuevos = 0;
    let duplicados = 0;
    let errores = 0;

    try {
      const config = await this.systemConfigService.findOneDecrypted();
      // Allow temporary override from environment variables for testing purposes.
      // Do NOT commit plaintext credentials to source control. Use env vars or DB.
      const envConfig: any = {};
      if (process.env.SERVICE_SYNC_EMAIL)
        envConfig.email_consulta = process.env.SERVICE_SYNC_EMAIL;
      if (process.env.SERVICE_SYNC_PWD)
        envConfig.password_consulta = process.env.SERVICE_SYNC_PWD;
      if (process.env.SERVICE_SYNC_HOST)
        envConfig.host_imap = process.env.SERVICE_SYNC_HOST;
      if (process.env.SERVICE_SYNC_PORT)
        envConfig.port_imap = parseInt(process.env.SERVICE_SYNC_PORT, 10);
      if (process.env.SERVICE_SYNC_SECURE)
        envConfig.secure = process.env.SERVICE_SYNC_SECURE === 'true';

      const effectiveConfig = { ...(config || {}), ...envConfig };
      const imap = await this.createImapConnection(effectiveConfig);

      const fechaInicio = new Date();
      fechaInicio.setDate(fechaInicio.getDate() - config.check_period_days);

      // Determinar remitentes válidos buscando proveedores con dominios_notificacion
      const providers = await this.findProviders(options?.providerCuit);
      const flattenedFroms = providers
        .flatMap((p) => p.dominios_notificacion || [])
        .filter(Boolean);

      const emails = await this.fetchEmails(imap, fechaInicio, flattenedFroms);
      this.logger.log(`Emails de servicios encontrados: ${emails.length}`);

      for (const email of emails) {
        procesados++;
        try {
          const parsed = await this.parseEmail(email, providers);
          if (!parsed) continue;

          const created = await this.serviceSyncService.create({
            email_id: parsed.email_id,
            proveedor_cuit: parsed.proveedor_cuit,
            proveedor_id: parsed.proveedor_id as any,
            remitente: parsed.remitente,
            asunto: parsed.asunto,
            fecha_email: parsed.fecha_email,
            cuerpo_texto: parsed.cuerpo_texto,
            cuerpo_html: parsed.cuerpo_html,
            tipo_alerta: parsed.tipo_alerta,
            identificador_servicio: parsed.identificador_servicio,
            numero_medidor: parsed.numero_medidor,
            monto_estimado: parsed.monto_estimado,
            fecha_vencimiento: parsed.fecha_vencimiento,
            periodo_label: parsed.periodo_label,
            estado_procesamiento: CommunicationStatus.UNPROCESSED,
          });

          if (created) nuevos++;
          else duplicados++;
          // If requested, attempt to generate a candidate for this communication immediately
          if (created && options?.autoCandidates) {
            try {
              await this.classificationService.generateCandidates({
                communicationId: created._id.toString(),
                tryExtractServiceId: options.tryExtractServiceId !== false,
                maxPerRun: 1,
              });
            } catch (e) {
              this.logger.error(
                `Error generating candidate for comm ${created._id}: ${e.message}`,
              );
            }
          }
        } catch (e) {
          errores++;
          this.logger.error(`Error procesando email: ${e.message}`);
        }
      }

      await this.systemConfigService.updateLastCheckDate();
    } catch (e) {
      this.logger.error(`Error en escaneo de servicios: ${e.message}`);
      throw e;
    } finally {
      this.isScanning = false;
    }

    return { procesados, nuevos, duplicados, errores };
  }

  async testConnection(): Promise<boolean> {
    try {
      const config = await this.systemConfigService.findOneDecrypted();
      const envConfig: any = {};
      if (process.env.SERVICE_SYNC_EMAIL)
        envConfig.email_consulta = process.env.SERVICE_SYNC_EMAIL;
      if (process.env.SERVICE_SYNC_PWD)
        envConfig.password_consulta = process.env.SERVICE_SYNC_PWD;
      if (process.env.SERVICE_SYNC_HOST)
        envConfig.host_imap = process.env.SERVICE_SYNC_HOST;
      if (process.env.SERVICE_SYNC_PORT)
        envConfig.port_imap = parseInt(process.env.SERVICE_SYNC_PORT, 10);
      if (process.env.SERVICE_SYNC_SECURE)
        envConfig.secure = process.env.SERVICE_SYNC_SECURE === 'true';

      const effectiveConfig = { ...(config || {}), ...envConfig };
      const imap = await this.createImapConnection(effectiveConfig);
      try {
        imap.end();
      } catch {}
      return true;
    } catch (e) {
      this.logger.error(`Test conexión IMAP (servicios) fallido: ${e.message}`);
      return false;
    }
  }

  private async createImapConnection(config: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: config.email_consulta,
        password: config.password_consulta,
        host: config.host_imap,
        port: config.port_imap,
        tls: config.secure !== false,
        tlsOptions: { rejectUnauthorized: false },
      });

      imap.once('ready', () => resolve(imap));
      imap.once('error', (err) => reject(err));
      imap.connect();
    });
  }

  private async fetchEmails(
    imap: any,
    fechaInicio: Date,
    fromDomains: string[],
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err: any) => {
        if (err) {
          reject(err);
          return;
        }

        // Si hay múltiples dominios, haremos búsquedas por cada uno y uniremos resultados
        const searchSingle = (fromExpr: string) =>
          new Promise<number[]>((res, rej) => {
            imap.search(
              [
                ['FROM', fromExpr],
                ['SINCE', fechaInicio],
              ],
              (err2: any, results: number[]) => {
                if (err2) return rej(err2);
                res(results || []);
              },
            );
          });

        const domainSearches = fromDomains.length
          ? fromDomains.map((d) => searchSingle(d))
          : [searchSingle('camuzzi')]; // fallback si no hay dominios configurados

        Promise.all(domainSearches)
          .then((arrays) => Array.from(new Set(arrays.flat())))
          .then((uids) => {
            if (!uids.length) {
              try {
                imap.end();
              } catch {}
              return resolve([]);
            }

            const emails: any[] = [];
            const fetch = imap.fetch(uids, { bodies: '' });
            fetch.on('message', (msg: any) => {
              msg.on('body', (stream: any) => {
                simpleParser(stream, (err3: any, parsed: any) => {
                  if (!err3 && parsed) {
                    emails.push({
                      html: parsed.html || parsed.textAsHtml,
                      text: parsed.text,
                      subject: parsed.subject,
                      date: parsed.date,
                      messageId: parsed.messageId,
                      from: parsed.from?.text,
                    });
                  }
                });
              });
            });
            fetch.once('error', (err4: any) => reject(err4));
            fetch.once('end', () => {
              try {
                imap.end();
              } catch {}
              resolve(emails);
            });
          })
          .catch((err5) => reject(err5));
      });
    });
  }

  private async findProviders(providerCuit?: string) {
    const q: any = { dominios_notificacion: { $exists: true, $ne: [] } };
    if (providerCuit) q.identificador_fiscal = providerCuit;
    // Por ahora priorizamos Camuzzi si no se indica otro
    const list = await this.agentModel.find(q).limit(20);
    // Ordenar para que Camuzzi (30657864427) vaya primero
    return list.sort(
      (a, b) =>
        (a.identificador_fiscal === '30657864427' ? -1 : 0) -
        (b.identificador_fiscal === '30657864427' ? -1 : 0),
    );
  }

  private async parseEmail(
    email: any,
    providers: Agent[],
  ): Promise<ParsedCommunication | null> {
    try {
      const html = email.html || email.text || '';
      const subject = email.subject || '';
      const from = email.from || '';
      const $ = cheerio.load(html || '');

      // Intentar parseo específico para Camuzzi (extrae cuenta, monto, vencimiento, enlaces)
      const camuzziData = this.parseCamuzziEmail({
        subject,
        from,
        html: email.html,
        text: email.text,
      });

      // Detectar proveedor por dominio remitente
      const foundProvider = providers.find((p) =>
        (p.dominios_notificacion || []).some((d) => from.includes(d)),
      );

      const proveedorCuit =
        foundProvider?.identificador_fiscal || '30657864427';
      const proveedorId = foundProvider?._id?.toString();

      // Clasificación básica por frases clave
      const lower = (subject + ' ' + $.root().text()).toLowerCase();
      let tipo: CommunicationType = CommunicationType.OTRO;
      if (
        lower.includes('hoy vence tu factura') ||
        lower.includes('por vencer')
      )
        tipo = CommunicationType.VENCIMIENTO_PROXIMO;
      else if (
        lower.includes('te acerca tu factura') ||
        lower.includes('nueva factura')
      )
        tipo = CommunicationType.FACTURA_DISPONIBLE;
      else if (lower.includes('deuda') || lower.includes('regularizar'))
        tipo = CommunicationType.AVISO_DEUDA;
      else if (lower.includes('suspensión') || lower.includes('corte'))
        tipo = CommunicationType.AVISO_CORTE;

      // Extraer identificador de servicio
      const servicioRegexStr =
        foundProvider?.servicio_id_regex ||
        String('(\\d{4}\\/\\d-\\d{2}-\\d{2}-\\d{7}\\/\\d)');
      const servicioRegex = new RegExp(servicioRegexStr);
      const servicioMatch = (html + ' ' + subject).match(servicioRegex);
      // Usar la coincidencia de la regex si existe, sino fallback a la cuenta
      const rawIdentificador =
        servicioMatch?.[1] || camuzziData?.cuenta || undefined;
      
      // Normalizar identificador: eliminar guiones, barras, puntos, etc.
      // Esto asegura consistencia en todos los tipos de alerta
      const identificadorServicio = rawIdentificador
        ? rawIdentificador.replace(/[^0-9]/g, '')
        : undefined;

      // Extraer monto aproximado (si aparece $ 1.234,56)
      const montoMatch = (html + ' ' + subject).match(/\$\s*([0-9\.,]+)/);
      let monto: number | undefined = undefined;
      if (montoMatch) {
        const cleaned = montoMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) monto = parsed;
      }

      // Vencimiento: soportar dd/mm/yyyy y dd/mm/yy
      let fechaVenc: Date | undefined = undefined;
      const fullFechaMatch = (html + ' ' + subject).match(
        /(\d{2})\/(\d{2})\/(\d{4})/,
      );
      const shortFechaMatch = (html + ' ' + subject).match(
        /(\d{2})\/(\d{2})\/(\d{2})(?!\d)/,
      );
      if (fullFechaMatch) {
        const [, dd, mm, yyyy] = fullFechaMatch;
        fechaVenc = new Date(`${yyyy}-${mm}-${dd}`);
      } else if (shortFechaMatch) {
        const [, dd, mm, yy] = shortFechaMatch;
        const yyyy = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
        fechaVenc = new Date(`${yyyy}-${mm}-${dd}`);
      } else if (camuzziData?.vencimiento) {
        // Intentar parsear la cadena extraída por el parser específico
        const v = camuzziData.vencimiento.trim();
        const mFull = v.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const mShort = v.match(/(\d{2})\/(\d{2})\/(\d{2})(?!\d)/);
        if (mFull) {
          const [, dd, mm, yyyy] = mFull;
          fechaVenc = new Date(`${yyyy}-${mm}-${dd}`);
        } else if (mShort) {
          const [, dd, mm, yy] = mShort;
          const yyyy = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
          fechaVenc = new Date(`${yyyy}-${mm}-${dd}`);
        }
      }

      // Periodo MM/YYYY
      const periodo = (html + ' ' + subject).match(/(\d{2}\/\d{4})/)
        ? (html + ' ' + subject).match(/(\d{2}\/\d{4})/)?.[1]
        : undefined;

      const parsed: ParsedCommunication = {
        email_id: email.messageId || `${Date.now()}-${Math.random()}`,
        proveedor_cuit: proveedorCuit,
        proveedor_id: proveedorId,
        remitente: from,
        asunto: subject,
        fecha_email: email.date,
        cuerpo_texto: email.text,
        cuerpo_html: email.html,
        tipo_alerta: tipo,
        identificador_servicio: identificadorServicio,
        monto_estimado: monto,
        fecha_vencimiento: fechaVenc,
        periodo_label: periodo,
      };

      if (!parsed.identificador_servicio) {
        // No podemos vincular sin identificador de servicio
        this.logger.warn(
          `Email sin identificador de servicio detectable - asunto: ${subject} - remitente: ${from}`,
        );
        if (camuzziData?.cuenta) {
          this.logger.log(
            `Camuzzi parser extrajo cuenta como fallback: ${camuzziData.cuenta}`,
          );
        }
      } else {
        this.logger.log(
          `Identificador detectado: ${parsed.identificador_servicio} (asunto: ${subject})`,
        );
      }

      return parsed;
    } catch (e) {
      this.logger.error(`Error parseando email: ${e.message}`);
      return null;
    }
  }
}
