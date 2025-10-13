# API de CUIT - Documentación Completa

**Fecha:** 12 de Octubre, 2025  
**Base URL:** `http://localhost:3050/api/v1/cuit`

> ✅ **Nota:** Los endpoints CUIT incluyen el prefijo global `/api/v1/`

---

## 📋 Índice

1. [Validar CUIT](#1-validar-cuit)
2. [Generar CUITs desde Documento](#2-generar-cuits-desde-documento)
3. [Consultar CUIT (Web Scraping)](#3-consultar-cuit-web-scraping)

---

## 1. Validar CUIT

Valida el formato y dígito verificador de un CUIT.

### Endpoint

```
GET /cuit/validar/:cuit
```

### Parámetros

- **`cuit`** (string, path): CUIT a validar
  - Puede incluir guiones: `20-12345678-9`
  - O sin guiones: `20123456789`

### Validaciones Realizadas

1. ✅ Longitud correcta (11 dígitos)
2. ✅ Solo números
3. ✅ Prefijo válido (20, 23, 24, 27, 30, 33, 34)
4. ✅ Dígito verificador correcto

### Response Success

```json
{
  "valido": true,
  "mensaje": "CUIT válido",
  "cuitFormateado": "20-12345678-9"
}
```

### Response Error (CUIT Inválido)

```json
{
  "valido": false,
  "mensaje": "Dígito verificador incorrecto. Esperado: 5, Recibido: 9"
}
```

### Ejemplos de Uso

#### cURL

```bash
# Con guiones
curl http://localhost:3050/api/v1/cuit/validar/20-25407911-2

# Sin guiones
curl http://localhost:3050/api/v1/cuit/validar/20254079112
```

#### Frontend (Fetch)

```typescript
async function validarCuit(cuit: string) {
  const response = await fetch(`/api/v1/cuit/validar/${cuit}`);
  const data = await response.json();

  if (data.valido) {
    console.log(`✅ CUIT válido: ${data.cuitFormateado}`);
  } else {
    console.error(`❌ ${data.mensaje}`);
  }

  return data;
}
```

---

## 2. Generar CUITs desde Documento

Genera todos los posibles CUITs válidos a partir de un número de documento (DNI).

### Endpoint

```
GET /cuit/generar/:documento
```

### Parámetros

- **`documento`** (string, path): Número de DNI (7 u 8 dígitos)

### Response Success

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

### Response Error

```json
{
  "statusCode": 400,
  "message": "El documento debe tener 7 u 8 dígitos numéricos",
  "error": "Bad Request"
}
```

### Prefijos de CUIT

| Prefijo | Tipo      | Descripción                              |
| ------- | --------- | ---------------------------------------- |
| 20      | Masculino | Persona Física - Masculino (común)       |
| 27      | Femenino  | Persona Física - Femenino (común)        |
| 23      | Masculino | Persona Física - Masculino (alternativo) |
| 24      | Femenino  | Persona Física - Femenino (alternativo)  |
| 30      | Jurídica  | Persona Jurídica                         |
| 33      | Jurídica  | Persona Jurídica (alternativo)           |
| 34      | Jurídica  | Persona Jurídica (otro)                  |

### Ejemplos de Uso

#### cURL

```bash
# Con puntos (se limpian automáticamente)
curl http://localhost:3050/api/v1/cuit/generar/25.407.911

# Sin puntos
curl http://localhost:3050/api/v1/cuit/generar/25407911
```

#### Frontend (React)

```typescript
const GenerarCuitForm = () => {
  const [documento, setDocumento] = useState('');
  const [cuits, setCuits] = useState([]);

  const generarCuits = async () => {
    const response = await fetch(`/api/v1/cuit/generar/${documento}`);
    const data = await response.json();
    setCuits(data.cuits);
  };

  return (
    <div>
      <input
        value={documento}
        onChange={(e) => setDocumento(e.target.value)}
        placeholder="Ingrese DNI"
      />
      <button onClick={generarCuits}>Generar CUITs</button>

      <ul>
        {cuits.map((c, index) => (
          <li key={index}>
            <strong>{c.cuit}</strong> - {c.descripcion}
          </li>
        ))}
      </ul>
    </div>
  );
};
```

---

## 3. Consultar CUIT (Web Scraping)

Consulta información de CUIT desde el sitio `cuitonline.com` mediante web scraping.

⚠️ **Importante:** Depende de un sitio externo. Puede dejar de funcionar si cambia la estructura.

### Endpoint

```
GET /cuit/consultar/:dni
```

### Parámetros

- **`dni`** (string, path): Número de DNI a consultar

### Response Success

```json
{
  "nombre": "PRADA TOLEDO LISANDRO EMANUEL",
  "cuit": "20-25407911-2",
  "tipoPersona": "Persona Física (masculino)",
  "ganancias": "Ganancias Personas Fisicas",
  "iva": "Iva Inscripto"
}
```

### Response Error (DNI no encontrado)

```json
{
  "statusCode": 400,
  "message": "No se encontraron resultados para el DNI 25407911. Intente usar el endpoint /generar/25407911 para obtener CUITs posibles.",
  "error": "Bad Request"
}
```

### Response Error (Error de red/timeout)

```json
{
  "statusCode": 500,
  "message": "Error al consultar CUIT desde el sitio externo. Use el endpoint /generar/25407911 como alternativa confiable.",
  "error": "Internal Server Error"
}
```

### Ejemplos de Uso

#### cURL

```bash
curl http://localhost:3050/api/v1/cuit/consultar/25407911
```

#### Frontend

```typescript
async function consultarCuit(dni: string) {
  try {
    const response = await fetch(`/api/v1/cuit/consultar/${dni}`);

    if (!response.ok) {
      throw new Error('Error al consultar CUIT');
    }

    const data = await response.json();
    console.log(`Nombre: ${data.nombre}`);
    console.log(`CUIT: ${data.cuit}`);
    console.log(`Condición IVA: ${data.iva}`);

    return data;
  } catch (error) {
    console.error('Error:', error);
    // Fallback: usar el endpoint de generar
    const generated = await fetch(`/api/v1/cuit/generar/${dni}`);
    return generated.json();
  }
}
```

---

## 🔄 Flujo de Trabajo Recomendado

### Validación de CUIT Ingresado por Usuario

```typescript
async function procesarCuit(cuitIngresado: string) {
async function procesarCuit(cuitIngresado: string) {
  // 1. Validar formato
  const validacion = await fetch(`/api/v1/cuit/validar/${cuitIngresado}`);
  const { valido, mensaje, cuitFormateado } = await validacion.json();

  if (!valido) {
    alert(`CUIT inválido: ${mensaje}`);
    return;
  }

  console.log(`✅ CUIT válido: ${cuitFormateado}`);
  // Continuar con el proceso...
}
```

### Generación de CUIT desde DNI

```typescript
async function seleccionarCuit(dni: string, sexo: 'M' | 'F') {
  // 1. Generar todos los CUITs posibles
  const response = await fetch(`/api/v1/cuit/generar/${dni}`);
  const { cuits } = await response.json();

  // 2. Filtrar por sexo
  const tipoFiltro = sexo === 'M' ? 'Masculino' : 'Femenino';
  const cuitSugerido = cuits.find((c) => c.tipo === tipoFiltro);

  // 3. Validar el CUIT sugerido
  const validacion = await fetch(`/api/v1/cuit/validar/${cuitSugerido.cuit}`);
  const { valido } = await validacion.json();

  return valido ? cuitSugerido.cuit : null;
}
```

### Consulta Completa con Fallback

```typescript
async function obtenerDatosCuit(dni: string) {
  try {
    // 1. Intentar consultar desde cuitonline.com
    const consulta = await fetch(`/api/v1/cuit/consultar/${dni}`);

    if (consulta.ok) {
      return await consulta.json();
    }
  } catch (error) {
    console.warn('Web scraping falló, usando generación local');
  }

  // 2. Fallback: generar CUITs localmente
  const generacion = await fetch(`/api/v1/cuit/generar/${dni}`);
  const { cuits } = await generacion.json();

  return {
    cuitsPosibles: cuits,
    mensaje: 'Seleccione el CUIT correcto de la lista',
  };
}
```

---

## 📊 Casos de Uso

### 1. Formulario de Alta de Agente

```typescript
const FormularioAgente = () => {
  const [dni, setDni] = useState('');
  const [cuit, setCuit] = useState('');
  const [sexo, setSexo] = useState('M');

  const autocompletarCuit = async () => {
    const response = await fetch(`/api/v1/cuit/generar/${dni}`);
    const data = await response.json();

    const tipoFiltro = sexo === 'M' ? 'Masculino' : 'Femenino';
    const cuitSugerido = data.cuits.find(c => c.tipo === tipoFiltro);

    setCuit(cuitSugerido?.cuit || '');
  };

  const validarCuitManual = async (e) => {
    const cuitIngresado = e.target.value;
    const response = await fetch(`/api/v1/cuit/validar/${cuitIngresado}`);
    const { valido, mensaje } = await response.json();

    if (!valido) {
      setError(mensaje);
    }
  };

  return (
    <form>
      <input
        value={dni}
        onChange={(e) => setDni(e.target.value)}
        onBlur={autocompletarCuit}
        placeholder="DNI"
      />

      <select value={sexo} onChange={(e) => setSexo(e.target.value)}>
        <option value="M">Masculino</option>
        <option value="F">Femenino</option>
      </select>

      <input
        value={cuit}
        onChange={(e) => setCuit(e.target.value)}
        onBlur={validarCuitManual}
        placeholder="CUIT"
      />
    </form>
  );
};
```

### 2. Validación en Tiempo Real

```typescript
const CuitInput = () => {
  const [cuit, setCuit] = useState('');
  const [estado, setEstado] = useState<'validando' | 'valido' | 'invalido'>('validando');

  const validarEnTiempoReal = useCallback(
    debounce(async (valor: string) => {
      if (valor.length < 11) return;

      const response = await fetch(`/api/v1/cuit/validar/${valor}`);
      const { valido } = await response.json();

      setEstado(valido ? 'valido' : 'invalido');
    }, 500),
    []
  );

  return (
    <div>
      <input
        value={cuit}
        onChange={(e) => {
          setCuit(e.target.value);
          validarEnTiempoReal(e.target.value);
        }}
        className={estado === 'valido' ? 'border-green-500' : 'border-red-500'}
      />
      {estado === 'valido' && <span>✅ CUIT válido</span>}
      {estado === 'invalido' && <span>❌ CUIT inválido</span>}
    </div>
  );
};
```

---

## 🧪 Testing

### Test con cURL

```bash
# 1. Validar CUIT válido
curl http://localhost:3050/api/v1/cuit/validar/20-25407911-2

# 2. Validar CUIT inválido
curl http://localhost:3050/api/v1/cuit/validar/20-25407911-9

# 3. Generar CUITs desde DNI
curl http://localhost:3050/api/v1/cuit/generar/25407911

# 4. Consultar CUIT (web scraping)
curl http://localhost:3050/api/v1/cuit/consultar/25407911
```

### Resultados Esperados

```bash
# Validar válido
{"valido":true,"mensaje":"CUIT válido","cuitFormateado":"20-25407911-2"}

# Validar inválido
{"valido":false,"mensaje":"Dígito verificador incorrecto. Esperado: 2, Recibido: 9"}

# Generar
{"documento":"25407911","cuits":[...]}

# Consultar
{"nombre":"PRADA TOLEDO LISANDRO EMANUEL",...}
```

---

## ⚠️ Notas Importantes

### Validación de CUIT

- ✅ **100% confiable** - Algoritmo estándar de validación
- ✅ **Offline** - No depende de servicios externos
- ✅ **Rápida** - Cálculo inmediato

### Generación de CUIT

- ✅ **100% confiable** - Genera todos los CUITs válidos posibles
- ✅ **Offline** - No depende de servicios externos
- ✅ **Completa** - Incluye todos los prefijos (20, 23, 24, 27, 30, 33, 34)

### Consulta CUIT (Web Scraping)

- ⚠️ **Dependiente de sitio externo** - Puede fallar si cambia la estructura
- ⚠️ **Rate limiting** - No hacer consultas masivas
- ⚠️ **Puede devolver error 500** - Usar generación como fallback

---

## 📚 Referencias

- [AFIP - Cálculo de Dígito Verificador](https://www.afip.gob.ar/genericos/claveunica/ayuda/digito-verificador.asp)
- [Algoritmo CUIT](https://es.wikipedia.org/wiki/Clave_%C3%9Anica_de_Identificaci%C3%B3n_Tributaria)
- [Tipos de CUIT](https://www.argentina.gob.ar/obtener-la-cuit)
