import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

@Injectable()
export class ErrorsService {
  private readonly logger = new Logger(ErrorsService.name);

  public handleDatabaseError(error: any): never {
    this.logger.error('Database Error Details:', error);
    if (error.code === 11000) {
      throw new ConflictException(
        `Duplicate field error: ${JSON.stringify(error.keyValue)}.`,
      );
    } else if (error.name === 'ValidationError') {
      // Mejorar el mensaje para campos requeridos
      const messages = Object.values(error.errors || {}).map(
        (e: any) => e.message || e,
      );
      throw new BadRequestException(messages.length ? messages : error.message);
    } else if (error.name === 'CastError') {
      throw new BadRequestException(`Invalid ${error.path}: ${error.value}.`);
    } else if (error.kind === 'ObjectId' && error.path === '_id') {
      throw new NotFoundException(
        `No record found with the ID: ${error.value}`,
      );
    }

    throw new InternalServerErrorException(
      'An unexpected error occurred. Please check the logs.',
    );
  }

  public notFound(entity: string): never {
    throw new NotFoundException(`${entity} not found`);
  }

  public badRequest(message: string): never {
    throw new BadRequestException(message);
  }

  public unauthorized(message: string = 'Unauthorized'): never {
    throw new UnauthorizedException(message);
  }

  public forbidden(message: string = 'Forbidden'): never {
    throw new ForbiddenException(message);
  }

  public conflict(message: string): never {
    throw new ConflictException(message);
  }

  public internalServerError(message: string = 'Internal server error'): never {
    throw new InternalServerErrorException(message);
  }

  public handle(error: any): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof ConflictException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }
    return this.handleDatabaseError(error);
  }
}
