# 🎯 Para el Desarrollador Frontend

## Cambio en 1 minuto

### ❌ ELIMINAR (campo incorrecto):

```typescript
cuit_validado_fecha;
```

### ✅ USAR (campo correcto):

```typescript
cuit_validado_en;
```

---

## Comando

**VS Code:**

```
Cmd+Shift+H
```

- Find: `cuit_validado_fecha`
- Replace: `cuit_validado_en`
- Click "Replace All"

**Verificar:**

```bash
grep -r "cuit_validado_fecha" src/
# Resultado esperado: nada
```

---

## Bonus (opcional)

Agregar a tu interface `Agent`:

```typescript
interface Agent {
  // ... campos existentes
  cuit_validado_en?: string;
  cuit_datos_afip?: {
    nombre?: string;
    tipoPersona?: string;
    ganancias?: string;
    iva?: string;
  };
}
```

---

## Ejemplos

### Antes (❌):

```typescript
agent.cuit_validado_fecha = new Date().toISOString();
```

### Después (✅):

```typescript
agent.cuit_validado_en = new Date().toISOString();
```

---

**Eso es todo.** Un simple renombrado de campo.
