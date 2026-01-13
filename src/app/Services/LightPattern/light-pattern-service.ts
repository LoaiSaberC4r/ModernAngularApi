import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../Shared/environment/environment';

import { GetAllLightPattern } from '../../Domain/Entity/LightPattern/GetAllLightPattern';
import { AddLightPatternCommand } from '../../Domain/Entity/LightPattern/AddLightPattern';
import { Result } from '../../Domain/ResultPattern/Result';
import { GetLightPattern } from '../../Domain/Entity/LightPattern/GetLightPattern';
import { ToasterService } from '../Toster/toaster-service';

@Injectable({ providedIn: 'root' })
export class LightPatternService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToasterService);

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

  getAll(): Observable<GetAllLightPattern[]> {
    const params = new HttpParams();

    return this.http
      .get<GetAllLightPattern[]>(`${environment.baseUrl}/LightPattern/GetAll`, { params })
      .pipe(
        map((resp) => {
          if (!resp) return [];
          return resp.map((p: any) => this.normalizePattern(p));
        }),
        catchError(this.handleError<GetAllLightPattern[]>('LightPattern:GetAll', [])),
        shareReplay(1)
      );
  }

  getById(id: number): Observable<GetLightPattern> {
    const params = new HttpParams().set('id', String(id));

    return this.http
      .get<GetLightPattern>(`${environment.baseUrl}/LightPattern/GetById`, { params })
      .pipe(
        map((resp) => this.normalizePattern(resp)),
        catchError(this.handleError<GetLightPattern>('LightPattern:GetById', {} as any)),
        shareReplay(1)
      );
  }

  private normalizePattern(p: any): any {
    if (!p) return p;
    const overTime = p.overLapTime ?? p.OverLapTime ?? p.OverlapTime ?? 0;
    const blinkInt = p.blinkInterval ?? p.BlinkInterval ?? 500;
    return {
      ...p,
      id: p.id ?? p.Id,
      name: p.name ?? p.Name,
      red: p.red ?? p.Red ?? p.redTime ?? p.RedTime ?? 0,
      yellow: p.yellow ?? p.Yellow ?? p.yellowTime ?? p.YellowTime ?? 0,
      green: p.green ?? p.Green ?? p.greenTime ?? p.GreenTime ?? 0,
      blinkInterval: blinkInt,
      blinkGreen: blinkInt > 0 && !!(p.blinkGreen ?? p.BlinkGreen),
      blinkYellow: blinkInt > 0 && !!(p.blinkYellow ?? p.BlinkYellow),
      blinkRed: blinkInt > 0 && !!(p.blinkRed ?? p.BlinkRed),
      mergeWith:
        p.mergeWith ?? p.MergeWith ?? (p.isMerged || p.IsMerged ? p.mergedWith || p.MergedWith : 0),
      isOverLap: p.isOverLap ?? p.IsOverLap ?? p.IsOverlap ?? overTime > 0,
      overLapTime: overTime,
    };
  }

  add(command: AddLightPatternCommand): Observable<Result> {
    return this.http.post<Result>(`${environment.baseUrl}/LightPattern/Add`, command).pipe(
      map((resp) => {
        if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
        return resp;
      }),
      tap(() => this.toast.success('Success')),
      catchError(this.handleError<Result>('LightPattern:Add', {} as any))
    );
  }

  delete(lightPatternId: number): Observable<Result> {
    const params = new HttpParams().set('LightPatternId', String(lightPatternId));

    return this.http.delete<Result>(`${environment.baseUrl}/LightPattern/Delete`, { params }).pipe(
      map((resp) => {
        if (!resp?.isSuccess) throw new Error(resp?.error?.description ?? 'Unknown error');
        return resp;
      }),
      tap(() => this.toast.success('Success')),
      catchError(this.handleError<Result>('LightPattern:Delete', {} as any))
    );
  }
}
