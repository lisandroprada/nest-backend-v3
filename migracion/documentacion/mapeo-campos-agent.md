# Mapeo de Campos: Legacy → V3 (Agent)

## ⚠️ ANÁLISIS CRÍTICO

Después de revisar los schemas reales, se identificaron **diferencias significativas** entre Legacy y V3 que requieren decisiones de negocio antes de proceder con la migración.

---

## 📋 Campos de Legacy (Schema Real)

```javascript
{
  _id: ObjectId,
  name: string,              // Nombre
  lastName: string,          // Apellido
  email: string,             // Email
  phone: [                   // Array de teléfonos
    { number: string }
  ],
  address: string,           // Dirección (texto plano)
  agentType: string,         // Tipo: "Proveedor", "Cliente", etc.
  fullName: string,          // Nombre completo generado
  bankAccount: [             // Cuentas bancarias
    { /* estructura desconocida */ }
  ],
  createdAt: Date,
  __v: number
}
```

---

## 📋 Campos de V3 (Schema Real)

### ✅ Campos OBLIGATORIOS en V3

| Campo V3 | Tipo | Descripción |
|:---------|:-----|:------------|
| `persona_tipo` | Enum | **REQUERIDO**. Valores: `'FISICA'`, `'JURIDICA'` |
| `nomenclador_fiscal` | Enum | **REQUERIDO**. Valores: `'CF'`, `'RI'`, `'MONOTRIBUTO'` |
| `identificador_fiscal` | String | **REQUERIDO**. CUIT/CUIL (único) |
| `nombre_razon_social` | String | **REQUERIDO**. Nombre completo o razón social |
| `direccion_fiscal` | Object | **REQUERIDO**. Ver estructura abajo |

### 📝 Campos Opcionales en V3

| Campo V3 | Tipo | Descripción |
|:---------|:-----|:------------|
| `rol` | Array | Roles del agente (ej: `['PROVEEDOR']`) |
| `nombres` | String | Nombres (opcional) |
| `apellidos` | String | Apellidos (opcional) |
| `email_principal` | String | Email principal |
| `telefonos` | Array | Array de objetos `{numero, tipo}` |
| `direccion_real` | Object | Dirección real (estructura compleja) |
| `cuentas_bancarias` | Array | Array de objetos con CBU, banco, etc. |
| `documento_tipo` | Enum | `'DNI'`, `'LE'`, `'LC'`, `'PASAPORTE'` |
| `documento_numero` | String | Número de documento |
| `genero` | Enum | `'MASCULINO'`, `'FEMENINO'`, `'PERSONA_JURIDICA'` |

---

## 🚨 Problemas Identificados

### 1. ❌ Campos OBLIGATORIOS Faltantes en Legacy

Legacy **NO tiene** los siguientes campos obligatorios de V3:

- ❌ `persona_tipo` (FISICA/JURIDICA)
- ❌ `nomenclador_fiscal` (CF/RI/MONOTRIBUTO)
- ❌ `identificador_fiscal` (CUIT/CUIL)
- ❌ `direccion_fiscal` (objeto complejo con provincia_id, localidad_id)

**Impacto:** No se puede insertar en V3 sin estos datos.

### 2. ⚠️ Estructura de Teléfonos Incompatible

**Legacy:**
```javascript
phone: [{ number: "2804623526" }]
```

**V3 requiere:**
```javascript
telefonos: [
  { numero: "2804623526", tipo: "MOVIL" }  // tipo es OBLIGATORIO
]
```

### 3. ⚠️ Estructura de Dirección Incompatible

**Legacy:**
```javascript
address: "Calle Falsa 123, Ciudad"  // String simple
```

**V3 requiere:**
```javascript
direccion_fiscal: {
  calle: "Calle Falsa",
  numero: "123",
  provincia_id: ObjectId("..."),  // OBLIGATORIO
  localidad_id: ObjectId("..."),  // OBLIGATORIO
  codigo_postal: "8300",
  latitud: -38.9516,
  longitud: -68.0591
}
```

### 4. ⚠️ Mapeo de Roles (agentType → rol)

**Legacy:**
```javascript
agentType: "Proveedor"  // String simple
```

**V3:**
```javascript
rol: ["PROVEEDOR"]  // Array de enums
```

