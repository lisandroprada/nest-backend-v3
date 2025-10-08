import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

import { Model } from 'mongoose';
import { User } from '../user/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ErrorsService } from 'src/common/errors/errors.service';
import { JwtPayload } from './interfaces';
import { CreateUserDto, UserLoginDto } from './dto';
import { EmailService } from 'src/common/email/email.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private jwtService: JwtService,
    // eslint-disable-next-line prettier/prettier
    private errorsService: ErrorsService,
    private emailService: EmailService,
  ) {}

  async signIn(email: string, pass: string): Promise<any> {
    const user = await this.userModel.findOne({ email });

    if (!user) throw new UnauthorizedException('User not found');

    if (!bcrypt.compareSync(pass, user.password)) {
      throw new UnauthorizedException('Password is incorrect');
    }

    const payload = {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
    };

    user.password = undefined;
    return {
      user,
      access_token: await this.createSendToken(payload),
    };
  }

  async userLogin(userLoginDto: UserLoginDto) {
    const { email } = userLoginDto;

    const user = await this.userModel.findOne({ email });
    user.password = undefined;
    return user;
  }

  async create(createUserDto: CreateUserDto) {
    const { password, ...userData } = createUserDto;

    createUserDto.username = createUserDto.username.toLowerCase();
    try {
      const user = await this.userModel.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
      });

      const userObject = user.toObject();
      delete userObject.password;
      const payload = {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
      };
      return { userObject, token: await this.createSendToken(payload) };
    } catch (error) {
      this.errorsService.handleDatabaseError(error);
    }
  }

  async checkAuthStatus(user: User) {
    return {
      user,
      token: this.getJwtToken({
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
      }),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
    // return this.jwtService.sign(payload);
  }

  async createSendToken(payload: JwtPayload) {
    return await this.jwtService.signAsync(payload);
  }

  async requestPasswordReset(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetToken = uuidv4();
    const resetPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetPasswordExpires;

    await user.save();

    // console.log('Sending email', email);
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'Password reset email sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    // console.log('Token', token);

    const user = await this.userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    // console.log({
    //   resetPasswordToken: token,
    //   resetPasswordExpires: { $gt: Date.now() },
    // });

    // console.log('User', user);

    if (!user) {
      throw new UnauthorizedException(
        'Invalid or expired password reset token',
      );
    }

    user.password = bcrypt.hashSync(newPassword, 10);
    await user.save();

    return {
      message: 'Password has been reset successfully',
      email: user.email,
    };
  }
}
