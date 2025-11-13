import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemConfig } from './entities/system-config.entity';
import { CreateSystemConfigDto } from './dto/create-system-config.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import * as crypto from 'crypto';

@Injectable()
export class SystemConfigService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;
  private readonly iv: Buffer;

  constructor(
    @InjectModel(SystemConfig.name)
    private systemConfigModel: Model<SystemConfig>,
  ) {
    // En producción, estas claves deben venir de variables de entorno
    const key = process.env.ENCRYPTION_KEY || 'a'.repeat(32); // 32 bytes para AES-256
    const ivString = process.env.ENCRYPTION_IV || 'b'.repeat(16); // 16 bytes para IV

    this.encryptionKey = Buffer.from(key, 'utf8');
    this.iv = Buffer.from(ivString, 'utf8');
  }

  /**
   * Encripta una cadena de texto
   */
  private encrypt(text: string): string {
    try {
      const cipher = crypto.createCipheriv(
        this.algorithm,
        this.encryptionKey,
        this.iv,
      );
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al encriptar la contraseña',
      );
    }
  }

  /**
   * Desencripta una cadena de texto
   */
  decrypt(encryptedText: string): string {
    try {
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        this.iv,
      );
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al desencriptar la contraseña',
      );
    }
  }

  /**
   * Crea la configuración singleton del sistema
   */
  async create(createDto: CreateSystemConfigDto): Promise<SystemConfig> {
    // Verificar que no exista ya una configuración
    const existingConfig = await this.systemConfigModel.findOne();
    if (existingConfig) {
      throw new BadRequestException(
        'Ya existe una configuración del sistema. Use el endpoint de actualización.',
      );
    }

    // Encriptar la contraseña antes de guardar
    const encryptedPassword = this.encrypt(createDto.password_consulta);

    const config = new this.systemConfigModel({
      ...createDto,
      password_consulta: encryptedPassword,
    });

    return config.save();
  }

  /**
   * Obtiene la configuración del sistema (sin mostrar la contraseña real)
   */
  async findOne(): Promise<any> {
    const config = await this.systemConfigModel.findOne();
    if (!config) {
      throw new NotFoundException('No se encontró configuración del sistema');
    }

    // Retornar sin la contraseña real
    const configObject = config.toObject();
    return {
      ...configObject,
      password_consulta: '********', // Placeholder
    };
  }

  /**
   * Obtiene la configuración completa con contraseña desencriptada (solo para uso interno)
   */
  async findOneDecrypted(): Promise<any> {
    const config = await this.systemConfigModel.findOne();
    if (!config) {
      throw new NotFoundException('No se encontró configuración del sistema');
    }

    const configObject = config.toObject();
    return {
      ...configObject,
      password_consulta: this.decrypt(config.password_consulta),
    };
  }

  /**
   * Actualiza la configuración del sistema
   */
  async update(updateDto: UpdateSystemConfigDto): Promise<SystemConfig> {
    const config = await this.systemConfigModel.findOne();
    if (!config) {
      throw new NotFoundException(
        'No se encontró configuración del sistema. Créela primero.',
      );
    }

    // Si se actualiza la contraseña, encriptarla
    if (updateDto.password_consulta) {
      updateDto.password_consulta = this.encrypt(updateDto.password_consulta);
    }

    Object.assign(config, updateDto);
    return config.save();
  }

  /**
   * Actualiza la fecha de última consulta
   */
  async updateLastCheckDate(): Promise<void> {
    const config = await this.systemConfigModel.findOne();
    if (config) {
      config.fecha_ultima_consulta = new Date();
      await config.save();
    }
  }
}
