import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { InboxService } from '../inbox/inbox.service';
import * as Imap from 'imap';
import { simpleParser } from 'mailparser';

@Injectable()
export class EmailSyncService {
  private readonly logger = new Logger(EmailSyncService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly inboxService: InboxService,
    private readonly userService: UserService,
  ) {}

  /**
   * Cron job para sincronizar emails automáticamente cada 5 minutos
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncAllActiveUsers() {
    this.logger.log('Iniciando sincronización automática de emails...');

    try {
      const usersWithSync = await this.userModel
        .find({
          'emailCorporativoConfig.sincronizacionActiva': true,
        })
        .exec();

      this.logger.log(
        `Encontrados ${usersWithSync.length} usuarios con sincronización activa`,
      );

      for (const user of usersWithSync) {
        try {
          await this.syncUserEmail(user._id.toString());
        } catch (error) {
          this.logger.error(
            `Error sincronizando usuario ${user._id}: ${error.message}`,
          );
        }
      }

      this.logger.log('Sincronización automática completada');
    } catch (error) {
      this.logger.error(
        `Error en sincronización automática: ${error.message}`,
      );
    }
  }

  /**
   * Sincronizar emails de un usuario específico
   */
  async syncUserEmail(userId: string): Promise<{
    success: boolean;
    nuevos: number;
    errores: number;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user || !user.emailCorporativoConfig) {
      throw new Error('Usuario no encontrado o sin configuración de email');
    }

    const config = user.emailCorporativoConfig;
    if (!config.sincronizacionActiva) {
      throw new Error('Sincronización no activa para este usuario');
    }

    this.logger.log(`Sincronizando emails para usuario ${user.username}`);

    let nuevos = 0;
    let errores = 0;

