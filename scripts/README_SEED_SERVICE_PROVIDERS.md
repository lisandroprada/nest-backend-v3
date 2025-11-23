# Seed de Proveedores de Servicios Públicos

Este script automatiza la creación de proveedores de servicios públicos e impuestos en el sistema.

## Contenido

- `seed-service-providers.json`: Datos de proveedores predefinidos
- `seed-service-providers.sh`: Script de importación

## Proveedores Incluidos

1. **Camuzzi Gas Pampeana S.A.** (CUIT: 30657864427)
   - Gas natural
   - Implementación de referencia completa

2. **Cooperativa Popular de Electricidad** (CUIT: 30546520669)
   - Electricidad Santa Rosa

3. **Municipalidad de Santa Rosa** (CUIT: 30999033336)
   - Tasas municipales

4. **EPRE (Ente Provincial del Río Colorado)** (CUIT: 30999044447)
   - Agua potable

5. **Municipalidad de General Pico** (CUIT: 30999055558)
   - Tasas municipales

6. **ASSA** (CUIT: 30999066669)
   - Servicios sanitarios y ambientales

## Requisitos

- Backend corriendo en `http://localhost:4000`
- `jq` instalado (para parsear JSON en bash)
- `curl` instalado

### Instalar jq en macOS:

```bash
brew install jq
```

## Uso

### 1. Dar permisos de ejecución

```bash
chmod +x scripts/seed-service-providers.sh
```

### 2. Ejecutar el script

```bash
# Desde la raíz del proyecto
./scripts/seed-service-providers.sh

# O especificar una URL diferente
API_URL=http://localhost:3000/api ./scripts/seed-service-providers.sh
```

### 3. Verificar resultados

```bash
# Listar proveedores creados
curl -H "Authorization: Bearer <TOKEN>" http://localhost:4000/api/v1/service-sync/providers | jq

# Verificar un proveedor específico
curl -H "Authorization: Bearer <TOKEN>" http://localhost:4000/api/agents?identificador_fiscal=30657864427 | jq
```

## Estructura de un Proveedor

Cada proveedor tiene los siguientes campos clave:

```json
{
  "rol": ["PROVEEDOR_SERVICIO_PUBLICO"],
  "persona_tipo": "JURIDICA",
  "nomenclador_fiscal": "RI",
  "identificador_fiscal": "30657864427",
  "nombre_razon_social": "Camuzzi Gas Pampeana S.A.",
  "email_principal": "avisos@camuzzigas.com.ar",

  // Configuración para sincronización automática
  "check_automatizado": true,
  "dominios_notificacion": ["avisos.camuzzigas.com.ar"],

  // Regex para extracción de datos
  "servicio_id_regex": "Cuenta[:\\s]+(\\d+/\\d+-\\d+-\\d+-\\d+/\\d+)",
  "monto_regex": "Total\\s*:\\s*\\$\\s*([\\d,.]+)",
  "pdf_search_key": "CAMUZZI GAS PAMPEANA",
  "pdf_attachment_names": ["factura_camuzzi.pdf"]
}
```

## Agregar Nuevo Proveedor

### Opción 1: Editar el JSON

1. Editar `scripts/seed-service-providers.json`
2. Agregar nuevo objeto con la estructura mostrada arriba
3. Ejecutar el script nuevamente

### Opción 2: Request manual

```bash
curl -X POST http://localhost:4000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "rol": ["PROVEEDOR_SERVICIO_PUBLICO"],
    "persona_tipo": "JURIDICA",
    "nomenclador_fiscal": "RI",
    "identificador_fiscal": "30111222333",
    "nombre_razon_social": "Nuevo Proveedor S.A.",
    "email_principal": "contacto@proveedor.com",
    "direccion_fiscal": {
      "calle": "Calle Principal",
      "numero": "123",
      "provincia_id": "633c5e9b1e9b7c2b6c8f2d32",
      "localidad_id": "633c5e9b1e9b7c2b6c8f2d33",
      "codigo_postal": "Q8300"
    },
    "check_automatizado": true,
    "dominios_notificacion": ["avisos.proveedor.com"]
  }'
```

