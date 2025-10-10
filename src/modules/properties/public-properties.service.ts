import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from './entities/property.entity';
import { PublicPropertyQueryDto } from './dto/public-property-query.dto';
import { MapQueryDto } from './dto/map-query.dto';

@Injectable()
export class PublicPropertiesService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
  ) {}

  /**
   * Buscar propiedades públicas con filtros
   */
  async findPublicProperties(queryDto: PublicPropertyQueryDto) {
    const {
      tipo,
      proposito,
      minLat,
      maxLat,
      minLng,
      maxLng,
      minPrecio,
      maxPrecio,
      dormitorios,
      banos,
      ambientes,
      pageSize = 20,
      page = 0,
    } = queryDto;

    const limit = pageSize;
    const offset = page * pageSize;

    const filter: any = { status: { $ne: 'INACTIVO' } };

    // Filtrar por tipo de operación (venta o alquiler)
    if (tipo === 'venta') {
      filter.publicar_para_venta = true;
    } else if (tipo === 'alquiler') {
      filter.publicar_para_alquiler = true;
    } else {
      // Si no se especifica, mostrar ambos
      filter.$or = [
        { publicar_para_venta: true },
        { publicar_para_alquiler: true },
      ];
    }

    // Filtros adicionales
    if (proposito) {
      filter.proposito = proposito;
    }

    // Filtro por bounding box geográfico
    if (minLat && maxLat && minLng && maxLng) {
      filter['direccion.latitud'] = { $gte: minLat, $lte: maxLat };
      filter['direccion.longitud'] = { $gte: minLng, $lte: maxLng };
    }

    // Filtros por características
    if (dormitorios) {
      filter['caracteristicas.dormitorios'] = { $gte: dormitorios };
    }

    if (banos) {
      filter['caracteristicas.banos'] = { $gte: banos };
    }

    if (ambientes) {
      filter['caracteristicas.ambientes'] = { $gte: ambientes };
    }

    // Filtro por rango de precios
    if (tipo === 'venta' && (minPrecio || maxPrecio)) {
      const precioFilter: any = {};
      if (minPrecio) precioFilter.$gte = minPrecio;
      if (maxPrecio) precioFilter.$lte = maxPrecio;
      filter.$or = [
        { valor_venta: precioFilter },
        { 'valor_venta_detallado.monto': precioFilter },
      ];
    } else if (tipo === 'alquiler' && (minPrecio || maxPrecio)) {
      const precioFilter: any = {};
      if (minPrecio) precioFilter.$gte = minPrecio;
      if (maxPrecio) precioFilter.$lte = maxPrecio;
      filter.$or = [
        { valor_alquiler: precioFilter },
        { 'valor_alquiler_detallado.monto': precioFilter },
      ];
    }

    const [properties, total] = await Promise.all([
      this.propertyModel
        .find(filter)
        .select(
          'identificador_interno direccion caracteristicas valor_venta valor_alquiler ' +
            'valor_venta_detallado valor_alquiler_detallado proposito status img_cover_url ' +
            'imagenes publicar_para_venta publicar_para_alquiler',
        )
        .populate('direccion.provincia_id', 'nombre')
        .populate('direccion.localidad_id', 'nombre')
        .skip(offset)
        .limit(limit)
        .lean(),
      this.propertyModel.countDocuments(filter),
    ]);

    // Procesar propiedades para exponer solo información pública
    const processedProperties = properties.map((property) =>
      this.sanitizePropertyForPublic(property),
    );

    return { data: processedProperties, total, limit, offset };
  }

  /**
   * Obtener una propiedad pública específica
   */
  async findPublicProperty(id: string) {
    const property = await this.propertyModel
      .findById(id)
      .select(
        'identificador_interno direccion caracteristicas valor_venta valor_alquiler ' +
          'valor_venta_detallado valor_alquiler_detallado proposito status img_cover_url ' +
          'imagenes planos publicar_para_venta publicar_para_alquiler tipo_expensas ' +
          'consorcio_nombre',
      )
      .populate('direccion.provincia_id', 'nombre')
      .populate('direccion.localidad_id', 'nombre')
      .populate('caracteristicas.amenities', 'nombre')
      .lean();

    if (!property) {
      throw new NotFoundException(`Propiedad con ID ${id} no encontrada`);
    }

    // Verificar que la propiedad sea pública
    if (!property.publicar_para_venta && !property.publicar_para_alquiler) {
      throw new NotFoundException(`Propiedad con ID ${id} no está disponible`);
    }

    return this.sanitizePropertyForPublic(property);
  }

  /**
   * Buscar propiedades para visualización en mapa
   * Devuelve solo los campos esenciales para optimizar el rendimiento
   */
  async findPropertiesForMap(queryDto: MapQueryDto) {
    const { tipo, minLat, maxLat, minLng, maxLng, proposito } = queryDto;

    const filter: any = {
      status: { $ne: 'INACTIVO' },
      'direccion.latitud': { $gte: minLat, $lte: maxLat },
      'direccion.longitud': { $gte: minLng, $lte: maxLng },
    };

    // Filtrar por tipo de operación
    if (tipo === 'venta') {
      filter.publicar_para_venta = true;
    } else if (tipo === 'alquiler') {
      filter.publicar_para_alquiler = true;
    } else {
      filter.$or = [
        { publicar_para_venta: true },
        { publicar_para_alquiler: true },
      ];
    }

    if (proposito) {
      filter.proposito = proposito;
    }

    const properties = await this.propertyModel
      .find(filter)
      .select(
        '_id direccion.latitud direccion.longitud valor_venta valor_alquiler ' +
          'valor_venta_detallado.monto valor_venta_detallado.es_publico ' +
          'valor_alquiler_detallado.monto valor_alquiler_detallado.es_publico ' +
          'img_cover_url imagenes proposito publicar_para_venta publicar_para_alquiler',
      )
      .limit(500) // Límite razonable para mapas
      .lean();

    // Formatear para el mapa
    return properties.map((p) => {
      const imgCover =
        p.imagenes && p.imagenes.length > 0
          ? p.imagenes.find((img) => img.es_portada)?.versiones?.thumb ||
            p.imagenes[0]?.versiones?.thumb
          : p.img_cover_url;

      let precio = null;
      if (tipo === 'venta' || p.publicar_para_venta) {
        if (
          p.valor_venta_detallado &&
          p.valor_venta_detallado.es_publico !== false
        ) {
          precio = p.valor_venta_detallado.monto;
        } else if (p.valor_venta) {
          precio = p.valor_venta;
        }
      } else if (tipo === 'alquiler' || p.publicar_para_alquiler) {
        if (
          p.valor_alquiler_detallado &&
          p.valor_alquiler_detallado.es_publico !== false
        ) {
          precio = p.valor_alquiler_detallado.monto;
        } else if (p.valor_alquiler) {
          precio = p.valor_alquiler;
        }
      }

      return {
        id: p._id,
        lat: p.direccion.latitud,
        lng: p.direccion.longitud,
        precio,
        imgCover,
        proposito: p.proposito,
      };
    });
  }

  /**
   * Sanitizar propiedad para exposición pública
   */
  private sanitizePropertyForPublic(property: any) {
    const sanitized: any = {
      id: property._id,
      identificador: property.identificador_interno,
      direccion: property.direccion,
      caracteristicas: property.caracteristicas,
      proposito: property.proposito,
      status: property.status,
      imagenes: property.imagenes || [],
      planos: property.planos || [],
      tipo_expensas: property.tipo_expensas,
      consorcio_nombre: property.consorcio_nombre,
    };

    // Manejar precios según visibilidad
    if (property.publicar_para_venta) {
      if (property.valor_venta_detallado) {
        if (property.valor_venta_detallado.es_publico !== false) {
          sanitized.precio_venta = {
            monto: property.valor_venta_detallado.monto,
            moneda: property.valor_venta_detallado.moneda,
            descripcion: property.valor_venta_detallado.descripcion,
          };
        } else {
          sanitized.precio_venta = { consultar: true };
        }
      } else if (property.valor_venta) {
        sanitized.precio_venta = { monto: property.valor_venta, moneda: 'ARS' };
      }
    }

    if (property.publicar_para_alquiler) {
      if (property.valor_alquiler_detallado) {
        if (property.valor_alquiler_detallado.es_publico !== false) {
          sanitized.precio_alquiler = {
            monto: property.valor_alquiler_detallado.monto,
            moneda: property.valor_alquiler_detallado.moneda,
            descripcion: property.valor_alquiler_detallado.descripcion,
          };
        } else {
          sanitized.precio_alquiler = { consultar: true };
        }
      } else if (property.valor_alquiler) {
        sanitized.precio_alquiler = {
          monto: property.valor_alquiler,
          moneda: 'ARS',
        };
      }
    }

    return sanitized;
  }
}
