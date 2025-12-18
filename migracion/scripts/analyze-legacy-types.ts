
import mongoose from 'mongoose';

const LEGACY_DB = 'mongodb://127.0.0.1:27017/propietas';

async function analyzeLegacyTypes() {
  const conn = await mongoose.createConnection(LEGACY_DB).asPromise();
  const db = conn.db;
  
  console.log('Fetching unique account types from legacy receipts...');
  
  // Aggregation to unwind receiptEntries and group by account/masterAccount
  const types = await db.collection('receipts').aggregate([
    { $unwind: '$receiptEntries' },
    { $group: {
        _id: { 
            account: '$receiptEntries.account',
            masterAccount: '$receiptEntries.masterAccount',
            type: '$receiptEntries.accountType' // Debito/Credito
        },
        count: { $sum: 1 }
    }},
    { $sort: { count: -1 } }
  ]).toArray();
  
  console.log('unique_id|account|master_account|type|count');
  
  types.forEach(t => {
      console.log(`${t._id.account}|${t._id.account}|${t._id.masterAccount}|${t._id.type}|${t.count}`);
  });
  
  await conn.close();
}

analyzeLegacyTypes();
