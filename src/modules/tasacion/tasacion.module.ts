import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comparable, ComparableSchema } from './comparable.schema';
import { MarketParams, MarketParamsSchema } from './market-params.schema';
import { ValuationService } from './valuation.service';
import { TasacionController } from './tasacion.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comparable.name, schema: ComparableSchema },
      { name: MarketParams.name, schema: MarketParamsSchema },
    ]),
  ],
  controllers: [TasacionController],
  providers: [ValuationService],
})
export class TasacionModule {}
