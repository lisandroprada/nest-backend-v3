import { IsArray, IsNumber } from 'class-validator';

export class UpdateLotesDto {
  @IsArray()
  lotes: {
    id: string;
    coordenadas: { x: number; y: number }[];
    status: string;
    precio?: number;
    moneda?: string;
    superficie_m2?: number;
  }[];
}

export class CalibracionImagenDto {
  @IsNumber()
  pixels_por_metro: number;
}
