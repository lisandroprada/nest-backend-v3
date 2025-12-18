import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateEmailConfigDto } from './dto/update-email-config.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateUserDto) {
    const user = new this.userModel(createUserDto);
    return user.save();
  }

  async findAll() {
    return this.userModel.find().exec();
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  async remove(id: string) {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return result;
  }

  /**
   * Actualizar configuración de email corporativo
   */
  async updateEmailConfig(userId: string, config: UpdateEmailConfigDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Actualizar emailCorporativo si se proporciona
    if (config.emailCorporativo) {
      user.emailCorporativo = config.emailCorporativo;
    }

    // Inicializar emailCorporativoConfig si no existe
    if (!user.emailCorporativoConfig) {
      user.emailCorporativoConfig = {
        provider: 'IMAP',
        sincronizacionActiva: false,
      };
    }

    // Actualizar provider si se proporciona
    if (config.provider) {
      user.emailCorporativoConfig.provider = config.provider;
    }

    // Actualizar configuración IMAP si se proporciona
    if (config.imapConfig) {
      user.emailCorporativoConfig.imapConfig = config.imapConfig;
    }

    // Actualizar sincronizacionActiva si se proporciona
    if (config.sincronizacionActiva !== undefined) {
      user.emailCorporativoConfig.sincronizacionActiva =
        config.sincronizacionActiva;
    }

    await user.save();

    // Retornar sin datos sensibles
    const userObj = user.toObject();
    if (userObj.emailCorporativoConfig?.imapConfig) {
      delete userObj.emailCorporativoConfig.imapConfig.password;
    }

    return userObj;
  }

  /**
   * Actualizar último UID sincronizado (para tracking de emails)
   */
  async updateLastSyncedUID(userId: string, uid: number): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    user.emailSync = {
      lastSyncedUID: uid,
      lastSyncDate: new Date(),
    };

    await user.save();
    this.logger.log(`UID sincronizado actualizado para usuario ${userId}: ${uid}`);
  }

  /**
   * Obtener configuración de email corporativo (sin password)
   */
  async getEmailConfig(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const config = {
      emailCorporativo: user.emailCorporativo,
      provider: user.emailCorporativoConfig?.provider,
      sincronizacionActiva:
        user.emailCorporativoConfig?.sincronizacionActiva || false,
      ultimaSincronizacion:
        user.emailCorporativoConfig?.ultimaSincronizacion,
      imapConfig: user.emailCorporativoConfig?.imapConfig
        ? {
            host: user.emailCorporativoConfig.imapConfig.host,
            port: user.emailCorporativoConfig.imapConfig.port,
            user: user.emailCorporativoConfig.imapConfig.user,
            tls: user.emailCorporativoConfig.imapConfig.tls,
            // NO incluir password por seguridad
          }
        : undefined,
    };

    return config;
  }
}
