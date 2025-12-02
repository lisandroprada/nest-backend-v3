import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Document} from 'mongoose';

export type BrandCatalogDocument = BrandCatalog & Document;

@Schema({timestamps: true})
export class BrandCatalog extends Document {
  @Prop({required: true, unique: true, index: true})
  categoria: string;

  @Prop()
  subcategoria?: string;

  @Prop({type: [String], default: []})
  marcas: string[];

  @Prop({type: [String], default: []})
  items_comunes: string[];

  @Prop({
    type: Map,
    of: [String],
    default: {},
  })
  modelos: Map<string, string[]>; // { "Samsung": ["Heladera No Frost", "Smart TV 55\""], ... }

  @Prop({type: [String], default: [], index: true})
  keywords: string[];

  @Prop({type: Object})
  metadata?: {
    pais?: string;
    popularidad?: number;
    descripcion?: string;
    uso_frecuencia?: Map<string, number>; // Track usage frequency for sorting
  };

  @Prop({default: true})
  activo: boolean;
}

export const BrandCatalogSchema = SchemaFactory.createForClass(BrandCatalog);

// Índice compuesto para búsquedas
BrandCatalogSchema.index({categoria: 1, subcategoria: 1});
BrandCatalogSchema.index({keywords: 'text', items_comunes: 'text'});
