import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { GetAllSignControlBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBox';
import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { catchError, map, of, shareReplay } from 'rxjs';
import { environment } from '../../Shared/environment/environment';

@Injectable({
  providedIn: 'root'
})
export class ISignBoxControlService { 
   private readonly http = inject(HttpClient);
  private cache = new Map<string, Pagination<GetAllSignControlBox>>();

  getAll(params: SearchParameters) {
    const query = new HttpParams()
      .set('SearchText', params.searchText ?? '')
      .set('SortOrder', params.sortOrder ?? 'Newest')
      .set('Page', params.page?.toString() ?? '1')
      .set('PageSize', params.pageSize?.toString() ?? '10');

    const cacheKey = query.toString();
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey)!);
    }

    return this.http
      .get<Pagination<GetAllSignControlBox>>(`${environment.baseUrl}/SignControlBox/GetAll`, { params: query })
      .pipe(
        map((resp) => {
          if (!resp.isSuccess) {
            throw new Error(resp.error?.description ?? 'Unknown error');
          }
          const mapped: Pagination<GetAllSignControlBox>  =resp ;
          this.cache.set(cacheKey, mapped);
          return mapped;
        }),
        catchError((err) => {
          console.error('Failed to load control boxes', err);
          return of({ 

          } as Pagination<GetAllSignControlBox>);
        }),
        shareReplay(1)
      );
  }
  
}
