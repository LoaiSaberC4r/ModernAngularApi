import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { GetAllSignControlBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBox';
import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { GetAllSignControlBoxWithLightPattern } from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { Result } from '../../Domain/ResultPattern/Result';

@Injectable({
  providedIn: 'root',
})
export class ISignBoxControlService {
  private readonly http = inject(HttpClient);
  private cache = new Map<string, Pagination<GetAllSignControlBox>>();
  private cahceWithLightPattern = new Map<
    string,
    Pagination<GetAllSignControlBoxWithLightPattern>
  >();

  getAll(params: SearchParameters) {
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
      .get<Pagination<GetAllSignControlBox>>(`${environment.baseUrl}/SignControlBox/GetAll`, {
        params: query,
      })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) {
            throw new Error(resp.error?.description ?? 'Unknown error');
          }
          const mapped: Pagination<GetAllSignControlBox> = resp;
          this.cache.set(cacheKey, mapped);
          return mapped;
        }),
        catchError((err) => {
          console.error('Failed to load control boxes', err);
          return of({} as Pagination<GetAllSignControlBox>);
        }),
        shareReplay(1)
      );
  }

  getAllWithLightPattern(
    params: SearchParameters
  ): Observable<Pagination<GetAllSignControlBoxWithLightPattern>> {
    const query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', params.pageSize?.toString() ?? '10');

    const cacheKey = query.toString();
    if (this.cahceWithLightPattern.has(cacheKey)) {
      return of(this.cahceWithLightPattern.get(cacheKey)!);
    }

    return this.http
      .get<Pagination<GetAllSignControlBoxWithLightPattern>>(
        `${environment.baseUrl}/SignControlBox/GetAllWithLightPatter`,
        { params: query }
      )
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) {
            throw new Error(resp.error?.description ?? 'Unknown error');
          }
          const mapped: Pagination<GetAllSignControlBoxWithLightPattern> = resp;
          this.cahceWithLightPattern.set(cacheKey, mapped);
          return mapped;
        }),
        catchError((err) => {
          console.error('Failed to load control boxes', err);
          return of({} as Pagination<GetAllSignControlBoxWithLightPattern>);
        }),
        shareReplay(1)
      );
  }

  applySignBox(payload: GetAllSignControlBoxWithLightPattern): Observable<Result> {
    return this.http
      .post<Result>(
        // لو عايز تستعمل الـ baseUrl بدل الثابت: `${environment.baseUrl}/SignControlBox/ApplySignBox`
        `${environment.baseUrl}/SignControlBox/ApplySignBox`,
        payload
      )
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) {
            throw new Error(resp.error?.description ?? 'Unknown error');
          }
          // نفس النمط: نرجّع الـ Result كما هو بعد التحقق
          const mapped: Result = resp;
          return mapped;
        }),
        catchError((err) => {
          console.error('Failed to apply sign box', err);
          return of({} as Result);
        }),
        shareReplay(1)
      );
  }
}
