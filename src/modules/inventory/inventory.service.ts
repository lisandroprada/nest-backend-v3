import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryItem } from './entities/inventory-item.entity';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name) private readonly inventoryItemModel: Model<InventoryItem>,
  ) {}

  create(createInventoryItemDto: CreateInventoryItemDto) {
    const newItem = new this.inventoryItemModel(createInventoryItemDto);
    return newItem.save();
  }

  findAll() {
    return this.inventoryItemModel.find().exec();
  }

  findOne(id: string) {
    return this.inventoryItemModel.findById(id).exec();
  }

  update(id: string, updateInventoryItemDto: UpdateInventoryItemDto) {
    return this.inventoryItemModel.findByIdAndUpdate(id, updateInventoryItemDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.inventoryItemModel.findByIdAndDelete(id).exec();
  }
}
