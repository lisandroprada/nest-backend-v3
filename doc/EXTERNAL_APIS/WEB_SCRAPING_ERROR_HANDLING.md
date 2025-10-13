# Manejo de Errores en Web Scraping - Mejoras Implementadas

**Fecha:** 12 de Octubre, 2025  
**Módulos afectados:** `index-scrapper`, `cuit`

---

## 🎯 Problema Identificado

Durante el desarrollo se detectaron errores recurrentes en servicios que dependen de APIs externas y web scraping:

### 1. Error 524 - API IPC (apis.datos.gob.ar)

```
AxiosError: Request failed with status code 524
Cloudflare Error: "The origin web server timed out responding to this request"
```

**Causa:** El servidor de `apis.datos.gob.ar` experimenta timeouts frecuentes debido a sobrecarga.

### 2. Web Scraping CUIT (cuitonline.com)

```
Error al hacer scrapping para DNI 25407911: No se encontraron resultados para el DNI provisto.
```

**Causas posibles:**

- Sitio externo cambió estructura HTML
- Bloqueo por detección de bot
- DNI no existe en base de datos externa
- Rate limiting del sitio

---

## ✅ Soluciones Implementadas

### 1. IPC Scraper - Manejo Resiliente de Timeouts

**Archivo:** `src/modules/external-apis/index-value/index-scrapper/index-scrapper.service.ts`

#### Cambios:

```typescript
// ❌ ANTES (sin timeout, sin reintentos)
const response = await axios.get(url);

// ✅ DESPUÉS (con timeout y configuración optimizada)
const response = await axios.get(url, {
  timeout: 30000, // 30 segundos
  httpsAgent: new https.Agent({ keepAlive: true }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NestBackend/1.0)',
  },
});
```

#### Manejo de errores mejorado:

```typescript
catch (error) {
  // Detectar timeouts y errores 524
  if (
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error.response?.status === 524
  ) {
    console.warn(
      '⚠️ API IPC temporalmente no disponible (timeout/524). Se reintentará en el próximo cron.',
    );
    return; // ✅ Salir silenciosamente sin crashear
  }

  // Otros errores sí se loguean
  console.error('Error al obtener los datos del IPC:', error.message);
  this.errorsService.handleDatabaseError(error);
}
```

**Beneficios:**

- ✅ El cron job no falla completamente si una API está caída
- ✅ Timeout configurado evita esperas infinitas
- ✅ Se reintentará automáticamente en el próximo cron (medianoche)
- ✅ Logs más claros para debugging

---

### 2. CUIT Scraper - Mejoras de Confiabilidad

**Archivo:** `src/modules/cuit/cuit.service.ts`

#### Cambios en headers y timeout:

```typescript
// ❌ ANTES
const { data } = await axios.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0... Chrome/91.0...',
  },
});

// ✅ DESPUÉS (User-Agent actualizado, timeout, más headers)
const { data } = await axios.get(url, {
  timeout: 10000, // 10 segundos
  headers: {
    'User-Agent': 'Mozilla/5.0... Chrome/120.0.0.0...',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9',
  },
});
```

#### Mensajes de error más informativos:

```typescript
// ❌ ANTES
throw new Error('No se encontraron resultados para el DNI provisto.');

// ✅ DESPUÉS
throw new BadRequestException(
  `No se encontraron resultados para el DNI ${dni}. ` +
    `Intente usar el endpoint /generar/${dni} para obtener CUITs posibles.`,
);
```

#### Diferenciación de errores:

```typescript
catch (error) {
  // Si es BadRequestException (no encontrado), re-lanzarla
  if (error instanceof BadRequestException) {
    throw error;
  }

  // Para timeouts, red, etc. - mensaje diferente
  console.warn(`⚠️ Web scraping CUIT falló para DNI ${dni}:`, error.message);

  throw new InternalServerErrorException(
    `Error al consultar CUIT desde el sitio externo. ` +
    `Use el endpoint /generar/${dni} como alternativa confiable.`,
  );
}
```

**Beneficios:**

- ✅ Usuario sabe qué hacer si falla (usar `/generar`)
- ✅ Diferencia entre "no encontrado" vs "error técnico"
- ✅ Headers más modernos reducen detección como bot
- ✅ Timeout evita esperas largas

---

## 🔄 Estrategia de Fallback

### Para IPC (Cron Job)

```
1. Intenta hacer scraping a medianoche (00:00)
   ↓ (si falla con 524/timeout)
2. Loguea warning y sale silenciosamente
   ↓
3. Reintenta en el próximo cron (24 horas después)
```

### Para CUIT (Endpoint público)

```
1. Usuario llama GET /cuit/consultar/:dni
   ↓ (si falla web scraping)
2. Responde con error + sugerencia alternativa
   ↓
3. Usuario usa GET /cuit/generar/:dni (100% confiable, offline)
```

---

## 📊 Comparación de Endpoints CUIT

