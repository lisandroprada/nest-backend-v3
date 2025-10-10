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

    const queryConditions: any = { ...filter };

    if (search && search.criteria.length > 0) {
      const orClauses = [];

      for (const criterion of search.criteria) {
        const { field, term, operation } = criterion;
        const orFields = field.split(',');

        // --- OR Logic for multi-field search ---
        if (orFields.length > 1) {
          const orQuery = orFields.map(f => {
            if (operation === SearchOperation.CONTAINS) {
              return { [f]: { $regex: new RegExp(accentInsensitive(term), 'i') } };
            }
            // Add other operations for OR search if needed in the future
            return { [f]: term };
          });
          orClauses.push(...orQuery);
          continue; // Continue to the next criterion
        }

        // --- AND Logic for single fields (existing logic) ---
        const populatedFieldMatch = field.match(/(\w+)\[(\w+)\]/);
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
            queryConditions['_id'] = null;
            break;
          }
          queryConditions['owners'] = { $in: ownerIds };
          continue;
        }

        switch (operation) {
          case SearchOperation.EQUALS:
            const parsed = Number(term);
            if (!isNaN(parsed) && term.trim() !== '') {
              queryConditions[field] = parsed;
            } else {
              queryConditions[field] = term;
            }
            break;
          case SearchOperation.CONTAINS:
            queryConditions[field] = {
              $regex: new RegExp(accentInsensitive(term), 'i'),
            };
            break;
          case SearchOperation.GREATER_THAN:
            queryConditions[field] = { $gt: term };
            break;
          case SearchOperation.LESS_THAN:
            queryConditions[field] = { $lt: term };
            break;
          case SearchOperation.GREATER_THAN_OR_EQUAL:
            queryConditions[field] = { $gte: term };
            break;
          case SearchOperation.LESS_THAN_OR_EQUAL:
            queryConditions[field] = { $lte: term };
            break;
          default:
            if (/\w+\[\w+\]/.test(field)) {
              const match = field.match(/(\w+)\[(\w+)\]/);
              if (match) {
                const subField = `${match[1]}.${match[2]}`;
                if (operation === SearchOperation.CONTAINS) {
                  queryConditions[subField] = {
                    $regex: new RegExp(accentInsensitive(term), 'i'),
                  };
                } else {
                  queryConditions[subField] = term;
                }
              }
            }
            break;
        }
      }

      if (orClauses.length > 0) {
        queryConditions['$or'] = orClauses;
      }
    }

    let query = model
      .find(queryConditions)
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

      populateFields.forEach((field) => {
        const modelName = fieldToModelMap[field];
        if (modelName) {
          query = query.populate({ path: field, model: modelName });
        } else {
          // Si no está en el mapeo, intentar populate simple (para casos especiales)
          query = query.populate(field);
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
