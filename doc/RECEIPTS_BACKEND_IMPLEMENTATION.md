# Sistema de Recibos - Configuración Backend

## ✅ Implementación Completada

El backend ahora soporta completamente la generación, envío y gestión de recibos en formato PDF.

---

## 📋 Endpoints Disponibles

### 1. Procesar Recibo

```
POST /api/v1/receipts/process-receipt
```

Procesa cobros y pagos (endpoint unificado ya existente).

**Cambios:** Ahora retorna `_id`, `comprobante_externo`, `tipo_flujo_neto` en la respuesta.

### 2. Generar PDF

```
POST /api/v1/receipts/generate-pdf
Body: { "receiptId": "..." }
```

Genera un PDF profesional del recibo.

### 3. Enviar por Email

```
POST /api/v1/receipts/send-email
Body: { "receiptId": "...", "email": "..." }
```

Envía el recibo por email con PDF adjunto.

### 4. Enviar por WhatsApp

```
POST /api/v1/receipts/send-whatsapp
Body: { "receiptId": "...", "phoneNumber": "..." }
```

Envía el recibo por WhatsApp con PDF adjunto.

### 5. Obtener URL del PDF

```
GET /api/v1/receipts/:id/pdf-url
```

Obtiene la URL pública del PDF (genera el PDF si no existe).

---

## ⚙️ Configuración Requerida

### Variables de Entorno (.env)

Agrega las siguientes variables a tu archivo `.env`:

```bash
# ==========================================
# CONFIGURACIÓN DE EMAIL (SMTP)
# ==========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-app-password

# ==========================================
# CONFIGURACIÓN DE WHATSAPP BUSINESS API
# ==========================================
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_ACCESS_TOKEN=tu-access-token-aqui
WHATSAPP_PHONE_NUMBER_ID=tu-phone-number-id-aqui
```

### Configuración de Email (Gmail)

1. **Habilitar "Verificación en 2 pasos"** en tu cuenta de Gmail
2. **Generar contraseña de aplicación:**
   - Ve a: https://myaccount.google.com/apppasswords
   - Genera una nueva contraseña para "Mail"
   - Usa esa contraseña en `SMTP_PASS`

3. **Usar la configuración:**

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # Contraseña de aplicación
```

### Configuración de WhatsApp Business API

1. **Crear cuenta en Meta for Developers:**
   - https://developers.facebook.com/

2. **Configurar WhatsApp Business API:**
   - Crear una app de tipo "Business"
   - Configurar WhatsApp Business API
   - Obtener Phone Number ID
   - Generar Access Token

3. **Obtener credenciales:**
   - `WHATSAPP_PHONE_NUMBER_ID`: En Dashboard → WhatsApp → API Setup
   - `WHATSAPP_ACCESS_TOKEN`: En Dashboard → System Users → Generate Token

4. **Usar la configuración:**

```bash
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
```

---

## 📁 Estructura de Archivos

```
src/modules/receipts/
├── receipts.module.ts          # ✅ Módulo actualizado
├── receipts.controller.ts      # ✅ Nuevos endpoints agregados
├── receipts.service.ts         # ✅ Nuevos métodos agregados
├── entities/
│   └── receipt.entity.ts       # ✅ Campos nuevos: tipo_flujo_neto, pdf_path, pdf_url
├── dto/
│   ├── create-receipt.dto.ts
│   ├── send-email.dto.ts       # ✅ NUEVO
│   └── send-whatsapp.dto.ts    # ✅ NUEVO
└── services/
    ├── pdf-generator.service.ts  # ✅ NUEVO
    ├── email.service.ts          # ✅ NUEVO
    └── whatsapp.service.ts       # ✅ NUEVO
