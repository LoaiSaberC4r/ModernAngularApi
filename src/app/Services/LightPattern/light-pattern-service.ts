import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { GetAllLightPattern } from '../../Domain/Entity/LightPattern/GetAllLightPattern';
import { AddLightPatternCommand } from '../../Domain/Entity/LightPattern/AddLightPattern';
import { Result } from '../../Domain/ResultPattern/Result';
import { GetLightPattern } from '../../Domain/Entity/LightPattern/GetLightPattern';
import { ToasterService } from '../Toster/toaster-service';

@Injectable({ providedIn: 'root' })
export class LightPatternService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToasterService);

  // توحيد هيدر منع الكاش + بصمة زمنية للاستعلامات
  private readonly noCacheHeaders = new HttpHeaders({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });

  private withNoCache(params?: HttpParams): HttpParams {
    const base = params ?? new HttpParams();
    return base.set('__ts', Date.now().toString());
  }

  // كاش بسيط في الذاكرة
  private cacheAll = new Map<string, ResultV<GetAllLightPattern>>();
  private cacheById = new Map<string, ResultV<GetLightPattern>>();

  private invalidateCache(): void {
    this.cacheAll.clear();
    this.cacheById.clear();
  }

  // ===== Error Handling موحّد (نفس نمط الخدمة السابقة) =====
  private handleError<T>(op: string, fallback?: T, rethrow = false) {
    return (err: any): Observable<T> => {
      const msg = this.extractErrorMessage(err, op);
      console.error(`[${op}] failed:`, err);
      this.toast.error(msg);
      if (rethrow) return throwError(() => err);
      return of((fallback as T) ?? ({} as T));
    };
  }

  private extractErrorMessage(err: any, op: string): string {
    const validationList: string[] =
      err?.error?.errorMessages ??
      err?.error?.errors ??
      err?.error?.ErrorMessages ??
      [];

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

  // =========================
  // ======= READ (GET) ======
  // =========================

  getAll(): Observable<ResultV<GetAllLightPattern>> {
    let query = new HttpParams();
    query = this.withNoCache(query);
    const cacheKey = query.toString();

    if (this.cacheAll.has(cacheKey)) {
      return of(this.cacheAll.get(cacheKey)!);
    }

    return this.http
      .get<ResultV<GetAllLightPattern>>(
        `${environment.baseUrl}/LightPattern/GetAll`,
        { params: query, headers: this.noCacheHeaders }
      )
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
          this.cacheAll.set(cacheKey, resp);
          return resp;
        }),
        catchError(this.handleError<ResultV<GetAllLightPattern>>('LightPattern:GetAll', {} as any)),
        shareReplay(1)
      );
  }

  getById(id: number): Observable<ResultV<GetLightPattern>> {
    let query = new HttpParams().set('id', String(id));
    query = this.withNoCache(query);
    const cacheKey = query.toString();

    if (this.cacheById.has(cacheKey)) {
      return of(this.cacheById.get(cacheKey)!);
    }

    return this.http
      .get<ResultV<GetLightPattern>>(
        `${environment.baseUrl}/LightPattern/GetById`,
        { params: query, headers: this.noCacheHeaders }
      )
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
          this.cacheById.set(cacheKey, resp);
          return resp;
        }),
        catchError(this.handleError<ResultV<GetLightPattern>>('LightPattern:GetById', {} as any)),
        shareReplay(1)
      );
  }

  // =========================
  // ====== WRITE (CUD) ======
  // ===== Success Toast =====
  // =========================

  add(command: AddLightPatternCommand): Observable<Result> {
    return this.http
      .post<Result>(`${environment.baseUrl}/LightPattern/Add`, command, {
        headers: this.noCacheHeaders
      })
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
          return resp;
        }),
        tap(() => {
          this.invalidateCache();
          this.toast.success('Success'); // نفس النمط
        }),
        catchError(this.handleError<Result>('LightPattern:Add', {} as any))
      );
  }

  delete(lightPatternId: number): Observable<Result> {
    let params = new HttpParams().set('LightPatternId', String(lightPatternId));
    params = this.withNoCache(params);

    return this.http
      .delete<Result>(`${environment.baseUrl}/LightPattern/Delete`, {
        params,
        headers: this.noCacheHeaders
      })
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
          return resp;
        }),
        tap(() => {
          this.invalidateCache();
          this.toast.success('Success'); // نفس النمط
        }),
        catchError(this.handleError<Result>('LightPattern:Delete', {} as any))
      );
  }
}
