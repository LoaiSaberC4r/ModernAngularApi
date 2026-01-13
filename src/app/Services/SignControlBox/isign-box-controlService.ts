import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { GetAllSignControlBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBox';
import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { catchError, map, Observable, of, throwError, tap } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import {
  ApplySignBox,
  GetAllSignControlBoxWithLightPattern,
} from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { Result } from '../../Domain/ResultPattern/Result';
import { AddSignBoxWithUpdateLightPattern } from '../../Domain/Entity/SignControlBox/AddSignBoxWithUpdateLightPattern';

import { GetAllSignBoxLocation } from '../../Domain/Entity/SignControlBox/GetAllSignBoxLocation';
import { AddSignBoxCommandDto } from '../../Domain/Entity/SignControlBox/AddSignBoxCommandDto';
import { UpdateSignControlBox } from '../../Domain/Entity/SignControlBox/UpdateSignBox';

import { ToasterService } from '../Toster/toaster-service';
import { PaginateValue } from '../../Domain/ResultPattern/PaginateValue';

@Injectable({ providedIn: 'root' })
export class ISignBoxControlService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToasterService);

  // ===== Error Utilities =====
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

  // ===== Reads =====

  getAll(params: SearchParameters): Observable<PaginateValue<GetAllSignControlBox>> {
    const query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', (params.pageSize ?? 1000).toString());

    return this.http
      .get<PaginateValue<GetAllSignControlBox>>(`${environment.baseUrl}/SignControlBox/GetAll`, {
        params: query,
      })
      .pipe(
        catchError(
          this.handleError<PaginateValue<GetAllSignControlBox>>('GetAll', {
            data: [],
            pageSize: 0,
            totalPages: 0,
            currentPage: 0,
            hasNextPage: false,
            hasPreviousPage: false,
            totalItems: 0,
          })
        )
      );
  }

  getAllWithLightPattern(
    params: SearchParameters
  ): Observable<PaginateValue<GetAllSignControlBoxWithLightPattern>> {
    const query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', params.pageSize?.toString() ?? '10');

    return this.http
      .get<PaginateValue<GetAllSignControlBoxWithLightPattern>>(
        `${environment.baseUrl}/SignControlBox/GetAllWithLightPatter`,
        { params: query }
      )
      .pipe(
        catchError(
          this.handleError<PaginateValue<GetAllSignControlBoxWithLightPattern>>(
            'GetAllWithLightPattern',
            {
              data: [],
              pageSize: 0,
              totalPages: 0,
              currentPage: 0,
              hasNextPage: false,
              hasPreviousPage: false,
              totalItems: 0,
            }
          )
        )
      );
  }

  getAllLocations(): Observable<GetAllSignBoxLocation[]> {
    return this.http
      .get<GetAllSignBoxLocation[]>(
        `${environment.baseUrl}/SignControlBox/GetSignControlBoxLocations`
      )
      .pipe(
        map((resp) => resp || []),
        catchError(this.handleError<GetAllSignBoxLocation[]>('GetSignControlBoxLocations', []))
      );
  }

  getById(id: number): Observable<GetAllSignControlBoxWithLightPattern> {
    return this.http
      .get<GetAllSignControlBoxWithLightPattern>(
        `${environment.baseUrl}/SignControlBox/GetById/${id}`
      )
      .pipe(
        catchError(this.handleError<GetAllSignControlBoxWithLightPattern>('GetById', {} as any))
      );
  }

  // ===== Writes "Success") =====

  applySignBox(payload: ApplySignBox): Observable<Result> {
    return this.http
      .post<Result>(`${environment.baseUrl}/SignControlBox/ApplySignBox`, payload)
      .pipe(
        map((resp) => {
          if (!(resp as any)?.isSuccess)
            throw new Error((resp as any)?.error?.description ?? 'Unknown error');
          return resp;
        }),
        tap(() => this.toast.success('Success')),
        catchError(this.handleError<Result>('ApplySignBox', {} as any))
      );
  }

  AddWithUpdateLightPattern(payload: AddSignBoxWithUpdateLightPattern): Observable<Result> {
    return this.http
      .post<Result>(`${environment.baseUrl}/SignControlBox/AddWithUpdateLightPattern`, payload)
      .pipe(
        map((resp) => {
          if (!(resp as any)?.isSuccess)
            throw new Error((resp as any)?.error?.description ?? 'Unknown error');
          return resp;
        }),
        tap(() => this.toast.success('Success')),
        catchError(this.handleError<Result>('AddWithUpdateLightPattern', {} as any))
      );
  }

  AddSignBox(payload: AddSignBoxCommandDto): Observable<Result> {
    return this.http.post<Result>(`${environment.baseUrl}/SignControlBox/Add`, payload).pipe(
      map((resp) => {
        if (!(resp as any)?.isSuccess)
          throw new Error((resp as any)?.error?.description ?? 'Unknown error');
        return resp;
      }),
      tap(() => this.toast.success('Success')),
      catchError(this.handleError<Result>('AddSignBox', {} as any, true))
    );
  }

  Update(payload: UpdateSignControlBox): Observable<Result> {
    return this.http.put<Result>(`${environment.baseUrl}/SignControlBox/Update`, payload).pipe(
      map((resp) => {
        if (!(resp as any)?.isSuccess)
          throw new Error((resp as any)?.error?.description ?? 'Unknown error');
        return resp;
      }),
      tap(() => this.toast.success('Success')),
      catchError(this.handleError<Result>('Update', {} as any))
    );
  }

  Delete(signBoxId: number): Observable<Result> {
    const params = new HttpParams().set('signBoxId', signBoxId.toString());
    return this.http.delete<Result>(`${environment.baseUrl}/SignControlBox`, { params }).pipe(
      map((resp) => {
        if (!(resp as any)?.isSuccess)
          throw new Error((resp as any)?.error?.description ?? 'Unknown error');
        return resp;
      }),
      tap(() => this.toast.success('Deleted Successfully')),
      catchError(this.handleError<Result>('Delete', {} as any))
    );
  }

  Restart(signBoxId: number): Observable<Result> {
    return this.http
      .post<Result>(`${environment.baseUrl}/SignControlBox/Restart`, { signBoxId })
      .pipe(
        map((resp) => {
          if (!(resp as any)?.isSuccess)
            throw new Error((resp as any)?.error?.description ?? 'Unknown error');
          return resp;
        }),
        tap(() => this.toast.success('Restart command sent successfully')),
        catchError(this.handleError<Result>('Restart', {} as any))
      );
  }
}
