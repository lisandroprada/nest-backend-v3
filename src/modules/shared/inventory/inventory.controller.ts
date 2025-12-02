import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {diskStorage} from 'multer';
import {extname} from 'path';
import * as fs from 'fs';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { CreatePropertyInventoryDto } from './dto/create-property-inventory.dto';
import { CreateInventoryVersionDto } from './dto/create-inventory-version.dto';
import { UpdateInventoryVersionDto } from './dto/update-inventory-version.dto';
import { Auth } from '../../auth/decorators';
import { ValidRoles } from '../../auth/interfaces';

@Controller('inventory')
@Auth(ValidRoles.admin, ValidRoles.superUser)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ============================================
  // Endpoints para InventoryItem (catálogo global)
  // ============================================

  @Post('items')
  createItem(@Body() createInventoryItemDto: CreateInventoryItemDto) {
    return this.inventoryService.create(createInventoryItemDto);
  }

  @Get('items')
  findAllItems() {
    return this.inventoryService.findAll();
  }

  @Get('items/:id')
  findOneItem(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @Body() updateInventoryItemDto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.update(id, updateInventoryItemDto);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }

  // ============================================
  // Endpoints para PropertyInventory
  // ============================================

  @Post('property')
  createPropertyInventory(
    @Body() createPropertyInventoryDto: CreatePropertyInventoryDto,
  ) {
    return this.inventoryService.createPropertyInventory(
      createPropertyInventoryDto,
    );
  }

  @Get('property/:propertyId')
  getPropertyInventory(@Param('propertyId') propertyId: string) {
    return this.inventoryService.getPropertyInventory(propertyId);
  }

  // ============================================
  // Endpoints para InventoryVersion
  // ============================================

  @Post('property/:propertyId/versions')
  createVersion(
    @Param('propertyId') propertyId: string,
    @Body() createVersionDto: CreateInventoryVersionDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.inventoryService.createVersion(
      propertyId,
      createVersionDto,
      userId,
    );
  }

  @Get('property/:propertyId/versions')
  getVersions(@Param('propertyId') propertyId: string) {
    return this.inventoryService.getVersions(propertyId);
  }

  @Get('property/:propertyId/versions/:versionId')
  getVersion(
    @Param('propertyId') propertyId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.inventoryService.getVersion(propertyId, versionId);
  }

  @Patch('property/:propertyId/versions/:versionId')
  updateVersion(
    @Param('propertyId') propertyId: string,
    @Param('versionId') versionId: string,
    @Body() updateVersionDto: UpdateInventoryVersionDto,
  ) {
    return this.inventoryService.updateVersion(
      propertyId,
      versionId,
      updateVersionDto,
    );
  }

  @Put('property/:propertyId/current-version/:versionId')
  setCurrentVersion(
    @Param('propertyId') propertyId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.inventoryService.setCurrentVersion(propertyId, versionId);
  }

  @Delete('property/:propertyId/versions/:versionId')
  deleteVersion(
    @Param('propertyId') propertyId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.inventoryService.deleteVersion(propertyId, versionId);
  }

  // ============================================
  // Endpoint para copiar inventario entre propiedades
  // ============================================

  @Post('property/:sourcePropertyId/copy-to/:targetPropertyId')
  async copyInventory(
    @Param('sourcePropertyId') sourcePropertyId: string,
    @Param('targetPropertyId') targetPropertyId: string,
    @Body() body: { versionId?: string; description?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.inventoryService.copyInventoryToProperty(
      sourcePropertyId,
      targetPropertyId,
      body.versionId,
      body.description,
      userId,
    );
  }

  // ============================================
  // Endpoint para subir fotos de items de inventario
  // ============================================

  @Post('upload-photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/inventory';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, {recursive: true});
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `item-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('Solo se permiten archivos de imagen'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se proporcionó archivo');
    }

    return {
      filePath: `inventory/${file.filename}`,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
