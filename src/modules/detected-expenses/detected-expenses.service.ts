import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DetectedExpense } from './entities/detected-expense.entity';
import { CreateDetectedExpenseDto } from './dto/create-detected-expense.dto';
import { UpdateDetectedExpenseDto } from './dto/update-detected-expense.dto';

@Injectable()
export class DetectedExpensesService {
  constructor(
    @InjectModel(DetectedExpense.name) private readonly detectedExpenseModel: Model<DetectedExpense>,
  ) {}

  create(createDto: CreateDetectedExpenseDto) {
    const newExpense = new this.detectedExpenseModel(createDto);
    return newExpense.save();
  }

  findAll() {
    return this.detectedExpenseModel.find().exec();
  }

  findOne(id: string) {
    return this.detectedExpenseModel.findById(id).exec();
  }

  update(id: string, updateDto: UpdateDetectedExpenseDto) {
    return this.detectedExpenseModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.detectedExpenseModel.findByIdAndDelete(id).exec();
  }
}
