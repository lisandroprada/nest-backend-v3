import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { META_ROLES } from '../decorators/role-protected.decorator';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check handler level first, then class level
    let validRoles = this.reflector.get<string[]>(
      META_ROLES,
      context.getHandler(),
    );

    if (!validRoles || validRoles.length === 0) {
      // If no roles at handler level, check class level
      validRoles = this.reflector.get<string[]>(
        META_ROLES,
        context.getClass(),
      );
    }

    console.log('[UserRoleGuard] Valid roles required:', validRoles);

    if (!validRoles) return true;
    if (validRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    
    console.log('[UserRoleGuard] User:', user);
    console.log('[UserRoleGuard] User roles:', user?.roles);
    
    if (!user) {
      console.error('[UserRoleGuard] ✗ No user found in request');
      throw new ForbiddenException('User not found in request');
    }

    const userRoles = user.roles || [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const hasValidRole = userRoles.some((role) => validRoles.includes(role));

    for (const role of user.roles) {
      if (validRoles.includes(role)) {
        console.log('[UserRoleGuard] ✓ Role match found:', role);
        return true;
      }
    }

    console.error('[UserRoleGuard] ✗ No matching role found');
    throw new ForbiddenException(
      `User ${user.username} does not have required roles: [${validRoles}]`,
    );
  }
}
