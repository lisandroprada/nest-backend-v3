# 🧪 Scripts de Testing - Rescisión Anticipada

Scripts para probar la funcionalidad de rescisión anticipada de contratos.

---

## 📋 Scripts Disponibles

### 1. `test-rescision.sh`

Script de prueba completo para los endpoints de rescisión.

**Uso:**

```bash
./scripts/test-rescision.sh [CONTRACT_ID] [AUTH_TOKEN]
```

**Ejemplos:**

```bash
# Uso básico (requiere editar el script con tu token)
./scripts/test-rescision.sh 67af123456789abcdef01234

# Con token en línea de comandos
./scripts/test-rescision.sh 67af123456789abcdef01234 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Tests incluidos:**

1. **Test 1:** Calcular rescisión con penalidad (30 días preaviso)
2. **Test 2:** Calcular rescisión sin penalidad (100 días preaviso)
3. **Test 3:** Registrar rescisión (SKIP por defecto)
4. **Test 4:** Verificar datos del contrato

**Requisitos:**

- `curl` instalado
- `jq` instalado (para formatear JSON)
- Token de autenticación válido
- Servidor corriendo en `localhost:3000`

---

## 🔧 Instalación de Dependencias

### macOS

```bash
brew install jq
```

### Ubuntu/Debian

```bash
sudo apt-get install jq
```

### Windows (WSL)

```bash
sudo apt-get install jq
```

---

## 📝 Ejemplos de Uso Manual (cURL)

Si preferís probar manualmente con cURL:

### Calcular Rescisión

```bash
curl -X POST http://localhost:3000/contracts/67af123456789abcdef01234/calcular-rescision \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha_notificacion_rescision": "2026-10-06",
    "fecha_recision_efectiva": "2026-11-05"
  }' | jq '.'
```

### Registrar Rescisión

```bash
curl -X POST http://localhost:3000/contracts/67af123456789abcdef01234/registrar-rescision \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha_notificacion_rescision": "2026-10-06",
    "fecha_recision_anticipada": "2026-11-05",
    "penalidad_monto": 600000,
    "motivo": "Mudanza del inquilino"
  }' | jq '.'
```

---

## 🧪 Testing con Postman

### Collection: Rescisión Anticipada

Importá esta colección en Postman:

```json
{
  "info": {
    "name": "Rescisión Anticipada",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Calcular Rescisión",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "type": "text"
          },
          {
            "key": "Content-Type",
            "value": "application/json",
            "type": "text"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"fecha_notificacion_rescision\": \"2026-10-06\",\n  \"fecha_recision_efectiva\": \"2026-11-05\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/contracts/:id/calcular-rescision",
          "host": ["{{base_url}}"],
          "path": ["contracts", ":id", "calcular-rescision"],
          "variable": [
            {
              "key": "id",
              "value": "67af123456789abcdef01234"
            }
          ]
        }
      }
    },
    {
      "name": "Registrar Rescisión",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "type": "text"
          },
          {
            "key": "Content-Type",
            "value": "application/json",
            "type": "text"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"fecha_notificacion_rescision\": \"2026-10-06\",\n  \"fecha_recision_anticipada\": \"2026-11-05\",\n  \"penalidad_monto\": 600000,\n  \"motivo\": \"Mudanza del inquilino\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/contracts/:id/registrar-rescision",
          "host": ["{{base_url}}"],
          "path": ["contracts", ":id", "registrar-rescision"],
          "variable": [
            {
              "key": "id",
              "value": "67af123456789abcdef01234"
            }
          ]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    },
    {
      "key": "token",
      "value": "YOUR_TOKEN_HERE"
    }
  ]
}
```

---

## 🐛 Troubleshooting

### Error: "jq: command not found"

**Solución:** Instalá jq según tu sistema operativo (ver sección de instalación)

### Error: "Contract not found"

**Solución:** Verificá que el ID del contrato exista en la base de datos

### Error: 401 Unauthorized

**Solución:**

- Verificá que el token sea válido
- Verificá que el token no haya expirado
- Obtené un nuevo token con login

### Error: 403 Forbidden

**Solución:** El usuario debe tener rol `admin` o `superUser`

### Error: "Contrato ya rescindido"

**Solución:** Usá un contrato con status `VIGENTE`

---

## 📚 Documentación Relacionada

- [RESCISION_ANTICIPADA_FRONTEND.md](../doc/CONTRACTS/RESCISION_ANTICIPADA_FRONTEND.md) - Guía de integración frontend
- [RESCISION_ANTICIPADA_RESUMEN.md](../doc/CONTRACTS/RESCISION_ANTICIPADA_RESUMEN.md) - Resumen técnico
- [RESCISION_CONTRATO.md](../doc/CONTRACTS/RESCISION_CONTRATO.md) - Especificación original

---

**Última actualización:** 14 de octubre de 2025
