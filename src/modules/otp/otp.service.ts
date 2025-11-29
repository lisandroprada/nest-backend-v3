import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OtpVerification } from './schemas/otp-verification.schema';
import { Agent } from '../agents/entities/agent.entity';
import { ValidateIdentityDto, VerifyOtpDto } from './dto';
import { EmailService } from '../../common/email/email.service';

/**
 * OtpService - Servicio para gestión de OTP de verificación de identidad
 * 
 * Funcionalidades:
 * - Generar códigos OTP de 6 dígitos
 * - Validar DNI/CUIT contra base de datos de agentes
 * - Verificar códigos OTP con límite de intentos
 * - Auto-expiración de OTPs (15 minutos)
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRATION_MINUTES = 15;
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    @InjectModel(OtpVerification.name)
    private readonly otpModel: Model<OtpVerification>,
    @InjectModel(Agent.name)
    private readonly agentModel: Model<Agent>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Genera un código OTP de 6 dígitos
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Normaliza DNI/CUIT removiendo caracteres no numéricos
   * Para DNIs de 7 dígitos (ej: 5982015), agrega un 0 adelante (05982015)
   */
  private normalizeDni(dni: string): string {
    const cleaned = dni.replace(/\D/g, '');
    
    // Si el DNI tiene 7 dígitos, agregar un 0 adelante
    // Esto maneja DNIs antiguos como 5.982.015 que en realidad son 05.982.015
    if (cleaned.length === 7) {
      return '0' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Ofusca un email para mostrarlo parcialmente
   * Ej: lisandro@gmail.com -> l***@gmail.com
   */
  private maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (user.length <= 2) {
      return `${user}***@${domain}`;
    }
    return `${user.substring(0, 1)}***${user.substring(user.length - 1)}@${domain}`;
  }

  /**
   * Valida identidad del usuario y genera OTP
   * 
   * Busca el DNI/CUIT en la base de datos de agentes.
   * Si existe, genera un OTP y lo retorna (para que el bot lo envíe por WhatsApp).
   */
  async validateIdentity(dto: ValidateIdentityDto) {
    const normalizedDni = this.normalizeDni(dto.dni);
    this.logger.log(`Validating identity for DNI: ${normalizedDni}, JID: ${dto.whatsappJid}`);

    // Para DNIs de 7 dígitos, buscar también sin el padding
    const searchVariants = [normalizedDni];
    if (normalizedDni.length === 8 && normalizedDni.startsWith('0')) {
      // Si normalizamos "5982015" a "05982015", también buscar "5982015"
      searchVariants.push(normalizedDni.substring(1));
    }

    // Buscar agente por DNI o CUIT
    // Soporta tanto schema antiguo (identityCard, taxId) como nuevo (documento_numero, identificador_fiscal)
    const agent = await this.agentModel
      .findOne({
        $or: [
          { documento_numero: { $in: searchVariants } },
          { identificador_fiscal: { $in: searchVariants } },
          { identityCard: { $in: searchVariants } }, // Schema antiguo
          { taxId: { $in: searchVariants } }, // Schema antiguo
        ],
      })
      .select('_id nombre_razon_social fullName name lastName email_principal email identificador_fiscal taxId')
      .lean();

    if (!agent) {
      this.logger.warn(`No agent found for DNI: ${normalizedDni}`);
      throw new NotFoundException(
        'No encontramos un cliente registrado con ese DNI/CUIT. Por favor, verifica el número ingresado.',
      );
    }

    // Obtener nombre del agente (soporta ambos schemas)
    // Usamos 'any' porque el schema legacy tiene campos diferentes
    const agentData = agent as any;
    const clientName = agent.nombre_razon_social || agentData.fullName || `${agentData.name || ''} ${agentData.lastName || ''}`.trim();
    const clientEmail = agent.email_principal || agentData.email;

    if (!clientEmail) {
      this.logger.warn(`Agent ${agent._id} has no email registered`);
      throw new BadRequestException(
        'Tu cuenta no tiene un email registrado. Por favor, contacta a un asesor para actualizar tus datos.',
      );
    }

    // Invalidar OTPs anteriores del mismo JID
    await this.otpModel.updateMany(
      { whatsappJid: dto.whatsappJid, verified: false },
      { verified: true, verifiedAt: new Date() }, // Marcar como verificados para que no se usen
    );

    // Generar nuevo OTP
    const otp = this.generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRATION_MINUTES);

    // Guardar OTP en base de datos
    await this.otpModel.create({
      whatsappJid: dto.whatsappJid,
      dni: normalizedDni,
      otp,
      expiresAt,
      verified: false,
      clientId: agent._id.toString(),
      clientName,
      attempts: 0,
    });

    // Enviar email
    try {
      await this.emailService.send({
        to: clientEmail,
        subject: 'Código de verificación - Propietas',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verificación de Identidad</h2>
            <p>Hola ${clientName},</p>
            <p>Estás intentando validar tu identidad en nuestro asistente de WhatsApp.</p>
            <p>Tu código de seguridad es:</p>
            <h1 style="color: #4A90E2; letter-spacing: 5px; font-size: 32px;">${otp}</h1>
            <p>Este código expira en 15 minutos.</p>
            <p>Si no solicitaste este código, por favor ignora este correo.</p>
          </div>
        `,
      });
      
      this.logger.log(`OTP sent to email for ${clientName} (${agent._id})`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${clientEmail}`, error);
      throw new BadRequestException('Hubo un error al enviar el código a tu email. Por favor intenta más tarde.');
    }

    // Retornar respuesta SIN el OTP
    const maskedEmail = this.maskEmail(clientEmail);
    return {
      success: true,
      clientId: agent._id.toString(),
      clientName,
      emailSent: true,
      maskedEmail,
      expiresAt: expiresAt.toISOString(),
      message: `Hemos enviado un código de verificación a tu email (${maskedEmail}).`,
    };
  }

  /**
   * Verifica código OTP ingresado por el usuario
   * 
   * Valida que:
   * - El OTP exista y no haya expirado
   * - No se hayan excedido los intentos máximos
   * - El código sea correcto
   */
  async verifyOtp(dto: VerifyOtpDto) {
    this.logger.log(`Verifying OTP for JID: ${dto.whatsappJid}`);

    // Buscar OTP activo (no verificado, no expirado)
    const otpRecord = await this.otpModel.findOne({
      whatsappJid: dto.whatsappJid,
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      this.logger.warn(`No active OTP found for JID: ${dto.whatsappJid}`);
      throw new NotFoundException(
        'No hay un código de verificación activo. Por favor, solicita uno nuevo.',
      );
    }

    // Verificar intentos máximos
    if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
      this.logger.warn(`Max attempts exceeded for JID: ${dto.whatsappJid}`);
      throw new BadRequestException(
        'Has excedido el número máximo de intentos. Por favor, solicita un nuevo código.',
      );
    }

    // Incrementar contador de intentos
    otpRecord.attempts += 1;
    await otpRecord.save();

    // Verificar código OTP
    if (otpRecord.otp !== dto.otp) {
      this.logger.warn(
        `Invalid OTP for JID: ${dto.whatsappJid}, attempts: ${otpRecord.attempts}/${this.MAX_ATTEMPTS}`,
      );
      throw new UnauthorizedException(
        `Código incorrecto. Te quedan ${this.MAX_ATTEMPTS - otpRecord.attempts} intentos.`,
      );
    }

    // OTP correcto - marcar como verificado
    otpRecord.verified = true;
    otpRecord.verifiedAt = new Date();
    await otpRecord.save();

    this.logger.log(
      `OTP verified successfully for ${otpRecord.clientName} (${otpRecord.clientId})`,
    );

    return {
      success: true,
      clientId: otpRecord.clientId,
      clientName: otpRecord.clientName,
      message: '¡Verificación exitosa! Tu cuenta ha sido vinculada.',
    };
  }
}
