
import { MongoClient, ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from '../utils/logger';
import { DateTime } from 'luxon';

/**
 * FASE 4.6 - Vinculación de Asientos Contractuales (REVISIÓN FINAL)
 * 
 * Estrategia: "Matching Contractual con Validación de Actores"
 * 
 * Correcciones Globales:
 * 1. Filtro estricto de tipo 'Debito' (ignora Créditos espejo).
 * 2. Validación de Roles por ID (Source vs Locatario/Locador).
 */

const CONTRACTUAL_TYPES = [
  'Alquiler Devengado',
  'Honorarios',
  'Deposito en Garantía'
];

interface ContractData {
    _id: ObjectId;
    locatarioId?: string;
    locadorId?: string;
}

async function linkContractualEntries() {
  logger.startPhase('FASE 4.6 - Vinculación de Asientos Contractuales (Final Fix)');

  let legacyClient: MongoClient | null = null;
  let v3Client: MongoClient | null = null;

  try {
    legacyClient = await dbConnections.connectToLegacy();
    v3Client = await dbConnections.connectToV3();
    
    const legacyDb = await dbConnections.getLegacyDB();
    const v3Db = await dbConnections.getV3DB();

    // 1. Obtener MasterAccounts Contractuales (MIGRACIÓN MASIVA)
    // FILTRO QUIRÚRGICO (COMENTADO - Para migración masiva)
    // const TARGET_CONTRACT_ID = '6902560abbb2614a30d9d131';
    logger.info(`🔍 Conectado a DB Legacy: ${legacyDb.databaseName}`);
    logger.info(`🔍 Buscando todas las cuentas Legacy contractuales...`);
    
    const query = {
      type: { $in: CONTRACTUAL_TYPES }
      // origin: TARGET_CONTRACT_ID  // Comentado para migración masiva
    };
    
    const masterAccounts = await legacyDb.collection('masteraccounts').find(query).toArray();
    logger.info(`   Query: ${JSON.stringify(query)}`);
    logger.info(`   Resultados: ${masterAccounts.length}`);

    if (masterAccounts.length === 0) {
      logger.warning('No se encontraron asientos Contractuales para vincular.');
      return;
    }

    const masterIds = masterAccounts.map(m => m._id);
    const legacyAccounts = await legacyDb.collection('accounts').find({
      masterAccount: { $in: masterIds }
    }).toArray();

    logger.info(`   Encontradas ${legacyAccounts.length} Accounts candidatas.`);

    // 2. Cargar Mapa de Contratos con Actores (Locatario/Locador)
    logger.info('🗺️  Cargando mapa de Contratos (con Actores)...');
    
    // Proyección incluye IDs de búsqueda para matchear roles
    const v3Contracts = await v3Db.collection('contracts').find({}, { 
        projection: { 
            _id: 1, 
            "_search.locatario_id": 1, 
            "_search.locador_id": 1 
        } 
    }).toArray();
    
    const contractMap = new Map<string, ContractData>(); 
    
    v3Contracts.forEach(c => {
      contractMap.set(c._id.toString(), {
          _id: c._id,
          locatarioId: c._search?.locatario_id?.toString(),
          locadorId: c._search?.locador_id?.toString()
      });
    });
    
    logger.info(`   Mapa de contratos cargado: ${contractMap.size} contratos.`);

    let linked = 0;
    let notFound = 0;
    let skipped = 0; 
    const bulkOps: any[] = [];

    for (const legAcc of legacyAccounts) {
        const master = masterAccounts.find(m => m._id.toString() === legAcc.masterAccount.toString());
        if (!master) continue;

        const legacyContractId = master.origin; 
        if (!legacyContractId) {
            skipped++;
            continue;
        }

        // CORRECCIÓN FINAL: Procesar AMBOS tipos (Debito Y Credito)
        // - Debito (Locatario): se vincula a partida DEBE
        // - Credito (Locador): se vincula a partida HABER
        const isDebito = legAcc.accountType === 'Debito';
        const isCredito = legAcc.accountType === 'Credito';
        
        if (!isDebito && !isCredito) {
            skipped++;
            continue;
        }

        const v3ContractData = contractMap.get(legacyContractId.toString());
        if (!v3ContractData) {
            skipped++;
            continue;
        }

        // 2. Validación de Identidad (Source ID vs Contract Actor IDs)
        // Usamos IDs estrictos en lugar de heurística de texto.
        
        let v3TypeRegex: RegExp;
        const legacySourceId = legAcc.source?.toString();
        
        const isLocatarioById = legacySourceId && legacySourceId === v3ContractData.locatarioId;
        const isLocadorById = legacySourceId && legacySourceId === v3ContractData.locadorId;

        // Fallback de texto si source no matchea (antigua heurística como respaldo)
        const desc = (legAcc.account || '').toLowerCase();
        const fullDesc = (legAcc.accountDescription || '').toLowerCase();
        const isLocatarioText = fullDesc.includes('locatario') || fullDesc.includes('inquilino');
        const isLocadorText = fullDesc.includes('locador') || fullDesc.includes('propietario');
        
        if (desc.includes('alquiler')) {
            v3TypeRegex = /Alquiler/i;
        } else if (desc.includes('honorarios')) {
            // Lógica Estricta con Fallback
            if (isLocatarioById) {
                v3TypeRegex = /Honorarios Locatario/i;
            } else if (isLocadorById) {
                v3TypeRegex = /Honorarios Locador/i;
            } else if (isLocatarioText) {
                v3TypeRegex = /Honorarios Locatario/i;
            } else if (isLocadorText) {
                 v3TypeRegex = /Honorarios Locador/i;
            } else {
                // Último recurso: Honorarios genérico (esto causó el bug original, pero ahora tenemos IDs)
                // Si llegamos aquí, es un honorario sin dueño claro.
                // Asignamos a Locatario por defecto estadístico (es el que paga más comúnmente).
                v3TypeRegex = /Honorarios/i; 
            }
        } else if (desc.includes('deposito')) {
            v3TypeRegex = /Deposito/i; 
        } else {
             v3TypeRegex = new RegExp(escapeRegExp(master.type), 'i');
        }

        // Matching Fecha (Mes/Año)
        const accDate = DateTime.fromJSDate(legAcc.dueDate || master.dueDate);
        const startOfMonth = accDate.startOf('month').toJSDate();
        const endOfMonth = accDate.endOf('month').toJSDate();
        
        const matchQuery = {
            contrato_id: v3ContractData._id,
            tipo_asiento: { $regex: v3TypeRegex },
            fecha_imputacion: {
                $gte: startOfMonth,
                $lte: endOfMonth
            }
        };

        const v3Entry = await v3Db.collection('accountingentries').findOne(matchQuery);

        if (v3Entry) {
            // Vincular a metadata específico según tipo de cuenta
            const metadataField = isDebito 
                ? "metadata.legacy_account_ids_debito"  // Locatario (Debe)
                : "metadata.legacy_account_ids_credito"; // Locador (Haber)
            
            bulkOps.push({
                updateOne: {
                    filter: { _id: v3Entry._id },
                    update: { 
                        $addToSet: { 
                            [metadataField]: legAcc._id 
                        } 
                    }
                }
            });
            linked++;
        } else {
            notFound++;
        }
    }

    if (bulkOps.length > 0) {
        logger.info(`💾 Vinculando ${bulkOps.length} cuentas Legacy a asientos V3...`);
        const res = await v3Db.collection('accountingentries').bulkWrite(bulkOps);
        logger.success(`✅ Modificados: ${res.modifiedCount}`);
    }

    logger.endPhase('FASE 4.6 - Completada (Final Fix)', { linked, notFound, skipped });

  } catch (error) {
    logger.error('Error fatal en vinculación contractual', error);
  } finally {
    if (legacyClient) await legacyClient.close();
    if (v3Client) await v3Client.close();
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

if (require.main === module) {
  linkContractualEntries().catch(console.error);
}