**Tabla de conversión necesaria:**
| Legacy `agentType` | V3 `rol` |
|:-------------------|:---------|
| "Proveedor" | `["PROVEEDOR"]` |
| "Cliente" | `["CLIENTE"]` |
| "Locador" / "Propietario" | `["LOCADOR"]` |
| "Locatario" / "Inquilino" | `["LOCATARIO"]` |
| "Fiador" / "Garante" | `["FIADOR"]` |
| *Desconocido* | `[]` (vacío) |

### 5. ⚠️ Cuentas Bancarias

**Legacy:** Estructura desconocida (requiere inspección)
**V3 requiere:**
```javascript
cuentas_bancarias: [{
  cbu_alias: string,
  cbu_numero: string,      // OBLIGATORIO
  bank_id: ObjectId,       // OBLIGATORIO (ref a Bank)
  moneda: string,          // OBLIGATORIO
  cbu_tipo: string         // OBLIGATORIO ("Cuenta Corriente", "Caja de Ahorro")
}]
```

---

## 💡 Estrategias Propuestas

### Opción 1: Migración con Valores por Defecto (RECOMENDADA para testing)

Usar valores por defecto temporales para campos obligatorios faltantes:

```typescript
{
  persona_tipo: "FISICA",                    // Por defecto
  nomenclador_fiscal: "CF",                  // Por defecto
  identificador_fiscal: `LEGACY-${_id}`,     // Generar único
  direccion_fiscal: {                        // Dirección mínima
    // Dejar campos opcionales vacíos
    // PROBLEMA: provincia_id y localidad_id son OBLIGATORIOS
  }
}
```

**⚠️ PROBLEMA:** `direccion_fiscal.provincia_id` y `localidad_id` son OBLIGATORIOS pero Legacy no los tiene.

### Opción 2: Modificar Schema V3 (Temporal)

Hacer opcionales los campos `direccion_fiscal.provincia_id` y `localidad_id` temporalmente durante la migración.

### Opción 3: Crear Provincia/Localidad "por defecto"

Crear registros "Desconocido" en las colecciones `Province` y `Locality`:
- `provincia_id` → ID de provincia "Desconocida"
- `localidad_id` → ID de localidad "Desconocida"

### Opción 4: No migrar campos complejos

Migrar solo con los campos mínimos y dejar que se completen manualmente después:

```typescript
{
  persona_tipo: "FISICA",
  nomenclador_fiscal: "CF",
  identificador_fiscal: `TEMP-${_id}`,
  nombre_razon_social: `${name} ${lastName}`,
  nombres: name,
  apellidos: lastName,
  email_principal: email,
  telefonos: phone.map(p => ({ numero: p.number, tipo: "MOVIL" })),
  rol: mapAgentType(agentType),
  // NO migrar direccion_fiscal (saltará error de validación)
  // NO migrar cuentas_bancarias
}
```

**⚠️ Esto fallará** porque `direccion_fiscal` es obligatorio.

---

## 🎯 Recomendación Final

**No se puede proceder con la migración** hasta decidir:

1. **¿Cómo obtener CUIT/CUIL?**
   - ¿Generar temporales?
   - ¿Usar DNI si existe?
   - ¿Dejar en blanco y completar después?

2. **¿Cómo manejar direccion_fiscal obligatoria?**
   - ¿Crear provincia/localidad "Desconocida"?
   - ¿Modificar schema V3 para hacerla opcional?
   - ¿Parsear el string de address y mapear a provincias/localidades existentes?

3. **¿Migrar cuentas bancarias?**
   - ¿Cuál es la estructura en Legacy?
   - ¿Se puede ignorar y completar después?

4. **¿Validar agentType?**
   - ¿Existen otros valores además de "Proveedor", "Cliente", etc.?
   - ¿Cómo mapear valores desconocidos?

---

## 📝 Próximos Pasos

**ANTES de continuar con la migración:**

- [ ] **Decisión 1:** Estrategia para campos obligatorios faltantes
- [ ] **Decisión 2:** Crear registros de provincia/localidad "por defecto" o modificar schema
- [ ] **Decisión 3:** Inspeccionar estructura de `bankAccount` en Legacy
- [ ] **Decisión 4:** Verificar todos los valores de `agentType` en Legacy
- [ ] **Decisión 5:** Ajustar script de migración según decisiones tomadas
