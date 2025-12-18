
import { MongoClient } from 'mongodb';

const V3_URI = 'mongodb://127.0.0.1:27017/nest-propietasV3';

async function truncateAccounting() {
    console.log('🗑️  TRUNCATING V3 ACCOUNTING COLLECTIONS...');
    const client = await MongoClient.connect(V3_URI);
    const db = client.db();

    try {
        const ae = await db.collection('accountingentries').deleteMany({});
        console.log(`✅ Deleted ${ae.deletedCount} accountingentries`);

        const tx = await db.collection('transactions').deleteMany({});
        console.log(`✅ Deleted ${tx.deletedCount} transactions`);
        
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.close();
    }
}

truncateAccounting();
