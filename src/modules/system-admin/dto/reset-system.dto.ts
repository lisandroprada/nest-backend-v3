import { IsBoolean, IsOptional } from 'class-validator';

export class ResetSystemDto {
  @IsBoolean()
  confirm: boolean;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class ResetSystemResponseDto {
  success: boolean;
  message: string;
  deletedCounts: {
    contracts: number;
    accountingEntries: number;
    transactions: number;
    receipts: number;
    receiptFiles: number;
    cashBoxMovements: number;
    financialAccountsReset: number;
  };
  timestamp: Date;
  isDryRun?: boolean;
}