```

---

## 🎨 Diseño del PDF

El PDF generado incluye:

- ✅ **Header profesional** con logo y datos de la empresa
- ✅ **Tipo de comprobante** (X - No Fiscal)
- ✅ **Número de recibo** formateado (00000123)
- ✅ **Información del cliente** (nombre, CUIT, email)
- ✅ **Detalles del pago** (método, comprobante externo)
- ✅ **Tabla de operaciones** con descripción, fecha y montos
- ✅ **Totales calculados** (ingresos, egresos, neto)
- ✅ **Observaciones** (si existen)
- ✅ **Espacio para firmas** (emisor y receptor)

---

## 📧 Diseño del Email

El email enviado incluye:

- ✅ **Header verde corporativo** con logo
- ✅ **Asunto:** "Recibo de Pago N° XXXXXXXX"
- ✅ **Contenido HTML responsive**
- ✅ **Resumen del recibo** (número, fecha, monto)
- ✅ **PDF adjunto** con el comprobante
- ✅ **Footer profesional** con disclaimer

---

## 💬 Diseño del WhatsApp

El mensaje de WhatsApp incluye:

- ✅ **Mensaje formateado** con emojis
- ✅ **Datos del recibo** (número, fecha, monto)
- ✅ **PDF adjunto** descargable
- ✅ **Formato de teléfono:** 549 + código de área + número
  - Ejemplo Buenos Aires: `5491123456789`
  - Ejemplo Córdoba: `5493514567890`

---

## 🧪 Pruebas

### Probar generación de PDF

```bash
curl -X POST 'http://localhost:3050/api/v1/receipts/generate-pdf' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"receiptId": "673a812dbff411728c9e830b"}'
```

### Probar envío de email

```bash
curl -X POST 'http://localhost:3050/api/v1/receipts/send-email' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "receiptId": "673a812dbff411728c9e830b",
    "email": "test@ejemplo.com"
  }'
```

### Probar envío de WhatsApp

```bash
curl -X POST 'http://localhost:3050/api/v1/receipts/send-whatsapp' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "receiptId": "673a812dbff411728c9e830b",
    "phoneNumber": "5491123456789"
  }'
```

---

## 🔍 Verificación de Configuración

### Verificar conexión SMTP

```typescript
// En el código:
const isConnected = await emailService.verifyConnection();
console.log('SMTP:', isConnected ? '✅ Configurado' : '❌ Error');
```

### Verificar configuración WhatsApp

```typescript
// En el código:
const isConfigured = whatsappService.isConfigured();
console.log(
  'WhatsApp:',
  isConfigured ? '✅ Configurado' : '❌ Faltan variables',
);
```

---

## 📝 Notas Importantes

1. **Directorio de PDFs:**
   - Los PDFs se guardan en: `/uploads/receipts/`
   - Asegúrate de que el directorio tenga permisos de escritura
   - El directorio se crea automáticamente si no existe

2. **Dependencias instaladas:**
   - `pdfkit` - Generación de PDF
   - `@types/pdfkit` - TypeScript types
   - `nodemailer` - Envío de emails
   - `@types/nodemailer` - TypeScript types

3. **Configuración opcional:**
   - Si no configuras email/WhatsApp, esos endpoints retornarán error
   - El sistema seguirá funcionando para generación de PDF local

4. **Seguridad:**
   - Nunca commitees el archivo `.env` al repositorio
   - Usa variables de entorno en producción
   - Considera usar servicios como AWS SES para emails en producción

---

## 🚀 Próximos Pasos

1. ✅ **Backend completado**
2. ✅ **Frontend ya implementado** (según tu mensaje)
3. ⏳ **Configurar variables de entorno**
4. ⏳ **Probar endpoints**
5. ⏳ **Verificar integración frontend-backend**

---

## 📚 Documentación Completa

Ver documentación detallada en:

- `doc/ESTADO_CUENTA_API.md` - Sección 10: Gestión de Recibos

---

## 🐛 Solución de Problemas

### Error: "No se pudo enviar el email"

- Verificar configuración SMTP en .env
- Verificar que SMTP_USER y SMTP_PASS sean correctos
- Probar con `emailService.verifyConnection()`

### Error: "WhatsApp no está configurado"

- Verificar que todas las variables WHATSAPP\_\* estén en .env
- Verificar que el access token sea válido
- Verificar que el phone number ID sea correcto

### Error: "El archivo PDF no existe"

- Verificar permisos de escritura en `/uploads/receipts/`
- Verificar que el directorio exista
- Ejecutar con permisos adecuados

---

**Implementado por:** GitHub Copilot  
**Fecha:** Noviembre 6, 2025  
**Estado:** ✅ Completado y listo para usar
