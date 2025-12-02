import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Model} from 'mongoose';
import {BrandCatalog, BrandCatalogDocument} from './entities/brand-catalog.entity';
import {CreateBrandCatalogDto} from './dto/create-brand-catalog.dto';
import {UpdateBrandCatalogDto} from './dto/update-brand-catalog.dto';
import {LearnCatalogDto} from './dto/learn-catalog.dto';

@Injectable()
export class BrandCatalogService {
  constructor(
    @InjectModel(BrandCatalog.name)
    private brandCatalogModel: Model<BrandCatalogDocument>,
  ) {}

  async create(createDto: CreateBrandCatalogDto): Promise<BrandCatalog> {
    const created = new this.brandCatalogModel(createDto);
    return created.save();
  }

  async findAll(): Promise<BrandCatalog[]> {
    return this.brandCatalogModel.find({activo: true}).exec();
  }

  async findByCategoria(categoria: string): Promise<BrandCatalog | null> {
    return this.brandCatalogModel.findOne({categoria, activo: true}).exec();
  }

  async getBrands(categoria: string): Promise<string[]> {
    const catalog = await this.findByCategoria(categoria);
    return catalog?.marcas || [];
  }

  async getCommonItems(categoria: string): Promise<string[]> {
    const catalog = await this.findByCategoria(categoria);
    return catalog?.items_comunes || [];
  }

  async getSuggestions(query: string): Promise<{
    marcas: string[];
    items: string[];
    categorias: string[];
  }> {
    const searchRegex = new RegExp(query, 'i');

    const catalogs = await this.brandCatalogModel
      .find({
        activo: true,
        $or: [
          {marcas: searchRegex},
          {items_comunes: searchRegex},
          {keywords: searchRegex},
          {categoria: searchRegex},
        ],
      })
      .limit(10)
      .exec();

    const marcas = new Set<string>();
    const items = new Set<string>();
    const categorias = new Set<string>();

    catalogs.forEach((catalog) => {
      // Filtrar marcas que coincidan
      catalog.marcas
        .filter((m) => searchRegex.test(m))
        .forEach((m) => marcas.add(m));

      // Filtrar items que coincidan
      catalog.items_comunes
        .filter((i) => searchRegex.test(i))
        .forEach((i) => items.add(i));

      // Agregar categoría si coincide
      if (searchRegex.test(catalog.categoria)) {
        categorias.add(catalog.categoria);
      }
    });

    return {
      marcas: Array.from(marcas).slice(0, 10),
      items: Array.from(items).slice(0, 10),
      categorias: Array.from(categorias),
    };
  }

  async getCategories(): Promise<{categoria: string; count: number}[]> {
    const catalogs = await this.brandCatalogModel
      .find({activo: true})
      .select('categoria marcas')
      .exec();
    
    return catalogs.map((c) => ({
      categoria: c.categoria,
      count: c.marcas.length,
    }));
  }

  async getModels(categoria: string, marca: string): Promise<string[]> {
    const catalog = await this.findByCategoria(categoria);
    if (!catalog || !catalog.modelos) {
      return [];
    }
    
    // Get models for the specific brand
    const modelos = catalog.modelos.get(marca) || [];
    
    // Sort by usage frequency if available
    const metadata = catalog.metadata as any;
    if (metadata?.uso_frecuencia) {
      return modelos.sort((a, b) => {
        const freqA = metadata.uso_frecuencia.get(`${marca}:${a}`) || 0;
        const freqB = metadata.uso_frecuencia.get(`${marca}:${b}`) || 0;
        return freqB - freqA; // Descending order
      });
    }
    
    return modelos;
  }

  async learnFromInput(dto: LearnCatalogDto): Promise<void> {
    const {categoria, marca, modelo} = dto;
    
    // Find or create catalog for this category
    let catalog = await this.findByCategoria(categoria);
    
    if (!catalog) {
      // Create new catalog entry
      catalog = await this.create({
        categoria,
        marcas: marca ? [marca] : [],
        items_comunes: [],
        keywords: [categoria.toLowerCase()],
        metadata: {
          pais: 'Argentina',
          popularidad: 1,
          uso_frecuencia: new Map(),
        },
      });
    }
    
    let updated = false;
    
    // Add brand if not exists
    if (marca && !catalog.marcas.includes(marca)) {
      catalog.marcas.push(marca);
      updated = true;
    }
    
    // Add model if provided
    if (marca && modelo) {
      if (!catalog.modelos) {
        catalog.modelos = new Map();
      }
      
      const existingModels = catalog.modelos.get(marca) || [];
      if (!existingModels.includes(modelo)) {
        existingModels.push(modelo);
        catalog.modelos.set(marca, existingModels);
        updated = true;
      }
      
      // Update usage frequency
      if (!catalog.metadata) {
        catalog.metadata = {};
      }
      const metadata = catalog.metadata as any;
      if (!metadata.uso_frecuencia) {
        metadata.uso_frecuencia = new Map();
      }
      
      const key = `${marca}:${modelo}`;
      const currentFreq = metadata.uso_frecuencia.get(key) || 0;
      metadata.uso_frecuencia.set(key, currentFreq + 1);
      updated = true;
    }
    
    if (updated) {
      await catalog.save();
    }
  }

