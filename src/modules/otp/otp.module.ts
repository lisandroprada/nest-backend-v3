import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OtpService } from './otp.service';
import { OtpVerification, OtpVerificationSchema } from './schemas/otp-verification.schema';
import { Agent, AgentSchema } from '../agents/entities/agent.entity';
import { EmailModule } from '../../common/email/email.module';

/**
 * OtpModule - Módulo para gestión de OTP de verificación de identidad
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OtpVerification.name, schema: OtpVerificationSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
    EmailModule,
  ],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
