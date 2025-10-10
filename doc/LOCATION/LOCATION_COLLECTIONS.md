# Manual de Uso del Frontend - Módulo Location (Localidades y Provincias)

Este manual describe cómo consumir el módulo `location` desde el frontend, incluyendo la obtención de provincias y localidades, y su integración con los módulos Party y Properties para la gestión de direcciones.

## 🎯 Colecciones Relacionadas

- **province**: Provincias disponibles.
- **locality**: Localidades (ciudades/pueblos), cada una asociada a una provincia.
- **party**: Personas/propietarios, cada uno puede tener dirección, localidad y provincia.
- **property**: Propiedades, cada una debe tener dirección, localidad y provincia.

---

## 📝 Casos de Uso Principales

1. **Listar provincias y localidades para formularios**
2. **Seleccionar provincia y filtrar localidades asociadas**
3. **Guardar dirección completa en Party o Property**
4. **Mostrar dirección legible en vistas y listados**

---

## 🎯 Endpoints Principales

### Listar Provincias

```
GET /api/v1/location/provinces
```

**Respuesta:**

```json
[
  { "id": "1", "name": "Buenos Aires" },
  { "id": "2", "name": "Córdoba" },
  ...
]
```

### Buscar Provincias por Nombre

```
GET /api/v1/province/search?name=cordoba
```

**Descripción:** Devuelve todas las provincias cuyo nombre contenga el texto indicado (búsqueda insensible a mayúsculas/minúsculas).

**Respuesta:**

```json
[{"_id": "2", "name": "Córdoba"}]
```

### Buscar Localidades por Nombre y Provincia

```
GET /api/v1/locality/search?name=plata&provinceId=1
```

**Descripción:** Devuelve todas las localidades cuyo nombre contenga el texto indicado y que pertenezcan a la provincia especificada (búsqueda insensible a mayúsculas/minúsculas).

**Respuesta:**

```json
[
  {
    "_id": "10",
    "name": "La Plata",
    "provincia": {"_id": "1", "name": "Buenos Aires"}
  }
]
```

### Listar Localidades por Provincia

```
GET /api/v1/location/localities?provinceId={id}
```

**Respuesta:**

```json
[
  { "id": "10", "name": "La Plata", "provinceId": "1" },
  { "id": "11", "name": "Mar del Plata", "provinceId": "1" },
  ...
]
```

### Obtener Localidad por ID

```
GET /api/v1/location/localities/{id}
```

---

## 🔎 Obtener Provincia o Localidad por \_id (MongoID)

Para obtener una provincia o localidad por su `_id` (MongoID), utiliza los siguientes endpoints:

### Obtener Provincia por \_id

```
GET /api/v1/province/{id}
```

**Ejemplo:**

```
GET /api/v1/province/66a25a8e1f1570568e03e1d8
```

**Respuesta:**

```json
{"_id": "66a25a8e1f1570568e03e1d8", "iso_nombre": "Chubut"}
```

### Obtener Localidad por \_id

```
GET /api/v1/locality/{id}
```

**Ejemplo:**

```
GET /api/v1/locality/66a25b0d1f1570568e03e9c2
```

**Respuesta:**

```json
{
  "_id": "66a25b0d1f1570568e03e9c2",
  "nombre": "Rawson",
  "provincia": {"_id": "66a25a8e1f1570568e03e1d8", "iso_nombre": "Chubut"}
}
```

---

## 🔧 Ejemplo de Implementación (React + Axios)

### 1. Servicio API para Location

```javascript
// services/location.js
import api from './api';

export const getProvinces = async () => {
  const response = await api.get('/location/provinces');
  return response.data;
};

export const getLocalitiesByProvince = async (provinceId) => {
  const response = await api.get('/location/localities', {
    params: {provinceId},
  });
  return response.data;
};

export const getLocalityById = async (id) => {
  const response = await api.get(`/location/localities/${id}`);
  return response.data;
};

export const getProvinceById = async (id) => {
  const response = await api.get(`/location/provinces/${id}`);
  return response.data;
};
```

### 2. Formulario con Selección de Provincia y Localidad