  async update(id: string, updateDto: UpdateBrandCatalogDto): Promise<BrandCatalog> {
    const updated = await this.brandCatalogModel
      .findByIdAndUpdate(id, updateDto, {new: true})
      .exec();

    if (!updated) {
      throw new NotFoundException(`Catálogo con ID ${id} no encontrado`);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.brandCatalogModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Catálogo con ID ${id} no encontrado`);
    }
  }

  // Método para poblar la base de datos con datos iniciales
  async seedDatabase(): Promise<void> {
    const count = await this.brandCatalogModel.countDocuments().exec();
    if (count > 0) {
      console.log('Base de datos ya contiene catálogos. Saltando seed.');
      return;
    }

    const catalogos = CATALOGO_ARGENTINO;
    await this.brandCatalogModel.insertMany(catalogos);
    console.log(`✅ Seed completado: ${catalogos.length} catálogos creados`);
  }
}

// Datos de catálogo argentino con modelos
const CATALOGO_ARGENTINO: CreateBrandCatalogDto[] = [
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
    modelos: new Map([
      ['Eskabe', ['Tiro Balanceado 3000 kcal', 'Tiro Balanceado 5000 kcal', 'Estufa Catalítica S21']],
      ['Longvie', ['Tiro Balanceado ECA3S', 'Estufa Volcanita', 'Caloventor CV2000']],
      ['Peabody', ['Estufa Cuarzo PE-VQ20', 'Caloventor PE-VC20', 'Radiador PE-RO11']],
    ]),
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
    modelos: new Map([
      ['Ferrum', ['Inodoro Andina Corto', 'Inodoro Andina Largo', 'Bidet Andina', 'Lavatorio Andina', 'Inodoro Bari', 'Mochila Dual Andina']],
      ['FV', ['Inodoro Cibeles Corto', 'Inodoro Cibeles Largo', 'Bidet Cibeles', 'Lavatorio Cibeles', 'Inodoro Luján']],
      ['Roca Argentina', ['Inodoro Dama', 'Inodoro The Gap', 'Lavatorio Dama', 'Mampara Victoria']],
    ]),
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
    modelos: new Map([
      ['FV', ['Monocomando Pampa', 'Monocomando Arizona', 'Ducha Lluvia 20cm', 'Duchador Cromado', 'Mezcladora Libby']],
      ['Ferrum', ['Monocomando Andina', 'Monocomando Bari', 'Ducha Lluvia', 'Canilla Cocina Andina']],
      ['Peirano', ['Monocomando Quadra', 'Monocomando Loft', 'Ducha Cuadrada']],
    ]),
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
    modelos: new Map([
      ['Samsung', ['Heladera No Frost 330L', 'Heladera No Frost 410L', 'Lavarropas 7kg', 'Microondas 23L', 'Smart TV 55"']],
      ['LG', ['Heladera No Frost 400L', 'Lavarropas 8.5kg Inverter', 'Microondas NeoChef', 'Smart TV 50"']],
      ['Drean', ['Lavarropas Next 8.12', 'Lavarropas Concept 5.05', 'Secarropas Eco', 'Lavavajillas 13 cubiertos']],
      ['Philco', ['Heladera PHCT30', 'Microondas PMO23', 'Horno Eléctrico 60L']],
      ['Whirlpool', ['Heladera WRM45', 'Lavarropas Carga Superior 7kg', 'Microondas WM120']],
    ]),
  },
  {
    categoria: 'ABERTURAS',
    marcas: ['Aluar', 'Alcemar', 'Veka', 'Rehau', 'Modena', 'Herrero', 'DVH'],
    items_comunes: [
      'Ventana de aluminio',
      'Puerta de aluminio',
      'Ventana de PVC',
      'Puerta de madera',
      'Portón',
      'Ventana DVH',
      'Puerta placa',
      'Mosquitero',
    ],
    keywords: ['ventana', 'puerta', 'aluminio', 'pvc', 'abertura', 'portón'],
    metadata: {pais: 'Argentina', popularidad: 88},
    modelos: new Map([
      ['Aluar', ['Ventana Corrediza A30', 'Ventana Banderola', 'Puerta Balcón 2 hojas', 'Paño Fijo']],
      ['Veka', ['Ventana PVC DVH', 'Puerta PVC Reforzada', 'Ventana Oscilobatiente']],
      ['Modena', ['Línea Módena 40', 'Línea Módena 50', 'Puerta Placa 80cm']],
    ]),
  },
  {
    categoria: 'ILUMINACION',
    marcas: ['Philips', 'Osram', 'Taled', 'Candil', 'Velux', 'Ledvance', 'Sica'],
    items_comunes: [
      'Lámpara LED',
      'Tubo fluorescente',
      'Spot',
      'Aplique',
      'Araña',
      'Plafón',
      'Tira LED',
      'Dicroica',
    ],
    keywords: ['luz', 'lámpara', 'led', 'iluminación', 'spot', 'aplique'],
    metadata: {pais: 'Argentina', popularidad: 85},
    modelos: new Map([
      ['Philips', ['LED 9W E27', 'LED 12W E27', 'Tubo LED T8 18W', 'Dicroica GU10 5W', 'Tira LED 5m RGB']],
      ['Osram', ['LED 10W E27', 'Tubo LED 18W', 'Spot Embutir 7W']],
      ['Candil', ['Araña 5 Luces Cristal', 'Aplique Pared Moderno', 'Plafón LED 24W']],
    ]),
  },
  {
    categoria: 'MUEBLES_COCINA',
    marcas: ['Johnson', 'Arredo', 'Favatex', 'Alacenas.com', 'Muebles del Sur'],
    items_comunes: [
      'Alacena',
      'Bajo mesada',
      'Mesada',
      'Bachas',
      'Grifería de cocina',
      'Mueble esquinero',
      'Organizador',
    ],
    keywords: ['cocina', 'alacena', 'mesada', 'mueble', 'bajo mesada'],
    metadata: {pais: 'Argentina', popularidad: 80},
    modelos: new Map([
      ['Johnson', ['Alacena 3 Puertas', 'Bajo Mesada 1.20m', 'Mesada Granito Negro', 'Bacha Simple Acero']],
      ['Arredo', ['Mueble Aereo 80cm', 'Bajo Mesada 60cm', 'Organizador Especiero']],
    ]),
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
    modelos: new Map([
      ['BGH', ['Split 2250F', 'Split 3000F', 'Split 4500F Inverter', 'Split 6000F']],
      ['Surrey', ['Split 2200F', 'Split 3500F', 'Split 5500F Inverter']],
      ['Philco', ['Split 2250F PHS25', 'Split 3000F PHS32', 'Ventilador Techo 3 Palas']],
      ['Carrier', ['Split Inverter 3000F', 'Split Inverter 4500F', 'Aire Central 12000F']],
    ]),
  },
  {
    categoria: 'PISOS_REVESTIMIENTOS',
    marcas: ['Cerro Negro', 'San Lorenzo', 'Alberdi', 'Cortines', 'Ilva', 'Ferrazano'],
    items_comunes: [
      'Porcelanato',
      'Cerámico',
      'Piso flotante',
      'Alfombra',
      'Vinílico',
      'Mosaico calcáreo',
      'Revestimiento',
    ],
    keywords: ['piso', 'porcelanato', 'cerámico', 'revestimiento', 'flotante'],
    metadata: {pais: 'Argentina', popularidad: 90},
    modelos: new Map([
      ['Cerro Negro', ['Porcelanato Carrara 60x60', 'Porcelanato Madera 20x120', 'Cerámico Baño 33x33']],
      ['San Lorenzo', ['Porcelanato Mármol 60x60', 'Cerámico Cocina 30x30', 'Revestimiento Subway']],
      ['Cortines', ['Piso Flotante Roble', 'Piso Flotante Nogal', 'Zócalo PVC']],
    ]),
  },
  {
    categoria: 'PINTURA',
    marcas: ['Alba', 'Sherwin Williams', 'Sinteplast', 'Tersuave', 'Colorin', 'Prestigio'],
    items_comunes: [
      'Pintura látex',
      'Esmalte sintético',
      'Enduído',
      'Sellador',
      'Antióxido',
      'Barniz',
      'Impermeabilizante',
    ],
    keywords: ['pintura', 'látex', 'esmalte', 'barniz', 'sellador'],
    metadata: {pais: 'Argentina', popularidad: 75},
    modelos: new Map([
      ['Alba', ['Látex Interior Profesional', 'Látex Exterior Profesional', 'Esmalte Sintético Brillante', 'Enduído Plástico']],
      ['Sherwin Williams', ['Látex SuperPaint', 'Esmalte ProClassic', 'Sellador Multiuso']],
      ['Sinteplast', ['Látex Antihongo', 'Látex Satinado', 'Impermeabilizante Techos']],
    ]),
  },
];
