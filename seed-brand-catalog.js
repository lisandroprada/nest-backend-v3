// Script para cargar seed de BrandCatalog en MongoDB
// Ejecutar con: mongosh mongodb://localhost:27017/propietas < seed-brand-catalog.js

use propietas;

// Limpiar colección existente (opcional)
// db.brandcatalogs.deleteMany({});

// Datos de catálogo argentino con modelos
const catalogos = [
  {
    categoria: 'CALEFACCION',
    marcas: ['Eskabe', 'Longvie', 'Peabody', 'Orbis', 'Emege', 'Volcan', 'Coppens'],
    items_comunes: [
      'Calefactor tiro balanceado',
      'Estufa a gas',
      'Radiador eléctrico',
      'Caloventor',
      'Estufa infrarroja',
      'Calefactor split',
      'Estufa catalítica',
    ],
    keywords: ['calefacción', 'calor', 'gas', 'eléctrico', 'tiro balanceado'],
    metadata: {pais: 'Argentina', popularidad: 95},
    modelos: {
      'Eskabe': ['Tiro Balanceado 3000 kcal', 'Tiro Balanceado 5000 kcal', 'Estufa Catalítica S21'],
      'Longvie': ['Tiro Balanceado ECA3S', 'Estufa Volcanita', 'Caloventor CV2000'],
      'Peabody': ['Estufa Cuarzo PE-VQ20', 'Caloventor PE-VC20', 'Radiador PE-RO11'],
    },
    activo: true,
  },
  {
    categoria: 'SANITARIOS',
    marcas: ['Ferrum', 'FV', 'Roca Argentina', 'Hidromet', 'Piazza', 'Ideal Standard'],
    items_comunes: [
      'Inodoro',
      'Bidet',
      'Lavatorio',
      'Bañera',
      'Ducha',
      'Mampara',
      'Vanitory',
      'Botiquín',
    ],
    keywords: ['baño', 'sanitario', 'inodoro', 'bidet', 'ducha'],
    metadata: {pais: 'Argentina', popularidad: 98},
    modelos: {
      'Ferrum': ['Inodoro Andina Corto', 'Inodoro Andina Largo', 'Bidet Andina', 'Lavatorio Andina', 'Inodoro Bari', 'Mochila Dual Andina'],
      'FV': ['Inodoro Cibeles Corto', 'Inodoro Cibeles Largo', 'Bidet Cibeles', 'Lavatorio Cibeles', 'Inodoro Luján'],
      'Roca Argentina': ['Inodoro Dama', 'Inodoro The Gap', 'Lavatorio Dama', 'Mampara Victoria'],
    },
    activo: true,
  },
  {
    categoria: 'GRIFERIA',
    subcategoria: 'SANITARIOS',
    marcas: ['FV', 'Ferrum', 'Helvex', 'Peirano', 'Hidromet', 'Roca'],
    items_comunes: [
      'Canilla monocomando',
      'Ducha',
      'Duchador',
      'Mezcladora',
      'Grifería de cocina',
      'Canilla de lavatorio',
      'Canilla de bidet',
    ],
    keywords: ['canilla', 'grifo', 'monocomando', 'ducha', 'mezcladora'],
    metadata: {pais: 'Argentina', popularidad: 92},
    modelos: {
      'FV': ['Monocomando Pampa', 'Monocomando Arizona', 'Ducha Lluvia 20cm', 'Duchador Cromado', 'Mezcladora Libby'],
      'Ferrum': ['Monocomando Andina', 'Monocomando Bari', 'Ducha Lluvia', 'Canilla Cocina Andina'],
      'Peirano': ['Monocomando Quadra', 'Monocomando Loft', 'Ducha Cuadrada'],
    },
    activo: true,
  },
  {
    categoria: 'ELECTRODOMESTICOS',
    marcas: [
      'Philco',
      'Atma',
      'BGH',
      'Drean',
      'Patrick',
      'Samsung',
      'LG',
      'Whirlpool',
      'Electrolux',
      'Gafa',
    ],
    items_comunes: [
      'Heladera',
      'Freezer',
      'Lavarropas',
      'Secarropas',
      'Lavavajillas',
      'Microondas',
      'Horno eléctrico',
      'Anafe',
      'Campana extractora',
      'Termotanque',
    ],
    keywords: ['electrodoméstico', 'heladera', 'lavarropas', 'cocina', 'horno'],
    metadata: {pais: 'Argentina', popularidad: 100},
    modelos: {
      'Samsung': ['Heladera No Frost 330L', 'Heladera No Frost 410L', 'Lavarropas 7kg', 'Microondas 23L', 'Smart TV 55"'],
      'LG': ['Heladera No Frost 400L', 'Lavarropas 8.5kg Inverter', 'Microondas NeoChef', 'Smart TV 50"'],
      'Drean': ['Lavarropas Next 8.12', 'Lavarropas Concept 5.05', 'Secarropas Eco', 'Lavavajillas 13 cubiertos'],
      'Philco': ['Heladera PHCT30', 'Microondas PMO23', 'Horno Eléctrico 60L'],
      'Whirlpool': ['Heladera WRM45', 'Lavarropas Carga Superior 7kg', 'Microondas WM120'],
    },
    activo: true,
  },
  {
    categoria: 'AIRE_ACONDICIONADO',
    marcas: ['BGH', 'Philco', 'Surrey', 'Carrier', 'LG', 'Samsung', 'Midea', 'Hitachi'],
    items_comunes: [
      'Split frío/calor',
      'Split solo frío',
      'Aire central',
      'Ventilador de techo',
      'Ventilador de pie',
      'Aire portátil',
    ],
    keywords: ['aire', 'split', 'frío', 'calor', 'ventilador', 'climatización'],
    metadata: {pais: 'Argentina', popularidad: 97},
    modelos: {
      'BGH': ['Split 2250F', 'Split 3000F', 'Split 4500F Inverter', 'Split 6000F'],
      'Surrey': ['Split 2200F', 'Split 3500F', 'Split 5500F Inverter'],
      'Philco': ['Split 2250F PHS25', 'Split 3000F PHS32', 'Ventilador Techo 3 Palas'],
      'Carrier': ['Split Inverter 3000F', 'Split Inverter 4500F', 'Aire Central 12000F'],
    },
    activo: true,
  },
];

// Insertar datos
const result = db.brandcatalogs.insertMany(catalogos);
print(`✅ Seed completado: ${result.insertedIds.length} catálogos creados`);

// Verificar
print('\nCategorías insertadas:');
db.brandcatalogs.find({}, {categoria: 1, _id: 0}).forEach(doc => print(`  - ${doc.categoria}`));
