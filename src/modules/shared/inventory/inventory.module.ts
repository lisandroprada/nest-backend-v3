import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import {
  InventoryItem,
  InventoryItemSchema,
} from './entities/inventory-item.entity';
import {
  PropertyInventory,
  PropertyInventorySchema,
} from './entities/property-inventory.entity';
import {
  InventoryVersion,
  InventoryVersionSchema,
} from './entities/inventory-version.entity';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: InventoryItem.name,
        schema: InventoryItemSchema,
        collection: 'catalogo_muebles',
      },
      {
        name: PropertyInventory.name,
        schema: PropertyInventorySchema,
      },
      {
        name: InventoryVersion.name,
        schema: InventoryVersionSchema,
      },
    ]),
    AuthModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}

