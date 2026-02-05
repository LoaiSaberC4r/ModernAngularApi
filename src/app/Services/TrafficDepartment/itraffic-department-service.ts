import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { TrafficDepartment } from '../../Domain/Entity/TrafficDepartment/TrafficDepartment/TrafficDepartment';
import { Result } from '../../Domain/ResultPattern/Result';

@Injectable({ providedIn: 'root' })
export class ITrafficDepartmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.baseUrl}/TrafficDepartment`;

  getAll(): Observable<TrafficDepartment[]> {
    return this.http.get<TrafficDepartment[]>(this.baseUrl);
  }

  add(payload: TrafficDepartment): Observable<Result> {
    return this.http.post<Result>(this.baseUrl, payload);
  }

  update(payload: TrafficDepartment): Observable<Result> {
    return this.http.put<Result>(this.baseUrl, payload);
  }
}
