import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ContractSettingsService } from '../src/modules/contract-settings/contract-settings.service';

/**
 * Script para inicializar la configuración por defecto de contratos
 * Ejecutar: ts-node scripts/seed-contract-settings.ts
 */
async function bootstrap() {
  console.log('🌱 Iniciando seed de Contract Settings...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const contractSettingsService = app.get(ContractSettingsService);

  try {
    // Verificar si ya existe configuración
    const settings = await contractSettingsService.initializeDefaults();

    console.log('✅ Configuración encontrada:');
    console.log('   _id:', settings._id);
    console.log('   Activa:', settings.activo);
    console.log(
      '   Comisión admin:',
      settings.comision_administracion_default,
      '%',
    );
    console.log(
      '   Honorarios locador:',
      settings.honorarios_locador_porcentaje_default,
      '%',
    );
    console.log(
      '   Honorarios locatario:',
      settings.honorarios_locatario_porcentaje_default,
      '%',
    );
    console.log('   Tipos de contrato:', settings.tipos_contrato.length);
    console.log('\n✨ La configuración está lista para usar.\n');

    // Mostrar resumen de tipos de contrato
    console.log('📋 Tipos de Contrato Configurados:');
    console.log('─'.repeat(80));
    settings.tipos_contrato.forEach((tipo) => {
      console.log(
        `   • ${tipo.tipo_contrato.padEnd(20)} → ${tipo.duracion_meses_default}m, ${tipo.indice_tipo_default}, ajuste cada ${tipo.ajuste_periodicidad_meses_default}m`,
      );
    });
    console.log('─'.repeat(80));

    console.log('\n📊 Valores por Defecto:');
    console.log(
      '   Comisión administración:',
      settings.comision_administracion_default,
      '%',
    );
    console.log(
      '   Honorarios locador:',
      settings.honorarios_locador_porcentaje_default,
      '% en',
      settings.honorarios_locador_cuotas_default,
      'cuota(s)',
    );
    console.log(
      '   Honorarios locatario:',
      settings.honorarios_locatario_porcentaje_default,
      '% en',
      settings.honorarios_locatario_cuotas_default,
      'cuota(s)',
    );
    console.log(
      '   Interés mora diaria:',
      settings.interes_mora_diaria_default,
      '%',
    );
    console.log('   Días de mora:', settings.dias_mora_default, 'días');
    console.log(
      '   Depósito:',
      settings.deposito_meses_alquiler,
      'mes(es) de alquiler en',
      settings.deposito_cuotas_default,
      'cuota(s)',
    );

    console.log('\n🔔 Notificaciones:');
    console.log(
      '   Aviso vencimiento:',
      settings.dias_aviso_vencimiento,
      'días antes',
    );
    console.log('   Aviso ajuste:', settings.dias_aviso_ajuste, 'días antes');
    console.log(
      '   Recordatorios de pago:',
      settings.enviar_recordatorio_pago ? 'Sí' : 'No',
    );

    console.log('\n✅ Seed completado exitosamente!\n');
  } catch (error) {
    console.error('❌ Error durante el seed:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
