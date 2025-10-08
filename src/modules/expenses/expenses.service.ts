import { Injectable } from '@nestjs/common';
import { DetectedExpensesService } from '../detected-expenses/detected-expenses.service';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { AssignExpenseDto } from './dto/assign-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly detectedExpensesService: DetectedExpensesService,
    private readonly accountingEntriesService: AccountingEntriesService,
  ) {}

  async assignExpense(assignDto: AssignExpenseDto, userId: string) {
    const { gasto_detectado_id, agente_responsable_id, monto_final_factura, tipo_gasto } = assignDto;

    // 1. Create the accounting entry for the expense
    // This is a simplified version. The actual implementation would need to get the account IDs from the chart of accounts.
    const accountingEntry = await this.accountingEntriesService.create({
      descripcion: `Gasto por ${tipo_gasto}`,
      tipo_asiento: 'GASTO',
      fecha_vencimiento: new Date().toISOString(),
      partidas: [
        {
          cuenta_id: new (require('mongoose').Types.ObjectId)('placeholder_for_gasto_cuenta_id'),
          descripcion: `Gasto ${tipo_gasto}`,
          debe: monto_final_factura,
          haber: 0,
          agente_id: new (require('mongoose').Types.ObjectId)(agente_responsable_id),
        },
        {
          cuenta_id: new (require('mongoose').Types.ObjectId)('placeholder_for_cxp_prov_cuenta_id'),
          descripcion: 'Contrapartida Gasto',
          debe: 0,
          haber: monto_final_factura,
        },
      ],
      usuario_creacion_id: new (require('mongoose').Types.ObjectId)(userId),
      usuario_modificacion_id: new (require('mongoose').Types.ObjectId)(userId),
    });

    // 2. Update the state of the detected expense
    await this.detectedExpensesService.update(gasto_detectado_id, {
      estado_procesamiento: 'ASIGNADO',
    });

    return accountingEntry;
  }
}