## Configuración de Regex

Los campos regex permiten extraer información automáticamente de los emails:

### `servicio_id_regex`

Extrae el número de cuenta/servicio/partida:

```javascript
// Camuzzi: "Cuenta: 9103/0-21-08-0023608/4"
"servicio_id_regex": "Cuenta[:\\s]+(\\d+/\\d+-\\d+-\\d+-\\d+/\\d+)"

// CPE: "Número de Socio: 123456"
"servicio_id_regex": "N[úu]mero de Socio[:\\s]+(\\d+)"

// Municipalidad: "Partida: 12-345"
"servicio_id_regex": "Partida[:\\s]+(\\d+-\\d+)"
```

### `monto_regex`

Extrae el monto a pagar:

```javascript
// "Total: $45,000.50"
"monto_regex": "Total\\s*:\\s*\\$\\s*([\\d,.]+)"

// "Importe Total: $ 1,234.56"
"monto_regex": "Importe Total[:\\s]*\\$\\s*([\\d,.]+)"
```

### `pdf_search_key`

Palabra clave para identificar PDFs de facturas:

```javascript
"pdf_search_key": "CAMUZZI GAS PAMPEANA"
"pdf_search_key": "COOPERATIVA POPULAR"
"pdf_search_key": "MUNICIPALIDAD DE SANTA ROSA"
```

## Verificación Post-Importación

```bash
# 1. Listar todos los proveedores configurados
curl -H "Authorization: Bearer <TOKEN>" http://localhost:4000/api/v1/service-sync/providers | jq

# 2. Verificar configuración de un proveedor específico
curl -H "Authorization: Bearer <TOKEN>" http://localhost:4000/api/agents?identificador_fiscal=30657864427 | jq '.[0] | {
  nombre: .nombre_razon_social,
  cuit: .identificador_fiscal,
  rol: .rol,
  dominios: .dominios_notificacion,
  check_automatizado: .check_automatizado
}'

# 3. Probar escaneo de emails
curl -H "Authorization: Bearer <TOKEN>" -X POST http://localhost:4000/api/v1/service-sync/rescan | jq

# 4. Verificar comunicaciones capturadas
curl -H "Authorization: Bearer <TOKEN>" http://localhost:4000/api/v1/service-sync?limit=5 | jq
```

## Troubleshooting

### Error: "jq: command not found"

Instalar jq:

```bash
# macOS
brew install jq

# Linux (Debian/Ubuntu)
sudo apt-get install jq

# Linux (RHEL/CentOS)
sudo yum install jq
```

### Error: Proveedores no aparecen en `/providers`

Verificar que tienen `dominios_notificacion` configurado:

```bash
curl http://localhost:4000/api/agents?identificador_fiscal=30657864427 | jq '.[0].dominios_notificacion'
```

### Error: No se capturan emails

1. Verificar configuración IMAP en `system_configs`
2. Verificar que `check_automatizado` está en `true`
3. Verificar que `dominios_notificacion` coincide con el remitente del email
4. Ejecutar manualmente: `curl -H "Authorization: Bearer <TOKEN>" -X POST http://localhost:4000/api/v1/service-sync/rescan`

## Referencias

- [Documentación de Agentes](../doc/AGENTS_API.md)
- [Documentación de Service Sync](../doc/SERVICE_SYNC_API.md)
- [Enum AgenteRoles](../src/modules/agents/constants/agent-roles.enum.ts)

## Notas

- Los CUITs de municipalidades y entes son ficticios (30999...)
- Para proveedores reales, usar CUITs correctos
- Los regex pueden necesitar ajustes según el formato real de los emails
- Revisar logs del backend para debugging: `pnpm start:dev`
