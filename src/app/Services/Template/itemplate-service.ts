import { inject, Injectable } from '@angular/core';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { GetAllTemplate } from '../../Domain/Entity/Template/GetAllTemplate';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../Shared/environment/environment';

@Injectable({
  providedIn: 'root',
})
export class ITemplateService {
  private cache = new Map<string, ResultV<GetAllTemplate>>();
  private readonly http = inject(HttpClient);

  GetAll(): Observable<ResultV<GetAllTemplate>> {
    const query = new HttpParams();

    const cacheKey = query.toString();
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey)!);
    }

    return this.http
      .get<ResultV<GetAllTemplate>>(
        `${environment.baseUrl}/Template/GetAll`,
        {
          params: query,
        }
      )
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) {
            throw new Error(resp.error?.description ?? 'Unknown error');
          }
          const mapped: ResultV<GetAllTemplate> = resp;
          this.cache.set(cacheKey, mapped);
          return mapped;
        }),
        catchError((err) => {
          console.error('Failed to load control boxes', err);
          return of({} as ResultV<GetAllTemplate>);
        }),
        shareReplay(1)
      );
  }
}