| Endpoint          | Método          | Confiabilidad | Depende de Internet | Información                   |
| ----------------- | --------------- | ------------- | ------------------- | ----------------------------- |
| `/consultar/:dni` | Web Scraping    | ⚠️ Variable   | ✅ Sí               | Nombre, CUIT, IVA, Ganancias  |
| `/generar/:dni`   | Algoritmo Local | ✅ 100%       | ❌ No               | CUITs posibles (7 variantes)  |
| `/validar/:cuit`  | Algoritmo Local | ✅ 100%       | ❌ No               | Validación dígito verificador |

**Recomendación para Frontend:**

```typescript
async function obtenerCuit(dni: string) {
  try {
    // 1. Intentar web scraping (información completa)
    const response = await fetch(`/api/v1/cuit/consultar/${dni}`);

    if (response.ok) {
      return await response.json(); // ✅ Datos completos
    }
  } catch (error) {
    console.warn('Web scraping falló, usando generación local');
  }

  // 2. Fallback: generar CUITs localmente (siempre funciona)
  const genResponse = await fetch(`/api/v1/cuit/generar/${dni}`);
  const { cuits } = await genResponse.json();

  // Sugerir CUIT según sexo
  return {
    cuitsPosibles: cuits,
    mensaje: 'Seleccione el CUIT correcto',
  };
}
```

---

## 🧪 Testing de Errores

### Test 1: Simular timeout de IPC

```bash
# Desconectar internet temporalmente y ver logs
# Esperado: ⚠️ API IPC temporalmente no disponible (timeout/524)
```

### Test 2: DNI inexistente en cuitonline.com

```bash
curl http://localhost:3050/api/v1/cuit/consultar/99999999

# Esperado:
{
  "statusCode": 400,
  "message": "No se encontraron resultados para el DNI 99999999. Intente usar el endpoint /generar/99999999 para obtener CUITs posibles.",
  "error": "Bad Request"
}
```

### Test 3: Fallback a generación

```bash
curl http://localhost:3050/api/v1/cuit/generar/99999999

# Esperado: Array de 7 CUITs válidos (siempre funciona)
{
  "documento": "99999999",
  "cuits": [
    { "cuit": "20-99999999-6", "tipo": "Masculino", ... },
    { "cuit": "27-99999999-3", "tipo": "Femenino", ... },
    ...
  ]
}
```

---

## 🎓 Lecciones Aprendidas

### 1. **APIs Externas son Inherentemente Inestables**

- ✅ Siempre configurar timeouts
- ✅ Implementar retry logic o cron reintento
- ✅ No crashear la aplicación por un servicio externo caído

### 2. **Web Scraping es Frágil**

- ✅ Ofrecer alternativa offline cuando sea posible
- ✅ User-Agent actualizado reduce bloqueos
- ✅ Timeout corto (10s) mejor que espera larga

### 3. **Mensajes de Error Útiles**

- ❌ "Error al procesar CUIT" (vago)
- ✅ "Use /generar/:dni como alternativa" (accionable)

### 4. **Separación de Responsabilidades**

- `/consultar` → Datos completos, puede fallar
- `/generar` → CUITs posibles, nunca falla
- `/validar` → Verificación, nunca falla

---

## 📝 Configuraciones Actuales

### Timeouts

| Servicio      | Timeout | Razón                     |
| ------------- | ------- | ------------------------- |
| IPC API       | 30s     | API gubernamental lenta   |
| CUIT Scraping | 10s     | Respuesta esperada rápida |
| Casa Propia   | 15s     | Scraping medio            |
| ICL           | 15s     | Scraping medio            |

### Cron Jobs

| Tarea              | Frecuencia   | Comportamiento en Error        |
| ------------------ | ------------ | ------------------------------ |
| Update IPC         | 00:00 diario | ⚠️ Warning + reintentar en 24h |
| Update Casa Propia | 00:00 diario | 🛑 Error logged                |
| Update ICL         | 00:00 diario | 🛑 Error logged                |

---

## 🔮 Mejoras Futuras Sugeridas

### 1. Implementar Retry con Exponential Backoff

```typescript
async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await axios.get(url, { timeout: 30000 });
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2 ** i * 1000));
    }
  }
}
```

### 2. Cache de Resultados CUIT

```typescript
// Cachear resultados exitosos del web scraping
private cuitCache = new Map<string, { data: CuitData, timestamp: number }>();

async consultarCuitPorDni(dni: string): Promise<CuitData> {
  // Verificar cache (válido por 7 días)
  const cached = this.cuitCache.get(dni);
  if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
    return cached.data;
  }

  // Hacer scraping...
}
```

### 3. Notificaciones de Servicios Caídos

```typescript
if (ipcErrorCount > 3) {
  await this.emailService.send({
    to: 'admin@propietas.com',
    subject: '⚠️ API IPC caída por >3 días',
    body: 'Revisar estado de apis.datos.gob.ar',
  });
}
```

---

## 📚 Referencias

- [Axios Timeout Configuration](https://axios-http.com/docs/req_config)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [Cloudflare Error 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)
