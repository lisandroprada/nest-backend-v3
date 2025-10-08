import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Auth, GetUser, RawHeaders } from './decorators';
import { User } from '../user/entities/user.entity';
import { CreateUserDto, SignInDto } from './dto';
import { AuthGuard } from '@nestjs/passport';
import { ValidRoles } from './interfaces';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  signIn(@Body() signInDto: SignInDto) {
    console.log(
      `[AUTH] Intento de login para: ${signInDto.email} - ${new Date().toISOString()}`,
    );
    return this.authService.signIn(signInDto.email, signInDto.password);
  }

  @Post('register')
  async create(@Body() createAuthDto: CreateUserDto) {
    try {
      const result = await this.authService.create(createAuthDto);
      return {
        ok: true,
        message: 'Usuario registrado exitosamente',
        ...result,
      };
    } catch (error) {
      // Si el error es una excepción de Nest, se propaga automáticamente
      // Si no, se devuelve un error genérico
      if (error && error.status && error.message) {
        throw error;
      }
      return {
        ok: false,
        message: error?.message || 'Error inesperado en el registro',
        error,
      };
    }
  }

  @Post('check-auth-status')
  @Auth()
  checkAuthStatus(@Request() request: Request, @GetUser() user: User) {
    // console.log(request.headers);
    return this.authService.checkAuthStatus(user);
  }

  @Get('')
  @UseGuards(AuthGuard('jwt'))
  testRoute(
    @GetUser() user: User,
    @GetUser('email') userEmail: string,
    @RawHeaders() rawHeaders: string[],
  ) {
    // console.log(user, userEmail);
    return {
      user,
      userEmail,
      rawHeaders,
      status: 'Ok',
      message: 'Test route success',
    };
  }

  // @SetMetadata('roles', ['admin'])
  @Get('test')
  @Auth(ValidRoles.admin, ValidRoles.user)
  testRoute2(@GetUser() user: User) {
    // console.log(req);
    return {
      ok: true,
      user,
    };
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.requestPasswordReset(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }
}
