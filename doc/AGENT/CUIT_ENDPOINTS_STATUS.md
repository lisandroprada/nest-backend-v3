# Estado Actual de Endpoints CUIT

**Fecha:** 12 de Octubre, 2025  
**Servidor:** http://localhost:3050

---

## ✅ Rutas Correctas (Con Prefijo Global)

Todos los endpoints CUIT incluyen el prefijo `/api/v1/` configurado en `main.ts`:

```typescript
// src/main.ts
app.setGlobalPrefix('/api/v1');
```

### Rutas Completas:

```
GET /api/v1/cuit/validar/:cuit      ✅ FUNCIONANDO
GET /api/v1/cuit/generar/:documento ✅ FUNCIONANDO
GET /api/v1/cuit/consultar/:dni     ⚠️ WEB SCRAPING - Puede fallar
```

---

## 📊 Estado de Cada Endpoint

### 1. Validar CUIT ✅

**Ruta:** `GET /api/v1/cuit/validar/:cuit`

**Estado:** ✅ **FUNCIONANDO PERFECTO**

**Test:**

```bash
curl http://localhost:3050/api/v1/cuit/validar/20-25407911-2
```

**Response:**

```json
{
  "valido": true,
  "mensaje": "CUIT válido",
  "cuitFormateado": "20-25407911-2"
}
```

**Características:**

- ✅ 100% confiable (algoritmo local)
- ✅ Offline (no depende de APIs externas)
- ✅ Valida formato y dígito verificador
- ✅ Respuesta instantánea

---

### 2. Generar CUITs ✅

**Ruta:** `GET /api/v1/cuit/generar/:documento`

**Estado:** ✅ **FUNCIONANDO PERFECTO**

**Test:**

```bash
curl http://localhost:3050/api/v1/cuit/generar/25407911
```

**Response:**

```json
{
  "documento": "25407911",
  "cuits": [
    {
      "cuit": "20-25407911-2",
      "tipo": "Masculino",
      "descripcion": "Persona Física - Masculino"
    },
    {
      "cuit": "27-25407911-7",
      "tipo": "Femenino",
      "descripcion": "Persona Física - Femenino"
    },
    {
      "cuit": "23-25407911-1",
      "tipo": "Masculino",
      "descripcion": "Persona Física - Masculino (alternativo)"
    },
    {
      "cuit": "24-25407911-8",
      "tipo": "Femenino",
      "descripcion": "Persona Física - Femenino (alternativo)"
    },
    {
      "cuit": "30-25407911-8",
      "tipo": "Jurídica",
      "descripcion": "Persona Jurídica"
    },
    {
      "cuit": "33-25407911-7",
      "tipo": "Jurídica",
      "descripcion": "Persona Jurídica (alternativo)"
    },
    {
      "cuit": "34-25407911-3",
      "tipo": "Jurídica",
      "descripcion": "Persona Jurídica (otro)"
    }
  ]
}
```

**Características:**

- ✅ 100% confiable (algoritmo local)
- ✅ Offline (no depende de APIs externas)
- ✅ Genera todas las combinaciones posibles (7 variantes)
- ✅ Respuesta instantánea
- ✅ **RECOMENDADO PARA PRODUCCIÓN**

---

### 3. Consultar CUIT (Web Scraping) ⚠️

**Ruta:** `GET /api/v1/cuit/consultar/:dni`

**Estado:** ⚠️ **ACTUALMENTE NO FUNCIONA** (Web scraping fallando)

**Test:**

```bash
curl http://localhost:3050/api/v1/cuit/consultar/25407911
```

**Response Actual:**

```json
{
  "message": "No se encontraron resultados para el DNI 25407911. Intente usar el endpoint /generar/25407911 para obtener CUITs posibles.",
  "error": "Bad Request",
  "statusCode": 400
}
```

**Problemas Detectados:**

1. **El sitio cuitonline.com genera contenido con JavaScript**
   - Axios solo obtiene HTML inicial
   - El contenido real se carga dinámicamente
   - Cheerio no puede parsear contenido JS

2. **Posible protección anti-bot**
   - Headers actualizados no son suficientes
   - Puede requerir cookies/sesión
   - Cloudflare Turnstile detectado en la página

3. **Sitio verificado funciona en navegador:**
   - https://www.cuitonline.com/search/25407911 ✅ Funciona en browser
   - ❌ Falla con axios/cheerio

**Características:**

- ⚠️ Dependiente de sitio externo
- ⚠️ Requiere scraping dinámico (Puppeteer)
- ⚠️ Puede ser bloqueado
- ⚠️ **NO RECOMENDADO PARA PRODUCCIÓN EN ESTADO ACTUAL**

---

## 🎯 Recomendaciones

### Para Desarrollo/Producción

**✅ USAR:**

```typescript
// 1. Generar CUITs posibles desde DNI
const response = await fetch('/api/v1/cuit/generar/25407911');
const { cuits } = await response.json();

// 2. Usuario selecciona el CUIT correcto según sexo
const cuitSeleccionado = cuits.find((c) => c.tipo === 'Masculino');

// 3. Validar el CUIT seleccionado
const validacion = await fetch(`/api/v1/cuit/validar/${cuitSeleccionado.cuit}`);
```

