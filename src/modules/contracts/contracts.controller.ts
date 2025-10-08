import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Patch,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { User } from '../user/entities/user.entity';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async create(
    @Body() createContractDto: CreateContractDto,
    @GetUser() user: User,
  ) {
    return this.contractsService.create(createContractDto, user._id.toString());
  }

  @Get()
  @Auth(
    ValidRoles.admin,
    ValidRoles.superUser,
    ValidRoles.contabilidad,
    ValidRoles.agente,
  )
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.contractsService.findAll(paginationDto);
  }

  @Get(':id')
  @Auth(
    ValidRoles.admin,
    ValidRoles.superUser,
    ValidRoles.contabilidad,
    ValidRoles.agente,
  )
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateContractDto: UpdateContractDto,
    @GetUser() user: User,
  ) {
    return this.contractsService.update(
      id,
      updateContractDto,
      user._id.toString(),
    );
  }
}
