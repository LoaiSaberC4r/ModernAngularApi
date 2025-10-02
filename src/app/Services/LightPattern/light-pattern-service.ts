import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { GetAllSignControlBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBox';
import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { GetAllSignControlBoxWithLightPattern } from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { GetAllLightPattern } from '../../Domain/Entity/LightPattern/GetAllLightPattern';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { AddLightPatternCommand } from '../../Domain/Entity/LightPattern/AddLightPattern';
import { Result } from '../../Domain/ResultPattern/Result';
import { GetLightPattern } from '../../Domain/Entity/LightPattern/GetLightPattern';

@Injectable({
  providedIn: 'root',
})
export class LightPatternService {
  private readonly http = inject(HttpClient);
  private cache = new Map<string, ResultV<GetAllLightPattern>>();

  private invalidateCache(): void {
    this.cache.clear();
  }

  getAll(): Observable<ResultV<GetAllLightPattern>> {
    const query = new HttpParams()

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

  getById(params: number): Observable<ResultV<GetLightPattern>> {
    const query = new HttpParams().set('id', params ?? '');

    const cacheKey = query.toString();
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey)!);
    }

    return this.http
      .get<ResultV<GetAllLightPattern>>(`${environment.baseUrl}/LightPattern/GetById`, {
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
          return of({} as ResultV<GetLightPattern>);
        }),
        shareReplay(1)
      );
  }

  add(command: AddLightPatternCommand): Observable<Result> {
    // تطابق مع ASP.NET: [HttpPost(nameof(Add))] => POST /LightPattern/Add
    return this.http.post<Result>(`${environment.baseUrl}/LightPattern/Add`, command).pipe(
      tap((resp) => {
        if (resp?.isSuccess) {
          // أبسط حل مضمون: امسح الكاش عشان أول getAll بعدها يجيب بيانات محدثة
          this.invalidateCache();
        }
      }),
      catchError((err) => {
        console.error('Failed to add light pattern', err);
        // رجّع ResultV فاشل موحّد بدلاً من رمي الاستثناء للـ UI
        return of({
          isSuccess: false,
          error: { code: 'AddLightPatternFailed', description: err?.message ?? 'Request failed' },
        } as ResultV<unknown>);
      })
    );
  }

  delete(lightPatternId: number): Observable<Result> {
    const params = new HttpParams().set('LightPatternId', lightPatternId.toString());

    return this.http.delete<Result>(`${environment.baseUrl}/LightPattern/Delete`, { params }).pipe(
      tap((resp) => {
        if (resp?.isSuccess) {
          // أبسط حل مضمون: امسح الكاش عشان أول getAll بعدها يجيب بيانات محدثة
          this.invalidateCache();
        }
      }),
      catchError((err) => {
        console.error('Failed to delete light pattern', err);
        return of({
          isSuccess: false,
          error: {
            code: 'DeleteLightPatternFailed',
            description: err?.message ?? 'Request failed',
          },
        } as Result);
      })
    );
  }
}
