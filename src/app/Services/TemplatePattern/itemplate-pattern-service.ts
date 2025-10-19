import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import {
  LightPatternForTemplatePattern,
  TemplatePattern,
} from '../../Domain/Entity/TemplatePattern/TemplatePattern';
import { Result } from '../../Domain/ResultPattern/Result';
import { ToasterService } from '../Toster/toaster-service';

@Injectable({ providedIn: 'root' })
export class ITemplatePatternService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToasterService);

  private extractErrorMessage(err: any, op: string): string {
    const validationList: string[] =
      err?.error?.errorMessages ?? err?.error?.errors ?? err?.error?.ErrorMessages ?? [];

    if (Array.isArray(validationList) && validationList.length > 0) {
      return `Validation (${op}): ${validationList.join(' | ')}`;
    }

    const problemTitle = err?.error?.title || err?.error?.Title;
    const problemDetail = err?.error?.detail || err?.error?.Detail;
    if (problemTitle || problemDetail) {
      return `${problemTitle ?? 'Request failed'}${problemDetail ? `: ${problemDetail}` : ''}`;
    }

    const resultErrorDesc =
      err?.error?.error?.description ||
      err?.error?.Error?.Description ||
      err?.error?.message ||
      err?.message;

    return resultErrorDesc || `Operation "${op}" failed`;
  }

  AddOrUpdateLightPattern(payload: TemplatePattern): Observable<ResultV<TemplatePattern>> {
    return this.http
      .post<ResultV<TemplatePattern>>(
        `${environment.baseUrl}/TemplatePattern/AddOrUpdateTemplatePattern`,
        payload
      )
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
          return resp;
        }),
        tap(() => this.toast.success('Success')),
        catchError((err) => {
          const msg = this.extractErrorMessage(err, 'TemplatePattern:AddOrUpdate');
          console.error('[TemplatePattern:AddOrUpdate] failed:', err);
          this.toast.error(msg);
          return of({} as ResultV<TemplatePattern>);
        }),
        shareReplay(1)
      );
  }

  GetAllTemplatePatternByTemplateId(
    Id: number
  ): Observable<ResultV<LightPatternForTemplatePattern>> {
    const query = new HttpParams().set('templateId', String(Id));

    return this.http
      .get<ResultV<LightPatternForTemplatePattern>>(
        `${environment.baseUrl}/TemplatePattern/GetAllByTemplateId`,
        { params: query }
      )
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          const msg = this.extractErrorMessage(err, 'TemplatePattern:GetAllByTemplateId');
          console.error('[TemplatePattern:GetAllByTemplateId] failed:', err);
          this.toast.error(msg);
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
          if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
          return resp;
        }),
        tap(() => this.toast.success('Success')),
        catchError((err) => {
          const msg = this.extractErrorMessage(err, 'TemplatePattern:DeleteTemplate');
          console.error('[TemplatePattern:DeleteTemplate] failed:', err);
          this.toast.error(msg);
          return of({
            isSuccess: false,
            error: { description: 'Delete failed' },
          } as Result);
        })
      );
  }
}