```javascript
// components/AddressForm.js
import React, {useState, useEffect} from 'react';
import {getProvinces, getLocalitiesByProvince} from '../services/location';

const AddressForm = ({value, onChange}) => {
  const [provinces, setProvinces] = useState([]);
  const [localities, setLocalities] = useState([]);
  const [form, setForm] = useState({
    address: '',
    provinceId: '',
    localityId: '',
  });

  useEffect(() => {
    getProvinces().then(setProvinces);
  }, []);

  useEffect(() => {
    if (form.provinceId) {
      getLocalitiesByProvince(form.provinceId).then(setLocalities);
    } else {
      setLocalities([]);
    }
  }, [form.provinceId]);

  const handleChange = (e) => {
    const {name, value} = e.target;
    setForm((prev) => ({...prev, [name]: value}));
    if (name === 'provinceId') {
      setForm((prev) => ({...prev, localityId: ''}));
    }
    onChange && onChange({...form, [name]: value});
  };

  return (
    <div>
      <input name='address' value={form.address} onChange={handleChange} placeholder='Dirección' required />
      <select name='provinceId' value={form.provinceId} onChange={handleChange} required>
        <option value=''>Seleccionar provincia</option>
        {provinces.map((prov) => (
          <option key={prov.id} value={prov.id}>
            {prov.name}
          </option>
        ))}
      </select>
      <select name='localityId' value={form.localityId} onChange={handleChange} required disabled={!form.provinceId}>
        <option value=''>Seleccionar localidad</option>
        {localities.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AddressForm;
```

### 3. Uso en Formularios de Party y Property

```javascript
// Ejemplo de integración
<AddressForm value={addressData} onChange={setAddressData} />
// Al guardar, enviar address, localityId y provinceId al backend
```

### 4. Servicio API para obtener provincia y localidad por \_id

> **Endpoint para obtener provincia por \_id:**
>
> ```
> GET /api/v1/location/provinces/{id}
> ```
>
> **Endpoint para obtener localidad por \_id:**
>
> ```
> GET /api/v1/location/localities/{id}
> ```

```javascript
// services/location.js
import api from './api';

export const getProvinceById = async (id) => {
  const response = await api.get(`/location/provinces/${id}`);
  return response.data;
};

export const getLocalityById = async (id) => {
  const response = await api.get(`/location/localities/${id}`);
  return response.data;
};
```

### 5. Ejemplo de uso en un componente React

```javascript
import React, {useEffect, useState} from 'react';
import {getProvinceById, getLocalityById} from '../services/location';

const LocationInfo = ({provinceId, localityId}) => {
  const [province, setProvince] = useState(null);
  const [locality, setLocality] = useState(null);

  useEffect(() => {
    if (provinceId) {
      getProvinceById(provinceId).then(setProvince);
    }
    if (localityId) {
      getLocalityById(localityId).then(setLocality);
    }
  }, [provinceId, localityId]);

  return (
    <div>
      <div>Provincia: {province ? province.name : 'Cargando...'}</div>
      <div>Localidad: {locality ? locality.name : 'Cargando...'}</div>
    </div>
  );
};

export default LocationInfo;
```

---

## 🚀 Buenas Prácticas

- Cargar provincias al montar el formulario.
- Cargar localidades solo cuando se seleccione una provincia.
- Validar que se seleccione provincia y localidad antes de guardar.
- Mostrar la dirección completa en vistas y listados.

---

## 🔍 Testing

```javascript
// __tests__/AddressForm.test.js
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import AddressForm from '../AddressForm';

test('debe mostrar provincias y filtrar localidades', async () => {
  // Mock de getProvinces y getLocalitiesByProvince aquí...
});
```

---

## 🎯 Consideraciones Importantes

### Seguridad

- El backend valida la existencia de provincia y localidad.

### UX/UI

- Deshabilita el select de localidad hasta que se seleccione provincia.
- Muestra mensajes claros si no hay localidades para una provincia.

### Accesibilidad

- Usa labels y selects accesibles.

¿Necesitas ejemplos para otros casos o integración avanzada?
