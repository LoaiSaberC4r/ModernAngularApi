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

  private cache = new Map<string, ResultV<GetAllArea>>();

  getAll(params: number): Observable<ResultV<GetAllArea>> {
    const query = new HttpParams().set('governateId', params ?? '');

    const cacheKey = query.toString();
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey)!);
    }

    return this.http
      .get<ResultV<GetAllArea>>(`${environment.baseUrl}/Area/GetAreaByGovernateId`, {
        params: query,
      })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) {
            throw new Error(resp.error?.description ?? 'Unknown error');
          }
          const mapped: ResultV<GetAllArea> = resp;
          this.cache.set(cacheKey, mapped);
          return mapped;
        }),
        catchError((err) => {
          console.error('Failed to load control boxes', err);
          return of({} as ResultV<GetAllArea>);
        }),
        shareReplay(1)
      );
  }
}
