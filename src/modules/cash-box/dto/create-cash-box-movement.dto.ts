import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CashBoxMovementType } from '../entities/cash-box-movement.entity';

export class CreateCashBoxMovementDto {
  @IsMongoId()
  @IsNotEmpty()
  financial_account_id: string; // ID de la caja de efectivo afectada

  @IsEnum(CashBoxMovementType)
  @IsNotEmpty()
  type: CashBoxMovementType;

  @IsMongoId()
  @IsOptional()
  user_id?: string; // ID del operador que realiza el movimiento (se tomará del token)

  @IsNumber()
  @IsOptional()
  @Min(0)
  declared_amount?: number; // Monto declarado en la apertura

  @IsNumber()
  @IsOptional()
  @Min(0)
  physical_count?: number; // Conteo físico en cierres

  @IsString()
  @IsOptional()
  notes?: string; // Notas adicionales del operador

  // Campos para transferencias de efectivo (ej. a/desde banco)
  @IsMongoId()
  @IsOptional()
  target_financial_account_id?: string; // ID de la cuenta financiera destino/origen (ej. banco)

  @IsNumber()
  @IsOptional()
  @Min(0)
  transfer_amount?: number; // Monto de la transferencia
}
