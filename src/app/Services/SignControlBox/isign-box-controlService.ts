import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { GetAllSignControlBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBox';
import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import {
  ApplySignBox,
  GetAllSignControlBoxWithLightPattern,
} from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { Result } from '../../Domain/ResultPattern/Result';
import { AddSignBoxWithUpdateLightPattern } from '../../Domain/Entity/SignControlBox/AddSignBoxWithUpdateLightPattern';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { GetAllSignBoxLocation } from '../../Domain/Entity/SignControlBox/GetAllSignBoxLocation';
import { AddSignBoxCommandDto } from '../../Domain/Entity/SignControlBox/AddSignBoxCommandDto';
import { UpdateSignControlBox } from '../../Domain/Entity/SignControlBox/UpdateSignBox';

@Injectable({
  providedIn: 'root',
})
export class ISignBoxControlService {
  private readonly http = inject(HttpClient);

  private readonly noCacheHeaders = new HttpHeaders({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });

  private withNoCache(params?: HttpParams): HttpParams {
    const base = params ?? new HttpParams();
    return base.set('__ts', Date.now().toString());
  }

  getAll(params: SearchParameters): Observable<Pagination<GetAllSignControlBox>> {
    let query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', (params.pageSize ?? 1000).toString());

    query = this.withNoCache(query);

    return this.http
      .get<Pagination<GetAllSignControlBox>>(`${environment.baseUrl}/SignControlBox/GetAll`, {
        params: query,
        headers: this.noCacheHeaders,
      })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) throw new Error(resp.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          console.error('Failed to load control boxes', err);
          return of({} as Pagination<GetAllSignControlBox>);
        })
      );
  }

  getAllWithLightPattern(
    params: SearchParameters
  ): Observable<Pagination<GetAllSignControlBoxWithLightPattern>> {
    let query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', params.pageSize?.toString() ?? '10');

    query = this.withNoCache(query);

    return this.http
      .get<Pagination<GetAllSignControlBoxWithLightPattern>>(
        // ملاحظة: المسار كما هو عندك (GetAllWithLightPatter)
        `${environment.baseUrl}/SignControlBox/GetAllWithLightPatter`,
        { params: query, headers: this.noCacheHeaders }
      )
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) throw new Error(resp.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          console.error('Failed to load control boxes with light pattern', err);
          return of({} as Pagination<GetAllSignControlBoxWithLightPattern>);
        })
      );
  }

  applySignBox(payload: ApplySignBox): Observable<Result> {
    return this.http
      .post<Result>(`${environment.baseUrl}/SignControlBox/ApplySignBox`, payload, {
        headers: this.noCacheHeaders,
      })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) throw new Error(resp.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          console.error('Failed to apply sign box', err);
          return of({} as Result);
        })
      );
  }

  AddWithUpdateLightPattern(payload: AddSignBoxWithUpdateLightPattern): Observable<Result> {
    return this.http
      .post<Result>(`${environment.baseUrl}/SignControlBox/AddWithUpdateLightPattern`, payload, {
        headers: this.noCacheHeaders,
      })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) throw new Error(resp.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          console.error('Failed to add-with-update light pattern', err);
          return of({} as Result);
        })
      );
  }

  AddSignBox(payload: AddSignBoxCommandDto): Observable<Result> {
    const headers = this.noCacheHeaders.set('Accept-Language', 'ar');

    return this.http
      .post<Result>(`${environment.baseUrl}/SignControlBox/Add`, payload, { headers })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) throw new Error(resp.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          if (err?.error?.type === 'Validation') {
            console.log(err.error.errorMessages);
          } else {
            console.log(err?.error?.title ?? 'Request failed');
          }
          return throwError(() => err);
        })
      );
  }

  getAllLocatopn(): Observable<ResultV<GetAllSignBoxLocation>> {
    let query = new HttpParams();
    query = this.withNoCache(query);

    return this.http
      .get<ResultV<GetAllSignBoxLocation>>(
        `${environment.baseUrl}/SignControlBox/GetSignControlBoxLocations`,
        { params: query, headers: this.noCacheHeaders }
      )
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) throw new Error(resp.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          console.error('Failed to load control box locations', err);
          return of({} as ResultV<GetAllSignBoxLocation>);
        })
      );
  }

  Update(payload: UpdateSignControlBox): Observable<Result> {
    return this.http
      .put<Result>(`${environment.baseUrl}/SignControlBox/Update`, payload, {
        headers: this.noCacheHeaders,
      })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) throw new Error(resp.error?.description ?? 'Unknown error');
          return resp;
        }),
        catchError((err) => {
          console.error('Failed to update sign box', err);
          return of({} as Result);
        })
      );
  }

  getById(id: number): Observable<GetAllSignControlBoxWithLightPattern> {
    const params = this.withNoCache();
    return this.http.get<GetAllSignControlBoxWithLightPattern>(
      `${environment.baseUrl}/SignControlBox/GetById/${id}`,
      { params, headers: this.noCacheHeaders }
    );
  }
}
