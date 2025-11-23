import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AccountingEntriesService } from '../src/modules/accounting-entries/accounting-entries.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const service = app.get(AccountingEntriesService);
  const expenseId = process.argv[2];
  if (!expenseId) {
    console.error('Provide expenseId as argument');
    process.exit(1);
  }
  try {
    const result = await service.processDetectedExpenseToEntry({ detectedExpenseId: expenseId });
    console.log('Processing result:', result);
    // Fetch any accounting entries created for this expense
    const entries = await service.find({ detected_expense_id: expenseId });
    console.log('Associated accounting entries:', entries);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await app.close();
  }
}

main();
