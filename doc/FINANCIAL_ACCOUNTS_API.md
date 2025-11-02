# API de Cuentas Financieras - Documentación Completa

Este documento detalla la API para la gestión de cuentas financieras (bancos, cajas chicas), incluyendo sus endpoints, DTOs, esquema de datos y ejemplos de uso para el frontend.

---

## 1. Esquema de la Entidad `FinancialAccount`

La entidad `FinancialAccount` representa una cuenta bancaria o una caja chica dentro del sistema.

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class FinancialAccount extends Document {
  @Prop({ type: String, required: true, index: true })
  nombre: string; // Nombre de la cuenta (ej: "Caja Principal", "Banco Santander Cta Cte")

  @Prop({
    type: String,
    required: true,
    enum: ['BANCO', 'CAJA_CHICA'],
    index: true,
  })
  tipo: string; // Tipo de cuenta: BANCO o CAJA_CHICA

  @Prop({ type: String, required: true, default: 'ARS' })
  moneda: string; // Moneda de la cuenta (ej: 'ARS', 'USD')

  @Prop({ type: String })
  descripcion?: string; // Descripción opcional de la cuenta

  @Prop({ type: Number, default: 0 })
  saldo_inicial: number; // Saldo actual de la cuenta

  @Prop({ type: String, enum: ['ACTIVA', 'INACTIVA'], default: 'ACTIVA' })
  status: string; // Estado de la cuenta: ACTIVA o INACTIVA

  // Detalles específicos para cuentas bancarias
  @Prop({ type: String, sparse: true })
  cbu?: string; // Clave Bancaria Uniforme (CBU)

  @Prop({ type: String, sparse: true })
  alias?: string; // Alias CBU

  @Prop({ type: String, sparse: true })
  nombre_banco?: string; // Nombre de la entidad bancaria

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_creacion_id: Types.ObjectId; // ID del usuario que creó la cuenta

  @Prop({ type: Types.ObjectId, ref: 'User' })
  usuario_modificacion_id: Types.ObjectId; // ID del último usuario que modificó la cuenta
}

export const FinancialAccountSchema =
  SchemaFactory.createForClass(FinancialAccount);
```

---

## 2. Data Transfer Objects (DTOs)

### `CreateFinancialAccountDto`

Utilizado para crear nuevas cuentas financieras.

```typescript
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class CreateFinancialAccountDto {
  @IsString()
  @IsNotEmpty()
  nombre: string; // Nombre de la cuenta

  @IsEnum(['BANCO', 'CAJA_CHICA'])
  @IsNotEmpty()
  tipo: string; // Tipo de cuenta: BANCO o CAJA_CHICA

  @IsString()
  @IsOptional()
  moneda: string = 'ARS'; // Moneda de la cuenta (default: 'ARS')

  @IsString()
  @IsOptional()
  descripcion?: string; // Descripción opcional

  @IsNumber()
  @IsOptional()
  saldo_inicial?: number; // Saldo inicial (default: 0)

  @IsEnum(['ACTIVA', 'INACTIVA'])
  @IsOptional()
  status?: string; // Estado de la cuenta (default: 'ACTIVA')

  @IsString()
  @IsOptional()
  cbu?: string; // CBU (solo para tipo BANCO)

  @IsString()
  @IsOptional()
  alias?: string; // Alias CBU (solo para tipo BANCO)

  @IsString()
  @IsOptional()
  nombre_banco?: string; // Nombre del banco (solo para tipo BANCO)
}
```

### `UpdateFinancialAccountDto`

Utilizado para actualizar cuentas financieras existentes. Hereda de `PartialType(CreateFinancialAccountDto)`, lo que significa que todos sus campos son opcionales.

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateFinancialAccountDto } from './create-financial-account.dto';

export class UpdateFinancialAccountDto extends PartialType(
  CreateFinancialAccountDto,
) {}
```

---

## 3. Endpoints de la API

**Base URL:** `/financial-accounts`

Todos los endpoints requieren autenticación JWT.

| Método   | Ruta                | Descripción                                  | Roles Requeridos                     |
| :------- | :------------------ | :------------------------------------------- | :----------------------------------- |
| `POST`   | `/`                 | Crea una nueva cuenta financiera.            | `admin`, `superUser`, `contabilidad` |
| `GET`    | `/`                 | Lista todas las cuentas financieras.         | `admin`, `superUser`, `contabilidad` |
| `GET`    | `/:id`              | Obtiene los detalles de una cuenta específica.| `admin`, `superUser`, `contabilidad` |
| `PATCH`  | `/:id`              | Actualiza parcialmente una cuenta existente. | `admin`, `superUser`, `contabilidad` |
| `DELETE` | `/:id`              | Elimina una cuenta financiera.               | `admin`, `superUser`                 |

