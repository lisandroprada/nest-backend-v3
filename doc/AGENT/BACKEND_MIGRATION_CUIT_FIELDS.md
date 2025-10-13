# 🔧 Migración Backend: Agregar Campos de Validación CUIT

**Fecha:** 12 de Octubre, 2025  
**Tipo:** Schema Update - Agregar campos cuit_validado y cuit_validado_fecha  
**Prioridad:** 🔴 ALTA - Funcionalidad bloqueada

---

## 📋 Problema

Los campos `cuit_validado` y `cuit_validado_fecha` **NO existen en el schema del backend**.

### Evidencia

**Frontend enviando:**

```json
{
  "identificador_fiscal": "20-25407911-2",
  "cuit_validado": true,
  "cuit_validado_fecha": "2025-10-12T14:30:00.000Z"
}
```

**Backend probablemente ignorando estos campos** porque no están definidos en el schema de Mongoose.

---

## ✅ Solución: Actualizar Schema de Agent

### 1. Ubicar el Schema de Agent

**Archivo típico:** `src/agents/schemas/agent.schema.ts` o similar

### 2. Agregar Campos al Schema

```typescript
import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Document} from 'mongoose';

@Schema({timestamps: true})
export class Agent extends Document {
  // ... campos existentes ...

  @Prop({required: true})
  identificador_fiscal: string;

  // ✅ AGREGAR ESTOS CAMPOS
  @Prop({type: Boolean, default: false})
  cuit_validado: boolean;

  @Prop({type: Date, default: null})
  cuit_validado_fecha: Date;

  // ... resto de campos ...
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
```

### 3. Actualizar DTO de Creación

**Archivo típico:** `src/agents/dto/create-agent.dto.ts`

```typescript
import {IsBoolean, IsOptional, IsDateString} from 'class-validator';

export class CreateAgentDto {
  // ... campos existentes ...

  @IsOptional()
  identificador_fiscal?: string;

  // ✅ AGREGAR ESTOS CAMPOS
  @IsOptional()
  @IsBoolean()
  cuit_validado?: boolean;

  @IsOptional()
  @IsDateString()
  cuit_validado_fecha?: string;

  // ... resto de campos ...
}
```

### 4. Actualizar DTO de Actualización

**Archivo típico:** `src/agents/dto/update-agent.dto.ts`

```typescript
import {PartialType} from '@nestjs/mapped-types';
import {CreateAgentDto} from './create-agent.dto';

// Si usa PartialType, automáticamente incluirá los nuevos campos
export class UpdateAgentDto extends PartialType(CreateAgentDto) {}
```

### 5. Verificar Respuesta del Endpoint

Asegurarse que el endpoint `PATCH /agents/:id` devuelve estos campos:

```typescript
// En el controller o service
async update(id: string, updateAgentDto: UpdateAgentDto): Promise<Agent> {
  const updatedAgent = await this.agentModel
    .findByIdAndUpdate(id, updateAgentDto, { new: true }) // ⚠️ { new: true } es crucial
    .exec();

  return updatedAgent; // Debe incluir cuit_validado y cuit_validado_fecha
}
```

---

## 🧪 Testing de la Migración

### Test 1: Crear Agente con CUIT Validado

```bash
curl -X POST http://localhost:3050/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "nombre_razon_social": "Test Agente",
    "identificador_fiscal": "20-25407911-2",
    "cuit_validado": true,
    "cuit_validado_fecha": "2025-10-12T14:30:00.000Z",
    "rol": "CLIENTE"
  }' | jq '{_id, nombre_razon_social, identificador_fiscal, cuit_validado, cuit_validado_fecha}'
```

**Resultado esperado:**

```json
{
  "_id": "6703a1b2c3d4e5f6g7h8i9j0",
  "nombre_razon_social": "Test Agente",
  "identificador_fiscal": "20-25407911-2",
  "cuit_validado": true,
  "cuit_validado_fecha": "2025-10-12T14:30:00.000Z"
}
```

### Test 2: Actualizar CUIT Validado

```bash
AGENT_ID="<ID_DE_AGENTE_EXISTENTE>"

curl -X PATCH http://localhost:3050/api/v1/agents/$AGENT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "cuit_validado": true,
    "cuit_validado_fecha": "2025-10-12T15:00:00.000Z"
  }' | jq '{_id, cuit_validado, cuit_validado_fecha}'
```

**Resultado esperado:**

```json
{
  "_id": "6703a1b2c3d4e5f6g7h8i9j0",
  "cuit_validado": true,
  "cuit_validado_fecha": "2025-10-12T15:00:00.000Z"
}
```

### Test 3: Verificar en Lista

```bash
curl -s http://localhost:3050/api/v1/agents?page=0&pageSize=5 | \
  jq '.items[] | {_id, nombre_razon_social, cuit_validado, cuit_validado_fecha}'
```

**Resultado esperado:**

```json
{
  "_id": "6703a1b2c3d4e5f6g7h8i9j0",
  "nombre_razon_social": "PRADA TOLEDO LISANDRO EMANUEL",
  "cuit_validado": true,
  "cuit_validado_fecha": "2025-10-12T15:00:00.000Z"
}
```

---

## 🗄️ Migración de Datos Existentes

Si ya tienes agentes en la base de datos, ejecuta esta migración:

```javascript
// migrations/add-cuit-validado-fields.js
db.agents.updateMany(
  {},
  {
    $set: {
      cuit_validado: false,
      cuit_validado_fecha: null,
    },
  }
);

// Verificar
db.agents.find({}, {nombre_razon_social: 1, cuit_validado: 1, cuit_validado_fecha: 1}).limit(5);
```

