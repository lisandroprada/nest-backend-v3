
import mongoose, { Schema } from 'mongoose';

const V2_MONGO_URI = 'mongodb://127.0.0.1:27017/nest-propietasV2';

async function analyze() {
  const conn = await mongoose.createConnection(V2_MONGO_URI).asPromise();
  const Property = conn.model('Property', new Schema({}, { strict: false }), 'properties');

  const statuses = await Property.distinct('status');
  const paymentMethodsSale = await Property.distinct('valueForSale.paymentMethod');
  const paymentMethodsRent = await Property.distinct('valueForRent.paymentMethod');
  const currenciesSale = await Property.distinct('valueForSale.currency');
  
  console.log('Distinct Statuses:', statuses);
  console.log('Payment Methods (Sale):', paymentMethodsSale);
  console.log('Payment Methods (Rent):', paymentMethodsRent);
  console.log('Currencies (Sale):', currenciesSale);

  await conn.close();
}

analyze().catch(console.error);
