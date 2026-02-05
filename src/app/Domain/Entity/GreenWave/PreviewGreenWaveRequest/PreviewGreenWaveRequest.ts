export interface PreviewGreenWaveRequest {
  routeSegments: string[];
  speedKmh?: number;
  greenSeconds?: number;
  cabinetSearchRadiusMeters?: number;
  maxCabinets?: number;
}