O con Mongoose:

```typescript
// src/migrations/add-cuit-validation-fields.ts
import {Injectable} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Model} from 'mongoose';
import {Agent} from '../agents/schemas/agent.schema';

@Injectable()
export class AddCuitValidationFieldsMigration {
  constructor(@InjectModel(Agent.name) private agentModel: Model<Agent>) {}

  async up() {
    await this.agentModel.updateMany(
      {cuit_validado: {$exists: false}},
      {
        $set: {
          cuit_validado: false,
          cuit_validado_fecha: null,
        },
      }
    );

    console.log('✅ Migración completada: campos cuit_validado agregados');
  }
}
```

---

## 📊 Índices Recomendados

Para optimizar consultas de agentes por estado de validación:

```typescript
// En agent.schema.ts
@Schema({timestamps: true})
export class Agent extends Document {
  // ... campos ...

  @Prop({type: Boolean, default: false, index: true}) // ✅ Agregar índice
  cuit_validado: boolean;

  @Prop({type: Date, default: null})
  cuit_validado_fecha: Date;
}
```

O crear índice manualmente:

```javascript
db.agents.createIndex({cuit_validado: 1});
```

---

## 🔍 Verificación de Implementación

### Checklist Backend

- [ ] Schema `Agent` incluye `cuit_validado: boolean`
- [ ] Schema `Agent` incluye `cuit_validado_fecha: Date`
- [ ] `CreateAgentDto` incluye ambos campos como opcionales
- [ ] `UpdateAgentDto` hereda de `PartialType(CreateAgentDto)`
- [ ] Endpoint POST `/agents` acepta estos campos
- [ ] Endpoint PATCH `/agents/:id` acepta estos campos
- [ ] Endpoint PATCH `/agents/:id` devuelve estos campos en la respuesta (`{ new: true }`)
- [ ] Endpoint GET `/agents` incluye estos campos en la respuesta
- [ ] Endpoint GET `/agents/:id` incluye estos campos en la respuesta
- [ ] Migración de datos existentes ejecutada
- [ ] Índice creado en `cuit_validado`

### Checklist Frontend

- [x] Tipo `Agent` incluye `cuit_validado?: boolean`
- [x] Tipo `Agent` incluye `cuit_validado_fecha?: string`
- [x] `CreateAgentDto` incluye ambos campos
- [x] `UpdateAgentDto` incluye ambos campos
- [x] `handleConsultCuit()` establece `cuit_validado: true`
- [x] `handleValidateCuit()` establece `cuit_validado: true`
- [x] `AgentDetail` envía estos campos en `updateDto`
- [x] `AgentsList` muestra indicadores visuales
- [x] Componente `EditableFiscalInfo` muestra estado de validación

---

## 🎯 Ejemplo Completo de Schema

```typescript
// src/agents/schemas/agent.schema.ts
import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Document} from 'mongoose';

export type AgentDocument = Agent & Document;

@Schema({timestamps: true})
export class Agent {
  @Prop({required: true})
  rol: string;

  @Prop()
  persona_tipo: string;

  @Prop()
  genero: string;

  @Prop()
  nomenclador_fiscal: string;

  @Prop()
  identificador_fiscal: string;

  // ✅ CAMPOS DE VALIDACIÓN CUIT
  @Prop({type: Boolean, default: false, index: true})
  cuit_validado: boolean;

  @Prop({type: Date, default: null})
  cuit_validado_fecha: Date;

  @Prop()
  nombre_razon_social: string;

  @Prop()
  nombres: string;

  @Prop()
  apellidos: string;

  @Prop()
  documento_tipo: string;

  @Prop()
  documento_numero: string;

  @Prop()
  email_principal: string;

  // ... resto de campos ...
}

export const AgentSchema = SchemaFactory.createForClass(Agent);

// Índices adicionales
AgentSchema.index({cuit_validado: 1});
AgentSchema.index({identificador_fiscal: 1});
```

---

## 🚨 Errores Comunes

### Error 1: Campos no se guardan

**Síntoma:** El PATCH funciona pero los campos vuelven a `undefined`

**Causa:** Schema no incluye los campos

**Solución:** Agregar `@Prop()` en el schema

### Error 2: Validación falla

**Síntoma:** `ValidationError: cuit_validado is not defined`

**Causa:** DTO tiene validación pero campo no es opcional

**Solución:** Agregar `@IsOptional()` en el DTO

### Error 3: Respuesta no incluye campos

**Síntoma:** Backend guarda pero GET no devuelve los campos

**Causa:** Projection o serialización excluye campos

**Solución:** Verificar `.select()`, `.lean()`, o decoradores de clase

### Error 4: Migración no actualiza registros

**Síntoma:** Agentes existentes no tienen los campos

**Causa:** Migración no ejecutada o condición incorrecta

**Solución:** Ejecutar migración con `{ cuit_validado: { $exists: false } }`

---

## 📞 Contacto

Si necesitas ayuda con la implementación del backend:

1. Compartir el schema actual de `Agent`
2. Compartir los DTOs actuales
3. Compartir logs del backend al hacer PATCH
4. Ejecutar tests de este documento y compartir resultados

---

**Creado por:** GitHub Copilot  
**Fecha:** 12 de Octubre, 2025  
**Para:** Backend Developer  
**Prioridad:** 🔴 ALTA - Bloquea funcionalidad de validación CUIT
