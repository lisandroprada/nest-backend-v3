// src/modules/emails/emails.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../common/email/email.service'; // Asumiendo la ruta

@Injectable()
export class EmailsService {
  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}
}
