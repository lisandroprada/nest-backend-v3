#!/bin/bash

# Script para inicializar cuentas financieras en MongoDB
# Uso: ./seed-financial-accounts.sh

echo "🏦 Inicializando cuentas financieras..."

# Verificar si mongosh está instalado
if ! command -v mongosh &> /dev/null; then
    echo "❌ Error: mongosh no está instalado"
    exit 1
fi

# Verificar si el archivo JSON existe
if [ ! -f "scripts/seed-financial-accounts.json" ]; then
    echo "❌ Error: No se encuentra el archivo seed-financial-accounts.json"
    exit 1
fi

# Importar las cuentas financieras
echo "📥 Importando cuentas financieras..."
mongoimport \
  --db nest-propietasV3 \
  --collection financialaccounts \
  --file scripts/seed-financial-accounts.json \
  --jsonArray \
  --mode upsert

if [ $? -eq 0 ]; then
    echo "✅ Cuentas financieras importadas correctamente"
    
    # Mostrar las cuentas creadas
    echo ""
    echo "📊 Cuentas financieras creadas:"
    mongosh nest-propietasV3 --quiet --eval "
      db.financialaccounts.find({}, {
        nombre: 1,
        tipo: 1,
        saldo_inicial: 1,
        status: 1,
        _id: 0
      }).toArray()
    "
else
    echo "❌ Error al importar las cuentas financieras"
    exit 1
fi
