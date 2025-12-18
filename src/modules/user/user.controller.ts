import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateEmailConfigDto } from './dto/update-email-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Obtener configuración de email corporativo del usuario autenticado
   * GET /user/me/email-config
   * IMPORTANTE: Debe ir ANTES de @Get(':id') para que no se confunda con un parámetro
   */
  @Get('me/email-config')
  @UseGuards(JwtAuthGuard)
  getMyEmailConfig(@Request() req) {
    return this.userService.getEmailConfig(req.user._id);
  }

  /**
   * Actualizar configuración de email corporativo del usuario autenticado
   * PATCH /user/me/email-config
   * IMPORTANTE: Debe ir ANTES de @Patch(':id') para que no se confunda con un parámetro
   */
  @Patch('me/email-config')
  @UseGuards(JwtAuthGuard)
  updateMyEmailConfig(
    @Request() req,
    @Body() config: UpdateEmailConfigDto,
  ) {
    return this.userService.updateEmailConfig(req.user._id, config);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
