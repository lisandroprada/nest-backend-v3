# Ejemplos de Integración Frontend - Property Module

Este documento contiene ejemplos prácticos de cómo integrar los nuevos endpoints desde una aplicación frontend.

---

## 📦 Configuración Inicial

```typescript
// config/api.ts
const API_URL = 'http://localhost:3000';
const token = localStorage.getItem('authToken');

const headers = { Authorization: `Bearer ${token}` };

const headersMultipart = {
  Authorization: `Bearer ${token}`,
  // No establecer Content-Type, el browser lo hace automáticamente con FormData
};
```

---

## 🖼️ Ejemplos: Gestión de Imágenes

### 1. Subir Múltiples Imágenes

```typescript
// components/PropertyImageUpload.tsx
async function uploadPropertyImages(propertyId: string, files: File[]) {
  const formData = new FormData();

  files.forEach(file => {
    formData.append('imagenes', file);
  });

  try {
    const response = await fetch(`${API_URL}/properties/${propertyId}/imagenes`, {
      method: 'POST',
      headers: headersMultipart,
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error al subir imágenes');
    }

    const updatedProperty = await response.json();
    console.log('Imágenes subidas:', updatedProperty.imagenes);
    return updatedProperty;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Uso en React
function ImageUploadComponent({ propertyId }) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    await uploadPropertyImages(propertyId, selectedFiles);
    // Recargar datos de la propiedad
  };

  return (
    <div>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
      />
      <button onClick={handleUpload}>
        Subir {selectedFiles.length} imagen(es)
      </button>
    </div>
  );
}
```

### 2. Reordenar Imágenes (Drag & Drop)

```typescript
// components/ImageGalleryEditor.tsx
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

async function reorderImages(propertyId: string, imageNames: string[]) {
  const response = await fetch(
    `${API_URL}/properties/${propertyId}/imagenes/reordenar`,
    {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ordenImagenes: imageNames })
    }
  );

  return response.json();
}

function ImageGalleryEditor({ propertyId, images }) {
  const [imageList, setImageList] = useState(images);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(imageList);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setImageList(items);

    // Guardar orden en backend
    const imageNames = items.map(img => img.nombre);
    await reorderImages(propertyId, imageNames);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="images">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {imageList.map((image, index) => (
              <Draggable key={image.nombre} draggableId={image.nombre} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <img src={image.versiones.thumb} alt="" />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
```

### 3. Establecer Imagen como Portada

```typescript
async function setImageAsPortada(propertyId: string, fileName: string) {
  const response = await fetch(
    `${API_URL}/properties/${propertyId}/imagenes/${fileName}/portada`,
    {
      method: 'PATCH',
      headers
    }
  );

  return response.json();
}

// Componente con botón para cada imagen
function ImageCard({ propertyId, image, isPortada }) {
  const handleSetAsPortada = async () => {
    await setImageAsPortada(propertyId, image.nombre);
    // Actualizar estado
  };

  return (
    <div className={isPortada ? 'portada' : ''}>
      <img src={image.versiones.slider} alt="" />
      {!isPortada && (
        <button onClick={handleSetAsPortada}>
          Establecer como portada
        </button>
      )}
    </div>
  );
}
```

---

## 🗺️ Ejemplos: Búsqueda en Mapa

### 1. Cargar Propiedades en Mapa (Google Maps)

```typescript
// components/PropertyMap.tsx
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';

async function loadPropertiesForMap(bounds: google.maps.LatLngBounds) {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  const url = new URL(`${API_URL}/properties/map`);
  url.searchParams.append('minLat', sw.lat().toString());
  url.searchParams.append('maxLat', ne.lat().toString());
  url.searchParams.append('minLng', sw.lng().toString());
  url.searchParams.append('maxLng', ne.lng().toString());
  url.searchParams.append('tipo', 'venta'); // opcional

  const response = await fetch(url.toString());
  return response.json();
}

function PropertyMap() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState([]);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: 'TU_API_KEY'
  });

  const handleBoundsChanged = useCallback(async () => {
    if (!map) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const properties = await loadPropertiesForMap(bounds);
    setMarkers(properties);
  }, [map]);

  if (!isLoaded) return <div>Cargando mapa...</div>;

  return (
    <GoogleMap
      zoom={12}
      center={{ lat: -34.6037, lng: -58.3816 }}
      onLoad={setMap}
      onBoundsChanged={handleBoundsChanged}
      mapContainerStyle={{ width: '100%', height: '600px' }}
    >
      {markers.map((property) => (
        <Marker
          key={property.id}
          position={{ lat: property.lat, lng: property.lng }}
          label={property.precio ? `$${property.precio}` : ''}
          icon={{
            url: property.imgCover,
            scaledSize: new google.maps.Size(40, 40)
          }}
        />
      ))}
    </GoogleMap>
  );
}
```

