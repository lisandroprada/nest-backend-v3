import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Amenity } from './entities/amenity.entity';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectModel(Amenity.name) private readonly amenityModel: Model<Amenity>,
  ) {}

  create(createAmenityDto: CreateAmenityDto) {
    const newAmenity = new this.amenityModel(createAmenityDto);
    return newAmenity.save();
  }

  findAll() {
    return this.amenityModel.find().exec();
  }

  findOne(id: string) {
    return this.amenityModel.findById(id).exec();
  }

  update(id: string, updateAmenityDto: UpdateAmenityDto) {
    return this.amenityModel.findByIdAndUpdate(id, updateAmenityDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.amenityModel.findByIdAndDelete(id).exec();
  }
}