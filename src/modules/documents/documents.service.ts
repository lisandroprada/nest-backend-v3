import { Injectable, NotFoundException } from '@nestjs/common';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { ContractsService } from '../contracts/contracts.service';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly agentsService: AgentsService,
  ) {}

  async generateDocument(generateDto: GenerateDocumentDto): Promise<string> {
    const { template, context } = generateDto;

    let data = {};
    if (context.type === 'contract') {
      const contract = await this.contractsService.findOne(context.id);
      if (!contract) {
        throw new NotFoundException(
          `Contract with ID ${context.id} not found.`,
        );
      }

      const landlord = await this.agentsService.findOne(
        contract.partes.find((p) => p.rol === 'LOCADOR').agente_id.toString(),
      );
      const tenant = await this.agentsService.findOne(
        contract.partes.find((p) => p.rol === 'LOCATARIO').agente_id.toString(),
      );

      data = {
        contrato: contract,
        locador: landlord,
        locatario: tenant,
      };
    }

    // Placeholder for template engine (e.g., Handlebars)
    let finalHtml = template.content;
    for (const key in data) {
      for (const subKey in data[key]) {
        const regex = new RegExp(`{{${key}.${subKey}}}`, 'g');
        finalHtml = finalHtml.replace(regex, data[key][subKey]);
      }
    }

    // Placeholder for PDF generation (e.g., Puppeteer)
    // For now, we return the final HTML
    return finalHtml;
  }
}
