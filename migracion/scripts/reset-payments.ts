
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

const V3_DB = 'mongodb://127.0.0.1:27017/nest-propietasV3';

async function resetPayments() {
  const conn = await mongoose.createConnection(V3_DB).asPromise();
  const db = conn.db;
  
  console.log('🚨 RESETTING PAYMENTS ENVIRONMENT (V3.3) 🚨');
  
  // 1. Delete all Transactions
  console.log('Deleting all Transactions...');
  await db.collection('transactions').deleteMany({});
  
  // 2. Delete all Receipts
  console.log('Deleting all Receipts (to be re-imported in Phase 5A)...');
  await db.collection('receipts').deleteMany({});
  
  // 3. Delete Ad-Hoc Accounting Entries (Phase 4.5 target)
  // We identify them by the presence of `metadata.legacy_id` OR the old "(Migrado)" tag
  console.log('Deleting Ad-Hoc Accounting Entries...');
  await db.collection('accountingentries').deleteMany({
      $or: [
          { "metadata.legacy_id": { $exists: true } },
          { descripcion: { $regex: /\(Migrado\)$/ } }
      ]
  });
  
  // 4. Reset Contractual Accounting Entries (Phase 4 target)
  // These should NOT be deleted, just reset to unpaid state
  console.log('Resetting Contractual Accounting Entries to PENDIENTE...');
  await db.collection('accountingentries').updateMany(
      {}, // All remaining (contractual)
      { 
          $set: { 
              estado: 'PENDIENTE',
              "partidas.$[].monto_pagado_acumulado": 0,
              "partidas.$[].monto_liquidado": 0
          }
      }
  );

  console.log('✅ Environment Reset Complete.');
  await conn.close();
}

resetPayments();
