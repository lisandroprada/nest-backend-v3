import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JoiValidationSchema } from './common/config/joi.validation';
import { EnvConfiguration } from './common/config/env.config';
import { MongooseModule } from '@nestjs/mongoose';
import { LocalityModule } from './modules/shared/location/locality/locality.module';
import { ProvinceModule } from './modules/shared/location/province/province.module';
import { UniqueIdServiceService } from './modules/services/unique-id/unique-id-service.service';
import { UniqueIdModule } from './modules/services/unique-id/unique-id.module';
import { IndexValueModule } from './modules/external-apis/index-value/index-value.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SequenceModule } from './modules/sequence/sequence.module';
import { CommonModule } from './common/common.module';
import { AppConfigServiceModule } from './utils/app-config-service/app-config-service.module';
import { GoogleMapsService } from './modules/services/google-maps/google-maps.service';
import { NlpService } from './modules/services/nlp/nlp.service';
import { EmailsModule } from './modules/emails/emails.module';
import { AgentsModule } from './modules/agents/agents.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { ChartOfAccountsModule } from './modules/chart-of-accounts/chart-of-accounts.module';
import { FinancialAccountsModule } from './modules/financial-accounts/financial-accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AccountingEntriesModule } from './modules/accounting-entries/accounting-entries.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AmenitiesModule } from './modules/shared/amenities/amenities.module';
import { InventoryModule } from './modules/shared/inventory/inventory.module';

import { AssetsModule } from './modules/assets/assets.module';

import { DocumentTemplatesModule } from './modules/document-templates/document-templates.module';
import { DocumentsModule } from './modules/documents/documents.module';

import { DetectedExpensesModule } from './modules/detected-expenses/detected-expenses.module';
import { ExpensesModule } from './modules/expenses/expenses.module';

import { FiscalModule } from './modules/fiscal/fiscal.module';

import { ValuationsModule } from './modules/valuations/valuations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [EnvConfiguration],
      validationSchema: JoiValidationSchema,
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/public',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),

    ScheduleModule.forRoot(),
    UserModule,
    AuthModule,
    LocalityModule,
    ProvinceModule,
    UniqueIdModule,
    IndexValueModule,
    SequenceModule,
    CommonModule,
    AppConfigServiceModule,
    EmailsModule,
    AgentsModule,
    PropertiesModule,
    ContractsModule,
    ChartOfAccountsModule,
    FinancialAccountsModule,
    TransactionsModule,
    AccountingEntriesModule,
    TasksModule,
    InventoryModule,
    AmenitiesModule,
    AssetsModule,
    DocumentTemplatesModule,
    DocumentsModule,
    DetectedExpensesModule,
    ExpensesModule,
    FiscalModule,
    ValuationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    UniqueIdServiceService,
    GoogleMapsService,
    NlpService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {}
}
