import { Injectable } from '@nestjs/common';
import { AppConfig } from './app.config.interface';

@Injectable()
export class AppConfigServiceService {
  private readonly envConfig: Partial<AppConfig> = {};

  get(key: keyof AppConfig): string {
    return this.envConfig[key] || process.env[key];
  }

  set(key: keyof AppConfig, value: string): void {
    this.envConfig[key] = value;
    process.env[key] = value; // Actualizar la variable de entorno en memoria
  }
}
