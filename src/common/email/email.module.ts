import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          service: configService.get('MAIL_SERVICE'),
          port: configService.get('MAIL_PORT'),
          host: configService.get('MAIL_HOST'),
          secure: configService.get('MAIL_SECURE'),
          auth: {
            user: configService.get('MAIL_USER'),
            pass: configService.get('MAIL_PASS'),
          },
          tls: {
            rejectUnauthorized: false, // Ignora los errores de certificado
          },
        },
        defaults: {
          from: `'Propietas' <${configService.get('MAIL_FROM')}>`,
        },
        template: {
          dir: '/Users/lisandropradatoledo/Documents/dev/propietas/nest-backend-v2/src/common/email/templates',
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
