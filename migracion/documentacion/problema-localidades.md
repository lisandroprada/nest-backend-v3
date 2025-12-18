# Problema: Mapeo de Localidades Legacy → V3

## 🚨 Situación Actual

**Problema identificado:** Los IDs de localidades en Legacy **NO coinciden** con los IDs en V3.

### Ejemplo del Problema

**Legacy (city.id):**
```javascript
city: {
  id: "260112",
  nombre: "Rawson"
}
```

**V3 (localities):**
```javascript
{
  id: Long("2602103001"),  // ID DIFERENTE!
  nombre: "Acceso Norte",
  provincia: { id: 26, nombre: "Chubut" }
}
```

**Resultado:** El lookup `localityMap.get("260112")` retorna `undefined` → **0 agentes migrados** (todos omitidos).

---

## 💡 Opciones de Solución

### Opción 1: Usar Localidad Capital por Defecto ⭐ RECOMENDADA

Para cada provincia, usar su localidad capital como predeterminada.

**Pros:**
- Simple de implementar
- Garantiza que todos los agentes tengan una localidad válida
- Geográficamente razonable (la mayoría de agentes están en capitales)

**Contras:**
- Pierde precisión geográfica
- Necesita identificar la capital de cada provincia

**Implementación:**
```typescript
// Crear mapa provincia_id → localidad_capital_id
const defaultLocalityByProvince = {
  26: ObjectId("..."),  // Rawson para Chubut
  // ... resto provincias
};
```

---

### Opción 2: Mapeo por Nombre (Fuzzy Match)

Buscar localidades en V3 que coincidan con el nombre de Legacy.

**Pros:**
- Más preciso geográficamente
- Usa datos existentes de Legacy

**Contras:**
- Nombres pueden variar ("Rawson" vs "Ciudad de Rawson")
- Puede haber duplicados
- Más lento (requiere búsquedas)

**Implementación:**
```typescript
const locality= await v3Db.collection('localities').findOne({
  'nombre': { $regex: legacyCity.nombre, $options: 'i' },
  'provincia.id': legacyState.id
});
```

---

### Opción 3: Hacer `direccion_fiscal` Opcional Temporalmente

Modificar el schema V3 para permitir migración sin dirección.

**Pros:**
- Permite migrar todos los agentes
- Se pueden completar direcciones después

**Contras:**
- Requiere cambio en schema V3
- Los agentes sin dirección fiscal pueden causar problemas en otras partes del sistema

---

### Opción 4: Crear Tabla de Conversión Manual

Mapear manualmente los IDs más comunes.

**Ejemplo:**
```javascript
const LEGACY_TO_V3_LOCALITY = {
  "260112": "66a25b0d1f1570568e03ee76",  // Rawson
  "260098": "...",
  // ... resto
};
```

**Pros:**
- Mapeo preciso y controlado

**Contras:**
- Requiere trabajo manual
- Solo funciona para localidades conocidas

---

## 📊 Análisis de la Migración Previa

Mirando el agente migrado previamente que compartiste:
```javascript
"localidad_id": { "$oid": "66a25b0d1f1570568e03ee76" }
"_legacyLocationIds": {
  "city": { "id": "260112", "nombre": "Rawson" }
}
```

**Esto indica que la migración previa usó algún mapeo**. ¿Existe una tabla de conversión o script de la migración anterior?

---

## 🎯 Recomendación

**Combinación de Opción 1 + Opción 2:**

1. **Intentar mapeo por nombre** primero (Opción 2)
2. **Si falla, usar localidad capital** (Opción 1)
3. **Si no hay localidades para esa provincia, crear una "Desconocida"**

**Implementación sugerida:**
```typescript
async function findLocalityId(
  legacyState: {id: string, nombre: string},
  legacyCity: {id: string, nombre: string},
  v3Db: Db
): Promise<ObjectId | null> {
  const provinceId = parseInt(legacyState.id);
  
  // 1. Intentar por nombre
  if (legacyCity) {
    const locality = await v3Db.collection('localities').findOne({
      'nombre': { $regex: `^${legacyCity.nombre}`, $options: 'i' },
      'provincia.id': provinceId
    });
    if (locality) return locality._id;
  }
  
  // 2. Usar capital provincial (Rawson para Chubut)
  const defaultLocality = await v3Db.collection('localities').findOne({
    'provincia.id': provinceId,
    'categoria': 'Ciudad',  // o filtro similar para capitales
  }).sort({ 'nombre': 1 }).limit(1);
  
  return defaultLocality?._id || null;
}
```

---

## ❓ Decisión Requerida

**¿Qué estrategia prefieres usar?**

1. ⭐ Mapeo por nombre + capital por defecto (RECOMENDADO)
2. Solo capital por defecto (más rápido)
3. Hacer direccion_fiscal opcional
4. ¿Existe tabla de conversión de la migración anterior?
