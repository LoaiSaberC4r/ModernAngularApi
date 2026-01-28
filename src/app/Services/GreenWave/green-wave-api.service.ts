import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../Shared/environment/environment';

export interface PreviewGreenWaveRequest {
  routeSegments: string[];
  speedKmh?: number;
  greenSeconds?: number;
  cabinetSearchRadiusMeters?: number;
  maxCabinets?: number;
}

export interface ApplyGreenWaveRequest extends PreviewGreenWaveRequest {
  planId: string;
}

export interface GreenWaveCabinetPreview {
  cabinetId: number;
  roadNodeId: string;
  cabinetLat: number;
  cabinetLon: number;
  incomingSegmentIdOnRoute: string;
  incomingExternalSegmentIdOnRoute: string;
  openDirectionId: number;
  blockedDirectionIds: number[];
  offsetSeconds: number;
}

export interface GreenWavePreview {
  planId: string;
  speedKmh: number;
  greenSeconds: number;
  cabinets: GreenWaveCabinetPreview[];
}

@Injectable({ providedIn: 'root' })
export class GreenWaveApiService {
  private readonly baseUrl = `${environment.baseUrl}/greenwave`;

  constructor(private http: HttpClient) {}

  preview(req: PreviewGreenWaveRequest): Observable<GreenWavePreview> {
    return this.http.post<GreenWavePreview>(`${this.baseUrl}/preview`, req);
  }

  apply(req: ApplyGreenWaveRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/apply`, req);
  }
}
