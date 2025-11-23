import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ServiceSyncService } from './service-sync.service';
import { CamuzziScanService } from './services/camuzzi-scan.service';
import { ClassificationService } from './services/classification.service';
import { ServiceCommunicationQueryDto } from './dto/service-communication-query.dto';
import { UpdateCommunicationStatusDto } from './dto/update-communication-status.dto';
import { GenerateServiceCandidatesDto } from './dto/generate-candidates.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { SystemConfigService } from '../system-config/system-config.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent } from '../agents/entities/agent.entity';

@Controller('service-sync')
@Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.contabilidad)
export class ServiceSyncController {
  constructor(
    private readonly commService: ServiceSyncService,
    private readonly scanService: CamuzziScanService,
    private readonly classificationService: ClassificationService,
    private readonly systemConfigService: SystemConfigService,
    @InjectModel(Agent.name)
    private readonly agentModel: Model<Agent>,
  ) {}

  @Get()
  async list(@Query() query: ServiceCommunicationQueryDto) {
    return this.commService.findAll(query);
  }

  @Get('health')
  async health() {
    let configPresent = false;
    let lastCheckAt: string | null = null;
    let imapConnectionStatus: 'success' | 'failed' | 'not-tested' =
      'not-tested';
    let isScanning = false;

    try {
      const config = await this.systemConfigService.findOne();
      configPresent = !!config;
      lastCheckAt = config?.fecha_ultima_consulta
        ? config.fecha_ultima_consulta.toISOString()
        : null;
    } catch {
      configPresent = false;
    }

    try {
      const ok = await this.scanService.testConnection();
      imapConnectionStatus = ok ? 'success' : 'failed';
    } catch {
      imapConnectionStatus = 'failed';
    }

    isScanning = (this.scanService as any).isScanning || false;

    const stats = await this.commService.getStats();
    return {
      configPresent,
      lastCheckAt,
      imapConnection: imapConnectionStatus,
      isScanning,
      stats,
    };
  }

  @Get('stats/overview')
  async getStats() {
    return this.commService.getStats();
  }

  @Get('test/connection')
  async testConnection() {
    const ok = await this.scanService.testConnection();
    return {
      status: ok ? 'success' : 'failed',
    };
  }

  @Get('providers')
  async listProviders() {
    const providers = await this.agentModel
      .find({ dominios_notificacion: { $exists: true, $ne: [] } })
      .limit(50);
    return providers.map((p) => ({
      id: p._id.toString(),
      razon_social: p.nombre_razon_social,
      cuit: p.identificador_fiscal,
      dominios_notificacion: p.dominios_notificacion || [],
    }));
  }

  @Post('rescan')
  @HttpCode(HttpStatus.OK)
  async rescan(
    @Query('providerCuit') providerCuit?: string,
    @Query('autoDuring') autoDuring?: string, // generate candidates while scanning (per-email)
    @Query('autoBatch') autoBatch?: string, // generate candidates in a batch after scan
    @Query('maxCandidates') maxCandidates?: string,
  ) {
    const autoDuringFlag = autoDuring !== 'false'; // Default to true
    const autoBatchFlag = autoBatch === 'true';

    const res = await this.scanService.scanEmails({
      providerCuit,
      autoCandidates: autoDuringFlag,
      tryExtractServiceId: true,
    });

    if (autoBatchFlag) {
      const parsedMax = parseInt(maxCandidates || '200', 10) || 200;
      const maxPerRun = Math.min(Math.max(parsedMax, 1), 1000);
      const candidatesResult =
        await this.classificationService.generateCandidates({
          providerCuit,
          maxPerRun,
          tryExtractServiceId: true,
        });
      return {
        message: 'Escaneo completado',
        ...res,
        candidates: candidatesResult,
      };
    }

    return { message: 'Escaneo completado', ...res };
  }

  @Post('candidates/generate')
  async generateCandidates(@Body() dto: GenerateServiceCandidatesDto) {
    return this.classificationService.generateCandidates(dto);
  }

  @Post('communications/status')
  async updateStatus(@Body() dto: UpdateCommunicationStatusDto) {
    return this.commService.updateStatus(
      dto.communicationId,
      dto.status,
      dto.notes,
    );
  }

  // Only match Mongo ObjectId (24 hex chars) to avoid collisions with static routes
  @Get(':id([0-9a-fA-F]{24})')
  async getOne(@Param('id') id: string) {
    return this.commService.findOne(id);
  }
}
