import { Controller, Get, Param } from '@nestjs/common';
import { CuitService } from './cuit.service';

@Controller('cuit')
export class CuitController {
  constructor(private readonly cuitService: CuitService) {}

  /**
   * Consulta CUIT desde cuitonline.com (web scraping)
   * GET /cuit/consultar/:dni
   */
  @Get('consultar/:dni')
  consultarCuitPorDni(@Param('dni') dni: string) {
    return this.cuitService.consultarCuitPorDni(dni);
  }

  /**
   * Valida formato y dígito verificador de un CUIT
   * GET /cuit/validar/:cuit
   */
  @Get('validar/:cuit')
  validarCuit(@Param('cuit') cuit: string) {
    return this.cuitService.validarCuit(cuit);
  }

  /**
   * Genera posibles CUITs a partir de un documento (DNI)
   * GET /cuit/generar/:documento
   */
  @Get('generar/:documento')
  generarCuitsDesdeDocumento(@Param('documento') documento: string) {
    return this.cuitService.generarCuitsDesdeDocumento(documento);
  }
}
