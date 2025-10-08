import { IsString, IsNotEmpty, IsMongoId, IsNumber, IsPositive } from 'class-validator';

export class AssignExpenseDto {
  @IsMongoId()
  @IsNotEmpty()
  gasto_detectado_id: string;

  @IsMongoId()
  @IsNotEmpty()
  agente_responsable_id: string;

  @IsNumber()
  @IsPositive()
  monto_final_factura: number;

  @IsString()
  @IsNotEmpty()
  tipo_gasto: string; // This should be a code from the chart of accounts, e.g., 'GASTO_LUZ'
}
