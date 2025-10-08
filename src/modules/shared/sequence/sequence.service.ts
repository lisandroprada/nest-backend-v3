import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Sequence } from './entities/sequence.entity';
import { Model } from 'mongoose';

@Injectable()
export class SequenceService {
  constructor(
    @InjectModel(Sequence.name) private sequenceModel: Model<Sequence>,
  ) {}

  async generateReceiptNumber(name: string): Promise<number> {
    const sequenceDoc = await this.sequenceModel.findOneAndUpdate(
      { name }, // Filtra por el nombre de la secuencia
      { $inc: { value: 1 } }, // Incrementa el valor de la secuencia
      { new: true, upsert: true }, // Crea el documento si no existe
    );
    return sequenceDoc.value;
  }
}
