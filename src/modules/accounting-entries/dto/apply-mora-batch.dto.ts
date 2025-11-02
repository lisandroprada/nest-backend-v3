
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class ApplyMoraBatchDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  asientoIds: string[];
}
