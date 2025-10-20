import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FiscalDocument } from './entities/fiscal-document.entity';
import { AfipService } from './afip.service';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { AgentsService } from '../agents/agents.service';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';

@Injectable()
export class FiscalDocumentsService {
  constructor(
    @InjectModel(FiscalDocument.name)
    private readonly fiscalDocModel: Model<FiscalDocument>,
    private readonly afipService: AfipService,
    private readonly accountingEntriesService: AccountingEntriesService,
    private readonly agentsService: AgentsService,
  ) {}

  async issueInvoice(issueDto: IssueInvoiceDto, userId: string) {
    const { asientos_asociados_ids } = issueDto;

    // 1. Get accounting entries and validate them
    const entries = await this.accountingEntriesService.find({
      _id: { $in: asientos_asociados_ids },
    });
    if (entries.length !== asientos_asociados_ids.length) {
      throw new NotFoundException('One or more accounting entries not found.');
    }

    // ... (more validations, e.g., check if they are already invoiced)

    // 2. Group entries by client and calculate totals
    // For simplicity, this example assumes all entries are for the same client.
    const firstEntry = entries[0];
    const clientId = firstEntry.partidas[0].agente_id;
    const client = await this.agentsService.findOne(clientId.toString());

    const total_base_imponible = entries.reduce(
      (sum, e) =>
        sum + e.partidas.reduce((s, p) => s + (p.monto_base_imponible || 0), 0),
      0,
    );
    const total_iva = entries.reduce(
      (sum, e) =>
        sum + e.partidas.reduce((s, p) => s + (p.monto_iva_calculado || 0), 0),
      0,
    );
    const monto_total_fiscal = total_base_imponible + total_iva;

    // 3. Determine invoice type (A or B)
    const punto_venta = 1; // This should come from config
    const tipo_comprobante = client.nomenclador_fiscal === 'RI' ? '01' : '06'; // Simplified logic

    // 4. Get next invoice number
    const nextInvoiceNumber = await this.afipService.getProximoNroComprobante(
      punto_venta,
      tipo_comprobante,
    );

    // 5. Submit to AFIP
    const afipResponse = await this.afipService.submitInvoice({
      // ... (construct the payload for the AFIP SDK)
      CbteDesde: nextInvoiceNumber,
      // ...
    });

    // 6. Persist the fiscal document
    const fiscalDocument = new this.fiscalDocModel({
      agente_cliente_id: clientId,
      tipo_comprobante,
      numero_comprobante: afipResponse.numero_comprobante,
      punto_venta,
      fecha_emision: new Date(),
      monto_total_fiscal,
      CAE: afipResponse.CAE,
      estado_AFIP: afipResponse.estado_AFIP,
      asientos_asociados_ids,
      detalles_errores: afipResponse.detalles_errores,
    });
    await fiscalDocument.save();

    // 7. Update accounting entries status
    await this.accountingEntriesService.markAsInvoiced(asientos_asociados_ids);

    return fiscalDocument;
  }
}
