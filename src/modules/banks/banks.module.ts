import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BanksService } from './banks.service';
import { BanksController } from './banks.controller';
import { Bank, BankSchema } from './entities/bank.entity';
import { CommonModule } from 'src/common/common.module'; // Import CommonModule

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Bank.name, schema: BankSchema }]),
    CommonModule, // Add CommonModule here
  ],
  controllers: [BanksController],
  providers: [BanksService],
  exports: [BanksService], // Export the service so other modules can use it
})
export class BanksModule {}
