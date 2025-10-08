import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';

@Injectable()
export class UniqueIdServiceService {
  // Método para generar un ID único
  async generateUniqueId(model: Model<any>): Promise<string> {
    let isUnique = false;
    let newId: ObjectId;

    while (!isUnique) {
      newId = new ObjectId();
      const existingDoc = await model.findById(newId).exec();
      if (!existingDoc) {
        isUnique = true;
      }
    }

    return newId.toHexString();
  }
}
