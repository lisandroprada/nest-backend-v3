import { Injectable } from '@nestjs/common';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Locality } from './entities/locality.entity';
import { Province } from '../province/entities/province.entity';
import { Model, Types } from 'mongoose';
import { Property } from 'src/modules/properties/entities/property.entity';

function accentInsensitive(term: string) {
  return term
    .replace(/a/gi, '[aá]')
    .replace(/e/gi, '[eé]')
    .replace(/i/gi, '[ií]')
    .replace(/o/gi, '[oó]')
    .replace(/u/gi, '[uúü]');
}

@Injectable()
export class LocalityService {
  constructor(
    @InjectModel(Locality.name)
    private readonly localityModel: Model<Locality>,
    @InjectModel(Province.name) private provinceModel: Model<Province>,
    @InjectModel(Property.name) private propertyModel: Model<Property>,
  ) {}

  /**
   * Devuelve localidades donde existan propiedades disponibles para venta, alquiler o ambos.
   * @param type 'sale' | 'rent' | 'all' (default: 'all')
   */
  async getLocalitiesWithAvailableProperties(
    type: 'sale' | 'rent' | 'all' = 'all',
  ) {
    // Build filter based on type
    let filter: any = { status: 'DISPONIBLE' };
    if (type === 'sale') {
      filter.publicar_para_venta = true;
    } else if (type === 'rent') {
      filter.publicar_para_alquiler = true;
    } else {
      filter.$or = [
        { publicar_para_venta: true },
        { publicar_para_alquiler: true },
      ];
    }

    // Get unique locality IDs from properties
    const properties = await this.propertyModel
      .find(filter, { 'direccion.localidad_id': 1, _id: 0 })
      .lean();

    const localityIds = [
      ...new Set(
        properties
          .map((p) => p.direccion?.localidad_id?.toString())
          .filter(Boolean),
      ),
    ];

    // Fetch localities by IDs
    const localities = await this.localityModel
      .find({ _id: { $in: localityIds.map((id) => new Types.ObjectId(id)) } })
      .lean();

    // Map to required format
    return localities.map((l) => ({
      _id: l._id,
      nombre: l.nombre,
      provincia: l.provincia?.nombre || null,
    }));
  }

  create(createLocalityDto: CreateLocalityDto) {
    console.log(createLocalityDto);
    return 'This action adds a new locality';
  }

  findAll() {
    return this.localityModel.find().exec();
  }

  // async findOne(id: number) {
  //   return `This action returns locality by ${id}`;
  // }

  async findByProvinceId(id: string) {
    console.log(
      'Buscando localidades con provincia._id:',
      new Types.ObjectId(id),
    );
    return await this.localityModel.find({
      'provincia._id': new Types.ObjectId(id),
    });
  }

  async getLocalityByNumId(id: string) {
    try {
      const numericId = parseInt(id, 10);
      console.log(`Buscando localidad con municipio.id: ${numericId}`);

      if (isNaN(numericId)) {
        throw new Error(`El id proporcionado (${id}) no es un número válido.`);
      }

      const result = await this.localityModel
        .find({ 'municipio.id': numericId })
        .exec();

      console.log('Resultado de la búsqueda:', result);

      if (!result || result.length === 0) {
        console.log('No se encontraron resultados para el id:', numericId);
      }

      return result;
    } catch (error) {
      console.error('Error al buscar la localidad:', error);
      throw error;
    }
  }

  async testQuery(): Promise<any> {
    try {
      console.log('Ejecutando consulta de prueba...');

      const testResult = await this.localityModel
        .findOne(
          { 'municipio.id': 260112 },
          { 'municipio.id': 1, 'municipio.nombre': 1 },
        )
        .exec();

      const nativeResult = await this.localityModel.collection.findOne({
        'municipio.id': 260112,
      });

      console.log('Resultado de la consulta de prueba:', nativeResult);
      console.log(
        this.localityModel
          .findOne({ 'municipio.id': '260112'.toString() })
          .getFilter(),
      );

      if (!nativeResult) {
        console.log(
          'No se encontró ningún documento con municipio.id = 260112',
        );
      }
      return { nativeResult, testResult };
    } catch (error) {
      console.error('Error en la consulta de prueba:', error);
      throw error;
    }
  }

  update(id: string, updateLocalityDto: UpdateLocalityDto) {
    console.log(updateLocalityDto);
    return `This action updates a #${id} locality`;
  }

  remove(id: number) {
    return `This action removes a #${id} locality`;
  }

  async updateLocalitiesWithProvinceId() {
    // Obtener todas las provincias
    const provinces = await this.provinceModel.find().exec();

    for (const province of provinces) {
      // Buscar localidades que coincidan con el province.id
      const localities = await this.localityModel
        .find({ 'provincia.id': province.id })
        .exec();

      // Actualizar cada localidad para incluir el _id de la provincia
      for (const locality of localities) {
        locality.provincia._id = province._id as Types.ObjectId; // Asignar el _id de la provincia
        await locality.save(); // Guardar la localidad actualizada
      }
    }

    return { message: 'Localities updated successfully' };
  }

  async searchByName(name: string) {
    if (!name) return [];
    return this.localityModel
      .find({ nombre: { $regex: accentInsensitive(name), $options: 'i' } })
      .collation({ locale: 'es', strength: 1 })
      .exec();
  }

  async searchByNameAndProvince(name: string, provinceId: string) {
    console.log({ name, provinceId });
    if (!name || !provinceId) return [];
    const provinceIdNum = Number(provinceId);
    return this.localityModel
      .find({
        nombre: { $regex: accentInsensitive(name), $options: 'i' },
        'provincia.id': isNaN(provinceIdNum) ? provinceId : provinceIdNum,
      })
      .collation({ locale: 'es', strength: 1 })
      .exec();
  }

  /**
   * Autocomplete search for localities
   * Returns localities with province data, limited to 15 results
   * Useful for autocomplete/typeahead components
   */
  async autocomplete(query: string, limit: number = 15) {
    if (!query || query.trim().length < 2) return [];
    
    return this.localityModel
      .find({ nombre: { $regex: accentInsensitive(query.trim()), $options: 'i' } })
      .collation({ locale: 'es', strength: 1 })
      .limit(limit)
      .exec();
  }

  async findById(id: string) {
    return await this.localityModel.findById(id);
  }
}
