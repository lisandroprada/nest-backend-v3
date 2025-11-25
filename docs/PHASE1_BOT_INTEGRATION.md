# Core Backend Integration - Phase 1 Complete

## ✅ Fase 1: Autenticación Service-to-Service

### Componentes Implementados

1. **ApiKeyGuard** (`src/modules/bot/guards/api-key.guard.ts`)
   - Valida header `x-api-key`
   - Marca requests como autenticados por servicio
   - Lanza `UnauthorizedException` si falta o es inválida

2. **@ServiceAuth() Decorator** (`src/modules/bot/decorators/service-auth.decorator.ts`)
   - Combina `ApiKeyGuard` + Rate Limiting
   - Configurable: `@ServiceAuth(limit, ttl)`
   - Por defecto: 100 requests/minuto

3. **BotModule** (`src/modules/bot/bot.module.ts`)
   - Registrado en `app.module.ts`
   - Configurado con `ThrottlerModule`
   - Importa `Agent` schema para búsquedas

4. **BotService** (`src/modules/bot/bot.service.ts`)
   - `healthCheck()`: Endpoint de monitoreo
   - `findClientByJid(jid)`: Busca cliente por WhatsApp JID
   - Normaliza JID (remueve `@s.whatsapp.net`)

5. **BotController** (`src/modules/bot/bot.controller.ts`)
   - `GET /bot/health`: Health check (sin auth)
   - `GET /bot/client/by-jid/:jid`: Buscar cliente (con auth)

### Variables de Entorno

Agregado a `.env.example`:
```bash
WHATSAPP_BOT_API_KEY=your-secure-api-key-min-32-chars-here
```

### API Key Generada

**IMPORTANTE:** Copia esta API key a tu archivo `.env` en ambos proyectos:

**Core Backend** (`nest-backend-v3/.env`):
```bash
WHATSAPP_BOT_API_KEY=z5P+1rlMC4Y8wIpOC4mpeZ2hRENzQgmWIAvEdRynlUo=
```

**WhatsApp Bot** (`whatsapp-bot/.env`):
```bash
WHATSAPP_BOT_API_KEY=z5P+1rlMC4Y8wIpOC4mpeZ2hRENzQgmWIAvEdRynlUo=
```

### Cómo Probar

1. **Iniciar Core Backend:**
   ```bash
   cd nest-backend-v3
   npm run start:dev
   ```

2. **Test Health Check (sin auth):**
   ```bash
   curl http://localhost:3050/bot/health
   ```
   Esperado: `{ "status": "ok", "service": "whatsapp-bot-api", "timestamp": "..." }`

3. **Test Client Lookup (con auth):**
   ```bash
   curl -H "x-api-key: <TU_API_KEY>" \
        http://localhost:3050/bot/client/by-jid/5491112345678@s.whatsapp.net
   ```
   Esperado: `{ "exists": true/false, ... }`

4. **Test sin API Key (debe fallar):**
   ```bash
   curl http://localhost:3050/bot/client/by-jid/5491112345678@s.whatsapp.net
   ```
   Esperado: `401 Unauthorized`

### Próximos Pasos

- **Fase 2:** Endpoint de consulta de saldo
- **Fase 3:** Sistema de OTP
- **Fase 4:** Endpoint de reclamos (Tickets Module)
- **Fase 5:** Actualizar WhatsApp Bot para usar endpoints reales

---

**Fecha:** 2025-11-25  
**Estado:** ✅ Completado
