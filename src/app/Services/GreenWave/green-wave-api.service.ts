import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../Shared/environment/environment';

import { PreviewGreenWaveRequest } from '../../Domain/Entity/GreenWave/PreviewGreenWaveRequest/PreviewGreenWaveRequest';
import { ApplyGreenWaveRequest } from '../../Domain/Entity/GreenWave/ApplyGreenWaveRequest/ApplyGreenWaveRequest';
import { GreenWaveCabinetPreview } from '../../Domain/Entity/GreenWave/GreenWaveCabinetPreview/GreenWaveCabinetPreview';
import { GreenWavePreview } from '../../Domain/Entity/GreenWave/GreenWavePreview/GreenWavePreview';

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
