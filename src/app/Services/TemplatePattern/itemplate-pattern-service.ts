import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import {
  LightPatternForTemplatePattern,
  TemplatePattern,
} from '../../Domain/Entity/TemplatePattern/TemplatePattern';
import { Result } from '../../Domain/ResultPattern/Result';

@Injectable({
  providedIn: 'root',
})
export class ITemplatePatternService {
  private readonly http = inject(HttpClient);
  private cache = new Map<string, ResultV<LightPatternForTemplatePattern>>();

  private cacheGetAllByTemplateId = new Map<string, ResultV<LightPatternForTemplatePattern>>();
  AddOrUpdateLightPattern(payload: TemplatePattern): Observable<ResultV<TemplatePattern>> {
    return this.http
      .post<ResultV<TemplatePattern>>(
        // لو عايز تستعمل الـ baseUrl بدل الثابت: `${environment.baseUrl}/SignControlBox/ApplySignBox`
        `${environment.baseUrl}/TemplatePattern/AddOrUpdateTemplatePattern`,
        payload
      )
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) {
            throw new Error(resp.error?.description ?? 'Unknown error');
          }
          // نفس النمط: نرجّع الـ Result كما هو بعد التحقق
          const mapped: ResultV<TemplatePattern> = resp;
          return mapped;
        }),
        catchError((err) => {
          console.error('Failed to apply sign box', err);
          return of({} as ResultV<TemplatePattern>);
        }),
        shareReplay(1)
      );
  }

  GetAllByTemplateId(Id: number): Observable<ResultV<LightPatternForTemplatePattern>> {
    const query = new HttpParams().set('templateId', Id ?? '');

    const cacheKey = query.toString();
    if (this.cacheGetAllByTemplateId.has(cacheKey)) {
      return of(this.cacheGetAllByTemplateId.get(cacheKey)!);
    }

    return this.http
      .get<ResultV<LightPatternForTemplatePattern>>(
        `${environment.baseUrl}/TemplatePattern/GetAllByTemplateId`,
        { params: query }
      )
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) {
            throw new Error(resp.error?.description ?? 'Unknown error');
          }
          const mapped: ResultV<LightPatternForTemplatePattern> = resp;
          this.cacheGetAllByTemplateId.set(cacheKey, mapped);
          return mapped;
        }),
        catchError((err) => {
          console.error('Failed to load control boxes', err);
          return of({} as ResultV<LightPatternForTemplatePattern>);
        }),
        shareReplay(1)
      );
  } 
deleteTemplate(templateId: number): Observable<Result> {
    const params = new HttpParams().set('templateId', String(templateId));
    return this.http
      .delete<Result>(`${environment.baseUrl}/TemplatePattern/DeleteTemplate`, { params })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) throw new Error(resp.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          console.error('Delete Template failed', err);
          return of({ isSuccess: false, error: { description: 'Delete failed' } } as Result);
        })
      );
  }
  
}
