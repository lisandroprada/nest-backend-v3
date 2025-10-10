import {
  Controller,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id/parse-mongo-id.pipe';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../user/entities/user.entity';
import { PropertyFilesService } from './property-files.service';

@Controller('properties/:id')
export class PropertyFilesController {
  constructor(private readonly propertyFilesService: PropertyFilesService) {}

  /**
   * Subir una o más imágenes a la propiedad
   */
  @Post('imagenes')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  @UseInterceptors(FilesInterceptor('imagenes', 10))
  async uploadImages(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @GetUser() user: User,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se proporcionaron imágenes');
    }

    return this.propertyFilesService.uploadImages(
      propertyId,
      files,
      user._id.toString(),
    );
  }

  /**
   * Eliminar una imagen específica
   */
  @Delete('imagenes/:fileName')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  async deleteImage(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @Param('fileName') fileName: string,
    @GetUser() user: User,
  ) {
    return this.propertyFilesService.deleteImage(
      propertyId,
      fileName,
      user._id.toString(),
    );
  }

  /**
   * Reordenar imágenes
   */
  @Patch('imagenes/reordenar')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  async reorderImages(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @Body() body: { ordenImagenes: string[] },
    @GetUser() user: User,
  ) {
    return this.propertyFilesService.reorderImages(
      propertyId,
      body.ordenImagenes,
      user._id.toString(),
    );
  }

  /**
   * Establecer imagen como portada
   */
  @Patch('imagenes/:fileName/portada')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  async setImageAsPortada(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @Param('fileName') fileName: string,
    @GetUser() user: User,
  ) {
    return this.propertyFilesService.setImageAsPortada(
      propertyId,
      fileName,
      user._id.toString(),
    );
  }

  /**
   * Subir planos
   */
  @Post('planos')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  @UseInterceptors(FilesInterceptor('planos', 5))
  async uploadPlanos(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: { descripciones?: string[] },
    @GetUser() user: User,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se proporcionaron planos');
    }

    return this.propertyFilesService.uploadPlanos(
      propertyId,
      files,
      body.descripciones || [],
      user._id.toString(),
    );
  }

  /**
   * Eliminar un plano
   */
  @Delete('planos/:fileName')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  async deletePlano(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @Param('fileName') fileName: string,
    @GetUser() user: User,
  ) {
    return this.propertyFilesService.deletePlano(
      propertyId,
      fileName,
      user._id.toString(),
    );
  }

  /**
   * Subir documentos
   */
  @Post('documentos')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  @UseInterceptors(FilesInterceptor('documentos', 10))
  async uploadDocuments(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @GetUser() user: User,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se proporcionaron documentos');
    }

    return this.propertyFilesService.uploadDocuments(
      propertyId,
      files,
      user._id.toString(),
    );
  }

  /**
   * Eliminar un documento
   */
  @Delete('documentos/:fileName')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  async deleteDocument(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @Param('fileName') fileName: string,
    @GetUser() user: User,
  ) {
    return this.propertyFilesService.deleteDocument(
      propertyId,
      fileName,
      user._id.toString(),
    );
  }

  /**
   * Subir imagen satelital
   */
  @Post('imagen-satelital')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  @UseInterceptors(FileInterceptor('imagen'))
  async uploadSatelliteImage(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó imagen satelital');
    }

    return this.propertyFilesService.uploadSatelliteImage(
      propertyId,
      file,
      user._id.toString(),
    );
  }

  /**
   * Calibrar imagen satelital (establecer píxeles por metro)
   */
  @Post('imagen-satelital/calibrar')
  @Auth(ValidRoles.admin, ValidRoles.superUser, ValidRoles.agente)
  async calibrateSatelliteImage(
    @Param('id', ParseMongoIdPipe) propertyId: string,
    @Body() body: { pixels_por_metro: number },
    @GetUser() user: User,
  ) {
    return this.propertyFilesService.calibrateSatelliteImage(
      propertyId,
      body.pixels_por_metro,
      user._id.toString(),
    );
  }
}
