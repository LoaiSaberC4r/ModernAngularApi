import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GetAllSignControlBoxWithLightPattern } from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { environment } from '../../Shared/environment/environment';
import { Observable } from 'rxjs';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { HttpParams } from '@angular/common/http';
import { Result } from '../../Domain/ResultPattern/Result';

@Injectable({
  providedIn: 'root',
})
export class IeditSignBox {
  private readonly http = inject(HttpClient);

  getAll(params?: any): Observable<Pagination<GetAllSignControlBoxWithLightPattern>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((k) => {
        if (params[k] != null) httpParams = httpParams.set(k, params[k]);
      });
    }
    return this.http.get<Pagination<GetAllSignControlBoxWithLightPattern>>(
      `${environment.baseUrl}/SignControlBox/GetAll`,
      { params: httpParams }
    );
  }

  getById(id: number): Observable<GetAllSignControlBoxWithLightPattern> {
    return this.http.get<GetAllSignControlBoxWithLightPattern>(
      `${environment.baseUrl}/SignControlBox/GetById/${id}`
    );
  }
  

}