### 3.1. `POST /financial-accounts` - Crear Cuenta Financiera

Crea una nueva cuenta financiera (banco o caja chica).

*   **Request Body:** `CreateFinancialAccountDto`
*   **Ejemplo de Request:**
    ```json
    {
      "nombre": "Caja Principal",
      "tipo": "CAJA_CHICA",
      "moneda": "ARS",
      "descripcion": "Efectivo para gastos menores",
      "saldo_inicial": 50000,
      "status": "ACTIVA"
    }
    ```
    ```json
    {
      "nombre": "Banco Galicia Cta Cte",
      "tipo": "BANCO",
      "moneda": "ARS",
      "descripcion": "Cuenta corriente para operaciones principales",
      "saldo_inicial": 1500000,
      "cbu": "0070000030000000000000",
      "alias": "BANCO.GALICIA.ALIAS",
      "nombre_banco": "Banco Galicia"
    }
    ```
*   **Ejemplo de Respuesta (201 Created):**
    ```json
    {
      "_id": "653b...f",
      "nombre": "Caja Principal",
      "tipo": "CAJA_CHICA",
      "moneda": "ARS",
      "descripcion": "Efectivo para gastos menores",
      "saldo_inicial": 50000,
      "status": "ACTIVA",
      "createdAt": "2025-10-27T12:00:00.000Z",
      "updatedAt": "2025-10-27T12:00:00.000Z"
    }
    ```

### 3.2. `GET /financial-accounts` - Listar Cuentas Financieras

Obtiene una lista de todas las cuentas financieras.

*   **Ejemplo de Request:** `GET /financial-accounts`
*   **Ejemplo de Respuesta (200 OK):**
    ```json
    [
      {
        "_id": "653b...f",
        "nombre": "Caja Principal",
        "tipo": "CAJA_CHICA",
        "moneda": "ARS",
        "saldo_inicial": 50000,
        "status": "ACTIVA"
      },
      {
        "_id": "653c...a",
        "nombre": "Banco Galicia Cta Cte",
        "tipo": "BANCO",
        "moneda": "ARS",
        "saldo_inicial": 1500000,
        "status": "ACTIVA",
        "cbu": "0070000030000000000000"
      }
    ]
    ```

### 3.3. `GET /financial-accounts/:id` - Obtener Cuenta por ID

Obtiene los detalles de una cuenta financiera específica.

*   **Parámetros de Ruta:** `id` (string, ObjectId de la cuenta)
*   **Ejemplo de Request:** `GET /financial-accounts/653b...f`
*   **Ejemplo de Respuesta (200 OK):**
    ```json
    {
      "_id": "653b...f",
      "nombre": "Caja Principal",
      "tipo": "CAJA_CHICA",
      "moneda": "ARS",
      "descripcion": "Efectivo para gastos menores",
      "saldo_inicial": 50000,
      "status": "ACTIVA",
      "createdAt": "2025-10-27T12:00:00.000Z",
      "updatedAt": "2025-10-27T12:00:00.000Z"
    }
    ```

### 3.4. `PATCH /financial-accounts/:id` - Actualizar Cuenta Financiera

Actualiza parcialmente una cuenta financiera existente.

*   **Parámetros de Ruta:** `id` (string, ObjectId de la cuenta)
*   **Request Body:** `UpdateFinancialAccountDto` (solo los campos a modificar)
*   **Ejemplo de Request:**
    ```json
    {
      "descripcion": "Caja para gastos operativos diarios",
      "status": "INACTIVA"
    }
    ```
*   **Ejemplo de Respuesta (200 OK):**
    ```json
    {
      "_id": "653b...f",
      "nombre": "Caja Principal",
      "tipo": "CAJA_CHICA",
      "moneda": "ARS",
      "descripcion": "Caja para gastos operativos diarios",
      "saldo_inicial": 50000,
      "status": "INACTIVA",
      "createdAt": "2025-10-27T12:00:00.000Z",
      "updatedAt": "2025-10-27T12:30:00.000Z"
    }
    ```

