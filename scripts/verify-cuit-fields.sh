#!/bin/bash

# 🔍 Script de Verificación Backend - Campos CUIT
# Verifica que los cambios estén correctamente implementados

echo "🔍 Verificación de Implementación Backend - Campos CUIT"
echo "========================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de errores
ERRORS=0

# 1. Verificar que NO existe cuit_validado_fecha en el schema
echo "1. Verificando que NO existe 'cuit_validado_fecha' en el schema..."
if grep -q "cuit_validado_fecha" src/modules/agents/entities/agent.entity.ts; then
    echo -e "${RED}❌ FALLO: Se encontró 'cuit_validado_fecha' en agent.entity.ts${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ CORRECTO: No se encontró 'cuit_validado_fecha'${NC}"
fi

# 2. Verificar que existe cuit_validado_en en el schema
echo "2. Verificando que existe 'cuit_validado_en' en el schema..."
if grep -q "cuit_validado_en" src/modules/agents/entities/agent.entity.ts; then
    echo -e "${GREEN}✅ CORRECTO: 'cuit_validado_en' encontrado en agent.entity.ts${NC}"
else
    echo -e "${RED}❌ FALLO: No se encontró 'cuit_validado_en' en agent.entity.ts${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 3. Verificar que existe cuit_validado en el schema
echo "3. Verificando que existe 'cuit_validado' en el schema..."
if grep -q "cuit_validado: boolean" src/modules/agents/entities/agent.entity.ts; then
    echo -e "${GREEN}✅ CORRECTO: 'cuit_validado' encontrado en agent.entity.ts${NC}"
else
    echo -e "${RED}❌ FALLO: No se encontró 'cuit_validado' en agent.entity.ts${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 4. Verificar que existe cuit_datos_afip en el schema
echo "4. Verificando que existe 'cuit_datos_afip' en el schema..."
if grep -q "cuit_datos_afip" src/modules/agents/entities/agent.entity.ts; then
    echo -e "${GREEN}✅ CORRECTO: 'cuit_datos_afip' encontrado en agent.entity.ts${NC}"
else
    echo -e "${YELLOW}⚠️  ADVERTENCIA: No se encontró 'cuit_datos_afip' en agent.entity.ts${NC}"
fi

# 5. Verificar que existe cuit_validado_en en el DTO
echo "5. Verificando que existe 'cuit_validado_en' en CreateAgentDto..."
if grep -q "cuit_validado_en" src/modules/agents/dto/create-agent.dto.ts; then
    echo -e "${GREEN}✅ CORRECTO: 'cuit_validado_en' encontrado en create-agent.dto.ts${NC}"
else
    echo -e "${RED}❌ FALLO: No se encontró 'cuit_validado_en' en create-agent.dto.ts${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 6. Verificar que NO existe cuit_validado_fecha en el DTO
echo "6. Verificando que NO existe 'cuit_validado_fecha' en CreateAgentDto..."
if grep -q "cuit_validado_fecha" src/modules/agents/dto/create-agent.dto.ts; then
    echo -e "${RED}❌ FALLO: Se encontró 'cuit_validado_fecha' en create-agent.dto.ts${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ CORRECTO: No se encontró 'cuit_validado_fecha'${NC}"
fi

# 7. Verificar que el servicio usa cuit_validado_en
echo "7. Verificando que agents.service.ts usa 'cuit_validado_en'..."
if grep -q "cuit_validado_en" src/modules/agents/agents.service.ts; then
    echo -e "${GREEN}✅ CORRECTO: 'cuit_validado_en' encontrado en agents.service.ts${NC}"
else
    echo -e "${RED}❌ FALLO: No se encontró 'cuit_validado_en' en agents.service.ts${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 8. Verificar que existe el endpoint validar-cuit
echo "8. Verificando que existe el endpoint 'validar-cuit'..."
if grep -q "validar-cuit" src/modules/agents/agents.controller.ts; then
    echo -e "${GREEN}✅ CORRECTO: Endpoint 'validar-cuit' encontrado${NC}"
else
    echo -e "${RED}❌ FALLO: No se encontró endpoint 'validar-cuit'${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 9. Verificar que CuitService está inyectado
echo "9. Verificando que CuitService está inyectado en AgentsService..."
if grep -q "CuitService" src/modules/agents/agents.service.ts; then
    echo -e "${GREEN}✅ CORRECTO: CuitService encontrado en agents.service.ts${NC}"
else
    echo -e "${RED}❌ FALLO: No se encontró CuitService en agents.service.ts${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 10. Compilación
echo "10. Verificando compilación del proyecto..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ CORRECTO: Proyecto compila sin errores${NC}"
else
    echo -e "${RED}❌ FALLO: Error al compilar el proyecto${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "========================================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ TODAS LAS VERIFICACIONES PASARON${NC}"
    echo "Backend está correctamente implementado con 'cuit_validado_en'"
    exit 0
else
    echo -e "${RED}❌ SE ENCONTRARON $ERRORS ERROR(ES)${NC}"
    echo "Revisa los mensajes arriba para más detalles"
    exit 1
fi
