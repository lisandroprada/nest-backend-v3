import { ObjectId } from 'mongodb';
import { logger } from './logger';

/**
 * Utilidades de validación para la migración
 */
export class Validators {
  /**
   * Valida que un email sea válido
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida que un ObjectId sea válido
   */
  static isValidObjectId(id: any): boolean {
    return ObjectId.isValid(id);
  }

  /**
   * Convierte un string a ObjectId de forma segura
   */
  static toObjectId(id: any): ObjectId | null {
    try {
      if (id instanceof ObjectId) {
        return id;
      }
      if (typeof id === 'string' && this.isValidObjectId(id)) {
        return new ObjectId(id);
      }
      return null;
    } catch (error) {
      logger.error(`Error convirtiendo a ObjectId: ${id}`, error);
      return null;
    }
  }

  /**
   * Normaliza un email (trim y toLowerCase)
   */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Normaliza un número de teléfono (remueve espacios, guiones, paréntesis)
   */
  static normalizePhone(phone: any): string | undefined {
    if (!phone) return undefined;
    
    // Si es un objeto (no string ni number primitivo), intentar extraer valor
    if (typeof phone === 'object' && !Array.isArray(phone)) {
      // Intentar propiedades comunes
      phone = phone.number || phone.value || phone.phone || phone.toString();
    }
    
    // Convertir a string
    const phoneStr = String(phone);
    
    // Si el resultado es "[object Object]", retornar undefined
    if (phoneStr === '[object Object]') {
      return undefined;
    }
    
    // Remover espacios, guiones, paréntesis
    const normalized = phoneStr.replace(/[\s\-()]/g, '');
    
    // Retornar undefined si queda vacío
    return normalized.length > 0 ? normalized : undefined;
  }

  /**
   * Valida que una fecha sea válida
   */
  static isValidDate(date: any): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Convierte una fecha string a Date de forma segura
   */
  static toDate(dateString: any): Date | null {
    try {
      if (dateString instanceof Date) {
        return dateString;
      }
      const date = new Date(dateString);
      return this.isValidDate(date) ? date : null;
    } catch (error) {
      logger.error(`Error convirtiendo a Date: ${dateString}`, error);
      return null;
    }
  }

  /**
   * Normaliza una fecha UTC (remueve el offset manual de -3h de Legacy)
   */
  static normalizeDateToUTC(legacyDate: Date): Date {
    // Legacy guarda fechas con offset manual de -3h
    // Esta función asume que la fecha viene correcta de MongoDB
    // y solo necesitamos retornarla como Date UTC
    return new Date(legacyDate);
  }

  /**
   * Valida que un objeto tenga todas las propiedades requeridas
   */
  static hasRequiredFields(obj: any, fields: string[]): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    for (const field of fields) {
      if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
        missing.push(field);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Limpia un string (trim y remueve saltos de línea extra)
   */
  static cleanString(str: string): string {
    return str.trim().replace(/\s+/g, ' ');
  }
}

/**
 * Clase para reportar y acumular errores de validación
 */
export class ValidationReport {
  private errors: Array<{ entity: string; id: any; field: string; message: string }> = [];
  private warnings: Array<{ entity: string; id: any; field: string; message: string }> = [];

  /**
   * Agrega un error al reporte
   */
  addError(entity: string, id: any, field: string, message: string) {
    this.errors.push({ entity, id, field, message });
    logger.error(`Validation Error - ${entity}[${id}].${field}: ${message}`);
  }

  /**
   * Agrega una advertencia al reporte
   */
  addWarning(entity: string, id: any, field: string, message: string) {
    this.warnings.push({ entity, id, field, message });
    logger.warning(`Validation Warning - ${entity}[${id}].${field}: ${message}`);
  }

  /**
   * Verifica si hay errores
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Verifica si hay advertencias
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  /**
   * Obtiene el total de errores
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Obtiene el total de advertencias
   */
  getWarningCount(): number {
    return this.warnings.length;
  }

  /**
   * Obtiene todos los errores
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Obtiene todas las advertencias
   */
  getWarnings() {
    return this.warnings;
  }

  /**
   * Imprime un resumen del reporte
   */
  printSummary() {
    logger.separator();
    logger.info('📊 RESUMEN DE VALIDACIÓN');
    logger.info(`Errores: ${this.getErrorCount()}`);
    logger.info(`Advertencias: ${this.getWarningCount()}`);
    
    if (this.hasErrors()) {
      logger.error('❌ La validación encontró errores que deben ser corregidos');
      this.errors.slice(0, 10).forEach(err => {
        logger.error(`  - ${err.entity}[${err.id}].${err.field}: ${err.message}`);
      });
      if (this.errors.length > 10) {
        logger.info(`  ... y ${this.errors.length - 10} errores más (ver log completo)`);
      }
    }
    
    if (this.hasWarnings()) {
      logger.warning('⚠️  La validación encontró advertencias');
      this.warnings.slice(0, 10).forEach(warn => {
        logger.warning(`  - ${warn.entity}[${warn.id}].${warn.field}: ${warn.message}`);
      });
      if (this.warnings.length > 10) {
        logger.info(`  ... y ${this.warnings.length - 10} advertencias más (ver log completo)`);
      }
    }
    
    logger.separator();
  }

  /**
   * Guarda el reporte en un archivo JSON
   */
  saveToFile(filename: string) {
    const fs = require('fs');
    const path = require('path');
    
    const reportDir = path.join(__dirname, '..', '..', 'validacion', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, filename);
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        errors: this.getErrorCount(),
        warnings: this.getWarningCount(),
      },
      errors: this.errors,
      warnings: this.warnings,
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logger.info(`📄 Reporte guardado en: ${reportPath}`);
  }
}
