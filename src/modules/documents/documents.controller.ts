import { Controller, Post, Body, Res } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { Response } from 'express';

@Controller('documents')
@Auth(ValidRoles.admin, ValidRoles.superUser)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('generate-pdf')
  async generatePdf(
    @Body() generateDto: GenerateDocumentDto,
    @Res() res: Response,
  ) {
    const html = await this.documentsService.generateDocument(generateDto);
    // For now, we return the HTML. In the future, this will be a PDF file.
    res.header('Content-Type', 'text/html');
    res.send(html);
  }
}