**❌ EVITAR (hasta arreglar):**

```typescript
// Este endpoint NO funciona actualmente
const response = await fetch('/api/v1/cuit/consultar/25407911');
```

---

## 🔧 Soluciones Propuestas para Web Scraping

### Opción 1: Usar Puppeteer (RECOMENDADO)

Puppeteer renderiza JavaScript como un navegador real:

```typescript
import puppeteer from 'puppeteer';

async consultarCuitPorDni(dni: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`https://www.cuitonline.com/search/${dni}`, {
    waitUntil: 'networkidle0'
  });

  const data = await page.evaluate(() => {
    const nombre = document.querySelector('.resultado-busqueda a').textContent;
    const cuit = document.querySelector('li:contains("CUIT")').textContent;
    // ... más scraping
    return { nombre, cuit };
  });

  await browser.close();
  return data;
}
```

**Instalación:**

```bash
pnpm add puppeteer
pnpm add -D @types/puppeteer
```

### Opción 2: API Oficial de AFIP

Si existe una API oficial de AFIP, usarla en lugar de scraping:

```typescript
// Ejemplo hipotético
const response = await axios.get(
  `https://api.afip.gob.ar/padron/v1/persona/${dni}`,
  {
    headers: { Authorization: `Bearer ${AFIP_TOKEN}` },
  },
);
```

### Opción 3: Mantener Solo Generación Local

Deshabilitar el endpoint `/consultar` y usar solo `/generar` y `/validar`:

```typescript
// En cuit.controller.ts
// Comentar o eliminar este endpoint:
// @Get('consultar/:dni')
// consultarCuitPorDni(@Param('dni') dni: string) {
//   return this.cuitService.consultarCuitPorDni(dni);
// }
```

---

## 📝 Ejemplo de Flujo de Trabajo Frontend

### Formulario de Alta de Agente/Propietario

```typescript
const FormularioPersona = () => {
  const [dni, setDni] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [cuit, setCuit] = useState('');

  const handleDniBlur = async () => {
    // 1. Generar CUITs posibles
    const response = await fetch(`/api/v1/cuit/generar/${dni}`);
    const data = await response.json();

    // 2. Filtrar por sexo
    const tipoFiltro = sexo === 'M' ? 'Masculino' : 'Femenino';
    const cuitSugerido = data.cuits.find(c => c.tipo === tipoFiltro);

    // 3. Autocompletar
    if (cuitSugerido) {
      setCuit(cuitSugerido.cuit);
    }
  };

  const handleCuitBlur = async (e) => {
    // Validar CUIT ingresado manualmente
    const response = await fetch(`/api/v1/cuit/validar/${e.target.value}`);
    const { valido, mensaje } = await response.json();

    if (!valido) {
      alert(mensaje);
    }
  };

  return (
    <form>
      <input
        value={dni}
        onChange={e => setDni(e.target.value)}
        onBlur={handleDniBlur}
        placeholder="DNI"
      />

      <select value={sexo} onChange={e => setSexo(e.target.value)}>
        <option value="M">Masculino</option>
        <option value="F">Femenino</option>
      </select>

      <input
        value={cuit}
        onChange={e => setCuit(e.target.value)}
        onBlur={handleCuitBlur}
        placeholder="CUIT (autocompletado)"
      />
    </form>
  );
};
```

---

## 🧪 Tests de Integración

```bash
# ✅ Test 1: Validar CUIT válido
curl http://localhost:3050/api/v1/cuit/validar/20-25407911-2
# Esperado: {"valido":true,"mensaje":"CUIT válido","cuitFormateado":"20-25407911-2"}

# ✅ Test 2: Validar CUIT inválido
curl http://localhost:3050/api/v1/cuit/validar/20-25407911-9
# Esperado: {"valido":false,"mensaje":"Dígito verificador incorrecto..."}

# ✅ Test 3: Generar CUITs
curl http://localhost:3050/api/v1/cuit/generar/25407911
# Esperado: {"documento":"25407911","cuits":[...7 CUITs...]}

# ⚠️ Test 4: Consultar (actualmente falla)
curl http://localhost:3050/api/v1/cuit/consultar/25407911
# Actual: {"message":"No se encontraron resultados...","statusCode":400}
```

---

## 📌 Resumen

| Endpoint              | Estado      | Confiabilidad    | Recomendación             |
| --------------------- | ----------- | ---------------- | ------------------------- |
| `/validar/:cuit`      | ✅ Funciona | 100%             | ✅ Usar en producción     |
| `/generar/:documento` | ✅ Funciona | 100%             | ✅ Usar en producción     |
| `/consultar/:dni`     | ⚠️ Falla    | 0% (actualmente) | ❌ No usar hasta arreglar |

**Acción Recomendada:** Implementar Puppeteer para `/consultar` o deshabilitar ese endpoint y usar solo generación local.
