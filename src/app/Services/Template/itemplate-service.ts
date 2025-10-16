import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { environment } from '../../Shared/environment/environment';
import { ToasterService } from '../Toster/toaster-service';

import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { GetAllTemplate } from '../../Domain/Entity/Template/GetAllTemplate';

@Injectable({ providedIn: 'root' })
export class ITemplateService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToasterService);

  private cache = new Map<string, ResultV<GetAllTemplate>>();

  /** استخراج رسالة مفهومة من أخطاء الـ API (Validation/ProblemDetails/Result/Network) */
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

  GetAll(): Observable<ResultV<GetAllTemplate>> {
    const query = new HttpParams();
    const cacheKey = query.toString();

    // رجّع من الكاش لو موجود
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey)!);
    }

    // نداء الشبكة + حفظ بالكاش + مشاركة النتيجة
    return this.http
      .get<ResultV<GetAllTemplate>>(`${environment.baseUrl}/Template/GetAll`, { params: query })
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) {
            throw new Error(resp?.error?.description ?? 'Unknown error');
          }
          this.cache.set(cacheKey, resp);
          return resp;
        }),
        catchError((err) => {
          const msg = this.extractErrorMessage(err, 'Template:GetAll');
          console.error('[Template:GetAll] failed:', err);
          this.toast.error(msg);
          // ارجاع قيمة فاضية آمنة
          return of({} as ResultV<GetAllTemplate>);
        }),
        shareReplay(1)
      );
  }
}
