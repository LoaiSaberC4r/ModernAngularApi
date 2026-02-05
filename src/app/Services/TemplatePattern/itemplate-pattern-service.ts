import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError, shareReplay } from 'rxjs';
import { environment } from '../../Shared/environment/environment';

import {
  LightPatternForTemplatePattern,
  TemplatePattern,
} from '../../Domain/Entity/TemplatePattern/TemplatePattern/TemplatePattern';
import { Result } from '../../Domain/ResultPattern/Result';

@Injectable({ providedIn: 'root' })
export class ITemplatePatternService {
  private readonly http = inject(HttpClient);

  AddOrUpdateLightPattern(payload: TemplatePattern): Observable<TemplatePattern> {
    return this.http
      .post<TemplatePattern>(
        `${environment.baseUrl}/TemplatePattern/AddOrUpdateTemplatePattern`,
        payload,
      )
      .pipe(
        map((resp) => resp),
        catchError((err) => {
          console.error('[TemplatePattern:AddOrUpdate] failed:', err);
          return throwError(() => err);
        }),
      );
  }

  GetAllTemplatePatternByTemplateId(Id: number): Observable<LightPatternForTemplatePattern[]> {
    const query = new HttpParams().set('templateId', String(Id));

    return this.http
      .get<
        LightPatternForTemplatePattern[]
      >(`${environment.baseUrl}/TemplatePattern/GetAllByTemplateId`, { params: query })
      .pipe(
        map((resp) => resp || []),
        catchError((err) => {
          console.error('[TemplatePattern:GetAllByTemplateId] failed:', err);
          return throwError(() => err);
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
  }

  deleteTemplate(templateId: number): Observable<Result> {
    const params = new HttpParams().set('templateId', String(templateId));

    return this.http
      .delete<Result>(`${environment.baseUrl}/TemplatePattern/DeleteTemplate`, { params })
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          console.error('[TemplatePattern:DeleteTemplate] failed:', err);
          return throwError(() => err);
        }),
      );
  }
}
