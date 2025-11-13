import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SystemConfigService } from '../system-config/system-config.service';
import { BankingSyncService } from './banking-sync.service';
import { TipoOperacion } from './entities/bank-movement.entity';
import * as Imap from 'imap';
import { simpleParser } from 'mailparser';
import * as cheerio from 'cheerio';

interface EmailData {
  identificador_unico: string;
  tipo_operacion: TipoOperacion;
  monto: number;
  fecha_operacion: Date;
  cuenta_origen_cbu?: string;
  cuenta_destino_cbu?: string;
  identificador_fiscal?: string;
  nombre_tercero?: string;
  concepto_transaccion?: string;
  email_id: string;
  email_asunto: string;
  email_fecha: Date;
}

@Injectable()
export class RedlinkScanService {
  private readonly logger = new Logger(RedlinkScanService.name);
  private isScanning = false;

  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly bankingSyncService: BankingSyncService,
  ) {}

  /**
   * Cron job que se ejecuta diariamente a las 8:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleCron() {
    this.logger.log('Iniciando escaneo automático de emails bancarios');
    await this.scanEmails();
  }

  /**
   * Función principal de escaneo de emails
   */
  async scanEmails(): Promise<{
    procesados: number;
    nuevos: number;
    duplicados: number;
    errores: number;
  }> {
    if (this.isScanning) {
      this.logger.warn('Ya hay un escaneo en progreso');
      return { procesados: 0, nuevos: 0, duplicados: 0, errores: 0 };
    }

    this.isScanning = true;
    let procesados = 0;
    let nuevos = 0;
    let duplicados = 0;
    let errores = 0;

    try {
      // Obtener configuración del sistema
      const config = await this.systemConfigService.findOneDecrypted();

      // Crear conexión IMAP
      const imap = await this.createImapConnection(config);

      // Calcular fecha de inicio para el escaneo
      const fechaInicio = new Date();
      fechaInicio.setDate(fechaInicio.getDate() - config.check_period_days);

      // Procesar emails
      const emails = await this.fetchEmails(imap, fechaInicio);

      this.logger.log(`Emails encontrados: ${emails.length}`);

      for (const emailHtml of emails) {
        procesados++;
        try {
          const emailData = await this.parseEmail(emailHtml);

          if (emailData) {
            const created = await this.bankingSyncService.create(emailData);
            if (created) {
              nuevos++;
            } else {
              duplicados++;
            }
          }
        } catch (error) {
          errores++;
          this.logger.error(`Error al procesar email: ${error.message}`);
        }
      }

      // Actualizar fecha de última consulta
      await this.systemConfigService.updateLastCheckDate();

      this.logger.log(
        `Escaneo completado: ${procesados} procesados, ${nuevos} nuevos, ${duplicados} duplicados, ${errores} errores`,
      );
    } catch (error) {
      this.logger.error(`Error en el escaneo de emails: ${error.message}`);
      throw error;
    } finally {
      this.isScanning = false;
    }

    return { procesados, nuevos, duplicados, errores };
  }

  /**
   * Crea y devuelve una conexión IMAP
   */
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

      imap.once('ready', () => {
        this.logger.log('Conexión IMAP establecida');
        resolve(imap);
      });

      imap.once('error', (err) => {
        this.logger.error(`Error de conexión IMAP: ${err.message}`);
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * Obtiene los emails del servidor IMAP
   */
  private async fetchEmails(imap: any, fechaInicio: Date): Promise<any[]> {
    return new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err /*, box*/) => {
        if (err) {
          reject(err);
          return;
        }

        // Buscar emails de Redlink desde la fecha indicada
        const searchCriteria = [
          ['FROM', 'noreply@avisos.redlink.com.ar'],
          ['SINCE', fechaInicio],
        ];

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (!results || results.length === 0) {
            this.logger.log('No se encontraron emails nuevos');
            imap.end();
            resolve([]);
            return;
          }

          const emails: any[] = [];
          const fetch = imap.fetch(results, { bodies: '' });

          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (!err && parsed) {
                  emails.push({
                    html: parsed.html || parsed.textAsHtml,
                    text: parsed.text,
                    subject: parsed.subject,
                    date: parsed.date,
                    messageId: parsed.messageId,
                  });
                }
              });
            });
          });

          fetch.once('error', (err) => {
            reject(err);
          });

          fetch.once('end', () => {
            this.logger.log(`Emails recuperados: ${emails.length}`);
            imap.end();
            resolve(emails);
          });
        });
      });
    });
  }

  /**
   * Parsea el contenido del email y extrae los datos bancarios
   */
  private async parseEmail(email: any): Promise<EmailData | null> {
    try {
      const html = email.html || email.text || '';
      const subject = email.subject || '';

      // Construir mapa de etiquetas->valor desde tablas HTML (más robusto que regex plano)
      const labelMap = this.buildLabelMap(html);

      // Determinar si es ingreso o egreso
      let tipoOperacion: TipoOperacion;

      if (
        subject.toLowerCase().includes('debin') ||
        html.includes('Debin recibido')
      ) {
        tipoOperacion = TipoOperacion.INGRESO;
      } else if (
        subject.toLowerCase().includes('transferencia') ||
        html.includes('Transferencia realizada')
      ) {
        tipoOperacion = TipoOperacion.EGRESO;
      } else {
        this.logger.warn(`Tipo de operación no determinado en: ${subject}`);
        return null;
      }

      // Extraer datos según el tipo
      // Para INGRESO: solo tenemos CBU Crédito (nuestra cuenta que recibe)
      // Para EGRESO: tenemos CBU Débito (nuestra cuenta) y CBU Crédito (destino)
      let cuentaOrigenCBU: string | undefined;
      let cuentaDestinoCBU: string | undefined;

      if (tipoOperacion === TipoOperacion.INGRESO) {
        // En ingreso, solo capturamos el CBU Crédito como destino (nuestra cuenta)
        cuentaDestinoCBU = this.extractCBU(html, 'credito', labelMap);
      } else {
        // En egreso, CBU Débito es origen (nuestra cuenta) y CBU Crédito es destino
        cuentaOrigenCBU = this.extractCBU(html, 'debito', labelMap);
        cuentaDestinoCBU = this.extractCBU(html, 'credito', labelMap);
      }

      const emailData: EmailData = {
        identificador_unico: this.extractIdentificador(
          html,
          tipoOperacion,
          labelMap,
        ),
        tipo_operacion: tipoOperacion,
        monto: this.extractMonto(html, labelMap),
        fecha_operacion: this.extractFecha(html, labelMap) || email.date,
        cuenta_origen_cbu: cuentaOrigenCBU,
        cuenta_destino_cbu: cuentaDestinoCBU,
        identificador_fiscal: this.extractCUIT(html, labelMap),
        nombre_tercero: this.extractNombre(html, tipoOperacion, labelMap),
        concepto_transaccion: this.extractConcepto(html, labelMap),
        email_id: email.messageId || `${Date.now()}-${Math.random()}`,
        email_asunto: subject,
        email_fecha: email.date,
      };

      // Validar que tengamos al menos el identificador y el monto
      if (!emailData.identificador_unico || !emailData.monto) {
        this.logger.warn('Email sin identificador o monto válido');
        return null;
      }

      return emailData;
    } catch (error) {
      this.logger.error(`Error al parsear email: ${error.message}`);
      return null;
    }
  }

  /**
   * Crea un mapa label -> value a partir de filas de tablas HTML comunes en correos Redlink
   * Soporta dos formatos:
   * 1. Formato estándar: <tr><td>label</td><td>value</td></tr>
   * 2. Formato dos columnas: tabla izquierda con labels, tabla derecha con valores
   */
  private buildLabelMap(html: string): Record<string, string> {
    const map: Record<string, string> = {};
    try {
      if (!html) return map;
      const $ = cheerio.load(html);
      const processedTables = new Set<any>();

      // Formato 1: Buscar rows con 2 celdas (label, value)
      $('tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length >= 2) {
          const rawLabel = $(tds[0]).text().trim();
          const value = $(tds[1]).text().trim();
          if (rawLabel && value) {
            const key = this.normalizeLabel(rawLabel);
            map[key] = value;
          }
        }
      });

      // Formato 2: Buscar pares de <td> con tablas internas
      // Estructura: <tr><td><table>labels</table></td><td><table>values</table></td></tr>
      $('tr').each((_, row) => {
        const cells = $(row).find('> td');
        if (cells.length >= 2) {
          const leftTable = $(cells[0]).find('table').first();
          const rightTable = $(cells[1]).find('table').first();

          if (
            leftTable.length > 0 &&
            rightTable.length > 0 &&
            !processedTables.has(leftTable[0])
          ) {
            processedTables.add(leftTable[0]);
            processedTables.add(rightTable[0]);

            // Extraer labels de la tabla izquierda
            const labels: string[] = [];
            leftTable.find('tr').each((_, tr) => {
              const td = $(tr).find('td').first();
              const text = td.text().trim();
              if (text) labels.push(text);
            });

            // Extraer valores de la tabla derecha
            const values: string[] = [];
            rightTable.find('tr').each((_, tr) => {
              const td = $(tr).find('td').first();
              const text = td.text().trim();
              if (text) values.push(text);
            });

            // Emparejar labels con valores por índice
            const minLength = Math.min(labels.length, values.length);
            for (let i = 0; i < minLength; i++) {
              const key = this.normalizeLabel(labels[i]);
              if (key && values[i]) {
                map[key] = values[i];
              }
            }
          }
        }
      });
    } catch (e) {
      this.logger.warn(
        `No se pudo construir labelMap: ${(e as Error).message}`,
      );
    }
    return map;
  }

  private normalizeLabel(label: string): string {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remover acentos
      .replace(/[^a-z0-9\s]/g, ' ') // quitar símbolos, dejar espacios
      .replace(/\s+/g, ' ') // colapsar espacios
      .trim();
  }

  /**
   * Extrae el identificador único de la transacción
   */
  private extractIdentificador(
    html: string,
    tipo: TipoOperacion,
    labelMap: Record<string, string>,
  ): string {
    if (tipo === TipoOperacion.INGRESO) {
      // Preferir tabla: "Identificador del Debin"
      const tableVal = labelMap[this.normalizeLabel('Identificador del Debin')];
      if (tableVal) return tableVal.trim();
      // Fallback regex (por si viene en texto plano)
      const match = html.match(
        /Identificador del Debin[\s\S]*?([A-Z0-9]{6,})/i,
      );
      return match ? match[1].trim() : '';
    } else {
      // Variantes posibles: Identificador de Transferencia, Nº de transacción
      const variants = [
        'Identificador de Transferencia',
        'Nº de transacción',
        'N° de transacción',
        'Numero de transacción',
        'Número de transacción',
      ];
      for (const v of variants) {
        const tableVal = labelMap[this.normalizeLabel(v)];
        if (tableVal) return tableVal.trim();
      }
      const match = html.match(
        /N[º°]\s*de\s*transacci[oó]n[\s\S]*?([0-9]{4,})/i,
      );
      if (match) return match[1].trim();
      // Fallback adicional: Identificador de Transferencia
      const match2 = html.match(
        /Identificador\s*de\s*Transferencia[\s\S]*?([A-Z0-9]{6,})/i,
      );
      if (match2) return match2[1].trim();
      return match ? match[1].trim() : '';
    }
  }

  /**
   * Extrae el monto de la operación
   */
  private extractMonto(html: string, labelMap: Record<string, string>): number {
    const tableVal = labelMap[this.normalizeLabel('Importe')];
    const raw = tableVal || (html.match(/\$\s*([0-9,.]+)/)?.[0] ?? '');
    const numMatch = (tableVal ? tableVal : raw).match(/[0-9][0-9\.,]*/);
    if (numMatch) {
      const cleaned = numMatch[0].trim();
      let parsed: number;
      if (cleaned.includes('.') && cleaned.includes(',')) {
        // Formato tipo 1.234,56 -> remover puntos, coma como decimal
        const normalized = cleaned.replace(/\./g, '').replace(',', '.');
        parsed = parseFloat(normalized);
      } else if (cleaned.includes(',')) {
        // Formato 1234,56 -> coma como decimal
        parsed = parseFloat(cleaned.replace(',', '.'));
      } else {
        // Formato 1234.56 o 123456 -> punto como decimal o entero
        parsed = parseFloat(cleaned);
      }
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  /**
   * Extrae la fecha de la operación
   */
  private extractFecha(
    html: string,
    labelMap: Record<string, string>,
  ): Date | null {
    // Intentar patrón "Fecha" en tabla
    const fechaLabel = labelMap[this.normalizeLabel('Fecha')];
    const candidatos = [
      fechaLabel,
      // Texto descriptivo del correo
      html.match(/el d[ií]a[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null,
    ].filter(Boolean) as string[];
    for (const cand of candidatos) {
      const m = cand.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) {
        const [, dia, mes, anio] = m;
        return new Date(`${anio}-${mes}-${dia}`);
      }
    }
    return null;
  }

  /**
   * Extrae el CBU
   * tipo: 'debito' para CBU Débito (nuestra cuenta en egreso)
   *       'credito' para CBU Crédito (cuenta destino o nuestra cuenta en ingreso)
   */
  private extractCBU(
    html: string,
    tipo: 'debito' | 'credito',
    labelMap: Record<string, string>,
  ): string {
    const keysDebito = [
      'cbu debito',
      'cbu débito',
      'cbu del pagador',
      'cbu origen',
      'cuenta origen', // Formato 2: "Cuenta origen"
    ].map((k) => this.normalizeLabel(k));

    const keysCredito = [
      'cbu credito',
      'cbu crédito',
      'cbu del beneficiario',
      'cbu destino',
      'cbu/cvu', // Formato 2: "CBU/CVU"
      'cbu cvu',
    ].map((k) => this.normalizeLabel(k));

    const keys = tipo === 'debito' ? keysDebito : keysCredito;
    for (const key of keys) {
      const val = labelMap[key];
      if (val) {
        // Intentar extraer número de cuenta (puede ser CBU 22 dígitos o cuenta más corta)
        const match = val.match(/\d{14,22}/);
        if (match) {
          return match[0].trim();
        }
      }
    }
    // Fallback regex
    const pattern =
      tipo === 'debito'
        ? /CBU\s*(Origen|del\s*Pagador|D[eé]bito)[\s\S]*?([0-9]{22})/i
        : /CBU\s*(Destino|del\s*Beneficiario|Cr[eé]dito)[\s\S]*?([0-9]{22})/i;
    const match = html.match(pattern);
    return match ? match[2].trim() : '';
  }

  /**
   * Extrae el CUIT/CUIL
   */
  private extractCUIT(html: string, labelMap: Record<string, string>): string {
    const keys = [
      'cuit',
      'cuit del pagador',
      'cuit pagador',
      'cuit/cuil',
      'cuit cuil',
      'cuit/cuil/cdi', // Formato 2: "CUIT/CUIL/CDI"
      'cuit cuil cdi',
      'cuit del destinatario',
      'cuit destinatario',
      'cuit del beneficiario',
    ].map((k) => this.normalizeLabel(k));
    for (const key of keys) {
      const val = labelMap[key];
      if (val && /\d{11}/.test(val.replace(/[-\s]/g, ''))) {
        return val.replace(/[-\s]/g, '').match(/\d{11}/)?.[0] ?? '';
      }
    }
    const match = html.match(/CUIT[\s\S]*?([0-9][0-9-]{9,})/i);
    return match ? (match[1].replace(/-/g, '').match(/\d{11}/)?.[0] ?? '') : '';
  }

  /**
   * Extrae el nombre del tercero
   */
  private extractNombre(
    html: string,
    tipo: TipoOperacion,
    labelMap: Record<string, string>,
  ): string {
    const keysIngreso = ['nombre del pagador', 'pagador'].map((k) =>
      this.normalizeLabel(k),
    );
    const keysEgreso = [
      'nombre del beneficiario',
      'beneficiario',
      'nombre del destinatario',
      'destinatario',
      'transferiste a', // Formato 2: "Transferiste a"
    ].map((k) => this.normalizeLabel(k));
    const keys = tipo === TipoOperacion.INGRESO ? keysIngreso : keysEgreso;
    for (const key of keys) {
      const val = labelMap[key];
      if (val) return val.trim();
    }
    // Fallback regex más permisivo (incluye puntos y &)
    const match =
      tipo === TipoOperacion.INGRESO
        ? html.match(/Pagador[\s\S]*?([A-ZÁ-Ú0-9\.\-&\s]{3,})/i)
        : html.match(/Beneficiario[\s\S]*?([A-ZÁ-Ú0-9\.\-&\s]{3,})/i);
    return match ? match[1].trim() : '';
  }

  /**
   * Extrae el concepto de transacción (VAR, ALQ, HON, etc.)
   */
  private extractConcepto(
    html: string,
    labelMap: Record<string, string>,
  ): string {
    // Intentar primero "Motivo" (formato 2) antes que "Concepto"
    const keys = ['motivo', 'concepto'];
    for (const key of keys) {
      const val = labelMap[this.normalizeLabel(key)];
      if (val) {
        const m = val.match(/[A-Z]{3}/i);
        if (m) return m[0].toUpperCase();
      }
    }
    // Fallback regex
    const match = html.match(/Concepto[\s\S]*?([A-Z]{3})/i);
    return match ? match[1].toUpperCase().trim() : '';
  }

  /**
   * Prueba la conexión IMAP con las credenciales configuradas
   */
  async testConnection(): Promise<boolean> {
    try {
      const config = await this.systemConfigService.findOneDecrypted();
      // createImapConnection ya resuelve cuando el evento 'ready' ocurre
      const imap = await this.createImapConnection(config);
      this.logger.log('Test de conexión exitoso');
      // Cerramos la conexión inmediatamente tras el éxito
      try {
        imap.end();
      } catch {}
      return true;
    } catch (error) {
      this.logger.error(`Error en test de conexión: ${error.message}`);
      return false;
    }
  }
}
