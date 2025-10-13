# 🔴 BREAKING CHANGES - Frontend Migration Required

**Fecha:** 12 de Octubre, 2025  
**Tipo:** Renombrado de campo  
**Prioridad:** 🔴 CRÍTICA - Cambio obligatorio

---

## 🎯 Cambio Requerido

El campo `cuit_validado_fecha` **NO EXISTE** en el backend.  
El backend usa `cuit_validado_en` para consistencia con el resto del sistema.

---

## ⚠️ Acción Requerida en Frontend

### 1. Actualizar Tipo `Agent`

**ANTES:**

```typescript
interface Agent {
  // ... otros campos
  cuit_validado?: boolean;
  cuit_validado_fecha?: string; // ❌ ELIMINAR
}
```

**DESPUÉS:**

```typescript
interface Agent {
  // ... otros campos
  cuit_validado?: boolean;
  cuit_validado_en?: string; // ✅ RENOMBRAR
  cuit_datos_afip?: {
    // ✅ NUEVO (opcional)
    nombre?: string;
    tipoPersona?: string;
    ganancias?: string;
    iva?: string;
  };
}
```

---

### 2. Actualizar `CreateAgentDto`

**ANTES:**

```typescript
interface CreateAgentDto {
  // ... otros campos
  cuit_validado?: boolean;
  cuit_validado_fecha?: string; // ❌ ELIMINAR
}
```

**DESPUÉS:**

```typescript
interface CreateAgentDto {
  // ... otros campos
  cuit_validado?: boolean;
  cuit_validado_en?: string; // ✅ RENOMBRAR
}
```

---

### 3. Actualizar `UpdateAgentDto`

**ANTES:**

```typescript
interface UpdateAgentDto {
  // ... otros campos
  cuit_validado?: boolean;
  cuit_validado_fecha?: string; // ❌ ELIMINAR
}
```

**DESPUÉS:**

```typescript
interface UpdateAgentDto {
  // ... otros campos
  cuit_validado?: boolean;
  cuit_validado_en?: string; // ✅ RENOMBRAR
}
```

---

### 4. Actualizar Función `handleConsultCuit()`

**ANTES:**

```typescript
const handleConsultCuit = async () => {
  // ... código de consulta

  const updateDto: UpdateAgentDto = {
    identificador_fiscal: cuitData.cuit,
    cuit_validado: true,
    cuit_validado_fecha: new Date().toISOString(), // ❌ CAMBIAR
  };

  // ... resto del código
};
```

**DESPUÉS:**

```typescript
const handleConsultCuit = async () => {
  // ... código de consulta

  const updateDto: UpdateAgentDto = {
    identificador_fiscal: cuitData.cuit,
    cuit_validado: true,
    cuit_validado_en: new Date().toISOString(), // ✅ RENOMBRAR
  };

  // ... resto del código
};
```

---

### 5. Actualizar Función `handleValidateCuit()`

**ANTES:**

```typescript
const handleValidateCuit = async () => {
  // ... código de validación

  const updateDto: UpdateAgentDto = {
    cuit_validado: true,
    cuit_validado_fecha: new Date().toISOString(), // ❌ CAMBIAR
  };

  // ... resto del código
};
```

**DESPUÉS:**

```typescript
const handleValidateCuit = async () => {
  // ... código de validación

  const updateDto: UpdateAgentDto = {
    cuit_validado: true,
    cuit_validado_en: new Date().toISOString(), // ✅ RENOMBRAR
  };

  // ... resto del código
};
```

---

### 6. Actualizar Componente `EditableFiscalInfo`

Buscar TODAS las referencias a `cuit_validado_fecha` y reemplazar por `cuit_validado_en`.

**Búsqueda global:**

```bash
# En tu proyecto frontend
grep -r "cuit_validado_fecha" src/
```

**Reemplazar todas las ocurrencias:**

- `cuit_validado_fecha` → `cuit_validado_en`

---

### 7. Actualizar Visualización de Fecha (si existe)

**ANTES:**

```tsx
{
  agent.cuit_validado_fecha && (
    <span>
      Validado: {new Date(agent.cuit_validado_fecha).toLocaleDateString()}
    </span>
  );
}
```

**DESPUÉS:**

```tsx
{
  agent.cuit_validado_en && (
    <span>
      Validado: {new Date(agent.cuit_validado_en).toLocaleDateString()}
    </span>
  );
}
```

---

## 🎁 BONUS: Datos AFIP Disponibles

El backend ahora también devuelve `cuit_datos_afip` con información oficial:

```typescript
// Ejemplo de uso
if (agent.cuit_datos_afip) {
  console.log('Nombre oficial:', agent.cuit_datos_afip.nombre);
  console.log('Tipo:', agent.cuit_datos_afip.tipoPersona);
  console.log('IVA:', agent.cuit_datos_afip.iva);
  console.log('Ganancias:', agent.cuit_datos_afip.ganancias);
}
```

**Componente sugerido:**

```tsx
function CuitValidationBadge({ agent }: { agent: Agent }) {
  if (!agent.cuit_validado) {
    return <Badge variant="warning">⚠ CUIT sin validar</Badge>;
  }

  return (
    <div>
      <Badge variant="success">✓ CUIT Validado</Badge>
      {agent.cuit_validado_en && (
        <small className="text-muted ms-2">
          {new Date(agent.cuit_validado_en).toLocaleDateString()}
        </small>
      )}
      {agent.cuit_datos_afip && (
        <Tooltip>
          <strong>{agent.cuit_datos_afip.nombre}</strong>
          <br />
          {agent.cuit_datos_afip.tipoPersona}
          <br />
          IVA: {agent.cuit_datos_afip.iva}
        </Tooltip>
      )}
    </div>
  );
}
```

---

## ✅ Checklist de Migración

- [ ] Actualizar tipo `Agent` interface
- [ ] Actualizar tipo `CreateAgentDto` interface
- [ ] Actualizar tipo `UpdateAgentDto` interface
- [ ] Buscar y reemplazar `cuit_validado_fecha` → `cuit_validado_en` en TODO el proyecto
- [ ] Actualizar `handleConsultCuit()` función
- [ ] Actualizar `handleValidateCuit()` función
- [ ] Actualizar componente `EditableFiscalInfo`
- [ ] Actualizar cualquier visualización de fecha
- [ ] (Opcional) Implementar componente para mostrar `cuit_datos_afip`
- [ ] Probar creación de agente con CUIT
- [ ] Probar validación de CUIT
- [ ] Probar actualización de agente

---

## 🚀 Comando de Búsqueda y Reemplazo (VS Code)

1. Presiona `Cmd+Shift+H` (Mac) o `Ctrl+Shift+H` (Windows/Linux)
2. En "Find": `cuit_validado_fecha`
3. En "Replace": `cuit_validado_en`
4. Revisa cada ocurrencia antes de reemplazar
5. Click "Replace All"

---

## 📞 Verificación

Después de los cambios, verifica que:

```bash
# 1. No queden referencias al campo antiguo
grep -r "cuit_validado_fecha" src/
# Resultado esperado: Sin coincidencias

# 2. Compilación exitosa
npm run build
# o
yarn build
```

---

**Fin del documento**
