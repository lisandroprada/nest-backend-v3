import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChartOfAccount } from './entities/chart-of-account.entity';
import { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from './dto/update-chart-of-account.dto';
import { PaginationDto } from '../../common/pagination/dto/pagination.dto';
import { PaginationService } from '../../common/pagination/pagination.service';

@Injectable()
export class ChartOfAccountsService {
  constructor(
    @InjectModel(ChartOfAccount.name)
    private readonly chartOfAccountModel: Model<ChartOfAccount>,
    private readonly paginationService: PaginationService,
  ) {}

  async create(createDto: CreateChartOfAccountDto): Promise<ChartOfAccount> {
    const newAccount = new this.chartOfAccountModel(createDto);
    return await newAccount.save();
  }

  async findAll(paginationDto: PaginationDto) {
    return this.paginationService.paginate(this.chartOfAccountModel, paginationDto);
  }

  async findAllWithoutPagination(): Promise<ChartOfAccount[]> {
    return await this.chartOfAccountModel.find().exec();
  }

  async findOne(id: string): Promise<ChartOfAccount> {
    const account = await this.chartOfAccountModel.findById(id);
    if (!account) {
      throw new NotFoundException(
        `Cuenta contable con ID "${id}" no encontrada.`,
      );
    }
    return account;
  }

  async update(
    id: string,
    updateDto: UpdateChartOfAccountDto,
  ): Promise<ChartOfAccount> {
    const updatedAccount = await this.chartOfAccountModel.findByIdAndUpdate(
      id,
      updateDto,
      { new: true },
    );
    if (!updatedAccount) {
      throw new NotFoundException(
        `Cuenta contable con ID "${id}" no encontrada.`,
      );
    }
    return updatedAccount;
  }

  async remove(id: string): Promise<{ deleted: boolean; message?: string }> {
    const result = await this.chartOfAccountModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Cuenta contable con ID "${id}" no encontrada.`,
      );
    }
    return { deleted: true };
  }

  async getAccountIdsByCode(
    codes: string[],
  ): Promise<Record<string, Types.ObjectId>> {
    const accounts = await this.chartOfAccountModel
      .find({ codigo: { $in: codes } })
      .select('codigo _id')
      .exec();

    const accountIdsMap = accounts.reduce(
      (map, account) => {
        map[account.codigo] = account._id as Types.ObjectId;
        return map;
      },
      {} as Record<string, Types.ObjectId>,
    );

    // Validar que todas las cuentas requeridas fueron encontradas
    const notFound = codes.filter((code) => !accountIdsMap[code]);
    if (notFound.length > 0) {
      throw new NotFoundException(
        `No se encontraron las siguientes cuentas contables requeridas: ${notFound.join(
          ', ',
        )}`,
      );
    }

    return accountIdsMap;
  }

  async find(filter: any, session?: any): Promise<ChartOfAccount[]> {
    return this.chartOfAccountModel.find(filter, null, { session }).exec();
  }
}
