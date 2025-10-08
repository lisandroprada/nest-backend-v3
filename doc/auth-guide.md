# Guía de Autenticación y Autorización en la API

Este documento detalla el sistema de autenticación y autorización basado en roles (RBAC) implementado en el proyecto. El sistema utiliza JSON Web Tokens (JWT) para la autenticación.

---

## Componentes Principales

El sistema se compone de varios decoradores y guards que trabajan en conjunto para proteger los endpoints de la API.

### 1. Estrategia de JWT (`JwtStrategy`)

- **Ubicación:** `src/modules/auth/strategies/jwt.strategy.ts`
- **Propósito:** Es el núcleo de la validación de tokens. Cuando una ruta está protegida, esta estrategia se encarga de:
  1. Extraer el JWT del encabezado `Authorization` de la solicitud.
  2. Verificar que el token sea válido y no haya expirado usando el `JWT_SECRET`.
  3. Usar el payload del token (que contiene el `_id` del usuario) para buscar el usuario en la base de datos.
  4. Si el usuario existe y está activo, lo adjunta al objeto `request` de la solicitud (`request.user`). Si no, lanza un error `UnauthorizedException`.

### 2. Guards de NestJS

#### a. `JwtAuthGuard`

- **Ubicación:** `src/modules/auth/guards/jwt-auth.guard.ts`
- **Propósito:** Es un guard simple que extiende el `AuthGuard('jwt')` de Passport. Su única función es activar la `JwtStrategy` para validar el token.

#### b. `UserRoleGuard`

- **Ubicación:** `src/modules/auth/guards/user-role.guard.ts`
- **Propósito:** Este guard se encarga de la **autorización**. Funciona después de que `JwtAuthGuard` ha validado al usuario.
  1. Obtiene los roles permitidos para una ruta específica (que fueron definidos mediante un decorador).
  2. Compara los roles permitidos con los roles que tiene el usuario (`request.user.roles`).
  3. Si el usuario tiene al menos uno de los roles requeridos, permite el acceso. De lo contrario, lanza un error `ForbiddenException`.

---

## Decoradores Personalizados

Para simplificar el uso de los guards y la gestión de metadatos, se han creado varios decoradores personalizados.

### 1. `@Auth(...roles)` - El Decorador Principal

- **Ubicación:** `src/modules/auth/decorators/auth.decorators.ts`
- **Propósito:** **Este es el decorador que se debe usar para proteger las rutas.** Es un decorador compuesto que aplica en una sola línea tanto la autenticación como la autorización por roles.
- **Funcionamiento:**
  - Aplica el decorador `@RoleProtected(...roles)` para adjuntar los roles permitidos como metadatos a la ruta.
  - Aplica los guards `JwtAuthGuard` y `UserRoleGuard` en el orden correcto.

### 2. `@GetUser()`

- **Ubicación:** `src/modules/auth/decorators/get-user.decorators.ts`
- **Propósito:** Un decorador de parámetro que simplifica el acceso al objeto `user` dentro de un método de controlador. Evita tener que escribir `req.user` manualmente.
- **Uso:**
  - `@GetUser()`: Devuelve el objeto `user` completo.
  - `@GetUser('email')`: Devuelve la propiedad `email` del objeto `user`.

### 3. `@RoleProtected(...roles)`

- **Ubicación:** `src/modules/auth/decorators/role-protected.decorator.ts`
- **Propósito:** Un decorador simple que adjunta un array de roles como metadatos a un handler de ruta. Es utilizado internamente por el decorador `@Auth` y no debería necesitar ser usado directamente.

---

## Uso Práctico y Ejemplos

A continuación se muestran ejemplos de cómo proteger endpoints en cualquier controlador.

### Ejemplo 1: Proteger una ruta que solo requiere autenticación

Para una ruta que cualquier usuario autenticado puede acceder, sin importar su rol.

```typescript
import { Controller, Get } from '@nestjs/common';
import { Auth } from '../auth/decorators';

@Controller('profile')
export class ProfileController {
  @Get()
  @Auth() // <-- Solo requiere un token válido
  getProfile() {
    return { message: 'Este es un perfil privado.' };
  }
}
```

### Ejemplo 2: Proteger una ruta para roles específicos

Para una ruta que solo los usuarios con el rol de `admin` o `superUser` pueden acceder.

```typescript
import { Controller, Post } from '@nestjs/common';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('admin')
export class AdminController {
  @Post('data')
  @Auth(ValidRoles.admin, ValidRoles.superUser) // <-- Requiere token Y uno de estos roles
  createData() {
    // Lógica solo para administradores
  }
}
```

_Nota: `ValidRoles` es un enum que se encuentra en `src/modules/auth/interfaces/valid-roles.interface.ts`._

### Ejemplo 3: Acceder a los datos del usuario autenticado

Cómo usar el decorador `@GetUser` para obtener la información del usuario que realiza la solicitud.

```typescript
import { Controller, Get } from '@nestjs/common';
import { Auth, GetUser } from '../auth/decorators';
import { User } from '../user/entities/user.entity';

@Controller('profile')
export class ProfileController {
  @Get('me')
  @Auth()
  getProfile(@GetUser() user: User, @GetUser('email') userEmail: string) {
    console.log(user); // Imprime el objeto de usuario completo
    console.log(userEmail); // Imprime solo el email del usuario
    return user;
  }
}
```

---

## Roles Válidos (`ValidRoles`)

Los roles disponibles en el sistema están definidos en el enum `ValidRoles`. Al proteger una ruta, se debe usar este enum para garantizar la consistencia y evitar errores de tipeo.

- **Ubicación:** `src/modules/auth/interfaces/valid-roles.interface.ts`

```typescript
export enum ValidRoles {
  admin = 'admin',
  superUser = 'super-user',
  user = 'user',
  guest = 'guest',
}
```

---

## Flujo de una Solicitud Protegida

1.  Un cliente envía una solicitud a un endpoint protegido (ej. `GET /profile/me`) incluyendo el encabezado `Authorization: Bearer <jwt>`.
2.  El decorador `@Auth()` en el método del controlador activa sus guards.
3.  **`JwtAuthGuard`** se ejecuta primero. Llama a `JwtStrategy`.
4.  **`JwtStrategy`** valida el token. Si es válido, busca al usuario en la base de datos y lo adjunta a `request.user`.
5.  **`UserRoleGuard`** se ejecuta a continuación. Lee los metadatos de roles (si los hay) definidos por `@Auth(ValidRoles.admin, ...)`.
6.  Compara los roles del `request.user` con los roles permitidos.
7.  Si el usuario tiene el rol adecuado (o si no se requieren roles específicos), el acceso es concedido.
8.  Finalmente, la lógica del método del controlador se ejecuta. Si se usa `@GetUser()`, este extrae la información de `request.user` y la inyecta en el parámetro correspondiente.
