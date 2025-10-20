// Script para crear las cuentas contables requeridas para la migración
// Ejecutar con: node scripts/create-migration-accounts.js

const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/nest-propietasV3';

const accounts = [
  {
    codigo: 'CXC_ALQ',
    nombre: 'Cuentas por Cobrar - Alquileres',
    tipo_cuenta: 'ACTIVO',
    descripcion: 'Deudas de locatarios por alquileres devengados',
    es_imputable: true,
    cuenta_padre_id: null,
    tasa_iva_aplicable: 0,
    requiere_facturacion: false,
    es_cuenta_resultado: false,
  },
  {
    codigo: 'CXP_LOC',
    nombre: 'Cuentas por Pagar - Locadores',
    tipo_cuenta: 'PASIVO',
    descripcion: 'Obligaciones a pagar a propietarios por alquileres',
    es_imputable: true,
    cuenta_padre_id: null,
    tasa_iva_aplicable: 0,
    requiere_facturacion: false,
    es_cuenta_resultado: false,
  },
  {
    codigo: 'ING_HNR',
    nombre: 'Ingresos por Honorarios',
    tipo_cuenta: 'INGRESO',
    descripcion: 'Comisiones por administración de alquileres',
    es_imputable: true,
    cuenta_padre_id: null,
    tasa_iva_aplicable: 21, // Ajustar según tu país
    requiere_facturacion: true,
    es_cuenta_resultado: true,
  },
  {
    codigo: 'PASIVO_DEPOSITO',
    nombre: 'Depósitos en Garantía',
    tipo_cuenta: 'PASIVO',
    descripcion: 'Depósitos en garantía recibidos de locatarios',
    es_imputable: true,
    cuenta_padre_id: null,
    tasa_iva_aplicable: 0,
    requiere_facturacion: false,
    es_cuenta_resultado: false,
  },
  {
    codigo: 'ACTIVO_FIDUCIARIO',
    nombre: 'Fondos de Terceros en Custodia',
    tipo_cuenta: 'ACTIVO',
    descripcion: 'Dinero de terceros en custodia (depósitos)',
    es_imputable: true,
    cuenta_padre_id: null,
    tasa_iva_aplicable: 0,
    requiere_facturacion: false,
    es_cuenta_resultado: false,
  },
];

async function createAccounts() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    const db = client.db();
    const collection = db.collection('chartofaccounts');

    // Verificar si ya existen
    const existingCodes = await collection
      .find({ codigo: { $in: accounts.map((a) => a.codigo) } })
      .toArray();

    if (existingCodes.length > 0) {
      console.log('\n⚠️  Algunas cuentas ya existen:');
      existingCodes.forEach((acc) => {
        console.log(`   - ${acc.codigo}: ${acc.nombre}`);
      });

      const existingCodesSet = new Set(existingCodes.map((a) => a.codigo));
      const newAccounts = accounts.filter(
        (a) => !existingCodesSet.has(a.codigo),
      );

      if (newAccounts.length === 0) {
        console.log(
          '\n✅ Todas las cuentas ya están creadas. No hay nada que hacer.',
        );
        return;
      }

      console.log(`\n📝 Creando ${newAccounts.length} cuentas nuevas...`);
      const result = await collection.insertMany(newAccounts);
      console.log(`✅ ${result.insertedCount} cuentas creadas exitosamente`);
    } else {
      // Crear todas las cuentas
      console.log(`\n📝 Creando ${accounts.length} cuentas contables...`);
      const result = await collection.insertMany(accounts);
      console.log(`✅ ${result.insertedCount} cuentas creadas exitosamente`);
    }

    // Mostrar resumen
    console.log('\n📊 Resumen de cuentas creadas:');
    const allAccounts = await collection
      .find({ codigo: { $in: accounts.map((a) => a.codigo) } })
      .toArray();

    allAccounts.forEach((acc) => {
      console.log(`\n   ${acc.codigo} - ${acc.nombre}`);
      console.log(`   Tipo: ${acc.tipo_cuenta}`);
      console.log(`   ID: ${acc._id}`);
    });

    console.log('\n✅ Script completado exitosamente');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

createAccounts();
