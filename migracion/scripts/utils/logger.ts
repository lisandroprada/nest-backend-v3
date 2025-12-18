import * as fs from 'fs';
import * as path from 'path';

/**
 * Niveles de log disponibles
 */
export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

/**
 * Clase para manejar logging de las operaciones de migración
 */
export class Logger {
  private logDir: string;
  private currentLogFile: string;

  constructor() {
    // Crear directorio de logs si no existe
    this.logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Crear archivo de log con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(this.logDir, `migration-${timestamp}.log`);
  }

  /**
   * Escribe un mensaje en el log
   */
  private writeToFile(message: string) {
    fs.appendFileSync(this.currentLogFile, message + '\n');
  }

  /**
   * Formatea un mensaje de log
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      formatted += `\n${JSON.stringify(data, null, 2)}`;
    }

    return formatted;
  }

  /**
   * Log de información general
   */
  info(message: string, data?: any) {
    const formatted = this.formatMessage(LogLevel.INFO, message, data);
    console.log(`ℹ️  ${message}`);
    if (data) console.log(data);
    this.writeToFile(formatted);
  }

  /**
   * Log de operación exitosa
   */
  success(message: string, data?: any) {
    const formatted = this.formatMessage(LogLevel.SUCCESS, message, data);
    console.log(`✅ ${message}`);
    if (data) console.log(data);
    this.writeToFile(formatted);
  }

  /**
   * Log de advertencia
   */
  warning(message: string, data?: any) {
    const formatted = this.formatMessage(LogLevel.WARNING, message, data);
    console.warn(`⚠️  ${message}`);
    if (data) console.warn(data);
    this.writeToFile(formatted);
  }

  /**
   * Log de error
   */
  error(message: string, error?: any) {
    const formatted = this.formatMessage(LogLevel.ERROR, message, error);
    console.error(`❌ ${message}`);
    if (error) console.error(error);
    this.writeToFile(formatted);
  }

  /**
   * Log de debug (solo se escribe en archivo, no en consola)
   */
  debug(message: string, data?: any) {
    const formatted = this.formatMessage(LogLevel.DEBUG, message, data);
    this.writeToFile(formatted);
  }

  /**
   * Crea un separador visual en los logs
   */
  separator() {
    const separator = '='.repeat(80);
    console.log(separator);
    this.writeToFile(separator);
  }

  /**
   * Registra el inicio de una fase
   */
  startPhase(phaseName: string) {
    this.separator();
    this.info(`🚀 INICIANDO: ${phaseName}`);
    this.separator();
  }

  /**
   * Registra el fin de una fase
   */
  endPhase(phaseName: string, stats?: any) {
    this.separator();
    this.success(`✨ COMPLETADO: ${phaseName}`, stats);
    this.separator();
  }

  /**
   * Obtiene la ruta del archivo de log actual
   */
  getLogFilePath(): string {
    return this.currentLogFile;
  }
}

/**
 * Instancia singleton del logger
 */
export const logger = new Logger();
