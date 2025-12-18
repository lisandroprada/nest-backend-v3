import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from './entities/property.entity';
import { PaginationService } from '../../common/pagination/pagination.service';
import { PaginationDto } from '../../common/pagination/dto/pagination.dto';

@Injectable()
export class PublicPropertiesService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    private readonly paginationService: PaginationService,
  ) {}

  async findAllPublic(query: any) {
    const {
      page,
      pageSize,
      sort,
      type,
      locality,
      operation,
      north,
      south,
      east,
      west,
      q,
    } = query;

    const filter: any = {
      status: 'DISPONIBLE',
    };

    // Filter by Type
    if (type) {
      filter['caracteristicas.tipo_propiedad'] = type;
    }

    // Filter by Locality
    if (locality) {
      filter['direccion.localidad_id'] = new Types.ObjectId(locality);
    }

    // Filter by Operation
    if (operation === 'sale') {
      filter.publicar_para_venta = true;
    } else if (operation === 'rent') {
      filter.publicar_para_alquiler = true;
    } else {
      // Default: show if available for either
      filter.$or = [{ publicar_para_venta: true }, { publicar_para_alquiler: true }];
    }

    // Geo-Spatial Filter (Bounding Box)
    if (north && south && east && west) {
      // Using scalar comparison for now, will upgrade to $geoWithin after index creation
      // Note: V3 stores lat/lng in 'direccion' object
      filter['direccion.latitud'] = { $lte: Number(north), $gte: Number(south) };
      filter['direccion.longitud'] = { $lte: Number(east), $gte: Number(west) };
    }

    // Text Search
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        ...(filter.$or || []), // Preserve existing $or if any
        { titulo: regex },
        { descripcion: regex },
        { 'direccion.calle': regex },
      ];
      // If we had an $or for operation, we need to be careful not to overwrite it.
      // Better approach for complex $or: use $and with multiple $or conditions if needed.
      // For simplicity in this iteration, let's assume q is primary if present, or refine logic.
      // Actually, MongoDB allows implicit AND. But multiple $or fields need $and.
      // Let's restructure if both exist.
      if (operation === undefined) {
         // If we had the default operation $or, we need to combine it.
         // Let's simplify: if q is present, we might want to search across everything.
         // But usually filters are ANDed.
         // Let's use $and for the operation condition and the search condition.
         const operationCondition = { $or: [{ publicar_para_venta: true }, { publicar_para_alquiler: true }] };
         const searchCondition = { $or: [{ titulo: regex }, { descripcion: regex }, { 'direccion.calle': regex }] };
         
         delete filter.$or; // Remove the simple one
         filter.$and = [operationCondition, searchCondition];
      } else {
         // If operation is specific, we just add the search $or
         // But wait, filter.$or is already used? No, operation specific sets a direct field.
         // So we can just set filter.$or = searchCondition
         filter.$or = [{ titulo: regex }, { descripcion: regex }, { 'direccion.calle': regex }];
      }
    }

    // Map frontend field names to backend schema fields
    const fieldMapping: Record<string, string> = {
      locality: 'direccion.localidad_id',
      type: 'caracteristicas.tipo_propiedad',
      address: 'direccion.calle',
      specs: 'caracteristicas.amenities',
    };

    // Transform search criteria if present
    let transformedSearch = query.search;
    if (query.search && query.search.criteria) {
      transformedSearch = {
        ...query.search,
        criteria: query.search.criteria.map((criterion: any) => {
          const mappedField = fieldMapping[criterion.field] || criterion.field;

          return {
            ...criterion,
            field: mappedField,
            // Keep term as-is, PaginationService will handle conversion
          };
        }),
      };
    }

    const paginationDto: PaginationDto = {
      page: page ? Number(page) : 0,
      pageSize: pageSize ? Number(pageSize) : 10,
      sort: sort || 'createdAt:desc',
      search: transformedSearch, // Pass transformed search criteria
    };

    const result = await this.paginationService.paginate(
      this.propertyModel,
      paginationDto,
      filter,
    );

    // Map to V2-like Public Interface
    const items = result.items.map((prop) => this.mapToPublicSchema(prop));

    return {
      items,
      meta: {
        totalItems: result.totalItems,
        itemCount: result.items.length,
        itemsPerPage: paginationDto.pageSize || 10,
        totalPages: result.totalPages,
        currentPage: paginationDto.page || 0,
      },
    };
  }

  private mapToPublicSchema(prop: Property) {
    // Determine price to show
    let price: any = null;
    
    // Logic to pick price: if filtering by operation, show that price.
    // If not, show sale if available, else rent.
    // Or return both? V2 structure implies a single 'price' object in the example, 
    // but V2 entity has valueForSale and valueForRent.
    // The V2 controller returns valueForSale and valueForRent if pricePublic is true.
    // Let's stick to returning both if public, matching V2 behavior.

    const valueForSale = prop.valor_venta_detallado?.es_publico ? {
        amount: prop.valor_venta_detallado.monto,
        currency: prop.valor_venta_detallado.moneda,
        public: true
    } : undefined;

    const valueForRent = prop.valor_alquiler_detallado?.es_publico ? {
        amount: prop.valor_alquiler_detallado.monto,
        currency: prop.valor_alquiler_detallado.moneda,
        public: true
    } : undefined;

    return {
      _id: prop._id,
      address: `${prop.direccion?.calle || ''} ${prop.direccion?.numero || ''}`.trim(),
      type: prop.caracteristicas?.tipo_propiedad,
      valueForSale,
      valueForRent,
      imgCover: prop.img_cover_url ? { thumbWeb: prop.img_cover_url } : null,
      img: prop.imagenes ? prop.imagenes.map(img => ({
        name: img.nombre,
        thumbWeb: img.url, // Assuming url is the web thumb
        thumb: img.url,
        original: img.url
      })) : [],
      location: {
        lat: prop.direccion?.latitud,
        lng: prop.direccion?.longitud,
      },
      detailedDescription: {
        rooms: prop.caracteristicas?.ambientes,
        bedrooms: prop.caracteristicas?.dormitorios,
        bathrooms: prop.caracteristicas?.banos,
        buildSqFt: prop.caracteristicas?.metraje_cubierto,
        kitchen: true, // Default or derive
      },
      title: prop.titulo,
      description: prop.descripcion,
      slug: prop.identificador_interno,
      available: prop.status === 'DISPONIBLE',
      publishForSale: prop.publicar_para_venta,
      publishForRent: prop.publicar_para_alquiler,
      lots: prop.lotes,
    };
  }
}
