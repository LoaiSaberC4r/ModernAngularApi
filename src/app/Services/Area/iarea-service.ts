import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../Shared/environment/environment';

@Injectable({
  providedIn: 'root',
})
export class IAreaService {
  private readonly http = inject(HttpClient);

  getAll(governateId: number): Observable<ResultV<GetAllArea>> {
    const query = new HttpParams().set('governateId', String(governateId ?? ''));

    return this.http
      .get<ResultV<GetAllArea>>(`${environment.baseUrl}/Area/GetAreaByGovernateId`, {
        params: query,
      })
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) {
            throw new Error(resp?.error?.description ?? 'Unknown error');
          }
          return resp as ResultV<GetAllArea>;
        }),
        catchError((err) => {
          console.error('[Area:GetAreaByGovernateId] failed:', err);
          return of({} as ResultV<GetAllArea>);
        }),
        shareReplay(1)
      );
  }
}
