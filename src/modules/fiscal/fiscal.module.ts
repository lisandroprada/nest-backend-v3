import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FiscalDocumentsService } from './fiscal-documents.service';
import { FiscalController } from './fiscal.controller';
import { FiscalDocument, FiscalDocumentSchema } from './entities/fiscal-document.entity';
import { AfipService } from './afip.service';
import { AuthModule } from '../auth/auth.module';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FiscalDocument.name, schema: FiscalDocumentSchema, collection: 'comprobantes_fiscales' }]),
    AuthModule,
    AccountingEntriesModule,
    AgentsModule,
  ],
  controllers: [FiscalController],
  providers: [FiscalDocumentsService, AfipService],
})
export class FiscalModule {}
