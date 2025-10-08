import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { User } from '../user/entities/user.entity';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async create(@Body() createAgentDto: CreateAgentDto, @GetUser() user: User) {
    return this.agentsService.create(createAgentDto, user._id.toString());
  }

  @Get()
  @Auth(ValidRoles.admin, ValidRoles.superUser, 'contabilidad' as any)
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.agentsService.findAll(paginationDto);
  }

  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.superUser, 'contabilidad' as any)
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.agentsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin, ValidRoles.superUser)
  async update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateAgentDto: UpdateAgentDto,
    @GetUser() user: User,
  ) {
    return this.agentsService.update(id, updateAgentDto, user._id.toString());
  }

  @Delete(':id')
  @Auth(ValidRoles.superUser)
  async remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.agentsService.remove(id);
  }

  @Get(':id/balance')
  @Auth(ValidRoles.admin, ValidRoles.superUser, 'contabilidad' as any)
  async getBalance(@Param('id', ParseMongoIdPipe) agentId: string) {
    return this.agentsService.getAgentBalance(agentId);
  }
}
