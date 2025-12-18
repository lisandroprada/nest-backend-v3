import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from '../src/modules/inbox/entities/message.entity';

async function cleanDuplicates() {
  console.log('🧹 Iniciando limpieza de emails duplicados...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const messageModel = app.get<Model<Message>>('MessageModel');

  try {
    // Encontrar todos los messageIds duplicados
    const duplicates = await messageModel.aggregate([
      {
        $match: {
          'emailMetadata.messageId': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$emailMetadata.messageId',
          count: { $sum: 1 },
          docs: { $push: { id: '$_id', timestamp: '$timestamp' } },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ]);

    console.log(`📊 Encontrados ${duplicates.length} emails con duplicados\n`);

    if (duplicates.length === 0) {
      console.log('✅ No hay duplicados para limpiar');
      await app.close();
      return;
    }

    let totalDeleted = 0;

    for (const dup of duplicates) {
      // Ordenar por timestamp descendente (más reciente primero)
      const sorted = dup.docs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Mantener el primero (más reciente), eliminar el resto
      const toDelete = sorted.slice(1).map(d => d.id);

      console.log(`📧 MessageId: ${dup._id}`);
      console.log(`   Duplicados: ${dup.count}`);
      console.log(`   Manteniendo: ${sorted[0].id}`);
      console.log(`   Eliminando: ${toDelete.length} copias`);

      const result = await messageModel.deleteMany({
        _id: { $in: toDelete },
      });

      totalDeleted += result.deletedCount;
      console.log(`   ✓ Eliminados: ${result.deletedCount}\n`);
    }

    console.log('═══════════════════════════════════════');
    console.log(`✅ Limpieza completada`);
    console.log(`📊 Total de duplicados eliminados: ${totalDeleted}`);
    console.log(`📧 Emails únicos mantenidos: ${duplicates.length}`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await app.close();
  }
}

cleanDuplicates()
  .then(() => {
    console.log('🎉 Script finalizado con éxito');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
