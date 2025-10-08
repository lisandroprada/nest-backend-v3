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

  // Actualizar manualmente un índice desde la API o mediante scrapping
  @Post('/update/:formula')
  async updateIndexValue(@Param('formula') formula: string) {
    try {
      // Llamamos al servicio de scrapping para actualizar el índice
      await this.indexScrapperService.updateIndexData(formula);
      return { message: `Actualización del índice ${formula} completada.` };
    } catch (error) {
      return {
        message: `Error al actualizar el índice ${formula}: ${error.message}`,
      };
    }
  }
}