    try {
      // Solo soportamos IMAP por ahora
      if (config.provider === 'IMAP' && config.imapConfig) {
        const result = await this.syncImap(config.imapConfig, user);
        nuevos = result.nuevos;
        errores = result.errores;
      } else if (config.provider === 'GMAIL' || config.provider === 'OUTLOOK') {
        this.logger.warn(
          `OAuth no implementado aún para ${config.provider}. Se requiere configuración IMAP.`,
        );
        return { success: false, nuevos: 0, errores: 1 };
      }

      // Actualizar última sincronización
      user.emailCorporativoConfig.ultimaSincronizacion = new Date();
      await user.save();

      return { success: true, nuevos, errores };
    } catch (error) {
      this.logger.error(
        `Error en sincronización IMAP: ${error.message}`,
        error.stack,
      );
      return { success: false, nuevos, errores: errores + 1 };
    }
  }

  /**
   * Sincronizar usando IMAP
   */
  private async syncImap(
    imapConfig: any,
    user: any,
  ): Promise<{ nuevos: number; errores: number }> {
    return new Promise((resolve, reject) => {
      let nuevos = 0;
      let errores = 0;

      const imap = new Imap({
        user: imapConfig.user,
        password: imapConfig.password,
        host: imapConfig.host,
        port: imapConfig.port || 993,
        tls: imapConfig.tls !== false,
        tlsOptions: { rejectUnauthorized: false },
      });

      imap.once('ready', () => {
        this.logger.log('Conexión IMAP establecida');

        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          // Usar fecha de última sincronización para búsqueda incremental
          const lastSyncDate = user.emailSync?.lastSyncDate;
          let searchCriteria;
          
          if (!lastSyncDate) {
            // Primera sincronización: últimos 30 días
            const since = new Date();
            since.setDate(since.getDate() - 30);
            // SINTAXIS CORRECTA: SINCE requiere array anidado ['SINCE', Date]
            searchCriteria = [['SINCE', since]];
            this.logger.log(`Primera sincronización: buscando desde ${since.toISOString()}`);
          } else {
            // Sincronizaciones posteriores: desde última sync con margen
            const sinceLast = new Date(lastSyncDate);
            sinceLast.setHours(sinceLast.getHours() - 1); // 1h margen
            searchCriteria = [['SINCE', sinceLast]];
            this.logger.log(`Sincronización incremental desde: ${sinceLast.toISOString()}`);
          }

          imap.search(searchCriteria, (err, results) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              this.logger.log('No hay emails nuevos');
              imap.end();
              return resolve({ nuevos: 0, errores: 0 });
            }

            this.logger.log(`Encontrados ${results.length} emails para procesar`);

            const fetch = imap.fetch(results, { 
              bodies: '',
              struct: true
            });

            fetch.on('message', (msg, seqno) => {
              msg.on('body', async (stream, info) => {
                try {
                  const parsed = await simpleParser(stream as any);
                  await this.parseEmailToMessage(parsed, user);
                  nuevos++;
                } catch (error) {
                  this.logger.error(
                    `Error parseando email ${seqno}: ${error.message}`,
                  );
                  errores++;
                }
              });
            });

            fetch.once('error', (err) => {
              this.logger.error(`Error en fetch: ${err.message}`);
              errores++;
            });

            fetch.once('end', async () => {
              this.logger.log(`Sincronización completada: ${nuevos} nuevos, ${errores} errores`);
              
              // Actualizar fecha de última sincronización
              try {
                await this.userService.updateLastSyncedUID(
                  user._id.toString(), 
                  0 // No usamos UID, solo actualizamos fecha
                );
                this.logger.log('Fecha de última sincronización actualizada');
              } catch (error) {
                this.logger.error(`Error actualizando sync date: ${error.message}`);
              }
              
              imap.end();
            });
          });
        });
      });

      imap.once('error', (err) => {
        this.logger.error(`Error IMAP: ${err.message}`);
        reject(err);
      });

      imap.once('end', () => {
        this.logger.log('Conexión IMAP cerrada');
        resolve({ nuevos, errores });
      });

      imap.connect();
    });
  }

  /**
   * Parsear email recibido y crear mensaje
   */
  private async parseEmailToMessage(parsedEmail: any, user: any) {
    const subject = parsedEmail.subject || 'Sin asunto';
    const from = parsedEmail.from?.value[0];
    const content = parsedEmail.html || parsedEmail.textAsHtml || parsedEmail.text || '';
    const contentPlainText = parsedEmail.text || '';
    const emailMessageId = parsedEmail.messageId;
    const emailDate = parsedEmail.date || new Date();

    // SOLUCIÓN CORRECTA: Generar un ID único para detectar duplicados
    // Si tiene messageId, usarlo; si no, generar hash basado en subject+sender+date
    const crypto = require('crypto');
    let uniqueId = emailMessageId;
    
    if (!uniqueId || uniqueId === 'NULL') {
      // Emails sin messageId (como RedLink): generar hash único
      const hashSource = `${subject}|${from?.address || ''}|${emailDate.toISOString()}`;
      uniqueId = crypto.createHash('md5').update(hashSource).digest('hex');
    }

    // Verificar si ya existe usando el uniqueId
    const existing = await this.inboxService.findByMessageId(uniqueId);
    if (existing) {
      this.logger.log(`Email duplicado saltado: ${subject.substring(0, 50)}`);
      return;
    }

    const messageData = {
      subject,
      sender: {
        name: from?.name || from?.address || 'Desconocido',
        email: from?.address || '',
      },
      source: 'Email' as const,
      content,
      contentPlainText,
      emailMetadata: {
        messageId: uniqueId, // Guardar el uniqueId, no el messageId original
        inReplyTo: parsedEmail.inReplyTo,
        references: parsedEmail.references,
      },
      timestamp: emailDate,
    };

    try {
      await this.inboxService.createMessage(messageData);
      this.logger.log(`Mensaje creado: ${subject.substring(0, 50)}`);
    } catch (error) {
      if (error.code === 11000) {
        // Duplicado detectado por MongoDB (backup)
        this.logger.log(`Duplicado detectado por DB: ${subject.substring(0, 50)}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Probar configuración IMAP
   */
  async testImapConnection(imapConfig: any): Promise<{
    success: boolean;
    message: string;
  }> {
    return new Promise((resolve) => {
      const imap = new Imap({
        user: imapConfig.user,
        password: imapConfig.password,
        host: imapConfig.host,
        port: imapConfig.port || 993,
        tls: imapConfig.tls !== false,
        tlsOptions: { rejectUnauthorized: false },
      });

      imap.once('ready', () => {
        imap.end();
        resolve({ success: true, message: 'Conexión exitosa' });
      });

      imap.once('error', (err) => {
        resolve({
          success: false,
          message: `Error de conexión: ${err.message}`,
        });
      });

      imap.connect();
    });
  }
}
