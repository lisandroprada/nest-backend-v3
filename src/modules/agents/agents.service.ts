import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Agent } from './entities/agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { PaginationService } from 'src/common/pagination/pagination.service';

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name) private readonly agentModel: Model<Agent>,
    private readonly accountingEntriesService: AccountingEntriesService,
    private readonly paginationService: PaginationService,
  ) {}

  async create(createAgentDto: CreateAgentDto, userId: string): Promise<Agent> {
    const agentData = {
      ...createAgentDto,
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    };
    const newAgent = new this.agentModel(agentData);
    return newAgent.save();
  }

  async findAll(paginationDto: PaginationDto) {
    return this.paginationService.paginate(this.agentModel, paginationDto);
  }

  async findOne(id: string): Promise<Agent> {
    const agent = await this.agentModel.findById(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID "${id}" not found.`);
    }
    return agent;
  }

  async update(
    id: string,
    updateAgentDto: UpdateAgentDto,
    userId: string,
  ): Promise<Agent> {
    const agentData = {
      ...updateAgentDto,
      usuario_modificacion_id: new Types.ObjectId(userId),
    };
    const updatedAgent = await this.agentModel.findByIdAndUpdate(
      id,
      agentData,
      { new: true },
    );
    if (!updatedAgent) {
      throw new NotFoundException(`Agent with ID "${id}" not found.`);
    }
    return updatedAgent;
  }

  async remove(id: string): Promise<{ message: string }> {
    const agent = await this.findOne(id);
    agent.status = 'INACTIVO';
    await agent.save();
    return { message: `Agent with ID "${id}" has been logically deleted.` };
  }

  async getAgentBalance(agentId: string): Promise<number> {
    // Ensure agent exists
    await this.findOne(agentId);
    return this.accountingEntriesService.calculateAgentBalance(agentId);
  }
}