### 2. Búsqueda Pública con Filtros

```typescript
// hooks/usePublicProperties.ts
interface SearchFilters {
  tipo: 'venta' | 'alquiler';
  proposito?: string;
  minPrecio?: number;
  maxPrecio?: number;
  dormitorios?: number;
  banos?: number;
  page?: number;
  pageSize?: number;
}

async function searchPublicProperties(filters: SearchFilters) {
  const url = new URL(`${API_URL}/properties/public`);

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString());
  return response.json();
}

// Hook personalizado
function usePublicProperties(filters: SearchFilters) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function loadProperties() {
      setLoading(true);
      try {
        const result = await searchPublicProperties(filters);
        setProperties(result.data);
        setTotal(result.total);
      } catch (error) {
        console.error('Error al cargar propiedades:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProperties();
  }, [JSON.stringify(filters)]);

  return { properties, loading, total };
}

// Uso en componente
function PropertySearchPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    tipo: 'venta',
    pageSize: 20,
    page: 0
  });

  const { properties, loading, total } = usePublicProperties(filters);

  return (
    <div>
      <PropertyFilters filters={filters} onChange={setFilters} />
      {loading ? (
        <Spinner />
      ) : (
        <PropertyGrid properties={properties} />
      )}
      <Pagination
        total={total}
        pageSize={filters.pageSize}
        current={filters.page}
        onChange={(page) => setFilters({ ...filters, page })}
      />
    </div>
  );
}
```

---

## 🏗️ Ejemplos: Sistema de Lotes

### 1. Subir y Calibrar Imagen Satelital

```typescript
// components/LotEditor.tsx
async function uploadSatelliteImage(propertyId: string, file: File) {
  const formData = new FormData();
  formData.append('imagen', file);

  const response = await fetch(
    `${API_URL}/properties/${propertyId}/imagen-satelital`,
    {
      method: 'POST',
      headers: headersMultipart,
      body: formData
    }
  );

  return response.json();
}

async function calibrateSatelliteImage(
  propertyId: string,
  pixelsPerMeter: number
) {
  const response = await fetch(
    `${API_URL}/properties/${propertyId}/imagen-satelital/calibrar`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pixels_por_metro: pixelsPerMeter })
    }
  );

  return response.json();
}

function SatelliteImageUpload({ propertyId }) {
  const [uploading, setUploading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [pixelsPerMeter, setPixelsPerMeter] = useState(10);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadSatelliteImage(propertyId, file);
      console.log('Imagen subida:', result);
      // La imagen tiene dimensiones automáticamente extraídas
    } finally {
      setUploading(false);
    }
  };

  const handleCalibrate = async () => {
    setCalibrating(true);
    try {
      await calibrateSatelliteImage(propertyId, pixelsPerMeter);
      alert('Calibración guardada');
    } finally {
      setCalibrating(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
      />

      <div>
        <label>
          Píxeles por metro:
          <input
            type="number"
            value={pixelsPerMeter}
            onChange={e => setPixelsPerMeter(Number(e.target.value))}
          />
        </label>
        <button onClick={handleCalibrate} disabled={calibrating}>
          Calibrar
        </button>
      </div>
    </div>
  );
}
```

### 2. Editor de Lotes (Canvas)

