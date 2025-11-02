import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { PaginationDto } from './dto/pagination.dto';
import { SearchOperation } from '../pagination/dto/search-operations.enum';

@Injectable()
export class PaginationService {
  async paginate<T>(
    model: Model<T>,
    paginationDto: PaginationDto,
    filter: any = {},
  ) {
    // Log de entrada para debug
    // console.log(
    //   'PAGINATE REQUEST:',
    //   JSON.stringify(
    //     {
    //       model: model.modelName,
    //       paginationDto,
    //       filter,
    //     },
    //     null,
    //     2,
    //   ),
    // );
    const {
      pageSize = 10,
      page = 0,
      sort = '',
      search,
      populate,
    } = paginationDto;
    const skip = page * pageSize;

    // Sort
    const sortOrder = {};
    if (sort) {
      const direction = sort[0] === '-' ? -1 : 1;
      const field = sort[0] === '-' ? sort.substring(1) : sort;
      sortOrder[field] = direction;
    }

    const queryConditions: any[] = []; // Initialize as an array for $and conditions

    if (search && search.criteria.length > 0) {
      for (const criterion of search.criteria) {
        const { field, term, operation } = criterion;
        const orFields = field.split(',').map((f) => f.trim());

        let condition: any;

        if (orFields.length > 1) {
          // Multi-field OR search
          const orQuery = orFields.map((f) => {
            if (operation === SearchOperation.CONTAINS) {
              return {
                [f]: { $regex: new RegExp(accentInsensitive(term), 'i') },
              };
            }
            // Add other operations for OR search if needed in the future
            return { [f]: term };
          });
          condition = { $or: orQuery };
        } else {
          // Single-field search
          const singleField = orFields[0];
          const populatedFieldMatch = singleField.match(/(\w+)\[(\w+)\]/);

          if (
            populatedFieldMatch &&
            populatedFieldMatch[1] === 'owners' &&
            populatedFieldMatch[2] === 'fullName' &&
            operation === SearchOperation.CONTAINS
          ) {
            const PartyModel = model.db.model('Party');
            const ownerDocs = await PartyModel.find({
              fullName: { $regex: new RegExp(accentInsensitive(term), 'i') },
            }).select('_id');
            const ownerIds = ownerDocs.map((doc) => doc._id.toString());
            if (ownerIds.length === 0) {
              condition = { _id: null }; // No owners found, so no documents will match
            } else {
              condition = { owners: { $in: ownerIds } };
            }
          } else {
            switch (operation) {
              case SearchOperation.EQUALS:
                const parsed = Number(term);
                if (!isNaN(parsed) && term.trim() !== '') {
                  condition = { [singleField]: parsed };
                } else {
                  condition = { [singleField]: term };
                }
                break;
              case SearchOperation.CONTAINS:
                condition = {
                  [singleField]: { $regex: new RegExp(accentInsensitive(term), 'i') },
                };
                break;
              case SearchOperation.GREATER_THAN:
                condition = { [singleField]: { $gt: term } };
                break;
              case SearchOperation.LESS_THAN:
                condition = { [singleField]: { $lt: term } };
                break;
              case SearchOperation.GREATER_THAN_OR_EQUAL:
                condition = { [singleField]: { $gte: term } };
                break;
              case SearchOperation.LESS_THAN_OR_EQUAL:
                condition = { [singleField]: { $lte: term } };
                break;
              default:
                // Handle nested fields for default case if needed
                if (/\w+\[\w+\]/.test(singleField)) {
                  const match = singleField.match(/(\w+)\[(\w+)\]/);
                  if (match) {
                    const subField = `${match[1]}.${match[2]}`;
                    if (operation === SearchOperation.CONTAINS) {
                      condition = {
                        [subField]: { $regex: new RegExp(accentInsensitive(term), 'i') },
                      };
                    } else {
                      condition = { [subField]: term };
                    }
                  }
                } else {
                  condition = { [singleField]: term };
                }
                break;
            }
          }
        }
        queryConditions.push(condition);
      }
    }

    // Combine all conditions with $and if there are multiple, otherwise use the single condition
    let finalFilter: any = {};
    if (queryConditions.length > 0) {
      finalFilter = { $and: queryConditions };
    }

    let query = model
      .find(finalFilter)
      .collation({ locale: 'es', strength: 1 });

    if (populate) {
      const populateFields = populate.split(',').map((field) => field.trim());

      // Mapeo de campos a modelos para mayor seguridad
      const fieldToModelMap = {
        owners: 'Party',
        tenant: 'Party',
        province: 'Province',
        locality: 'Locality',
        user: 'User',
      };

      // Mapeo de alias de campos para populate
      const fieldAliasMap = {
        propiedad: 'propiedad_id',
        agente: 'agente_id',
        contrato: 'contrato_id',
        usuario: 'usuario_id',
      };

      populateFields.forEach((field) => {
        // Verificar si el campo tiene un alias
        const actualField = fieldAliasMap[field] || field;
        const modelName = fieldToModelMap[field];

        if (modelName) {
          query = query.populate({ path: actualField, model: modelName });
        } else {
          // Si no está en el mapeo, intentar populate simple (para casos especiales)
          query = query.populate(actualField);
        }
      });
    }

    // Agrega collation para búsquedas insensibles a acentos y mayúsculas
    query = query.collation({ locale: 'es', strength: 1 });

    const results = await query
      .limit(pageSize)
      .skip(skip)
      .sort(sortOrder)
      .select('-__v')
      .exec();

    const totalItems = await model
      .countDocuments(queryConditions)
      .collation({ locale: 'es', strength: 1 });
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      totalItems,
      totalPages,
      items: results,
    };
  }
}

function accentInsensitive(term: string) {
  return term
    .replace(/a/gi, '[aá]')
    .replace(/e/gi, '[eé]')
    .replace(/i/gi, '[ií]')
    .replace(/o/gi, '[oó]')
    .replace(/u/gi, '[uúü]');
}
