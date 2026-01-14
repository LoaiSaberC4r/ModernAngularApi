import { inject, Injectable } from '@angular/core';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { CreateGovernateCommand } from '../../Domain/Entity/Governate/CreateGovernateCommand';

import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { ToasterService } from '../Toster/toaster-service';

@Injectable({
  providedIn: 'root',
})
export class IGovernateService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToasterService);
  private governates$?: Observable<GetAllGovernate[]>;

  getAll(params: SearchParameters): Observable<GetAllGovernate[]> {
    if (this.governates$) {
      return this.governates$;
    }

    const query = new HttpParams();
    this.governates$ = this.http
      .get<GetAllGovernate[]>(`${environment.baseUrl}/Governate`, { params: query })
      .pipe(
        map((resp) => {
          if (!resp) return [];
          return resp;
        }),
        catchError((err) => {
          const msg = this.extractErrorMessage(err, 'Governor:GetAll');
          console.error('[Governor:GetAll] failed:', err);
          // this.toast.error(msg);
          this.governates$ = undefined; // Reset cache on error
          return of([] as GetAllGovernate[]);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    return this.governates$;
  }

  create(command: CreateGovernateCommand): Observable<any> {
    return this.http.post(`${environment.baseUrl}/Governate`, command).pipe(
      catchError((err) => {
        const msg = this.extractErrorMessage(err, 'Add Governate');
        // this.toast.error(msg);
        return throwError(() => err);
      })
    );
  }

  private extractErrorMessage(err: any, op: string): string {
    // 1. Specific validation format with "errors" array
    if (err?.error?.errors && Array.isArray(err.error.errors)) {
      const firstError = err.error.errors[0];
      if (firstError?.message) return firstError.message;
    }

    // 2. Fallback to standard error parsing
    const validationList: string[] =
      err?.error?.errorMessages ?? err?.error?.errors ?? err?.error?.ErrorMessages ?? [];

    if (Array.isArray(validationList) && validationList.length > 0) {
      return validationList[0]; // Return first error only for toast
    }

    const problemTitle = err?.error?.title || err?.error?.Title;
    const problemDetail = err?.error?.detail || err?.error?.Detail;
    if (problemDetail) return problemDetail;
    if (problemTitle) return problemTitle;

    const resultErrorDesc =
      err?.error?.error?.description ||
      err?.error?.Error?.Description ||
      err?.error?.message ||
      err?.message;

    return resultErrorDesc || `Operation "${op}" failed`;
  }
}
