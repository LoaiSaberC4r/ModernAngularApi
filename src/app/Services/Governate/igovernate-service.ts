import { inject, Injectable } from '@angular/core';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { environment } from '../../Shared/environment/environment';

@Injectable({
  providedIn: 'root',
})
export class IGovernateService {
  private readonly http = inject(HttpClient);

  getAll(params: SearchParameters): Observable<ResultV<GetAllGovernate>> {
    const query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', params.pageSize?.toString() ?? '10');

    return this.http
      .get<ResultV<GetAllGovernate>>(`${environment.baseUrl}/Governor`, { params: query })
      .pipe(
        map((resp) => {
          if (!resp?.isSuccess) {
            throw new Error(resp?.error?.description ?? 'Unknown error');
          }
          return resp as ResultV<GetAllGovernate>;
        }),
        catchError((err) => {
          console.error('[Governor:GetAll] failed:', err);
          return of({} as ResultV<GetAllGovernate>);
        }),
        shareReplay(1)
      );
  }
}
