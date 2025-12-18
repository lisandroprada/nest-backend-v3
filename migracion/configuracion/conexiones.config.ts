import { MongoClient } from 'mongodb';

/**
 * Configuración de Conexiones a Bases de Datos
 * 
 * Este archivo centraliza las connection strings y clientes de MongoDB
 * para las bases de datos Legacy y V3.
 */

export const DB_CONFIG = {
  legacy: {
    uri: 'mongodb://127.0.0.1:27017/propietas',
    database: 'propietas',
    collections: {
      agents: 'agents',
      properties: 'properties',
      contracts: 'contracts',
      masterAccounts: 'masteraccounts',
      accounts: 'accounts',
      accountEntries: 'accountentries',
    },
  },
  v3: {
    uri: 'mongodb://127.0.0.1:27017/nest-propietasV3',
    database: 'nest-propietasV3',
    collections: {
      agents: 'agents',
      properties: 'properties',
      contracts: 'leaseagreements',
      transactions: 'transactions',
      payments: 'payments',
    },
  },
};

/**
 * Clase para manejar las conexiones a las bases de datos
 */
export class DatabaseConnections {
  private legacyClient: MongoClient | null = null;
  private v3Client: MongoClient | null = null;

  /**
   * Conecta a la base de datos Legacy
   */
  async connectToLegacy(): Promise<MongoClient> {
    if (this.legacyClient) {
      return this.legacyClient;
    }

    try {
      this.legacyClient = new MongoClient(DB_CONFIG.legacy.uri);
      await this.legacyClient.connect();
      console.log('✅ Conectado a base de datos Legacy');
      return this.legacyClient;
    } catch (error) {
      console.error('❌ Error conectando a Legacy:', error);
      throw error;
    }
  }

  /**
   * Conecta a la base de datos V3
   */
  async connectToV3(): Promise<MongoClient> {
    if (this.v3Client) {
      return this.v3Client;
    }

    try {
      this.v3Client = new MongoClient(DB_CONFIG.v3.uri);
      await this.v3Client.connect();
      console.log('✅ Conectado a base de datos V3');
      return this.v3Client;
    } catch (error) {
      console.error('❌ Error conectando a V3:', error);
      throw error;
    }
  }

  /**
   * Obtiene la base de datos Legacy
   */
  async getLegacyDB() {
    const client = await this.connectToLegacy();
    return client.db(DB_CONFIG.legacy.database);
  }

  /**
   * Obtiene la base de datos V3
   */
  async getV3DB() {
    const client = await this.connectToV3();
    return client.db(DB_CONFIG.v3.database);
  }

  /**
   * Cierra todas las conexiones
   */
  async closeAll() {
    if (this.legacyClient) {
      await this.legacyClient.close();
      console.log('✅ Conexión a Legacy cerrada');
    }
    if (this.v3Client) {
      await this.v3Client.close();
      console.log('✅ Conexión a V3 cerrada');
    }
  }
}

/**
 * Instancia singleton de las conexiones
 */
export const dbConnections = new DatabaseConnections();
