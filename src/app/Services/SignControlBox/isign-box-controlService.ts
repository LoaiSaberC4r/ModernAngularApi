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
import {
  AddSignBoxCommandDto,
  AddDirectionsDto,
} from '../../Domain/Entity/SignControlBox/AddSignBoxCommandDto';
import { UpdateSignControlBox } from '../../Domain/Entity/SignControlBox/UpdateSignBox';

import { PaginateValue } from '../../Domain/ResultPattern/PaginateValue';

@Injectable({ providedIn: 'root' })
export class ISignBoxControlService {
  private readonly http = inject(HttpClient);

  // ===== Reads =====

  getAll(params: SearchParameters): Observable<PaginateValue<GetAllSignControlBox>> {
    const query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', (params.pageSize ?? 1000).toString());

    return this.http.get<PaginateValue<GetAllSignControlBox>>(
      `${environment.baseUrl}/SignControlBox/GetAll`,
      { params: query },
    );
  }

  getAllWithLightPattern(
    params: SearchParameters,
  ): Observable<PaginateValue<GetAllSignControlBoxWithLightPattern>> {
    const query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', params.pageSize?.toString() ?? '10');

    return this.http.get<PaginateValue<GetAllSignControlBoxWithLightPattern>>(
      `${environment.baseUrl}/SignControlBox/GetAllWithLightPatter`,
      { params: query },
    );
  }

  getAllLocations(): Observable<GetAllSignBoxLocation[]> {
    return this.http.get<GetAllSignBoxLocation[]>(
      `${environment.baseUrl}/SignControlBox/GetSignControlBoxLocations`,
    );
  }

  getById(id: number): Observable<GetAllSignControlBoxWithLightPattern> {
    return this.http.get<GetAllSignControlBoxWithLightPattern>(
      `${environment.baseUrl}/SignControlBox/GetById/${id}`,
    );
  }

  // ===== Writes =====

  applySignBox(payload: ApplySignBox): Observable<Result> {
    return this.http.post<Result>(`${environment.baseUrl}/SignControlBox/ApplySignBox`, payload);
  }

  AddWithUpdateLightPattern(payload: AddSignBoxWithUpdateLightPattern): Observable<Result> {
    return this.http.post<Result>(
      `${environment.baseUrl}/SignControlBox/AddWithUpdateLightPattern`,
      payload,
    );
  }

  AddSignBox(payload: AddSignBoxCommandDto): Observable<Result> {
    return this.http.post<Result>(`${environment.baseUrl}/SignControlBox/Add`, payload);
  }

  AddDirections(payload: AddDirectionsDto): Observable<Result> {
    return this.http.post<Result>(`${environment.baseUrl}/SignControlBox/AddDirections`, payload);
  }

  Update(payload: UpdateSignControlBox): Observable<Result> {
    return this.http.put<Result>(`${environment.baseUrl}/SignControlBox/Update`, payload);
  }

  Delete(signBoxId: number): Observable<Result> {
    const params = new HttpParams().set('signBoxId', signBoxId.toString());
    return this.http.delete<Result>(`${environment.baseUrl}/SignControlBox`, { params });
  }

  Restart(signBoxId: number): Observable<Result> {
    return this.http.post<Result>(`${environment.baseUrl}/SignControlBox/Restart`, { signBoxId });
  }
}
