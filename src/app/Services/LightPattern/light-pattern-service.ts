import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { GetAllSignControlBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBox';
import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { GetAllSignControlBoxWithLightPattern } from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { GetAllLightPattern } from '../../Domain/Entity/LightPattern/GetAllLightPattern';
import { ResultV } from '../../Domain/ResultPattern/ResultV';

@Injectable({
  providedIn: 'root',
})
export class LightPatternService {
  private readonly http = inject(HttpClient);
  private cache = new Map<string, ResultV<GetAllLightPattern>>();

  getAll(params: SearchParameters): Observable<ResultV<GetAllLightPattern>> {
    const query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', params.pageSize?.toString() ?? '10');

    const cacheKey = query.toString();
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey)!);
    }

    return this.http
      .get<ResultV<GetAllLightPattern>>(`${environment.baseUrl}/LightPattern/GetAll`, {
        params: query,
      })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) {
            throw new Error(resp.error?.description ?? 'Unknown error');
          }
          const mapped: ResultV<GetAllLightPattern> = resp;
          this.cache.set(cacheKey, mapped);
          return mapped;
        }),
        catchError((err) => {
          console.error('Failed to load control boxes', err);
          return of({} as ResultV<GetAllLightPattern>);
        }),
        shareReplay(1)
      );
  }
}
