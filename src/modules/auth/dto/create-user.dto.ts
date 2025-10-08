import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
  IsOptional,
  IsMongoId,
  IsArray,
} from 'class-validator';
import { Types } from 'mongoose';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  username: string;
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'The password must have a Uppercase, lowercase letter and a number',
  })
  password: string;

  @IsBoolean()
  @IsOptional()
  rememberMe: boolean;

  @IsMongoId()
  @IsOptional()
  party?: Types.ObjectId;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];
}
