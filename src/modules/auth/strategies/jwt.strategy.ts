import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { JwtPayload } from '../interfaces/jwt-payload.interface';

import { UnauthorizedException } from '@nestjs/common';
import { User } from 'src/modules/user/entities/user.entity';

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    configService: ConfigService,
  ) {
    super({
      secretOrKey: configService.get('JWT_SECRET'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }
  async validate(payload: JwtPayload): Promise<User> {
    console.log('=== JWT Strategy Validate ===');
    console.log('Payload:', payload);
    console.log('Attempting to validate token');

    const { _id } = payload;
    const user = await this.userModel.findOne({ _id });
    if (!user) throw new UnauthorizedException('Token not valid ');
    if (!user.isActive) throw new UnauthorizedException('User is not active');
    
    console.log('[JWT Strategy] User found:', { 
      _id: user._id, 
      username: user.username, 
      email: user.email,
      roles: user.roles 
    });
    
    user.password = undefined;
    return user;
  }
}
