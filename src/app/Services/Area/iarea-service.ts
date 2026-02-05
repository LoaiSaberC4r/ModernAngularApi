import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { IGovernateService } from '../Governate/igovernate-service';

import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea/GetAllArea';
import { CreateAreaCommand } from '../../Domain/Entity/Area/CreateAreaCommand/CreateAreaCommand';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../Shared/environment/environment';
import { ToasterService } from '../Toster/toaster-service';

@Injectable({
  providedIn: 'root',
})
export class IAreaService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToasterService);

  private readonly governateService = inject(IGovernateService);

  getAll(governateId: number): Observable<GetAllArea[]> {
    if (!governateId) return of([]);

    return this.governateService.getAll({}).pipe(
      map((governates) => {
        console.log('[AreaService] Found governates:', governates.length);
        const governate = governates.find((g) => g.governateId === governateId);
        console.log(
          '[AreaService] Looking for governateId:',
          governateId,
          'Found:',
          governate?.name,
        );
        const list = (governate?.areas ?? []).map((area) => ({
          ...area,
          longitude: area.longitude ?? '',
        }));
        console.log('[AreaService] Returning areas:', list.length);
        return list;
      }),
      catchError((err) => {
        console.error('[Area:GetAll] failed:', err);
        return of([] as GetAllArea[]);
      }),
      shareReplay(1),
    );
  }

  create(command: CreateAreaCommand): Observable<any> {
    return this.http.post(`${environment.baseUrl}/Area`, command).pipe(
      catchError((err) => {
        const msg = this.extractErrorMessage(err, 'Add Area');
        // this.toast.error(msg);
        return throwError(() => err);
      }),
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
      return validationList[0];
    }

    const problemTitle = err?.error?.title || err?.error?.Title;
    const problemDetail = err?.error?.detail || err?.error?.Detail;
    if (problemDetail) return problemDetail;
    if (problemTitle) return problemTitle;

    return err?.message || `Operation "${op}" failed`;
  }
}
