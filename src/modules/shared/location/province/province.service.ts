import { Injectable } from '@nestjs/common';
import { CreateProvinceDto } from './dto/create-province.dto';
import { UpdateProvinceDto } from './dto/update-province.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Province } from './entities/province.entity';
import { Model } from 'mongoose';

function accentInsensitive(term: string) {
  return term
    .replace(/a/gi, '[aá]')
    .replace(/e/gi, '[eé]')
    .replace(/i/gi, '[ií]')
    .replace(/o/gi, '[oó]')
    .replace(/u/gi, '[uúü]');
}

@Injectable()
export class ProvinceService {
  constructor(
    @InjectModel(Province.name)
    private readonly provinceModel: Model<Province>,
  ) {}

  create(createProvinceDto: CreateProvinceDto) {
    console.log(createProvinceDto);
    return this.provinceModel.find().exec();
  }

  findAll(populate?: string) {
    let query = this.provinceModel.find();
    if (populate) {
      const fields = populate.split(',').map((f) => f.trim());
      fields.forEach((field) => {
        query = query.populate(field);
      });
    }
    return query.exec();
  }

  // findOne(id: number) {
  //   return `This action returns a #${id} province`;
  // }

  update(id: number, updateProvinceDto: UpdateProvinceDto) {
    console.log(updateProvinceDto);
    return `This action updates a #${id} province`;
  }

  remove(id: number) {
    return `This action removes a #${id} province`;
  }

  async searchByName(name: string, populate?: string) {
    if (!name || typeof name !== 'string') return [];
    let query = this.provinceModel
      .find({ iso_nombre: { $regex: accentInsensitive(name), $options: 'i' } })
      .collation({ locale: 'es', strength: 1 });
    if (populate) {
      const fields = populate.split(',').map((f) => f.trim());
      fields.forEach((field) => {
        query = query.populate(field);
      });
    }
    return query.exec();
  }

  async findById(id: string, populate?: string) {
    let query = this.provinceModel.findById(id);
    if (populate) {
      const fields = populate.split(',').map((f) => f.trim());
      fields.forEach((field) => {
        query = query.populate(field);
      });
    }
    return await query.exec();
  }
}
