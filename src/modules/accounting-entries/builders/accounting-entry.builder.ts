import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateAccountingEntryDto } from '../dto/create-accounting-entry.dto';

interface PartidaBuilder {
  cuenta_id: Types.ObjectId;
  descripcion: string;
  debe: number;
  haber: number;
  agente_id?: Types.ObjectId;
  es_iva_incluido?: boolean;
  tasa_iva_aplicada?: number;
  monto_base_imponible?: number;
  monto_iva_calculado?: number;
}

/**
 * Builder pattern para construcción fluida de AccountingEntry DTOs.
 * Garantiza que los asientos estén balanceados (Debe = Haber) antes de persistir.
 */
@Injectable()
export class AccountingEntryBuilder {
  private dto: Partial<CreateAccountingEntryDto> = {};
  private partidas: PartidaBuilder[] = [];
  private metadata: Record<string, any> = {};

  /**
   * Reinicia el builder para comenzar un nuevo asiento.
   */
  reset(): this {
    this.dto = {};
    this.partidas = [];
    this.metadata = {};
    return this;
  }

  /**
   * Establece el tipo de asiento (ej: 'Alquiler', 'Honorarios', 'Depósito').
   */
  setType(type: string): this {
    this.dto.tipo_asiento = type;
    return this;
  }

  /**
   * Establece la descripción general del asiento.
   */
  setDescription(desc: string): this {
    this.dto.descripcion = desc;
    return this;
  }

  /**
   * Establece las fechas de imputación y vencimiento.
   */
  setDates(imputacion: Date, vencimiento: Date): this {
    this.dto.fecha_imputacion = imputacion.toISOString();
    this.dto.fecha_vencimiento = vencimiento.toISOString();
    return this;
  }

  /**
   * Establece el estado del asiento (se guarda en metadata ya que no está en el DTO).
   */
  setState(estado: string): this {
    this.metadata.estado = estado;
    return this;
  }

  /**
   * Marca el asiento como ajustable (se guarda en metadata ya que no está en el DTO).
   */
  setAdjustable(value: boolean): this {
    this.metadata.es_ajustable = value;
    return this;
  }

  /**
   * Agrega una partida al Debe (Débito).
   */
  addDebit(
    accountId: Types.ObjectId,
    amount: number,
    agentId?: Types.ObjectId,
    description?: string,
  ): this {
    if (amount < 0) {
      throw new Error('El monto del débito no puede ser negativo');
    }

    this.partidas.push({
      cuenta_id: accountId,
      debe: amount,
      haber: 0,
      agente_id: agentId,
      descripcion: description || this.dto.descripcion || '',
      es_iva_incluido: false,
      tasa_iva_aplicada: 0,
      monto_base_imponible: 0,
      monto_iva_calculado: 0,
    });
    return this;
  }

  /**
   * Agrega una partida al Haber (Crédito).
   */
  addCredit(
    accountId: Types.ObjectId,
    amount: number,
    agentId?: Types.ObjectId,
    description?: string,
  ): this {
    if (amount < 0) {
      throw new Error('El monto del crédito no puede ser negativo');
    }

    this.partidas.push({
      cuenta_id: accountId,
      debe: 0,
      haber: amount,
      agente_id: agentId,
      descripcion: description || this.dto.descripcion || '',
      es_iva_incluido: false,
      tasa_iva_aplicada: 0,
      monto_base_imponible: 0,
      monto_iva_calculado: 0,
    });
    return this;
  }

  /**
   * Ejecuta una acción condicionalmente.
   * Útil para lógica opcional (ej: agregar IVA solo si aplica).
   */
  conditionally(condition: boolean, callback: (builder: this) => this): this {
    return condition ? callback(this) : this;
  }

  /**
   * Agrega metadatos al asiento contable.
   */
  addMetadata(key: string, value: any): this {
    this.metadata[key] = value;
    return this;
  }

  /**
   * Construye el DTO final después de validar el balanceo.
   * @throws Error si el asiento no está balanceado o no tiene partidas.
   */
  build(): CreateAccountingEntryDto {
    // Validación: Debe tener al menos una partida
    if (this.partidas.length === 0) {
      throw new Error('El asiento debe tener al menos una partida');
    }

    // Validación: Balanceo contable (Debe = Haber)
    const totalDebit = this.partidas.reduce((sum, p) => sum + p.debe, 0);
    const totalCredit = this.partidas.reduce((sum, p) => sum + p.haber, 0);

    const difference = Math.abs(totalDebit - totalCredit);
    if (difference > 0.01) {
      throw new Error(
        `El asiento no está balanceado. Debe: ${totalDebit}, Haber: ${totalCredit}, Diferencia: ${difference}`,
      );
    }

    // Validación: Campos requeridos
    if (!this.dto.tipo_asiento) {
      throw new Error('El tipo de asiento es requerido');
    }
    if (!this.dto.descripcion) {
      throw new Error('La descripción del asiento es requerida');
    }
    if (!this.dto.fecha_imputacion) {
      throw new Error('La fecha de imputación es requerida');
    }
    if (!this.dto.fecha_vencimiento) {
      throw new Error('La fecha de vencimiento es requerida');
    }

    return {
      ...this.dto,
      partidas: this.partidas as any,
      monto_original: totalDebit,
      monto_actual: totalDebit,
      metadata: Object.keys(this.metadata).length > 0 ? this.metadata : undefined,
    } as CreateAccountingEntryDto;
  }
}
