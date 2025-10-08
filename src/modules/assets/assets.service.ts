import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Asset } from './entities/asset.entity';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
  ) {}

  create(createAssetDto: CreateAssetDto) {
    const newAsset = new this.assetModel(createAssetDto);
    return newAsset.save();
  }

  findAll() {
    return this.assetModel.find().exec();
  }

  findOne(id: string) {
    return this.assetModel.findById(id).exec();
  }

  update(id: string, updateAssetDto: UpdateAssetDto) {
    return this.assetModel.findByIdAndUpdate(id, updateAssetDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.assetModel.findByIdAndDelete(id).exec();
  }
}
