/**
 * Script de transformación de contratos Legacy a Backend-V3
 * 
 * Transforma contratos del formato sistema-be al formato nest-backend-v3
 * 
 * Uso:
 * mongosh mongodb://localhost:27017/nest-propietasV3 < transform-contracts.js
 */

print('🔄 Iniciando transformación de contratos Legacy a V3...\n');

// Obtener todos los contratos
const contracts = db.contracts.find({}).toArray();
print(`📊 Total de contratos a transformar: ${contracts.length}\n`);

let transformedCount = 0;
let errorCount = 0;

contracts.forEach((contract, index) => {
  try {
    // Verificar si ya está en formato V3
    if (contract.terminos_financieros) {
      print(`⏭️  Contrato ${index + 1}/${contracts.length} - Ya está en formato V3, saltando...`);
      return;
    }

    // Construir estructura V3
    const contractV3 = {
      // IDs y referencias
      propiedad_id: contract.property?._id || contract.property,
      
      // Partes del contrato
      partes: [],
      
      // Fechas
      fecha_inicio: contract.startDate,
      fecha_final: contract.expiresAt,
      duracion_meses: contract.length || 24,
      
      // Estado
      status: contract.status === true ? 'VIGENTE' : 'RESCINDIDO',
      
      // Términos financieros
      terminos_financieros: {
        monto_base_vigente: contract.rentAmount || 0,
        indice_tipo: contract.rentIncreaseType === 'ICL' ? 'ICL' : 
                     contract.rentIncreaseType === 'IPC' ? 'IPC' : 'FIJO',
        interes_mora_diaria: contract.interest || 0,
        iva_calculo_base: 'INCLUIDO',
        
        comision_administracion_porcentaje: contract.adminFee || 7,
        
        honorarios_locador_porcentaje: contract.leaseHolderFee || 0,
        honorarios_locador_cuotas: contract.leaseHolderAmountOfFees || 1,
        honorarios_locatario_porcentaje: contract.tenantFee || 0,
        honorarios_locatario_cuotas: contract.tenantAmountOfFees || 1,
        
        ajuste_porcentaje: contract.rentIncreaseFixed || 0,
        ajuste_periodicidad_meses: contract.rentIncreasePeriod || 12,
        ajuste_es_fijo: contract.rentIncreaseType === 'FIJO',
        indice_valor_inicial: contract.icl || 0
      },
      
      // Depósito
      deposito_monto: contract.depositAmount || 0,
      deposito_cuotas: contract.depositLength || 1,
      deposito_tipo_ajuste: contract.depositType === 'Efectivo' ? 'AL_ORIGEN' : 'AL_ULTIMO_ALQUILER',
      
      // Tipo y uso
      tipo_contrato: contract.type || 'Vivienda',
      uso_propiedad: contract.use || 'Vivienda Única',
      
      // Hitos (por defecto false para contratos migrados)
      firmas_completas: false,
      documentacion_completa: false,
      visita_realizada: false,
      inventario_actualizado: false,
      fotos_inventario: [],
      
      // Auditoría
      createdAt: contract.createdAt || new Date(),
      updatedAt: contract.changedAt || new Date()
    };

    // Agregar partes del contrato
    // Locatario (Inquilino)
    if (contract.tenant && contract.tenant.length > 0) {
      contract.tenant.forEach(t => {
        if (t._id) {
          contractV3.partes.push({
            agente_id: t._id,
            rol: 'LOCATARIO'
          });
        }
      });
    }

    // Locador (Propietario)
    if (contract.leaseHolder && contract.leaseHolder.length > 0) {
      contract.leaseHolder.forEach(lh => {
        if (lh._id) {
          contractV3.partes.push({
            agente_id: lh._id,
            rol: 'LOCADOR'
          });
        }
      });
    }

    // Garante
    if (contract.guarantor && contract.guarantor.length > 0) {
      contract.guarantor.forEach(g => {
        if (g._id) {
          contractV3.partes.push({
            agente_id: g._id,
            rol: 'GARANTE'
          });
        }
      });
    }

    // Actualizar el contrato en la BD
    db.contracts.updateOne(
      { _id: contract._id },
      { $set: contractV3 }
    );

    transformedCount++;
    if ((index + 1) % 100 === 0) {
      print(`✅ Progreso: ${index + 1}/${contracts.length} contratos procesados...`);
    }

  } catch (error) {
    errorCount++;
    print(`❌ Error en contrato ${contract._id}: ${error.message}`);
  }
});

print(`\n📊 Resumen de transformación:`);
print(`   ✅ Contratos transformados: ${transformedCount}`);
print(`   ❌ Errores: ${errorCount}`);
print(`   📝 Total procesados: ${contracts.length}`);
print(`\n✨ Transformación completada!\n`);
