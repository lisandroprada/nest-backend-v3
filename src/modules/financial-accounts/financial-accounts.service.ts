import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinancialAccount } from './entities/financial-account.entity';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';

@Injectable()
export class FinancialAccountsService {
  constructor(
    @InjectModel(FinancialAccount.name)
    private readonly financialAccountModel: Model<FinancialAccount>,
  ) {}

  async create(
    createDto: CreateFinancialAccountDto,
  ): Promise<FinancialAccount> {
    const newAccount = new this.financialAccountModel(createDto);
    return await newAccount.save();
  }

  async findAll(): Promise<FinancialAccount[]> {
    return await this.financialAccountModel.find().exec();
  }

  async findOne(id: string): Promise<FinancialAccount> {
    const account = await this.financialAccountModel.findById(id);
    if (!account) {
      throw new NotFoundException(
        `Cuenta financiera con ID "${id}" no encontrada.`,
      );
    }
    return account;
  }

  async update(
    id: string,
    updateDto: UpdateFinancialAccountDto,
  ): Promise<FinancialAccount> {
    const updatedAccount = await this.financialAccountModel.findByIdAndUpdate(
      id,
      updateDto,
      { new: true },
    );
    if (!updatedAccount) {
      throw new NotFoundException(
        `Cuenta financiera con ID "${id}" no encontrada.`,
      );
    }
    return updatedAccount;
  }

  async remove(id: string): Promise<{ deleted: boolean; message?: string }> {
    const result = await this.financialAccountModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Cuenta financiera con ID "${id}" no encontrada.`,
      );
    }
    return { deleted: true };
  }

  async updateBalance(
    accountId: string,
    amount: number,
    type: 'INGRESO' | 'EGRESO',
    session: any, // Mongoose session
  ): Promise<FinancialAccount> {
    const update =
      type === 'INGRESO'
        ? { $inc: { saldo_inicial: amount } }
        : { $inc: { saldo_inicial: -amount } };

    const updatedAccount = await this.financialAccountModel.findByIdAndUpdate(
      accountId,
      update,
      { new: true, session },
    );

    if (!updatedAccount) {
      throw new NotFoundException(
        `Cuenta financiera con ID "${accountId}" no encontrada para actualizar el saldo.`,
      );
    }
    return updatedAccount;
  }
}
