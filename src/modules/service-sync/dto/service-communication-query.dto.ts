import { IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { PaginationDto } from '../../../common/pagination/dto/pagination.dto';
import {
  CommunicationStatus,
  CommunicationType,
} from '../entities/service-communication.entity';
import { Type } from 'class-transformer';

export class ServiceCommunicationQueryDto extends PaginationDto {
  @IsOptional()
  proveedor_cuit?: string;

  @IsOptional()
  identificador_servicio?: string;

  @IsOptional()
  remitente?: string;

  @IsOptional()
  asunto?: string;

  @IsOptional()
  @IsEnum(CommunicationType)
  tipo_alerta?: CommunicationType;

  @IsOptional()
  @IsEnum(CommunicationStatus)
  estado_procesamiento?: CommunicationStatus;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  solo_sin_procesar?: boolean;
}
