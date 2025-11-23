import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Connection } from 'mongoose';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    // Get MongoDB connection
    const connection = app.get(Connection);
    console.log('Connected to database:', connection.name);

    // 1. Delete all service-related accounting entries
    console.log('\n🗑️  Deleting service accounting entries...');
    const entriesResult = await connection.db
      .collection('accountingentries')
      .deleteMany({ tipo_asiento: 'Gasto Servicio Detectado' });
    console.log(`   Deleted ${entriesResult.deletedCount} accounting entries`);

    // 2. Delete all detected expenses
    console.log('\n🗑️  Deleting detected expenses...');
    const expensesResult = await connection.db
      .collection('gastos_detectados')
      .deleteMany({});
    console.log(`   Deleted ${expensesResult.deletedCount} detected expenses`);

    // 3. Delete all service communications
    console.log('\n🗑️  Deleting service communications...');
    const commsResult = await connection.db
      .collection('servicecommunications')
      .deleteMany({});
    console.log(`   Deleted ${commsResult.deletedCount} service communications`);

    console.log('\n✅ Cleanup completed successfully!');
    console.log('\n📧 Now you can run the rescan to process emails again:');
    console.log('   curl -X POST "http://localhost:3050/api/v1/service-sync/rescan" \\');
    console.log('     -H "Authorization: Bearer <token>" \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"autoDuring": true}\'');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