```typescript
// components/LotDrawer.tsx
interface Lote {
  id: string;
  coordenadas: { x: number; y: number }[];
  status: string;
  precio?: number;
  moneda?: string;
  superficie_m2?: number;
}

async function saveLotes(propertyId: string, lotes: Lote[]) {
  const response = await fetch(
    `${API_URL}/properties/${propertyId}`,
    {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lotes })
    }
  );

  return response.json();
}

function LotDrawer({ propertyId, imagenSatelital, existingLotes }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lotes, setLotes] = useState<Lote[]>(existingLotes || []);
  const [currentLot, setCurrentLot] = useState<{ x: number; y: number }[]>([]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setCurrentLot([...currentLot, { x, y }]);
  };

  const closeLot = () => {
    if (currentLot.length < 3) {
      alert('Un lote debe tener al menos 3 puntos');
      return;
    }

    const newLot: Lote = {
      id: `lote-${Date.now()}`,
      coordenadas: currentLot,
      status: 'DISPONIBLE',
      precio: 0,
      moneda: 'USD',
      superficie_m2: calculateArea(
        currentLot,
        imagenSatelital.pixels_por_metro
      )
    };

    setLotes([...lotes, newLot]);
    setCurrentLot([]);
  };

  const handleSave = async () => {
    await saveLotes(propertyId, lotes);
    alert('Lotes guardados');
  };

  // Función para calcular área basada en píxeles y calibración
  const calculateArea = (
    coordenadas: { x: number; y: number }[],
    pixelsPerMeter: number
  ) => {
    // Algoritmo shoelace para calcular área de polígono
    let area = 0;
    for (let i = 0; i < coordenadas.length; i++) {
      const j = (i + 1) % coordenadas.length;
      area += coordenadas[i].x * coordenadas[j].y;
      area -= coordenadas[j].x * coordenadas[i].y;
    }

    // Convertir de píxeles cuadrados a metros cuadrados
    const areaPixels = Math.abs(area) / 2;
    const areaMeters = areaPixels / (pixelsPerMeter * pixelsPerMeter);

    return Math.round(areaMeters * 100) / 100;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cargar y dibujar imagen satelital
    const img = new Image();
    img.src = imagenSatelital.url;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Dibujar lotes existentes
      lotes.forEach(lote => drawLot(ctx, lote));

      // Dibujar lote actual
      if (currentLot.length > 0) {
        drawLot(ctx, { coordenadas: currentLot, status: 'DRAWING' });
      }
    };
  }, [lotes, currentLot]);

  const drawLot = (ctx: CanvasRenderingContext2D, lote: any) => {
    if (lote.coordenadas.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(lote.coordenadas[0].x, lote.coordenadas[0].y);

    lote.coordenadas.forEach((coord, i) => {
      if (i > 0) ctx.lineTo(coord.x, coord.y);
    });

    if (lote.status !== 'DRAWING') {
      ctx.closePath();
    }

    ctx.strokeStyle = lote.status === 'DISPONIBLE' ? 'green' : 'red';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (lote.status !== 'DRAWING') {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
      ctx.fill();
    }
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ border: '1px solid black', cursor: 'crosshair' }}
      />

      <div>
        <button onClick={closeLot} disabled={currentLot.length < 3}>
          Cerrar Lote ({currentLot.length} puntos)
        </button>
        <button onClick={() => setCurrentLot([])}>
          Cancelar
        </button>
        <button onClick={handleSave}>
          Guardar {lotes.length} lote(s)
        </button>
      </div>

      <div>
        <h3>Lotes Dibujados</h3>
        {lotes.map((lote, i) => (
          <div key={lote.id}>
            Lote {i + 1}: {lote.superficie_m2} m²
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🎨 Componentes de UI Útiles

### PropertyCard (para listado público)

```typescript
function PropertyCard({ property }) {
  const portada = property.imagenes?.find(img => img.es_portada);
  const imageUrl = portada?.versiones?.slider || property.img_cover_url;

  const precio = property.precio_venta?.consultar
    ? 'Consultar'
    : `${property.precio_venta?.moneda} ${property.precio_venta?.monto?.toLocaleString()}`;

  return (
    <div className="property-card">
      <img src={imageUrl} alt={property.identificador} />
      <h3>{property.direccion.calle} {property.direccion.numero}</h3>
      <p>{property.caracteristicas.dormitorios} dorm. | {property.caracteristicas.banos} baños</p>
      <p className="precio">{precio}</p>
      <Link to={`/properties/${property.id}`}>Ver más</Link>
    </div>
  );
}
```

---

## 🔄 Gestión de Estado (Redux Toolkit)

```typescript
// store/propertiesSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchPublicProperties = createAsyncThunk(
  'properties/fetchPublic',
  async (filters: SearchFilters) => {
    const response = await searchPublicProperties(filters);
    return response;
  },
);

const propertiesSlice = createSlice({
  name: 'properties',
  initialState: { items: [], loading: false, error: null, total: 0 },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPublicProperties.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPublicProperties.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.total = action.payload.total;
      })
      .addCase(fetchPublicProperties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export default propertiesSlice.reducer;
```

---

Estos ejemplos cubren los casos de uso más comunes. Ajusta según tu stack tecnológico (React, Vue, Angular, etc.).
