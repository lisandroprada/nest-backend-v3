# Documentación Técnica: Google Maps con Autocomplete y Marcadores en Next.js + React

## Índice

1. [Introducción](#introducción)
2. [Requisitos Previos](#requisitos-previos)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Configuración de Google Maps API](#configuración-de-google-maps-api)
5. [Variables de Entorno](#variables-de-entorno)
6. [Instalación y Setup](#instalación-y-setup)
7. [Componentes Principales](#componentes-principales)
8. [Lógica de Integración Google Maps](#lógica-de-integración-google-maps)
9. [Autocomplete y Marcadores](#autocomplete-y-marcadores)
10. [Manejo de Errores y Restricciones](#manejo-de-errores-y-restricciones)
11. [Estilos y UI](#estilos-y-ui)
12. [Despliegue y Seguridad](#despliegue-y-seguridad)
13. [Referencias](#referencias)

---

## Introducción

Esta aplicación es un ejemplo completo de cómo integrar Google Maps en un proyecto Next.js + React, incluyendo funcionalidades de Autocomplete de direcciones y marcadores dinámicos. El objetivo es que cualquier desarrollador pueda replicar la solución siguiendo esta guía.

## Requisitos Previos

- Node.js >= 18
- pnpm (o npm/yarn)
- Cuenta de Google Cloud Platform
- Conocimientos básicos de React y Next.js

## Estructura del Proyecto

```
/ (root)
├── app/
│   ├── page.tsx                # Página principal con lógica de Google Maps
│   └── ...
├── components/
│   ├── google-map-component.tsx # Componente principal del mapa
│   └── ...
├── public/                    # Recursos estáticos
├── styles/                    # Estilos globales
├── package.json
├── tailwind.config.ts
└── ...
```

## Configuración de Google Maps API

1. Ingresa a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto o selecciona uno existente.
3. Habilita las APIs:
   - "Maps JavaScript API"
   - "Places API"
4. Ve a **APIs y servicios > Credenciales** y crea una nueva API Key.
5. Configura restricciones:
   - **Restricciones de aplicación:** Referentes HTTP
   - Agrega dominios permitidos (ejemplo: `localhost:3000/*`, `*.vercel.app/*`)

## Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key_aqui
```

## Instalación y Setup

1. Clona el repositorio o crea un nuevo proyecto Next.js.
2. Instala dependencias:
   ```sh
   pnpm install
   # o npm install / yarn install
   ```
3. Agrega tu API Key en `.env.local`.
4. Inicia el entorno de desarrollo:
   ```sh
   pnpm dev
   # o npm run dev / yarn dev
   ```

## Componentes Principales

- **`app/page.tsx`**: Página principal, maneja la carga del script de Google Maps, validación de la API Key y renderiza el componente del mapa.
- **`components/google-map-component.tsx`**: Encapsula la lógica de Google Maps, Autocomplete y marcadores.
- **UI Components**: Utiliza una librería de componentes (Radix UI + TailwindCSS) para la interfaz.

## Lógica de Integración Google Maps

- Se carga el script de Google Maps dinámicamente usando la API Key desde variables de entorno.
- Se valida la API Key y se manejan errores de configuración o restricciones de dominio.
- El componente `GoogleMapComponent` inicializa el mapa y expone métodos para centrar, agregar marcadores y manejar eventos.

## Autocomplete y Marcadores

- Se utiliza la librería `places` de Google Maps para el Autocomplete.
- Al seleccionar una dirección, el mapa se centra automáticamente y se agrega un marcador.
- Los marcadores son interactivos y muestran información relevante.
- Se puede limpiar la selección y resetear el mapa.

## Manejo de Errores y Restricciones

- Si la API Key no está configurada o es inválida, se muestra un mensaje claro y pasos para solucionarlo.
- Si el dominio no está autorizado, se informa el error y se guía al usuario para autorizar el dominio en Google Cloud.
- Los errores se manejan de forma amigable y visual.

## Estilos y UI

- Se utiliza TailwindCSS para estilos rápidos y responsivos.
- Los componentes de UI (cards, alerts, loaders) mejoran la experiencia de usuario.
- La interfaz es moderna, clara y mobile-friendly.

## Despliegue y Seguridad

- Para producción, **siempre** restringe la API Key a los dominios necesarios.
- No compartas la API Key públicamente.
- Puedes desplegar en Vercel, Netlify u otro proveedor compatible con Next.js.

## Referencias

- [Documentación oficial Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview)
- [Next.js Documentation](https://nextjs.org/docs)
- [Radix UI](https://www.radix-ui.com/)
- [TailwindCSS](https://tailwindcss.com/)

---

**Autor:** Equipo de Desarrollo
**Fecha:** Julio 2025
