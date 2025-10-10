import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleMapsService {
  // Coordenadas por defecto (placeholder). Se recomienda sobreescribir por ENV.
  private readonly DEFAULT_POIS = {
    centro: { lat: -37.28, lng: -57.45 },
    costa: { lat: -37.3, lng: -57.38 },
    rio: { lat: -37.25, lng: -57.5 },
  } as const;

  constructor(private readonly configService: ConfigService) {}

  private getPointsOfInterest(): {
    [key: string]: { lat: number; lng: number };
  } {
    const parse = (v?: string) => (v !== undefined ? parseFloat(v) : undefined);

    const centroLat = parse(
      this.configService.get<string>('MAP_POI_CENTRO_LAT'),
    );
    const centroLng = parse(
      this.configService.get<string>('MAP_POI_CENTRO_LNG'),
    );
    const costaLat = parse(this.configService.get<string>('MAP_POI_COSTA_LAT'));
    const costaLng = parse(this.configService.get<string>('MAP_POI_COSTA_LNG'));
    const rioLat = parse(this.configService.get<string>('MAP_POI_RIO_LAT'));
    const rioLng = parse(this.configService.get<string>('MAP_POI_RIO_LNG'));

    return {
      centro: {
        lat: centroLat ?? this.DEFAULT_POIS.centro.lat,
        lng: centroLng ?? this.DEFAULT_POIS.centro.lng,
      },
      costa: {
        lat: costaLat ?? this.DEFAULT_POIS.costa.lat,
        lng: costaLng ?? this.DEFAULT_POIS.costa.lng,
      },
      rio: {
        lat: rioLat ?? this.DEFAULT_POIS.rio.lat,
        lng: rioLng ?? this.DEFAULT_POIS.rio.lng,
      },
    };
  }
  /**
   * Calcula la distancia en kilómetros a varios puntos de interés.
   * @param lat Latitud de la propiedad.
   * @param lng Longitud de la propiedad.
   * @returns Un objeto con las distancias calculadas.
   */
  public getDistances(lat: number, lng: number): { [key: string]: number } {
    const distances = {} as { [key: string]: number };
    const pois = this.getPointsOfInterest();

    for (const [key, coords] of Object.entries(pois)) {
      const distance = this.haversineDistance(lat, lng, coords.lat, coords.lng);
      distances[key] = distance;
    }

    return distances;
  }

  /**
   * Implementación de la fórmula de Haversine para calcular la distancia entre dos puntos geográficos.
   * @param lat1 Latitud del punto 1.
   * @param lng1 Longitud del punto 1.
   * @param lat2 Latitud del punto 2.
   * @param lng2 Longitud del punto 2.
   * @returns Distancia en kilómetros.
   */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Radio de la Tierra en kilómetros
    const toRad = (value) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
