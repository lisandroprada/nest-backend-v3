import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ValuationsService } from './valuations.service';
import { ValuationsController } from './valuations.controller';
import { Valuation, ValuationSchema } from './entities/valuation.entity';
import { AuthModule } from '../auth/auth.module';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Valuation.name, schema: ValuationSchema, collection: 'tasaciones' }]),
    AuthModule,
    AccountingEntriesModule,
    PropertiesModule,
  ],
  controllers: [ValuationsController],
  providers: [ValuationsService],
})
export class ValuationsModule {}