### 3.5. `DELETE /financial-accounts/:id` - Eliminar Cuenta Financiera

Elimina una cuenta financiera.

*   **Parámetros de Ruta:** `id` (string, ObjectId de la cuenta)
*   **Ejemplo de Request:** `DELETE /financial-accounts/653b...f`
*   **Ejemplo de Respuesta (200 OK):**
    ```json
    {
      "deleted": true
    }
    ```

---

## 4. Ejemplos de Uso para el Frontend

### 4.1. Listar Cuentas Financieras en un Selector

```typescript
// services/financialAccounts.ts
import axios from 'axios'; // Asumiendo que usas axios

const API_BASE_URL = 'http://localhost:3000/financial-accounts'; // Ajusta tu base URL
const getToken = () => localStorage.getItem('access_token'); // Función para obtener el token JWT

export const getFinancialAccounts = async () => {
  try {
    const response = await axios.get(API_BASE_URL, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener cuentas financieras:', error);
    throw error;
  }
};

// Componente React/Angular/Vue
import React, { useEffect, useState } from 'react';
import { getFinancialAccounts } from './services/financialAccounts';

function FinancialAccountSelector({ onSelectAccount }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await getFinancialAccounts();
        setAccounts(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  if (loading) return <div>Cargando cuentas...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <select onChange={(e) => onSelectAccount(e.target.value)}>
      <option value="">Seleccione una cuenta</option>
      {accounts.map((account) => (
        <option key={account._id} value={account._id}>
          {account.nombre} ({account.tipo}) - Saldo: {account.saldo_inicial} {account.moneda}
        </option>
      ))}
    </select>
  );
}
```

### 4.2. Crear una Nueva Cuenta Bancaria

```typescript
// services/financialAccounts.ts (continuación)
export const createFinancialAccount = async (accountData) => {
  try {
    const response = await axios.post(API_BASE_URL, accountData, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error al crear cuenta financiera:', error);
    throw error;
  }
};

// Componente React/Angular/Vue
import React, { useState } from 'react';
import { createFinancialAccount } from './services/financialAccounts';

function CreateBankAccountForm() {
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'BANCO',
    moneda: 'ARS',
    descripcion: '',
    saldo_inicial: 0,
    cbu: '',
    alias: '',
    nombre_banco: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const newAccount = await createFinancialAccount(formData);
      alert(`Cuenta ${newAccount.nombre} creada con éxito!`);
      // Limpiar formulario o redirigir
    } catch (error) {
      alert('Error al crear la cuenta.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre de la cuenta" required />
      <input name="cbu" value={formData.cbu} onChange={handleChange} placeholder="CBU" />
      <input name="alias" value={formData.alias} onChange={handleChange} placeholder="Alias CBU" />
      <input name="nombre_banco" value={formData.nombre_banco} onChange={handleChange} placeholder="Nombre del Banco" />
      <input name="saldo_inicial" type="number" value={formData.saldo_inicial} onChange={handleChange} placeholder="Saldo Inicial" />
      <button type="submit">Crear Cuenta Bancaria</button>
    </form>
  );
}
```

---

## 5. Consideraciones de Seguridad y Roles

*   **Autenticación:** Todos los endpoints requieren un JWT válido.
*   **Autorización:**
    *   `admin`, `superUser`, `contabilidad` tienen acceso completo de lectura (`GET`).
    *   `admin`, `superUser`, `contabilidad` pueden crear (`POST`) y actualizar (`PATCH`).
    *   Solo `admin` y `superUser` pueden eliminar (`DELETE`) cuentas financieras.
*   **Validación:** El backend realiza validaciones estrictas de los datos de entrada utilizando `class-validator` y `class-transformer`.

---

## 6. Notas Adicionales

*   El campo `saldo_inicial` se actualiza automáticamente por el backend cuando se registran transacciones o recibos asociados a la cuenta. No debe ser modificado directamente por el frontend, excepto en la creación inicial.
*   Los campos `cbu`, `alias` y `nombre_banco` son relevantes solo cuando `tipo` es `'BANCO'`. El frontend debería adaptar su UI para mostrar/ocultar estos campos según el tipo seleccionado.
*   El `ParseMongoIdPipe` se utiliza en el backend para validar que los IDs de ruta sean ObjectIds válidos de MongoDB.

---

**Fecha:** 2025-10-27
**Autor:** Gemini Agent
**Versión:** 1.0
