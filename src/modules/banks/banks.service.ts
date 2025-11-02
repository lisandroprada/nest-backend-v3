import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bank } from './entities/bank.entity';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { PaginationService } from 'src/common/pagination/pagination.service';

@Injectable()
export class BanksService {
  constructor(
    @InjectModel(Bank.name)
    private readonly bankModel: Model<Bank>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(createDto: CreateBankDto): Promise<Bank> {
    const newBank = new this.bankModel(createDto);
    return await newBank.save();
  }

  async findAll(paginationDto: PaginationDto) {
    return this.paginationService.paginate(this.bankModel, paginationDto);
  }

  async findOne(id: string): Promise<Bank> {
    const bank = await this.bankModel.findById(id);
    if (!bank) {
      throw new NotFoundException(`Banco con ID "${id}" no encontrado.`);
    }
    return bank;
  }

  async update(id: string, updateDto: UpdateBankDto): Promise<Bank> {
    const updatedBank = await this.bankModel.findByIdAndUpdate(id, updateDto, {
      new: true,
    });
    if (!updatedBank) {
      throw new NotFoundException(`Banco con ID "${id}" no encontrado.`);
    }
    return updatedBank;
  }

  async remove(id: string): Promise<{ deleted: boolean; message?: string }> {
    const result = await this.bankModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Banco con ID "${id}" no encontrado.`);
    }
    return { deleted: true };
  }
}
