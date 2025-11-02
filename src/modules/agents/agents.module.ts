import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Agent, AgentSchema } from './entities/agent.entity';
import { AuthModule } from '../auth/auth.module';
import { AccountingEntriesModule } from '../accounting-entries/accounting-entries.module';
import { CommonModule } from 'src/common/common.module';
import { CuitModule } from '../cuit/cuit.module';
import { BanksModule } from '../banks/banks.module'; // Import BanksModule

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agent.name, schema: AgentSchema }]),
    AuthModule,
    AccountingEntriesModule,
    CommonModule,
    CuitModule,
    BanksModule, // Add BanksModule here
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
