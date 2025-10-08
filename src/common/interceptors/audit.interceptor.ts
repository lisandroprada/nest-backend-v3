import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Asegurarse de que el usuario y el cuerpo de la solicitud existan
    if (user && request.body && user._id) {
      const userId = user._id;
      const method = request.method;

      if (method === 'POST') {
        // Para creaciones, establecer el ID del usuario de creación
        request.body.usuario_creacion_id = userId;
      } else if (method === 'PUT' || method === 'PATCH') {
        // Para actualizaciones, establecer el ID del usuario de modificación
        request.body.usuario_modificacion_id = userId;
      }
    }

    return next.handle();
  }
}
