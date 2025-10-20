import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { IndexValueService } from './index-value.service';
import { CreateIndexValueDto } from './dto/create-index-value.dto';
import { IndexScrapperService } from './index-scrapper/index-scrapper.service';

@Controller('index-value')
export class IndexValueController {
  constructor(
    private readonly indexValueService: IndexValueService,
    private indexScrapperService: IndexScrapperService,
  ) {}

  // Crear manualmente un nuevo valor de índice
  @Post()
  async createIndexValue(@Body() createIndexValueDto: CreateIndexValueDto) {
    return this.indexValueService.saveIndexValue(createIndexValueDto);
  }

  // Obtener el valor más reciente de un índice específico
  @Get('/:formula/latest')
  async getLatestIndexValue(@Param('formula') formula: string) {
    return this.indexValueService.getLatestIndexValue(formula);
  }

  // Obtener el historial de un índice con un límite de resultados
  @Get('/:formula/history')
  async getIndexHistory(
    @Param('formula') formula: string,
    @Query('limit') limit: number,
  ) {
    return this.indexValueService.getIndexHistory(formula, limit);
  }

  @Post('/update/all')
  async updateAllIndices() {
    try {
      const summary = await this.indexScrapperService.triggerUpdate();
      return {
        message: 'Actualización de todos los índices completada.',
        summary,
      };
    } catch (error) {
      return {
        message: `Error al actualizar los índices: ${error.message}`,
      };
    }
  }
}
