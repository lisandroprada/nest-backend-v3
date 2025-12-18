import { Db, Collection, ObjectId } from 'mongodb';
import { dbConnections } from '../../configuracion/conexiones.config';
import { logger } from './logger';

/**
 * Helpers de base de datos para operaciones comunes
 */
export class DbHelpers {
  /**
   * Cuenta documentos en una colección
   */
  static async countDocuments(db: Db, collectionName: string, filter: any = {}): Promise<number> {
    const collection = db.collection(collectionName);
    return await collection.countDocuments(filter);
  }

  /**
   * Verifica si un documento existe por _id
   */
  static async documentExists(db: Db, collectionName: string, id: ObjectId): Promise<boolean> {
    const collection = db.collection(collectionName);
    const doc = await collection.findOne({ _id: id });
    return doc !== null;
  }

  /**
   * Verifica si un documento existe por un campo específico
   */
  static async documentExistsByField(
    db: Db,
    collectionName: string,
    fieldName: string,
    value: any,
  ): Promise<boolean> {
    const collection = db.collection(collectionName);
    const doc = await collection.findOne({ [fieldName]: value });
    return doc !== null;
  }

  /**
   * Encuentra documentos huérfanos (que referencian un _id que no existe)
   */
  static async findOrphans(
    db: Db,
    sourceCollection: string,
    referenceField: string,
    targetCollection: string,
  ): Promise<any[]> {
    const source = db.collection(sourceCollection);
    const target = db.collection(targetCollection);

    // Obtener todos los _id válidos de la colección objetivo
    const validIds = await target.find({}).project({ _id: 1 }).toArray();
    const validIdSet = new Set(validIds.map(doc => doc._id.toString()));

    // Buscar documentos que referencien _id que no existen
    const orphans: any[] = [];
    const docs = await source.find({}).toArray();

    for (const doc of docs) {
      const refId = doc[referenceField];
      if (refId && !validIdSet.has(refId.toString())) {
        orphans.push(doc);
      }
    }

    return orphans;
  }

  /**
   * Crea índices en una colección
   */
  static async createIndexes(
    db: Db,
    collectionName: string,
    indexes: Array<{ key: any; unique?: boolean; sparse?: boolean }>,
  ) {
    const collection = db.collection(collectionName);
    
    for (const index of indexes) {
      try {
        await collection.createIndex(index.key, {
          unique: index.unique || false,
          sparse: index.sparse || false,
        });
        logger.success(`Índice creado en ${collectionName}:`, index.key);
      } catch (error) {
        logger.warning(`Índice ya existe en ${collectionName}:`, index.key);
      }
    }
  }

  /**
   * Inserta documentos con manejo de errores de duplicados
   */
  static async bulkInsertWithDuplicateHandling(
    collection: Collection,
    documents: any[],
    options: { continueOnError?: boolean } = {},
  ): Promise<{ inserted: number; duplicates: number; errors: any[] }> {
    const stats = {
      inserted: 0,
      duplicates: 0,
      errors: [] as any[],
    };

    for (const doc of documents) {
      try {
        await collection.insertOne(doc);
        stats.inserted++;
      } catch (error: any) {
        if (error.code === 11000) {
          // Error de clave duplicada
          stats.duplicates++;
          logger.warning(`Documento duplicado (se omite): ${doc._id}`);
        } else {
          stats.errors.push({ doc, error });
          logger.error(`Error insertando documento: ${doc._id}`, error);
          
          if (!options.continueOnError) {
            throw error;
          }
        }
      }
    }

    return stats;
  }

  /**
   * Actualiza documentos con upsert
   */
  static async bulkUpsert(
    collection: Collection,
    documents: any[],
    keyField: string = '_id',
  ): Promise<{ updated: number; inserted: number; errors: any[] }> {
    const stats = {
      updated: 0,
      inserted: 0,
      errors: [] as any[],
    };

    for (const doc of documents) {
      try {
        const filter = { [keyField]: doc[keyField] };
        const result = await collection.updateOne(filter, { $set: doc }, { upsert: true });
        
        if (result.upsertedCount > 0) {
          stats.inserted++;
        } else if (result.modifiedCount > 0) {
          stats.updated++;
        }
      } catch (error) {
        stats.errors.push({ doc, error });
        logger.error(`Error en upsert de documento: ${doc[keyField]}`, error);
      }
    }

    return stats;
  }

  /**
   * Compara conteos entre Legacy y V3
   */
  static async compareCollectionCounts(
    legacyCollection: string,
    v3Collection: string,
  ): Promise<{ legacy: number; v3: number; difference: number; match: boolean }> {
    const legacyDb = await dbConnections.getLegacyDB();
    const v3Db = await dbConnections.getV3DB();

    const legacyCount = await this.countDocuments(legacyDb, legacyCollection);
    const v3Count = await this.countDocuments(v3Db, v3Collection);

    const difference = legacyCount - v3Count;
    const match = difference === 0;

    logger.info(`📊 Comparación de conteos:`);
    logger.info(`  Legacy.${legacyCollection}: ${legacyCount}`);
    logger.info(`  V3.${v3Collection}: ${v3Count}`);
    logger.info(`  Diferencia: ${difference} ${match ? '✅' : '❌'}`);

    return { legacy: legacyCount, v3: v3Count, difference, match };
  }

  /**
   * Ejecuta un pipeline de agregación y retorna los resultados
   */
  static async aggregate(db: Db, collectionName: string, pipeline: any[]): Promise<any[]> {
    const collection = db.collection(collectionName);
    return await collection.aggregate(pipeline).toArray();
  }

  /**
   * Elimina todos los documentos de una colección (¡USAR CON CUIDADO!)
   */
  static async truncateCollection(db: Db, collectionName: string): Promise<number> {
    logger.warning(`⚠️  TRUNCANDO colección: ${collectionName}`);
    const collection = db.collection(collectionName);
    const result = await collection.deleteMany({});
    logger.info(`Eliminados ${result.deletedCount} documentos de ${collectionName}`);
    return result.deletedCount;
  }
}
